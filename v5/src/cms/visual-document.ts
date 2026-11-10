// [실제 사이트 비주얼 편집 문서 계약 / Real-site visual editing document contract]
// 원본 React 컴포넌트는 변경하지 않고, 승인 전 편집 결과를 데이터 전용 초안으로 보존합니다.
export const VISUAL_SCHEMA_VERSION = 1 as const;

export const VISUAL_STYLE_FIELDS = [
    { key: "color", label: "글자 색상", kind: "color" },
    { key: "background-color", label: "배경 색상", kind: "color" },
    { key: "font-size", label: "글자 크기", kind: "length" },
    { key: "font-weight", label: "글자 굵기", kind: "weight" },
    { key: "text-align", label: "텍스트 정렬", kind: "align" },
    { key: "line-height", label: "행간", kind: "length" },
    { key: "letter-spacing", label: "자간", kind: "length" },
    { key: "width", label: "너비", kind: "length" },
    { key: "height", label: "높이", kind: "length" },
    { key: "max-width", label: "최대 너비", kind: "length" },
    { key: "min-height", label: "최소 높이", kind: "length" },
    { key: "padding", label: "안쪽 여백", kind: "length" },
    { key: "margin", label: "바깥 여백", kind: "length" },
    { key: "gap", label: "간격", kind: "length" },
    { key: "border-radius", label: "모서리 곡률", kind: "length" },
    { key: "opacity", label: "불투명도", kind: "number" },
    { key: "display", label: "배치 방식", kind: "display" },
    { key: "flex-direction", label: "플렉스 방향", kind: "direction" },
    { key: "justify-content", label: "가로 정렬", kind: "justify" },
    { key: "align-items", label: "세로 정렬", kind: "alignItems" },
    { key: "translate", label: "위치 이동", kind: "translate" },
] as const;
export type VisualStyleKey = (typeof VISUAL_STYLE_FIELDS)[number]["key"];
export type VisualStyleMap = Partial<Record<VisualStyleKey, string>>;

export interface VisualElementPatch {
    selector: string;
    text?: string;
    src?: string;
    alt?: string;
    href?: string;
    hidden?: boolean;
    style?: VisualStyleMap;
}
export type VisualAddTag = "p" | "h2" | "button" | "a" | "img" | "div";
export interface VisualAddedElement {
    id: string;
    parent: string;
    tag: VisualAddTag;
    text: string;
    src?: string;
    alt?: string;
    href?: string;
}
export interface VisualDraftDocument {
    schemaVersion: 1;
    path: string;
    patches: VisualElementPatch[];
    additions: VisualAddedElement[];
}
export type VisualHistory = { past: VisualDraftDocument[]; present: VisualDraftDocument; future: VisualDraftDocument[] };

