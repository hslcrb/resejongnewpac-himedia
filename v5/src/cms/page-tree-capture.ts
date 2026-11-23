// [브라우저 캔버스 DOM → 페이지 트리 캡처 / Browser canvas DOM to page tree capture]
// 편집기 iframe의 동일 출처 DOM에서만 동작합니다. 공개 페이지에는 어떤 스크립트도 주입하지 않습니다.
import {
    PAGE_TREE_STYLE_KEYS,
    pageTreeChecksum,
    roleForTag,
} from "./page-tree.ts";
import type { CmsPageSnapshot, CmsPageTreeNode, CmsPageViewport } from "./page-tree.ts";
import { normalizeVisualPath } from "./visual-document.ts";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "META", "LINK", "TEMPLATE"]);
const MAX_NODES = 900;
const MAX_DEPTH = 8;
const MAX_TEXT = 160;

// 캔버스·MCP·초안이 같은 선택자 체계를 사용하도록 한 곳에서만 생성합니다.
export function visualSelectorFor(element: Element): string {
    const added = element.closest("[data-cms-added]")?.getAttribute("data-cms-added");
    if (added) {
        const segments: string[] = [];
        let node: Element = element;
        while (node && node.getAttribute("data-cms-added") !== added) {
            const parent: Element | null = node.parentElement;
            if (!parent) break;
            const tag = node.localName;
            let index = 1;
            let sibling: Element | null = node.previousElementSibling;
            while (sibling) {
                // nth-child는 태그와 무관하게 센다. / The index includes siblings of every tag.
                index += 1;
                sibling = sibling.previousElementSibling;
            }
            segments.push(tag + ":nth-child(" + index + ")");
            node = parent;
        }
        return ['[data-cms-added="' + added + '"]', ...segments.reverse()].join(" > ");
    }
    const segments: string[] = [];
    let current: Element | null = element;
    while (current && current.localName !== "body") {
        const tag = current.localName;
        let nth = 1;
        let sibling: Element | null = current.previousElementSibling;
        while (sibling) {
            if (sibling.localName === tag) nth += 1;
            sibling = sibling.previousElementSibling;
        }
        segments.unshift(tag + ":nth-of-type(" + nth + ")");
        current = current.parentElement;
    }
    return "body" + (segments.length ? " > " + segments.join(" > ") : "");
}

function describeElement(element: Element): string {
    const text = (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
    const id = element.getAttribute("id");
    return element.tagName.toLowerCase() + (id ? "#" + id : "") + (text ? " · " + text : "");
}

function captureStyles(element: Element, view: Window): Record<string, string> | undefined {
    const computed = view.getComputedStyle(element);
    const styles: Record<string, string> = {};
    for (const key of PAGE_TREE_STYLE_KEYS) {
        const value = computed.getPropertyValue(key).trim();
        if (value) styles[key] = value.slice(0, 60);
    }
    return Object.keys(styles).length ? styles : undefined;
}

function captureNode(
    element: Element,
    depth: number,
    view: Window,
    budget: { left: number },
): CmsPageTreeNode | null {
    if (budget.left <= 0 || SKIP_TAGS.has(element.tagName)) return null;
    const role = roleForTag(element.localName);
    const isAdded = element.hasAttribute("data-cms-added");
    if (role === "unknown" && !isAdded) return null;
    budget.left -= 1;
    const node: CmsPageTreeNode = {
        selector: visualSelectorFor(element),
        tag: element.localName.toLowerCase(),
        role,
        label: describeElement(element),
        children: [],
    };
    const text = (element.children.length === 0 ? element.textContent || "" : "").replace(/\s+/g, " ").trim();
    if (text) node.text = text.slice(0, MAX_TEXT);
    if (element.tagName === "A" || element.tagName === "BUTTON") {
        const href = element.getAttribute("href");
        if (href) node.attributes = { ...(node.attributes || {}), href: href.slice(0, 300) };
    }
    if (element.tagName === "IMG") {
        node.attributes = {
            src: (element.getAttribute("src") || "").slice(0, 300),
            alt: (element.getAttribute("alt") || "").slice(0, 200),
        };
    }
    const id = element.getAttribute("id");
    if (id) node.attributes = { ...(node.attributes || {}), id: id.slice(0, 80) };
    const styles = captureStyles(element, view);
    if (styles) node.styles = styles;
    if (element.hasAttribute("hidden")) node.hidden = true;
    if (isAdded) node.added = true;
    if (depth + 1 < MAX_DEPTH) {
        for (const child of Array.from(element.children)) {
            const next = captureNode(child, depth + 1, view, budget);
            if (next) node.children.push(next);
            if (budget.left <= 0) break;
        }
    }
    return node;
}

export function capturePageTree(input: {
    document: Document;
    path: string;
    viewport: CmsPageViewport;
    url?: string;
    capturedAt?: string;
}): CmsPageSnapshot {
    const body = input.document.body;
    if (!body) throw new Error("캔버스 문서에 body가 없습니다.");
    const view = input.document.defaultView;
    if (!view) throw new Error("캔버스 창(window)을 읽을 수 없습니다.");
    const budget = { left: MAX_NODES };
    const nodes: CmsPageTreeNode[] = [];
    for (const child of Array.from(body.children)) {
        const node = captureNode(child, 0, view, budget);
        if (node) nodes.push(node);
        if (budget.left <= 0) break;
    }
    if (!nodes.length) throw new Error("캡처할 수 있는 페이지 요소가 없습니다.");
    const path = normalizeVisualPath(input.path) || "/";
    return {
        schemaVersion: 1,
        path,
        url: (input.url || "/v5" + (path === "/" ? "/" : path + "/")).slice(0, 300),
        viewport: input.viewport,
        capturedAt: input.capturedAt || new Date().toISOString(),
        nodeCount: countNodes(nodes),
        nodes,
        checksum: pageTreeChecksum({ path, viewport: input.viewport, nodes }),
    };
}

function countNodes(nodes: readonly CmsPageTreeNode[]): number {
    let total = 0;
    for (const node of nodes) total += 1 + countNodes(node.children);
    return total;
}
