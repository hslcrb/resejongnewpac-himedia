// [피그마형 비주얼 문서 계약 v2 / Figma-like visual document contract v2]
// 실제 React 컴포넌트는 변경하지 않고, 승인 전 편집 결과를 데이터 전용 초안(패치 + 삽입 요소)으로 보존합니다.
// v1 문서(schemaVersion 1)는 그대로 읽을 수 있으며, 저장 시 v2로 정규화됩니다.
import { sha256Hex } from "./wysiwyg.ts";

export const VISUAL_SCHEMA_VERSION = 2 as const;
export const VISUAL_HISTORY_LIMIT = 50;

// 스타일 필드 정의: 인스펙터·MCP 도구가 같은 화이트리스트를 공유합니다.
export const VISUAL_STYLE_FIELDS = [
    { key: "display", label: "배치 방식", kind: "display" },
    { key: "flex-direction", label: "플렉스 방향", kind: "direction" },
    { key: "flex-wrap", label: "줄바꿈", kind: "wrap" },
    { key: "justify-content", label: "가로 정렬", kind: "justify" },
    { key: "align-items", label: "세로 정렬", kind: "alignItems" },
    { key: "grid-template-columns", label: "그리드 열", kind: "grid" },
    { key: "gap", label: "간격", kind: "length" },
    { key: "padding", label: "안쪽 여백", kind: "length" },
    { key: "padding-top", label: "안쪽 위", kind: "length" },
    { key: "padding-right", label: "안쪽 오른쪽", kind: "length" },
    { key: "padding-bottom", label: "안쪽 아래", kind: "length" },
    { key: "padding-left", label: "안쪽 왼쪽", kind: "length" },
    { key: "margin", label: "바깥 여백", kind: "length" },
    { key: "margin-top", label: "바깥 위", kind: "length" },
    { key: "margin-right", label: "바깥 오른쪽", kind: "length" },
    { key: "margin-bottom", label: "바깥 아래", kind: "length" },
    { key: "margin-left", label: "바깥 왼쪽", kind: "length" },
    { key: "font-size", label: "글자 크기", kind: "length" },
    { key: "font-weight", label: "글자 굵기", kind: "weight" },
    { key: "line-height", label: "행간", kind: "length" },
    { key: "letter-spacing", label: "자간", kind: "length" },
    { key: "text-align", label: "텍스트 정렬", kind: "align" },
    { key: "color", label: "글자 색상", kind: "color" },
    { key: "width", label: "너비", kind: "length" },
    { key: "height", label: "높이", kind: "length" },
    { key: "min-width", label: "최소 너비", kind: "length" },
    { key: "max-width", label: "최대 너비", kind: "length" },
    { key: "min-height", label: "최소 높이", kind: "length" },
    { key: "max-height", label: "최대 높이", kind: "length" },
    { key: "background-color", label: "배경 색상", kind: "color" },
    { key: "border-width", label: "테두리 두께", kind: "length" },
    { key: "border-color", label: "테두리 색상", kind: "color" },
    { key: "border-radius", label: "모서리 곡률", kind: "length" },
    { key: "opacity", label: "불투명도", kind: "number" },
    { key: "translate", label: "위치 이동", kind: "translate" },
    { key: "rotate", label: "회전", kind: "rotate" },
    { key: "position", label: "배치 기준", kind: "position" },
    { key: "overflow", label: "넘침 처리", kind: "overflow" },
] as const;
export type VisualStyleKey = (typeof VISUAL_STYLE_FIELDS)[number]["key"];
export type VisualStyleMap = Partial<Record<VisualStyleKey, string>>;

