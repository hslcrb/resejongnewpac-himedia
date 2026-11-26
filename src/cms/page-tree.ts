// [페이지 DOM 트리 계약 / Page DOM tree contract]
// 위지위그 캔버스가 캡처한 실제 페이지 구조를 MCP·API가 브라우저 없이 조회할 수 있도록 정규화합니다.
// 선택자(selector)는 visual-document.ts의 안전한 선택자 형식만 허용합니다.
import { isSafeVisualSelector, normalizeVisualPath, sanitizeVisualStyle } from "./visual-document.ts";
import { sha256Hex } from "./wysiwyg.ts";

export const PAGE_TREE_SCHEMA_VERSION = 1 as const;
const MAX_NODES = 900;
const MAX_DEPTH = 8;
const MAX_TEXT = 240;

export type VisualNodeRole =
    | "section"
    | "container"
    | "heading"
    | "text"
    | "button"
    | "link"
    | "image"
    | "list"
    | "item"
    | "unknown";

export type CmsPageViewport = "desktop" | "tablet" | "mobile";

export interface CmsPageTreeNode {
    selector: string;
    tag: string;
    role: VisualNodeRole;
    label: string;
    text?: string;
    attributes?: { href?: string; src?: string; alt?: string; id?: string };
    styles?: Record<string, string>;
    hidden?: boolean;
    added?: boolean;
    children: CmsPageTreeNode[];
}

export interface CmsPageSnapshot {
    schemaVersion: 1;
    path: string;
    url: string;
    viewport: CmsPageViewport;
    capturedAt: string;
    nodeCount: number;
    nodes: CmsPageTreeNode[];
    checksum: string;
}

// 캔버스가 수집하는 계산 스타일은 인스펙터·에이전트가 참고하는 최소 집합만 보존합니다.
export const PAGE_TREE_STYLE_KEYS = [
    "display",
    "flex-direction",
    "gap",
    "padding",
    "font-size",
    "font-weight",
    "color",
    "background-color",
    "width",
    "height",
    "border-radius",
] as const;

const TAG_ROLES: Record<string, VisualNodeRole> = {
    header: "section",
    footer: "section",
    main: "section",
    section: "section",
    article: "container",
    nav: "container",
    div: "container",
    aside: "container",
    figure: "container",
    h1: "heading",
    h2: "heading",
    h3: "heading",
    h4: "heading",
    p: "text",
    span: "text",
    strong: "text",
    em: "text",
    small: "text",
    figcaption: "text",
    button: "button",
    a: "link",
    img: "image",
    ul: "list",
    ol: "list",
    li: "item",
};

export function roleForTag(tag: string): VisualNodeRole {
    return TAG_ROLES[tag.toLowerCase()] || "unknown";
}

function cleanText(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const text = value.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
    return text || undefined;
}

function sanitizeStyles(input: unknown): Record<string, string> | undefined {
    if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
    const styles: Record<string, string> = {};
    for (const key of PAGE_TREE_STYLE_KEYS) {
        const raw = (input as Record<string, unknown>)[key];
        if (typeof raw !== "string") continue;
        const safe = sanitizeVisualStyle(key, raw);
        if (safe !== null) styles[key] = safe;
    }
    return Object.keys(styles).length ? styles : undefined;
}

function sanitizeAttributes(input: unknown): CmsPageTreeNode["attributes"] {
    if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
    const source = input as Record<string, unknown>;
    const attributes: NonNullable<CmsPageTreeNode["attributes"]> = {};
    if (typeof source.href === "string" && source.href.length <= 2048) attributes.href = source.href;
    if (typeof source.src === "string" && source.src.length <= 2048) attributes.src = source.src;
    if (typeof source.alt === "string") attributes.alt = source.alt.slice(0, 400);
    if (typeof source.id === "string" && /^[a-z0-9_-]{1,80}$/i.test(source.id)) attributes.id = source.id;
    return Object.keys(attributes).length ? attributes : undefined;
}

function sanitizeNode(input: unknown, depth: number, budget: { left: number }): CmsPageTreeNode | null {
    if (!input || typeof input !== "object" || budget.left <= 0) return null;
    const raw = input as Record<string, unknown>;
    if (!isSafeVisualSelector(raw.selector)) return null;
    const tag = typeof raw.tag === "string" ? raw.tag.toLowerCase() : "";
    if (!/^[a-z][a-z0-9-]{0,20}$/.test(tag)) return null;
    budget.left -= 1;
    const label = typeof raw.label === "string" && raw.label.trim()
        ? raw.label.trim().slice(0, 120)
        : tag + (cleanText(raw.text) ? " · " + cleanText(raw.text)!.slice(0, 30) : "");
    const node: CmsPageTreeNode = {
        selector: raw.selector,
        tag,
        role: roleForTag(tag),
        label,
        children: [],
    };
    const text = cleanText(raw.text);
    if (text) node.text = text;
    const attributes = sanitizeAttributes(raw.attributes);
    if (attributes) node.attributes = attributes;
    const styles = sanitizeStyles(raw.styles);
    if (styles) node.styles = styles;
    if (raw.hidden === true) node.hidden = true;
    if (raw.added === true) node.added = true;
    if (depth < MAX_DEPTH && Array.isArray(raw.children)) {
        for (const child of raw.children) {
            const next = sanitizeNode(child, depth + 1, budget);
            if (next) node.children.push(next);
        }
    }
    return node;
}