const SAFE_SELECTOR = /^body(?: > [a-z][a-z0-9-]*:nth-of-type\([1-9][0-9]*\))*$/;
const ADDED_SELECTOR = /^\[data-cms-added="[a-z0-9-]{6,64}"\]$/;
const SAFE_ID = /^[a-z0-9-]{6,64}$/;
const STYLE_NAMES = new Set<string>(VISUAL_STYLE_FIELDS.map((field) => field.key));
const SAFE_LENGTH = /^-?(?:\d+|\d*\.\d+)(?:px|rem|em|vw|vh|%|ch|dvh)?$/i;
const SAFE_COLOR = /^(?:#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|transparent|currentcolor|var\(--[a-z0-9-]+\)|[a-z]+)$/i;
const SAFE_TOKEN = /^var\(--[a-z0-9-]+\)$/i;
const SAFE_LENGTH_SET = /^(?:-?(?:\d+|\d*\.\d+)(?:px|rem|em|vw|vh|%|ch|dvh)?)(?:\s+-?(?:\d+|\d*\.\d+)(?:px|rem|em|vw|vh|%|ch|dvh)?){0,3}$/i;

export function normalizeVisualPath(input: string): string | null {
    if (typeof input !== "string") return null;
    let path = input.trim().split(/[?#]/)[0].replace(/^\/v5(?=\/|$)/, "");
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
    if (/^\/v5\/[a-z0-9/_%.!~()-]+$/i.test(value)) return true;
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
    if (key === "color" || key === "background-color") return SAFE_COLOR.test(v) ? v : null;
    if (key === "display") return ["block", "inline", "inline-block", "flex", "inline-flex", "grid", "none"].includes(v) ? v : null;
    if (key === "text-align") return ["left", "center", "right", "justify", "start", "end"].includes(v) ? v : null;
    if (key === "flex-direction") return ["row", "column", "row-reverse", "column-reverse"].includes(v) ? v : null;
    if (key === "justify-content") return ["start", "center", "end", "space-between", "space-around", "space-evenly", "flex-start", "flex-end"].includes(v) ? v : null;
    if (key === "align-items") return ["start", "center", "end", "stretch", "baseline", "flex-start", "flex-end"].includes(v) ? v : null;
    if (key === "font-weight") return /^(?:normal|bold|[1-9]00)$/.test(v) ? v : null;
    if (key === "opacity") return Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1 ? v : null;
    if (key === "translate") return /^-?\d{1,5}(?:\.\d{1,2})?px\s+-?\d{1,5}(?:\.\d{1,2})?px$/i.test(v) ? v : null;
    if (v === "auto" && ["width", "height", "max-width", "min-height", "margin"].includes(key)) return v;
    if (SAFE_TOKEN.test(v)) return v;
    if (key === "padding" || key === "margin" || key === "border-radius") return SAFE_LENGTH_SET.test(v) ? v : null;
    return SAFE_LENGTH.test(v) ? v : null;
}

function plain(value: unknown, cap = 10000): string {
    return typeof value === "string" ? value.slice(0, cap).replace(/\u0000/g, "") : "";
}

export function emptyVisualDocument(path: string): VisualDraftDocument {
    return { schemaVersion: 1, path: normalizeVisualPath(path) || "/", patches: [], additions: [] };
}

export function sanitizeVisualDocument(input: unknown, expectedPath: string): VisualDraftDocument {
    const path = normalizeVisualPath(expectedPath);
    if (!path) throw new Error("허용되지 않은 편집 경로입니다.");
    const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
    if (raw.schemaVersion != null && raw.schemaVersion !== 1) throw new Error("지원하지 않는 비주얼 문서 버전입니다.");
    if (raw.path != null && normalizeVisualPath(String(raw.path)) !== path) throw new Error("다른 페이지의 초안은 불러올 수 없습니다.");
    const additions: VisualAddedElement[] = [];
    const ids = new Set<string>();
    for (const item of (Array.isArray(raw.additions) ? raw.additions : []).slice(0, 80)) {
        if (!item || typeof item !== "object") continue;
        const a = item as Record<string, unknown>;
        if (typeof a.id !== "string" || !SAFE_ID.test(a.id) || ids.has(a.id) || !isSafeVisualSelector(a.parent)) continue;
        if (!["p", "h2", "button", "a", "img", "div"].includes(String(a.tag))) continue;
        ids.add(a.id);
        const clean: VisualAddedElement = {
            id: a.id, parent: a.parent, tag: a.tag as VisualAddTag, text: plain(a.text, 2000),
        };
        if (isSafeVisualUrl(a.src)) clean.src = a.src;
        if (a.alt != null) clean.alt = plain(a.alt, 500);
        if (isSafeVisualUrl(a.href)) clean.href = a.href;
        additions.push(clean);
    }
    const patches: VisualElementPatch[] = [];
    const seen = new Set<string>();
    for (const item of (Array.isArray(raw.patches) ? raw.patches : []).slice(0, 600)) {
        if (!item || typeof item !== "object") continue;
        const p = item as Record<string, unknown>;
        if (!isSafeVisualSelector(p.selector) || seen.has(p.selector)) continue;
        if (p.selector.startsWith("[data-cms-added=") &&
            !ids.has(p.selector.slice(17, -2))) continue;
        seen.add(p.selector);
        const patch: VisualElementPatch = { selector: p.selector };
        if (typeof p.text === "string") patch.text = plain(p.text);
        if (isSafeVisualUrl(p.src)) patch.src = p.src;
        if (typeof p.alt === "string") patch.alt = plain(p.alt, 500);
        if (isSafeVisualUrl(p.href)) patch.href = p.href;
        if (typeof p.hidden === "boolean") patch.hidden = p.hidden;
        if (p.style && typeof p.style === "object" && !Array.isArray(p.style)) {
            const style: VisualStyleMap = {};
            for (const [key, value] of Object.entries(p.style)) {
                const safe = sanitizeVisualStyle(key, value);
                if (safe !== null) (style as Record<string, string>)[key] = safe;
            }
            if (Object.keys(style).length) patch.style = style;
        }
        patches.push(patch);
    }
    return { schemaVersion: 1, path, patches, additions };
}

export function createVisualHistory(doc: VisualDraftDocument): VisualHistory {
    return { past: [], present: doc, future: [] };
}
export function pushVisualHistory(history: VisualHistory, next: VisualDraftDocument): VisualHistory {
    const clean = sanitizeVisualDocument(next, history.present.path);
    if (JSON.stringify(clean) === JSON.stringify(history.present)) return history;
    return { past: [...history.past.slice(-49), history.present], present: clean, future: [] };
}
export function undoVisualHistory(history: VisualHistory): VisualHistory {
    if (!history.past.length) return history;
    return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1], future: [history.present, ...history.future] };
}
export function redoVisualHistory(history: VisualHistory): VisualHistory {
    if (!history.future.length) return history;
    return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) };
}

export function upsertVisualPatch(doc: VisualDraftDocument, selector: string, change: Omit<VisualElementPatch, "selector">): VisualDraftDocument {
    if (!isSafeVisualSelector(selector)) return doc;
    const index = doc.patches.findIndex((item) => item.selector === selector);
    const previous: VisualElementPatch = index === -1 ? { selector } : doc.patches[index];
    const next: VisualElementPatch = {
        ...previous, ...change,
        style: { ...previous.style, ...change.style },
    };
    const patches = [...doc.patches];
    if (index === -1) patches.push(next);
    else patches[index] = next;
    return sanitizeVisualDocument({ ...doc, patches }, doc.path);
}