// 인스펙터 섹션(피그마 우측 패널 구조) - JSX에서 그대로 순회해 렌더링합니다.
export const VISUAL_STYLE_GROUPS = [
    {
        id: "layout",
        label: "Layout · 배치",
        keys: ["display", "flex-direction", "flex-wrap", "justify-content", "align-items", "grid-template-columns"],
    },
    {
        id: "spacing",
        label: "Spacing · 간격",
        keys: [
            "gap",
            "padding",
            "padding-top",
            "padding-right",
            "padding-bottom",
            "padding-left",
            "margin",
            "margin-top",
            "margin-right",
            "margin-bottom",
            "margin-left",
        ],
    },
    {
        id: "typography",
        label: "Typography · 글자",
        keys: ["font-size", "font-weight", "line-height", "letter-spacing", "text-align", "color"],
    },
    {
        id: "dimensions",
        label: "Dimensions · 크기",
        keys: ["width", "height", "min-width", "max-width", "min-height", "max-height"],
    },
    {
        id: "appearance",
        label: "Appearance · 표면",
        keys: ["background-color", "border-width", "border-color", "border-radius", "opacity", "translate", "rotate", "position", "overflow"],
    },
] as const satisfies readonly { id: string; label: string; keys: readonly VisualStyleKey[] }[];

export interface VisualElementPatch {
    selector: string;
    text?: string;
    src?: string;
    alt?: string;
    href?: string;
    hidden?: boolean;
    style?: VisualStyleMap;
}

export type VisualAddTag =
    | "h1" | "h2" | "h3" | "p" | "span" | "div" | "section" | "article"
    | "button" | "a" | "img" | "ul" | "li";

export type VisualPresetId = "heading" | "text" | "button" | "link" | "image" | "container" | "card" | "banner";

export interface VisualPresetDefinition {
    id: VisualPresetId;
    label: string;
    description: string;
    tag: VisualAddTag;
    text: string;
    style?: VisualStyleMap;
    href?: string;
    src?: string;
    alt?: string;
    children?: readonly { tag: VisualAddTag; text: string; href?: string }[];
}

// 좌측 컴포넌트 팔레트: 드래그하거나 눌러 캔버스에 삽입합니다. 색상은 중앙 CSS 변수만 사용합니다.
export const VISUAL_PRESETS: readonly VisualPresetDefinition[] = Object.freeze([
    { id: "heading", label: "제목", description: "페이지 제목(h2)", tag: "h2", text: "새로운 제목", style: { "font-size": "var(--text-heading)" } },
    { id: "text", label: "텍스트", description: "본문 문단", tag: "p", text: "새로운 문단을 입력하세요." },
    {
        id: "button",
        label: "버튼",
        description: "행동 버튼",
        tag: "button",
        text: "새 버튼",
        style: {
            display: "inline-flex",
            "align-items": "center",
            "justify-content": "center",
            gap: "8px",
            padding: "12px 20px",
            "border-radius": "var(--radius-control)",
            "background-color": "var(--surface-default)",
        },
    },
    { id: "link", label: "링크", description: "텍스트 링크", tag: "a", text: "새 링크", href: "/" },
    { id: "image", label: "이미지", description: "사진·도표", tag: "img", text: "", src: "/assets/favicon.svg", alt: "새 이미지" },
    { id: "container", label: "컨테이너", description: "요소 묶음 상자", tag: "div", text: "", style: { display: "flex", "flex-direction": "column", gap: "16px" } },
    {
        id: "card",
        label: "카드",
        description: "제목 + 설명 카드",
        tag: "article",
        text: "",
        style: { display: "flex", "flex-direction": "column", gap: "12px", padding: "24px", "border-radius": "var(--radius-panel)", "background-color": "var(--surface-default)" },
        children: [
            { tag: "h3", text: "카드 제목" },
            { tag: "p", text: "카드 설명을 입력하세요." },
        ],
    },
    {
        id: "banner",
        label: "배너",
        description: "안내 배너 + 링크",
        tag: "section",
        text: "",
        style: { display: "flex", "flex-direction": "column", gap: "12px", padding: "32px", "border-radius": "var(--radius-panel)", "background-color": "var(--surface-subtle)" },
        children: [
            { tag: "h2", text: "배너 제목" },
            { tag: "p", text: "배너 설명을 입력하세요." },
            { tag: "a", text: "자세히 보기", href: "/" },
        ],
    },
]);