export function flattenPageTree(nodes: readonly CmsPageTreeNode[]): CmsPageTreeNode[] {
    const flat: CmsPageTreeNode[] = [];
    const walk = (list: readonly CmsPageTreeNode[]) => {
        for (const node of list) {
            flat.push(node);
            walk(node.children);
        }
    };
    walk(nodes);
    return flat;
}

export function findPageNode(
    nodes: readonly CmsPageTreeNode[],
    selector: string,
): { node: CmsPageTreeNode; depth: number; parent: CmsPageTreeNode | null } | null {
    if (!isSafeVisualSelector(selector)) return null;
    let found: { node: CmsPageTreeNode; depth: number; parent: CmsPageTreeNode | null } | null = null;
    const walk = (list: readonly CmsPageTreeNode[], depth: number, parent: CmsPageTreeNode | null) => {
        for (const node of list) {
            if (found) return;
            if (node.selector === selector) {
                found = { node, depth, parent };
                return;
            }
            walk(node.children, depth + 1, node);
        }
    };
    walk(nodes, 0, null);
    return found;
}

export function pageTreeChecksum(input: {
    path: string;
    viewport: CmsPageViewport;
    nodes: readonly CmsPageTreeNode[];
}): string {
    return sha256Hex(JSON.stringify({ path: input.path, viewport: input.viewport, nodes: input.nodes }));
}

export function sanitizePageSnapshot(input: unknown, expectedPath: string): CmsPageSnapshot {
    const path = normalizeVisualPath(expectedPath);
    if (!path) throw new Error("허용되지 않은 페이지 경로입니다.");
    const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    if (raw.schemaVersion != null && raw.schemaVersion !== PAGE_TREE_SCHEMA_VERSION) {
        throw new Error("지원하지 않는 페이지 트리 버전입니다.");
    }
    if (raw.path != null && normalizeVisualPath(String(raw.path)) !== path) {
        throw new Error("다른 페이지의 트리 스냅샷은 저장할 수 없습니다.");
    }
    const viewport: CmsPageViewport = raw.viewport === "tablet" || raw.viewport === "mobile" ? raw.viewport : "desktop";
    const budget = { left: MAX_NODES };
    const nodes: CmsPageTreeNode[] = [];
    for (const item of Array.isArray(raw.nodes) ? raw.nodes : []) {
        const node = sanitizeNode(item, 0, budget);
        if (node) nodes.push(node);
        if (budget.left <= 0) break;
    }
    if (!nodes.length) throw new Error("페이지 트리에 유효한 요소가 없습니다.");
    return {
        schemaVersion: PAGE_TREE_SCHEMA_VERSION,
        path,
        url: typeof raw.url === "string" && raw.url.length <= 500 ? raw.url : (path === "/" ? "/" : path + "/"),
        viewport,
        capturedAt: typeof raw.capturedAt === "string" ? raw.capturedAt.slice(0, 40) : new Date().toISOString(),
        nodeCount: flattenPageTree(nodes).length,
        nodes,
        checksum: pageTreeChecksum({ path, viewport, nodes }),
    };
}

// MCP 텍스트 응답: 에이전트가 읽기 쉬운 들여쓰기 개요로 변환합니다.
export function pageTreeToOutline(
    nodes: readonly CmsPageTreeNode[],
    options: { maxDepth?: number; maxNodes?: number } = {},
): string {
    const maxDepth = Math.min(Math.max(options.maxDepth ?? 4, 1), MAX_DEPTH);
    const maxNodes = Math.min(Math.max(options.maxNodes ?? 120, 1), MAX_NODES);
    const lines: string[] = [];
    const walk = (list: readonly CmsPageTreeNode[], depth: number) => {
        for (const node of list) {
            if (lines.length >= maxNodes) return;
            const pad = "  ".repeat(depth);
            const text = node.text ? ` "${node.text.slice(0, 60)}"` : "";
            const attrs = node.attributes
                ? Object.entries(node.attributes).map(([key, value]) => `${key}=${String(value).slice(0, 48)}`).join(" ")
                : "";
            lines.push(`${pad}${node.tag} [${node.role}]${text}${attrs ? " (" + attrs + ")" : ""} · ${node.selector}`);
            if (depth + 1 < maxDepth) walk(node.children, depth + 1);
        }
    };
    walk(nodes, 0);
    return lines.join("\n");
}