export interface VisualAddedChild {
    tag: VisualAddTag;
    text: string;
    href?: string;
    src?: string;
    alt?: string;
}

export interface VisualAddedElement {
    id: string;
    parent: string;
    preset: VisualPresetId;
    tag: VisualAddTag;
    text: string;
    src?: string;
    alt?: string;
    href?: string;
    style?: VisualStyleMap;
    children?: VisualAddedChild[];
    order?: number;
}

export const visualGroupMemberLimit = 50;
const visualGroupLimit = 80;
export type VisualLayerGroup = { id: string; selectors: string[] };

export interface VisualDraftDocument {
    schemaVersion: 1 | 2;
    path: string;
    patches: VisualElementPatch[];
    additions: VisualAddedElement[];
    groups?: VisualLayerGroup[];
    updatedAt?: string;
}

export const visualLocalDraftKey = (path: string) => "sejong-cms-visual-draft:" + path;

export function autosaveVisualDraft(
    getStorage: () => Pick<Storage, "setItem">,
    path: string,
    draft: VisualDraftDocument,
    dirty: boolean,
): void {
    // 화면 전환·초기 로딩 중 저장본을 보존 / Never replace a draft with navigation or load state.
    if (!dirty || draft.path !== path) return;
    try {
        getStorage().setItem(visualLocalDraftKey(path), JSON.stringify(draft));
    } catch {
        // 저장소 제한이 편집을 막으면 안 됨 / Editing remains available if storage is blocked.
    }
}

export type VisualHistory = {
    past: VisualDraftDocument[];
    present: VisualDraftDocument;
    future: VisualDraftDocument[];
};

const SAFE_SELECTOR = /^body(?: > [a-z][a-z0-9-]*:nth-of-type\([1-9][0-9]*\))*$/;
const ADDED_SELECTOR = /^\[data-cms-added="[a-z0-9-]{6,64}"\](?: > (?:[a-z][a-z0-9-]*):nth-child\([1-9][0-9]*\))*$/;
const SAFE_ID = /^[a-z0-9-]{6,64}$/;
const STYLE_NAMES = new Set<string>(VISUAL_STYLE_FIELDS.map((field) => field.key));
const SAFE_LENGTH = /^-?(?:\d+|\d*\.\d+)(?:px|rem|em|vw|vh|%|ch|dvh)?$/i;
const SAFE_COLOR = /^(?:#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|transparent|currentcolor|var\(--[a-z0-9-]+\)|[a-z]+)$/i;
const SAFE_TOKEN = /^var\(--[a-z0-9-]+\)$/i;
const SAFE_LENGTH_SET = /^(?:-?(?:\d+|\d*\.\d+)(?:px|rem|em|vw|vh|%|ch|dvh)?)(?:\s+-?(?:\d+|\d*\.\d+)(?:px|rem|em|vw|vh|%|ch|dvh)?){0,3}$/i;
const SAFE_GRID = /^(?:repeat\(\s*[1-9][0-9]?\s*,\s*minmax\(0,\s*1fr\)\s*\)|[0-9a-z.]+(?:\s+[0-9a-z.]+){0,5})$/i;
const SAFE_ROTATE = /^-?\d{1,4}(?:\.\d{1,2})?deg$/i;
const SAFE_TRANSLATE = /^-?\d{1,5}(?:\.\d{1,2})?px\s+-?\d{1,5}(?:\.\d{1,2})?px$/i;
const ADD_TAGS = new Set<string>(["h1", "h2", "h3", "p", "span", "div", "section", "article", "button", "a", "img", "ul", "li"]);
const PRESET_IDS = new Set<string>(VISUAL_PRESETS.map((preset) => preset.id));
const MAX_ADDITIONS = 120;
const MAX_PATCHES = 900;
const MAX_CHILDREN = 6;

export function normalizeVisualPath(input: string): string | null {
    if (typeof input !== "string") return null;
    let path = input.trim().split(/[?#]/)[0];
    if (!path.startsWith("/")) path = "/" + path;
    path = path.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
    if (path.length > 220 || !/^\/[a-z0-9/_-]*$/i.test(path)) return null;
    if (/^\/(?:admin|account|booking|login|design-rules)(?:\/|$)/i.test(path)) return null;
    return path;
}

export function isSafeVisualSelector(value: unknown): value is string {
    return typeof value === "string" && value.length <= 500 &&
        (SAFE_SELECTOR.test(value) || ADDED_SELECTOR.test(value));
}

export function isSafeVisualUrl(input: unknown): input is string {
    if (typeof input !== "string" || input.length > 2048) return false;
    const value = input.trim();
    if (value === "/") return true;
    if (/^\/[a-z0-9/_%.!~()-]+$/i.test(value) && !value.startsWith("//")) return true;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
    } catch {
        return false;
    }
}

export function sanitizeVisualStyle(key: string, raw: unknown): string | null {
    if (!STYLE_NAMES.has(key) || typeof raw !== "string") return null;
    const v = raw.trim();
    if (!v || v.length > 120 || /[;<>{}]/.test(v) || /url\s*\(|expression\s*\(/i.test(v)) return null;
    if (key === "color" || key === "background-color" || key === "border-color") {
        return SAFE_COLOR.test(v) ? v : null;
    }
    if (key === "display") {
        return ["block", "inline", "inline-block", "flex", "inline-flex", "grid", "none", "contents"].includes(v) ? v : null;
    }
    if (key === "text-align") return ["left", "center", "right", "justify", "start", "end"].includes(v) ? v : null;
    if (key === "flex-direction") return ["row", "column", "row-reverse", "column-reverse"].includes(v) ? v : null;
    if (key === "flex-wrap") return ["nowrap", "wrap", "wrap-reverse"].includes(v) ? v : null;
    if (key === "justify-content") {
        return ["start", "center", "end", "space-between", "space-around", "space-evenly", "flex-start", "flex-end"].includes(v) ? v : null;
    }
    if (key === "align-items") return ["start", "center", "end", "stretch", "baseline", "flex-start", "flex-end"].includes(v) ? v : null;
    if (key === "position") return ["static", "relative", "absolute", "sticky"].includes(v) ? v : null;
    if (key === "overflow") return ["visible", "hidden", "auto", "scroll", "clip"].includes(v) ? v : null;
    if (key === "grid-template-columns") return SAFE_GRID.test(v) ? v : null;
    if (key === "font-weight") return /^(?:normal|bold|[1-9]00)$/.test(v) ? v : null;
    if (key === "opacity") return Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1 ? v : null;
    if (key === "translate") return SAFE_TRANSLATE.test(v) ? v : null;
    if (key === "rotate") return SAFE_ROTATE.test(v) ? v : null;
    if (v === "auto" && ["width", "height", "max-width", "min-width", "max-height", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left"].includes(key)) {
        return v;
    }
    if (SAFE_TOKEN.test(v)) return v;
    if (["padding", "margin", "border-radius", "gap"].includes(key) || key.startsWith("padding-") || key.startsWith("margin-")) {
        return SAFE_LENGTH_SET.test(v) ? v : null;
    }
    return SAFE_LENGTH.test(v) ? v : null;
}

function plain(value: unknown, cap = 10000): string {
    return typeof value === "string" ? value.slice(0, cap).replace(/\u0000/g, "") : "";
}

function sanitizeStyleMap(input: unknown): VisualStyleMap | undefined {
    if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
    const style: VisualStyleMap = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
        const safe = sanitizeVisualStyle(key, value);
        if (safe !== null) (style as Record<string, string>)[key] = safe;
    }
    return Object.keys(style).length ? style : undefined;
}

export function emptyVisualDocument(path: string): VisualDraftDocument {
    return { schemaVersion: VISUAL_SCHEMA_VERSION, path: normalizeVisualPath(path) || "/", patches: [], additions: [] };
}

export function newVisualNodeId(prefix = "node"): string {
    const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    return (prefix + "-" + random).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
}

function sanitizeChildren(input: unknown): VisualAddedChild[] {
    if (!Array.isArray(input)) return [];
    const children: VisualAddedChild[] = [];
    for (const item of input.slice(0, MAX_CHILDREN)) {
        if (!item || typeof item !== "object") continue;
        const child = item as Record<string, unknown>;
        const tag = String(child.tag || "");
        if (!ADD_TAGS.has(tag) || tag === "img") continue;
        const clean: VisualAddedChild = { tag: tag as VisualAddTag, text: plain(child.text, 2000) };
        if (isSafeVisualUrl(child.href)) clean.href = child.href;
        children.push(clean);
    }
    return children;
}

// v1(패치 + 단순 삽입)과 v2(프리셋/스타일/자식 노드) 문서를 모두 수용해 v2로 정규화합니다.
export function sanitizeVisualDocument(input: unknown, expectedPath: string): VisualDraftDocument {
    const path = normalizeVisualPath(expectedPath);
    if (!path) throw new Error("허용되지 않은 편집 경로입니다.");
    const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    if (raw.schemaVersion != null && raw.schemaVersion !== 1 && raw.schemaVersion !== 2) {
        throw new Error("지원하지 않는 비주얼 문서 버전입니다.");
    }
    if (raw.path != null && normalizeVisualPath(String(raw.path)) !== path) {
        throw new Error("다른 페이지의 초안은 불러올 수 없습니다.");
    }

    const additions: VisualAddedElement[] = [];
    const ids = new Set<string>();
    for (const item of (Array.isArray(raw.additions) ? raw.additions : []).slice(0, MAX_ADDITIONS)) {
        if (!item || typeof item !== "object") continue;
        const a = item as Record<string, unknown>;
        if (typeof a.id !== "string" || !SAFE_ID.test(a.id) || ids.has(a.id) || !isSafeVisualSelector(a.parent)) continue;
        const tag = String(a.tag || "");
        if (!ADD_TAGS.has(tag)) continue;
        const preset = PRESET_IDS.has(String(a.preset)) ? (a.preset as VisualPresetId) : inferPreset(tag as VisualAddTag);
        ids.add(a.id);
        const clean: VisualAddedElement = {
            id: a.id,
            parent: a.parent,
            preset,
            tag: tag as VisualAddTag,
            text: plain(a.text, 2000),
        };
        if (typeof a.order === "number" && Number.isInteger(a.order) && a.order >= 0 && a.order < MAX_ADDITIONS) clean.order = a.order;
        if (isSafeVisualUrl(a.src)) clean.src = a.src;
        if (a.alt != null) clean.alt = plain(a.alt, 500);
        if (isSafeVisualUrl(a.href)) clean.href = a.href;
        const style = sanitizeStyleMap(a.style);
        if (style) clean.style = style;
        const children = sanitizeChildren(a.children);
        if (children.length) clean.children = children;
        additions.push(clean);
    }

    const additionsById = new Map(additions.map((item) => [item.id, item]));
    const patches: VisualElementPatch[] = [];
    const seen = new Set<string>();
    for (const item of (Array.isArray(raw.patches) ? raw.patches : []).slice(0, MAX_PATCHES)) {
        if (!item || typeof item !== "object") continue;
        const p = item as Record<string, unknown>;
        if (!isSafeVisualSelector(p.selector) || seen.has(p.selector)) continue;
        const owner = /^\[data-cms-added="([a-z0-9-]{6,64})"\]/.exec(p.selector);
        if (owner && !additionsById.has(owner[1])) continue;
        seen.add(p.selector);
        const patch: VisualElementPatch = { selector: p.selector };
        if (typeof p.text === "string") patch.text = plain(p.text);
        if (isSafeVisualUrl(p.src)) patch.src = p.src;
        if (typeof p.alt === "string") patch.alt = plain(p.alt, 500);
        if (isSafeVisualUrl(p.href)) patch.href = p.href;
        if (typeof p.hidden === "boolean") patch.hidden = p.hidden;
        const style = sanitizeStyleMap(p.style);
        if (style) patch.style = style;
        patches.push(patch);
    }

    const groups: VisualLayerGroup[] = [];
    const groupIds = new Set<string>();
    const groupedSelectors = new Set<string>();
    // 그룹은 편집기 메타데이터입니다. / A group never creates a rendering wrapper.
    for (const item of (Array.isArray(raw.groups) ? raw.groups : []).slice(0, visualGroupLimit)) {
        if (!item || typeof item !== "object") continue;
        const { id, selectors } = item as Record<string, unknown>;
        if (typeof id !== "string" || !SAFE_ID.test(id) || groupIds.has(id) || !Array.isArray(selectors) ||
            selectors.length < 2 || selectors.length > visualGroupMemberLimit) continue;
        const members: string[] = [];
        for (const selector of selectors) {
            if (!isSafeVisualSelector(selector) || selector === "body" || groupedSelectors.has(selector)) continue;
            const owner = /^\[data-cms-added="([a-z0-9-]{6,64})"\]/.exec(selector);
            if (owner && !additionsById.has(owner[1])) continue;
            if (members.some(other => other === selector || other.startsWith(selector + " > ") || selector.startsWith(other + " > "))) continue;
            members.push(selector);
        }
        if (members.length < 2) continue;
        groups.push({ id, selectors: members });
        groupIds.add(id);
        for (const selector of members) groupedSelectors.add(selector);
    }
    return { schemaVersion: VISUAL_SCHEMA_VERSION, path, patches, additions, ...(groups.length ? { groups } : {}) };
}

function inferPreset(tag: VisualAddTag): VisualPresetId {
    if (tag === "h1" || tag === "h2" || tag === "h3") return "heading";
    if (tag === "button") return "button";
    if (tag === "a") return "link";
    if (tag === "img") return "image";
    if (tag === "section" || tag === "article") return "card";
    if (tag === "div") return "container";
    return "text";
}

export function createVisualHistory(doc: VisualDraftDocument): VisualHistory {
    return { past: [], present: doc, future: [] };
}

export function pushVisualHistory(history: VisualHistory, next: VisualDraftDocument): VisualHistory {
    const clean = sanitizeVisualDocument(next, history.present.path);
    if (JSON.stringify(clean) === JSON.stringify(history.present)) return history;
    return {
        past: [...history.past.slice(-(VISUAL_HISTORY_LIMIT - 1)), history.present],
        present: clean,
        future: [],
    };
}

export function undoVisualHistory(history: VisualHistory): VisualHistory {
    if (!history.past.length) return history;
    return {
        past: history.past.slice(0, -1),
        present: history.past[history.past.length - 1],
        future: [history.present, ...history.future],
    };
}

export function redoVisualHistory(history: VisualHistory): VisualHistory {
    if (!history.future.length) return history;
    return {
        past: [...history.past, history.present],
        present: history.future[0],
        future: history.future.slice(1),
    };
}

export function upsertVisualPatch(
    doc: VisualDraftDocument,
    selector: string,
    change: Omit<VisualElementPatch, "selector">,
): VisualDraftDocument {
    if (!isSafeVisualSelector(selector)) return doc;
    const index = doc.patches.findIndex((item) => item.selector === selector);
    const previous: VisualElementPatch = index === -1 ? { selector } : doc.patches[index];
    const mergedStyle = { ...previous.style, ...change.style };
    const next: VisualElementPatch = {
        ...previous,
        ...change,
        ...(Object.keys(mergedStyle).length ? { style: mergedStyle } : {}),
    };
    const patches = [...doc.patches];
    if (index === -1) patches.push(next);
    else patches[index] = next;
    return sanitizeVisualDocument({ ...doc, patches }, doc.path);
}

// 스타일 한 항목만 제거합니다(빈 값 입력 시). 패치가 비면 목록에서 정리합니다.
export function removeVisualStyle(doc: VisualDraftDocument, selector: string, key: VisualStyleKey): VisualDraftDocument {
    const patches = doc.patches.map((patch) => {
        if (patch.selector !== selector || !patch.style) return patch;
        const style = { ...patch.style };
        delete (style as Record<string, string>)[key];
        const { style: _removed, ...rest } = patch;
        return Object.keys(style).length ? { ...rest, style } : rest;
    }).filter((patch) => Object.keys(patch).length > 1);
    return sanitizeVisualDocument({ ...doc, patches }, doc.path);
}

export function addVisualElement(
    doc: VisualDraftDocument,
    input: {
        parent: string;
        preset: VisualPresetId;
        text?: string;
        href?: string;
        src?: string;
        alt?: string;
        id?: string;
        style?: VisualStyleMap;
    },
): { document: VisualDraftDocument; added: VisualAddedElement | null } {
    const preset = VISUAL_PRESETS.find((item) => item.id === input.preset);
    if (!preset || !isSafeVisualSelector(input.parent)) return { document: doc, added: null };
    const addition: VisualAddedElement = {
        id: input.id && SAFE_ID.test(input.id) ? input.id : newVisualNodeId(preset.id),
        parent: input.parent,
        preset: preset.id,
        tag: preset.tag,
        text: input.text !== undefined ? plain(input.text, 2000) : preset.text,
    };
    const style = sanitizeStyleMap({ ...preset.style, ...input.style });
    if (style) addition.style = style;
    if (preset.id === "image") {
        addition.src = isSafeVisualUrl(input.src) ? input.src : preset.src;
        addition.alt = plain(input.alt || preset.alt, 500);
    }
    if (preset.href || input.href) {
        const href = isSafeVisualUrl(input.href) ? input.href : preset.href;
        if (href) addition.href = href;
    }
    if (preset.children?.length) {
        addition.children = preset.children.map((child) => ({
            tag: child.tag,
            text: child.text,
            ...(child.href ? { href: child.href } : {}),
        }));
    }
    const next = sanitizeVisualDocument({ ...doc, additions: [...doc.additions, addition] }, doc.path);
    const added = next.additions.find((item) => item.id === addition.id) || null;
    return { document: next, added };
}

// 삽입 요소를 제거합니다. 그 요소(자식 노드 포함)를 가리키는 패치도 함께 정리합니다.
export function removeVisualElement(doc: VisualDraftDocument, selector: string): VisualDraftDocument {
    if (!isSafeVisualSelector(selector)) return doc;
    const match = /^\[data-cms-added="([a-z0-9-]{6,64})"\]/.exec(selector);
    if (!match) return doc;
    const id = match[1];
    const prefix = '[data-cms-added="' + id + '"]';
    return sanitizeVisualDocument({
        ...doc,
        additions: doc.additions.filter((item) => item.id !== id),
        patches: doc.patches.filter((patch) => !patch.selector.startsWith(prefix)),
    }, doc.path);
}

export function visualDocumentChecksum(doc: VisualDraftDocument): string {
    const stable = {
        schemaVersion: doc.schemaVersion,
        path: doc.path,
        patches: [...doc.patches].sort((a, b) => a.selector.localeCompare(b.selector)),
        additions: [...doc.additions].sort((a, b) => a.id.localeCompare(b.id)),
    };
    return sha256Hex(JSON.stringify(stable));
}

// 발행 체크섬은 렌더링만 비교하고, 복구에는 그룹까지 비교합니다.
export function visualDraftChecksum(doc: VisualDraftDocument): string {
    const rendered = visualDocumentChecksum(doc);
    return doc.groups?.length ? sha256Hex(JSON.stringify([rendered, doc.groups])) : rendered;
}

export function countVisualChanges(doc: VisualDraftDocument): { patches: number; additions: number; hidden: number } {
    return {
        patches: doc.patches.length,
        additions: doc.additions.length,
        hidden: doc.patches.filter((patch) => patch.hidden).length,
    };
}

export function documentPathSlug(path: string): string {
    const normalized = normalizeVisualPath(path) || "/";
    const slug = normalized.replace(/^\//, "").replace(/\//g, "-");
    return slug || "home";
}
