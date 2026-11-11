"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCatalog } from "../src/catalog/CatalogProvider";
import { supabase } from "../src/lib/supabase.ts";
import {
    CMS_ADMIN_RPC,
    CMS_PAGE_SNAPSHOTS_TABLE,
    CMS_PUBLISH_RPC,
    CMS_VISUAL_DOCUMENTS_TABLE,
} from "../src/cms/cms-tables.ts";
import { capturePageTree, visualSelectorFor } from "../src/cms/page-tree-capture.ts";
import type { CmsPageSnapshot, CmsPageTreeNode } from "../src/cms/page-tree.ts";
import {
    VISUAL_PRESETS,
    VISUAL_STYLE_FIELDS,
    VISUAL_STYLE_GROUPS,
    addVisualElement,
    countVisualChanges,
    createVisualHistory,
    emptyVisualDocument,
    isSafeVisualUrl,
    normalizeVisualPath,
    pushVisualHistory,
    redoVisualHistory,
    removeVisualElement,
    removeVisualStyle,
    sanitizeVisualDocument,
    sanitizeVisualStyle,
    undoVisualHistory,
    upsertVisualPatch,
    visualDocumentChecksum,
} from "../src/cms/visual-document.ts";
import type {
    VisualDraftDocument,
    VisualHistory,
    VisualPresetId,
    VisualStyleKey,
} from "../src/cms/visual-document.ts";
import {
    SystemBadge,
    SystemButton,
    SystemField,
    SystemFilterButton,
    SystemLink,
    SystemNotice,
} from "./SystemPrimitives";

type ToolMode = "select" | "move" | "text" | "preview";
type Viewport = "desktop" | "tablet" | "mobile";
type SelectionInfo = {
    selector: string;
    tag: string;
    text: string;
    src: string;
    alt: string;
    href: string;
    isLeaf: boolean;
    isImage: boolean;
    isLink: boolean;
    computed: Record<string, string>;
    breadcrumb: string[];
};
type Layer = { selector: string; label: string; depth: number; tag: string; role: string; children: number; added: boolean };
type Overlay = { left: number; top: number; width: number; height: number; label: string };
type Original = {
    style: string | null;
    text: string | null;
    src: string | null;
    alt: string | null;
    href: string | null;
    hidden: boolean;
};
type Editing = { element: HTMLElement; selector: string; original: string };

const EDITABLE_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "SPAN", "STRONG", "EM", "SMALL", "LABEL", "BUTTON", "A", "LI", "FIGCAPTION", "TD", "TH", "TIME"]);
const BODY_PREVIEW_STYLE = [
    '[data-v5-entry-intro]{display:none!important}',
    '[data-cms-visual-selected="true"]{outline:2px solid var(--accent-primary, #6b5b4a)!important;outline-offset:-2px!important}',
    '[data-cms-visual-hover="true"]:not([data-cms-visual-selected]){outline:1px dashed var(--text-secondary, #6b5b4a)!important;outline-offset:-1px!important}',
    '[data-cms-editing="true"]{outline:2px solid var(--text-primary, #211f1c)!important;cursor:text!important}',
    '[data-cms-visual-target="true"]{outline:2px dashed var(--accent-primary, #6b5b4a)!important;outline-offset:-4px!important}',
].join("");

// 인스펙터 세그먼트 값: 자유 입력 대신 피그마처럼 선택지로 제공할 수 있는 키입니다.
const STYLE_ENUMS: Record<string, readonly string[]> = {
    display: ["block", "flex", "grid", "inline-block", "none"],
    "flex-direction": ["row", "column", "row-reverse", "column-reverse"],
    "justify-content": ["start", "center", "end", "space-between", "space-around"],
    "align-items": ["start", "center", "end", "stretch", "baseline"],
    "text-align": ["left", "center", "right", "justify"],
    "font-weight": ["normal", "500", "600", "700", "bold"],
};
const COLOR_TOKENS = [
    { label: "본문", value: "var(--text-primary)" },
    { label: "보조", value: "var(--text-secondary)" },
    { label: "표면", value: "var(--surface-default)" },
    { label: "옅은 표면", value: "var(--surface-subtle)" },
    { label: "페이지", value: "var(--background-page)" },
    { label: "선", value: "var(--border-default)" },
];
const SPACING_SCALE = ["4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px"];

function saveOriginal(map: Map<HTMLElement, Original>, el: HTMLElement): void {
    if (map.has(el)) return;
    map.set(el, {
        style: el.getAttribute("style"),
        text: el.children.length === 0 ? el.textContent : null,
        src: el.getAttribute("src"),
        alt: el.getAttribute("alt"),
        href: el.getAttribute("href"),
        hidden: el.hidden,
    });
}

function restoreOriginals(map: Map<HTMLElement, Original>): void {
    for (const [el, original] of map) {
        if (!el.isConnected) continue;
        if (original.style == null) el.removeAttribute("style");
        else el.setAttribute("style", original.style);
        if (original.text != null && el.children.length === 0) el.textContent = original.text;
        for (const key of ["src", "alt", "href"] as const) {
            if (original[key] == null) el.removeAttribute(key);
            else el.setAttribute(key, original[key]!);
        }
        el.hidden = original.hidden;
    }
}

function resolveElement(doc: Document, selector: string): HTMLElement | null {
    try {
        const element = doc.querySelector(selector);
        return element && element.namespaceURI === "http://www.w3.org/1999/xhtml" ? (element as HTMLElement) : null;
    } catch {
        return null;
    }
}

function htmlTarget(event: Event): HTMLElement | null {
    let element = event.target as Element | null;
    while (element && element.namespaceURI !== "http://www.w3.org/1999/xhtml") {
        element = element.parentElement;
    }
    return element && element.nodeType === 1 ? (element as HTMLElement) : null;
}

function dataTextFor(tag: string): string {
    if (tag === "h1" || tag === "h2" || tag === "h3") return "heading";
    if (tag === "button" || tag === "a") return "action";
    if (tag === "span" || tag === "li") return "item-title";
    return "body";
}

// 삽입 요소(자식 포함)와 패치를 실제 캔버스 DOM에 반영합니다. 원본 React 코드는 건드리지 않습니다.
function applyVisualDraft(doc: Document, draft: VisualDraftDocument, originals: Map<HTMLElement, Original>): void {
    restoreOriginals(originals);
    doc.querySelectorAll("[data-cms-added]").forEach((element) => element.remove());
    for (const added of draft.additions) {
        const parent = resolveElement(doc, added.parent);
        if (!parent) continue;
        const node = doc.createElement(added.tag);
        node.setAttribute("data-cms-added", added.id);
        node.setAttribute("data-cms-preset", added.preset);
        node.setAttribute("data-text", dataTextFor(added.tag));
        if (added.tag === "img") {
            node.setAttribute("src", added.src || "/v5/assets/favicon.svg");
            node.setAttribute("alt", added.alt || "새 이미지");
        } else if (!added.children?.length) {
            node.textContent = added.text;
        }
        if (added.tag === "a") node.setAttribute("href", added.href || "/v5/");
        for (const [name, value] of Object.entries(added.style || {})) {
            const safe = sanitizeVisualStyle(name, value);
            if (safe != null) node.style.setProperty(name, safe);
        }
        if (added.children?.length) {
            const tagCounts = new Map<string, number>();
            for (const child of added.children) {
                const childNode = doc.createElement(child.tag);
                childNode.setAttribute("data-text", dataTextFor(child.tag));
                if (child.tag === "a" && child.href) childNode.setAttribute("href", child.href);
                if (child.tag === "img") {
                    childNode.setAttribute("src", child.src || "/v5/assets/favicon.svg");
                    childNode.setAttribute("alt", child.alt || "새 이미지");
                } else childNode.textContent = child.text;
                const count = (tagCounts.get(child.tag) || 0) + 1;
                tagCounts.set(child.tag, count);
                node.appendChild(childNode);
            }
        }
        parent.appendChild(node);
    }
    for (const patch of draft.patches) {
        const el = resolveElement(doc, patch.selector);
        if (!el) continue;
        if (!el.hasAttribute("data-cms-added")) saveOriginal(originals, el);
        if (patch.text !== undefined && el.children.length === 0 && EDITABLE_TAGS.has(el.tagName)) el.textContent = patch.text;
        if (patch.src && el.tagName === "IMG") el.setAttribute("src", patch.src);
        if (patch.alt !== undefined && el.tagName === "IMG") el.setAttribute("alt", patch.alt);
        if (patch.href && el.tagName === "A") el.setAttribute("href", patch.href);
        if (patch.hidden !== undefined) el.hidden = patch.hidden;
        for (const [name, value] of Object.entries(patch.style || {})) {
            const safe = sanitizeVisualStyle(name, value);
            if (safe != null) el.style.setProperty(name, safe);
        }
    }
}

function breadcrumbFor(el: Element): string[] {
    const trail: string[] = [];
    let current: Element | null = el;
    while (current && current.localName !== "html") {
        const text = (current.getAttribute("aria-label") || current.textContent || "").replace(/\s+/g, " ").trim().slice(0, 18);
        trail.unshift(current.localName + (text ? " · " + text : ""));
        current = current.parentElement;
    }
    return trail.slice(-6);
}

function selectionSnapshot(doc: Document, selector: string): SelectionInfo | null {
    const el = resolveElement(doc, selector);
    if (!el) return null;
    const styles = doc.defaultView?.getComputedStyle(el);
    const computed: Record<string, string> = {};
    for (const field of VISUAL_STYLE_FIELDS) computed[field.key] = styles?.getPropertyValue(field.key).trim() || "";
    const isImage = el.tagName === "IMG";
    const isLink = el.tagName === "A";
    return {
        selector,
        tag: el.tagName.toLowerCase(),
        text: el.textContent || "",
        src: isImage ? el.getAttribute("src") || "" : "",
        alt: isImage ? el.getAttribute("alt") || "" : "",
        href: isLink ? el.getAttribute("href") || "" : "",
        isLeaf: el.children.length === 0 && EDITABLE_TAGS.has(el.tagName),
        isImage,
        isLink,
        computed,
        breadcrumb: breadcrumbFor(el),
    };
}

function flattenTree(nodes: readonly CmsPageTreeNode[], collapsed: Set<string>, depth = 0, out: Layer[] = []): Layer[] {
    for (const node of nodes) {
        out.push({
            selector: node.selector,
            label: node.label,
            depth: Math.min(depth, 6),
            tag: node.tag,
            role: node.role,
            children: node.children.length,
            added: Boolean(node.added),
        });
        if (node.children.length && !collapsed.has(node.selector)) {
            flattenTree(node.children, collapsed, depth + 1, out);
        }
    }
    return out;
}

function downloadDraft(doc: VisualDraftDocument): void {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sejong-visual-" + (doc.path.replace(/\W+/g, "-") || "home") + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
}

// [세션은 DB 저장 권한만 결정 / The session only unlocks DB save]
// 세션이 없어도 캔버스는 그대로 열리고, 편집 결과는 브라우저 로컬 초안으로 보관됩니다.
export type CmsDesignerAccess = "checking" | "admin" | "guest" | "offline";

const LOCAL_DRAFT_PREFIX = "sejong-cms-visual-draft:";

function readLocalDraft(path: string): VisualDraftDocument | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(LOCAL_DRAFT_PREFIX + path);
        if (!raw) return null;
        return sanitizeVisualDocument(JSON.parse(raw), path);
    } catch {
        return null;
    }
}

export default function CmsVisualDesigner({
    userId = "",
    access = "guest",
    accessHandle = "",
    accessMessage = "",
}: {
    userId?: string;
    access?: CmsDesignerAccess;
    accessHandle?: string;
    accessMessage?: string;
}) {
    const { catalog } = useCatalog();
    const [path, setPath] = useState("/visit");
    const [manualPath, setManualPath] = useState("/visit");
    const [history, setHistory] = useState<VisualHistory>(() => createVisualHistory(emptyVisualDocument("/visit")));
    const [revision, setRevision] = useState(0);
    const [publishedRevision, setPublishedRevision] = useState(0);
    const [dirty, setDirty] = useState(false);
    const [status, setStatus] = useState("실제 웹페이지를 선택해 디자인을 편집하세요. DB 저장과 운영 게시는 별개입니다.");
    const [isError, setIsError] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [treeSyncing, setTreeSyncing] = useState(false);
    const [treeSyncedAt, setTreeSyncedAt] = useState("");
    const [loading, setLoading] = useState(true);
    const [frameReady, setFrameReady] = useState(false);
    const [mode, setMode] = useState<ToolMode>("select");
    const [viewport, setViewport] = useState<Viewport>("desktop");
    const [zoom, setZoom] = useState(100);
    const [selection, setSelection] = useState<SelectionInfo | null>(null);
    const [layers, setLayers] = useState<Layer[]>([]);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState("");
    const [dragPreset, setDragPreset] = useState<VisualPresetId | null>(null);
    const [overlay, setOverlay] = useState<Overlay | null>(null);
    const [agentPrompt, setAgentPrompt] = useState("");
    const [snapshot, setSnapshot] = useState<CmsPageSnapshot | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const originals = useRef<Map<HTMLElement, Original>>(new Map());
    const editingRef = useRef<Editing | null>(null);
    const dragRef = useRef<{ element: HTMLElement; selector: string; startX: number; startY: number; baseX: number; baseY: number } | null>(null);

    const mutate = useCallback((updater: (doc: VisualDraftDocument) => VisualDraftDocument) => {
        setHistory((current) => pushVisualHistory(current, updater(current.present)));
        setDirty(true);
    }, []);

    const refreshOverlay = useCallback(() => {
        const doc = iframeRef.current?.contentDocument;
        if (!doc || !selection) {
            setOverlay(null);
            return;
        }
        const el = resolveElement(doc, selection.selector);
        if (!el) {
            setOverlay(null);
            return;
        }
        const rect = el.getBoundingClientRect();
        const scale = zoom / 100;
        setOverlay({
            left: rect.left * scale,
            top: rect.top * scale,
            width: Math.max(rect.width * scale, 2),
            height: Math.max(rect.height * scale, 2),
            label: selection.tag + " · " + Math.round(rect.width) + "×" + Math.round(rect.height),
        });
    }, [selection, zoom]);

    const selectBySelector = useCallback((selector: string) => {
        const doc = iframeRef.current?.contentDocument;
        if (!doc) return;
        setSelection(selectionSnapshot(doc, selector));
    }, []);

    // 1) 페이지 초안 불러오기 (Supabase sejong_cms_visual_documents)
    useEffect(() => {
        let live = true;
        originals.current = new Map();
        editingRef.current = null;
        setFrameReady(false);
        setSelection(null);
        setOverlay(null);
        setHistory(createVisualHistory(emptyVisualDocument(path)));
        setRevision(0);
        setPublishedRevision(0);
        setDirty(false);
        setTreeSyncedAt("");
        setLoading(true);
        const stored = readLocalDraft(path);
        const load = async () => {
            if (!supabase) {
                if (live) {
                    setLoading(false);
                    if (stored) {
                        setHistory(createVisualHistory(stored));
                        setIsError(false);
                        setStatus(path + "의 브라우저 로컬 초안을 열었습니다. DB 저장은 관리자 로그인 후 가능합니다.");
                    } else {
                        setIsError(false);
                        setStatus("DB 연결 설정이 없어 로컬 모드로 동작합니다. 편집·미리보기는 그대로 가능합니다.");
                    }
                }
                return;
            }
            const { data, error } = await supabase
                .from(CMS_VISUAL_DOCUMENTS_TABLE)
                .select("document, revision, published_revision")
                .eq("target_path", path)
                .maybeSingle();
            if (!live) return;
            setLoading(false);
            if (error) {
                // [마이그레이션 전 상태도 작업을 막지 않음 / A missing table does not block the canvas]
                const notReady = /schema cache|does not exist|PGRST205|42P01/i.test(error.message);
                if (notReady) {
                    setIsError(false);
                    if (stored) {
                        setHistory(createVisualHistory(stored));
                        setStatus(path + "의 브라우저 로컬 초안을 열었습니다. DB 초안 테이블은 아직 준비되지 않았습니다.");
                    } else {
                        setStatus(
                            "DB 초안 테이블이 아직 준비되지 않아 브라우저 로컬 모드로 작업합니다. 편집 내용은 이 브라우저에 보관됩니다.",
                        );
                    }
                    return;
                }
                setIsError(true);
                setStatus("시각 초안 조회 실패: " + error.message);
                return;
            }
            if (data) {
                try {
                    setHistory(createVisualHistory(sanitizeVisualDocument(data.document, path)));
                    setRevision(Number(data.revision) || 0);
                    setPublishedRevision(Number(data.published_revision) || 0);
                    setIsError(false);
                    setStatus(
                        path + "의 DB 초안 r" + data.revision + "을(를) 불러왔습니다. 발행 r" + (data.published_revision || 0) + ".",
                    );
                } catch (err) {
                    setIsError(true);
                    setStatus("저장된 문서 정화 오류: " + String(err));
                }
            } else if (stored) {
                setHistory(createVisualHistory(stored));
                setIsError(false);
                setStatus(path + "의 브라우저 로컬 초안을 열었습니다. DB에는 아직 저장되지 않은 초안입니다.");
            } else {
                setIsError(false);
                setStatus(path + "에는 아직 시각 초안이 없습니다. 캔버스에서 바로 편집을 시작하세요.");
            }
        };
        void load();
        return () => {
            live = false;
        };
    }, [path]);

    // 1-b) 브라우저 로컬 초안 자동 보관 / Keep an offline browser copy of the draft
    useEffect(() => {
        if (!frameReady) return;
        try {
            window.localStorage.setItem(LOCAL_DRAFT_PREFIX + path, JSON.stringify(history.present));
        } catch {
            /* 저장 공간이 없으면 건너뜁니다. / Skip when storage is unavailable. */
        }
    }, [frameReady, history.present, path]);

    // 2) 캔버스 주입·선택·이동·인라인 편집·오버레이
    useEffect(() => {
        const doc = iframeRef.current?.contentDocument;
        if (!frameReady || !doc || !doc.body) return;
        let style = doc.getElementById("cms-visual-preview-style") as HTMLStyleElement | null;
        if (!style) {
            style = doc.createElement("style");
            style.id = "cms-visual-preview-style";
            style.textContent = BODY_PREVIEW_STYLE;
            doc.head.appendChild(style);
        }
        try {
            applyVisualDraft(doc, history.present, originals.current);
        } catch (error) {
            setIsError(true);
            setStatus("미리보기 적용 중 오류: " + String(error));
        }
        doc.querySelectorAll("[data-cms-visual-selected], [data-cms-visual-hover]").forEach((el) => {
            el.removeAttribute("data-cms-visual-selected");
            el.removeAttribute("data-cms-visual-hover");
        });
        const selected = selection ? resolveElement(doc, selection.selector) : null;
        if (selected) selected.setAttribute("data-cms-visual-selected", "true");
        try {
            const captured = capturePageTree({ document: doc, path, viewport });
            setSnapshot(captured);
            setLayers(flattenTree(captured.nodes, collapsed));
        } catch {
            setLayers([]);
        }
        refreshOverlay();

        if (mode === "preview") return;
        const pointerOver = (event: PointerEvent) => {
            const el = htmlTarget(event);
            if (!el || el === doc.body) return;
            doc.querySelector("[data-cms-visual-hover]")?.removeAttribute("data-cms-visual-hover");
            el.setAttribute("data-cms-visual-hover", "true");
        };
        const commitEditing = (restore = false) => {
            const editing = editingRef.current;
            if (!editing) return;
            editingRef.current = null;
            const element = editing.element;
            element.removeAttribute("contenteditable");
            element.removeAttribute("data-cms-editing");
            const nextText = (element.textContent || "").replace(/\s+/g, " ").trim();
            if (restore || !nextText || nextText === editing.original.trim()) {
                element.textContent = editing.original;
                return;
            }
            mutate((current) => upsertVisualPatch(current, editing.selector, { text: nextText }));
        };
        const click = (event: MouseEvent) => {
            const el = htmlTarget(event);
            if (!el || el === doc.body) return;
            if (el.closest("[data-cms-editing]")) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (editingRef.current) commitEditing();
            selectBySelector(visualSelectorFor(el));
        };
        const doubleClick = (event: MouseEvent) => {
            const el = htmlTarget(event);
            if (!el || el === doc.body) return;
            if (!EDITABLE_TAGS.has(el.tagName) || el.children.length > 0) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const selector = visualSelectorFor(el);
            selectBySelector(selector);
            el.setAttribute("contenteditable", "true");
            el.setAttribute("data-cms-editing", "true");
            editingRef.current = { element: el, selector, original: el.textContent || "" };
            el.focus();
            const range = doc.createRange();
            range.selectNodeContents(el);
            const selectionRange = doc.defaultView?.getSelection();
            selectionRange?.removeAllRanges();
            selectionRange?.addRange(range);
            setMode("text");
            setStatus("텍스트를 직접 수정하고 Enter 또는 바깥을 클릭하면 초안에 반영됩니다. Esc는 취소입니다.");
        };
        const keyDown = (event: KeyboardEvent) => {
            if (!editingRef.current) return;
            if (event.key === "Enter") {
                event.preventDefault();
                commitEditing();
            } else if (event.key === "Escape") {
                event.preventDefault();
                commitEditing(true);
            }
        };
        const blur = (event: Event) => {
            if (!editingRef.current) return;
            const target = event.target as Element | null;
            if (target && editingRef.current.element.contains(target)) return;
            commitEditing();
        };
        const pointerDown = (event: PointerEvent) => {
            if (mode !== "move") return;
            const el = htmlTarget(event);
            if (!el || el === doc.body) return;
            event.preventDefault();
            const selector = visualSelectorFor(el);
            const previous = history.present.patches.find((p) => p.selector === selector)?.style?.translate || "";
            const match = previous.match(/^(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px$/);
            dragRef.current = {
                element: el,
                selector,
                startX: event.clientX,
                startY: event.clientY,
                baseX: match ? Number(match[1]) : 0,
                baseY: match ? Number(match[2]) : 0,
            };
            selectBySelector(selector);
        };
        const pointerMove = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            const x = Math.round(drag.baseX + event.clientX - drag.startX);
            const y = Math.round(drag.baseY + event.clientY - drag.startY);
            drag.element.style.setProperty("translate", x + "px " + y + "px");
            refreshOverlay();
        };
        const pointerUp = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            dragRef.current = null;
            const x = Math.round(drag.baseX + event.clientX - drag.startX);
            const y = Math.round(drag.baseY + event.clientY - drag.startY);
            mutate((current) => upsertVisualPatch(current, drag.selector, { style: { translate: x + "px " + y + "px" } }));
        };
        doc.addEventListener("pointerover", pointerOver, true);
        doc.addEventListener("click", click, true);
        doc.addEventListener("dblclick", doubleClick, true);
        doc.addEventListener("keydown", keyDown, true);
        doc.addEventListener("focusout", blur, true);
        doc.addEventListener("pointerdown", pointerDown, true);
        doc.addEventListener("pointermove", pointerMove, true);
        doc.addEventListener("pointerup", pointerUp, true);
        doc.addEventListener("scroll", refreshOverlay, true);
        doc.defaultView?.addEventListener("resize", refreshOverlay);
        return () => {
            doc.removeEventListener("pointerover", pointerOver, true);
            doc.removeEventListener("click", click, true);
            doc.removeEventListener("dblclick", doubleClick, true);
            doc.removeEventListener("keydown", keyDown, true);
            doc.removeEventListener("focusout", blur, true);
            doc.removeEventListener("pointerdown", pointerDown, true);
            doc.removeEventListener("pointermove", pointerMove, true);
            doc.removeEventListener("pointerup", pointerUp, true);
            doc.removeEventListener("scroll", refreshOverlay, true);
            doc.defaultView?.removeEventListener("resize", refreshOverlay);
        };
    }, [collapsed, frameReady, history.present, mode, mutate, path, refreshOverlay, selectBySelector, selection, viewport]);

    useEffect(() => {
        refreshOverlay();
    }, [refreshOverlay, zoom, viewport]);

    // 2-b) React 하이드레이션 전에 iframe 로드가 이미 끝난 경우에도 캔버스를 연결합니다.
    // (이 경우 load 이벤트를 놓쳐 레이어·선택기능이 비어 보이는 문제를 막습니다.)
    useEffect(() => {
        const frame = iframeRef.current;
        if (!frame) return;
        let cancelled = false;
        const mark = () => {
            const doc = frame.contentDocument;
            if (!cancelled && doc?.readyState === "complete" && doc.body) {
                setFrameReady(true);
                return true;
            }
            return false;
        };
        if (mark()) return;
        const timer = window.setInterval(() => {
            if (mark()) window.clearInterval(timer);
        }, 400);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [path]);

    const setPatch = (change: Parameters<typeof upsertVisualPatch>[2]) => {
        if (!selection) return;
        mutate((current) => upsertVisualPatch(current, selection.selector, change));
    };

    const currentPatch = useMemo(
        () => history.present.patches.find((item) => item.selector === selection?.selector),
        [history.present, selection],
    );

    const navigate = (candidate: string) => {
        const next = normalizeVisualPath(candidate);
        if (!next) {
            setStatus("보안을 위해 공개 콘텐츠 페이지 경로만 편집할 수 있습니다.");
            setIsError(true);
            return;
        }
        if (dirty && !window.confirm("현재 페이지에 저장하지 않은 변경사항이 있습니다. 다른 페이지로 이동할까요?")) return;
        setPath(next);
        setManualPath(next);
        setMode("select");
    };

    const insertPreset = (preset: VisualPresetId, parentSelector?: string) => {
        const frameDoc = iframeRef.current?.contentDocument;
        if (!frameDoc?.body) return;
        const target = parentSelector
            ? resolveElement(frameDoc, parentSelector)
            : selection
              ? resolveElement(frameDoc, selection.selector)
              : null;
        const parent =
            target && ["MAIN", "SECTION", "ARTICLE", "DIV", "FORM", "UL"].includes(target.tagName)
                ? target
                : target?.parentElement || frameDoc.querySelector("#main") || frameDoc.body;
        const result = addVisualElement(history.present, {
            parent: visualSelectorFor(parent),
            preset,
        });
        if (!result.added) {
            setIsError(true);
            setStatus("요소를 삽입할 수 없습니다. 부모 컨테이너를 선택해 주세요.");
            return;
        }
        setHistory((current) => pushVisualHistory(current, result.document));
        setDirty(true);
        setIsError(false);
        setStatus(
            (VISUAL_PRESETS.find((item) => item.id === preset)?.label || preset) +
                " 요소를 " +
                (parent.getAttribute("aria-label") || parent.tagName.toLowerCase()) +
                " 안에 삽입했습니다. 우측 인스펙터에서 세부 값을 조정하세요.",
        );
        setSelection(null);
    };

    const deleteSelected = () => {
        if (!selection) return;
        if (selection.selector.startsWith("[data-cms-added=")) {
            mutate((doc) => removeVisualElement(doc, selection.selector));
            setStatus("삽입한 요소를 초안에서 제거했습니다.");
        } else {
            mutate((doc) => upsertVisualPatch(doc, selection.selector, { hidden: !currentPatch?.hidden }));
            setStatus(currentPatch?.hidden ? "원본 요소를 다시 표시합니다." : "원본 요소를 숨김 처리했습니다(React 코드는 그대로).");
        }
        setSelection(null);
    };

    const checkAdmin = async (): Promise<boolean> => {
        if (!supabase || !userId) return false;
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user?.id !== userId) return false;
        const { data: permitted, error } = await supabase.rpc(CMS_ADMIN_RPC, { p_user_id: userId });
        if (error || permitted !== true) return false;
        return true;
    };

    const save = async () => {
        if (!supabase || loading || !userId) {
            setIsError(false);
            setStatus(
                userId
                    ? "DB 연결이 준비되지 않았습니다. 편집한 내용은 이 브라우저에 안전하게 보관됩니다."
                    : "편집한 내용은 이 브라우저에 자동 보관됩니다. DB 초안 저장은 관리자 Google 로그인 후 사용할 수 있습니다.",
            );
            return;
        }
        setIsSaving(true);
        try {
            if (!(await checkAdmin())) throw new Error("서버의 활성 CMS 관리자 검증에 실패했습니다. 다시 로그인하세요.");
            const clean = sanitizeVisualDocument(history.present, path);
            const checksum = visualDocumentChecksum(clean);
            if (revision === 0) {
                const { data, error } = await supabase
                    .from(CMS_VISUAL_DOCUMENTS_TABLE)
                    .insert({
                        target_path: path,
                        document: clean,
                        revision: 1,
                        status: "draft",
                        checksum,
                        published_revision: 0,
                        updated_by: userId,
                    })
                    .select("revision")
                    .single();
                if (error) throw error;
                setRevision(Number(data.revision));
            } else {
                const { data, error } = await supabase
                    .from(CMS_VISUAL_DOCUMENTS_TABLE)
                    .update({ document: clean, revision: revision + 1, checksum, status: "draft", updated_at: new Date().toISOString(), updated_by: userId })
                    .eq("target_path", path)
                    .eq("revision", revision)
                    .select("revision")
                    .maybeSingle();
                if (error) throw error;
                if (!data) throw new Error("동시 편집 충돌입니다. 서버 리비전이 바뀌었으므로 덮어쓰지 않았습니다. 새로고침 후 다시 시도하세요.");
                setRevision(Number(data.revision));
            }
            setDirty(false);
            setIsError(false);
            setStatus("Supabase DB에 비공개 시각 초안을 저장했습니다. 운영 사이트에는 아직 게시되지 않았습니다.");
        } catch (error) {
            setIsError(true);
            setStatus("DB 저장 실패: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsSaving(false);
        }
    };

    const publish = async () => {
        if (!supabase || revision === 0) {
            setIsError(false);
            setStatus(
                revision === 0
                    ? "먼저 DB 초안을 저장해야 발행할 수 있습니다. 지금 편집은 브라우저 로컬 초안으로 보관됩니다."
                    : "발행에는 DB 연결과 관리자 로그인이 필요합니다. 편집 내용은 브라우저에 보관되어 있습니다.",
            );
            return;
        }
        if (dirty) {
            setIsError(true);
            setStatus("저장되지 않은 변경이 있습니다. 먼저 'DB 초안 저장'을 실행하세요.");
            return;
        }
        const note = window.prompt("발행 메모(감사 기록)", path + " 시각 디자인 발행");
        if (note === null) return;
        if (!window.confirm("초안 r" + revision + "을 발행 리비전으로 확정할까요? 발행 이력에 불변 스냅샷이 남습니다.")) return;
        setIsPublishing(true);
        try {
            if (!(await checkAdmin())) throw new Error("서버의 활성 CMS 관리자 검증에 실패했습니다.");
            const { data, error } = await supabase.rpc(CMS_PUBLISH_RPC, {
                p_path: path,
                p_expected_revision: revision,
                p_note: note.slice(0, 500),
            });
            if (error) throw error;
            const row = (data || {}) as { published_revision?: number };
            const nextPublished = Number(row.published_revision) || publishedRevision + 1;
            setPublishedRevision(nextPublished);
            setIsError(false);
            setStatus(
                "발행 리비전 r" + nextPublished + "을(를) DB에 확정했습니다. KV 미러·Cloudflare 캐시 무효화는 MCP/API 발행 경로에서 수행됩니다.",
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setIsError(true);
            setStatus(
                "발행 실패: " +
                    message +
                    (/could not find the function|PGRST202|42883/i.test(message)
                        ? " - 발행 RPC가 DB에 없습니다. 마이그레이션 20261111_cms_visual_wysiwyg_mcp.sql을 적용하세요."
                        : ""),
            );
        } finally {
            setIsPublishing(false);
        }
    };

    // [단축키: 되돌리기·다시 실행·DB 저장 / Shortcuts: undo, redo, save]
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey)) return;
            const key = event.key.toLowerCase();
            if (key === "z") {
                event.preventDefault();
                if (event.shiftKey) setHistory(redoVisualHistory);
                else setHistory(undoVisualHistory);
                setDirty(true);
            } else if (key === "s") {
                event.preventDefault();
                void save();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const syncTree = async () => {
        const frameDoc = iframeRef.current?.contentDocument;
        if (!supabase || !frameDoc || !userId) {
            setIsError(true);
            setStatus("캔버스와 DB 연결이 준비되지 않았습니다.");
            return;
        }
        setTreeSyncing(true);
        try {
            const captured = capturePageTree({
                document: frameDoc,
                path,
                viewport,
                url: "https://renewsejongpac.rhee.life/v5" + (path === "/" ? "/" : path + "/"),
            });
            const { error } = await supabase.from(CMS_PAGE_SNAPSHOTS_TABLE).upsert(
                {
                    target_path: captured.path,
                    tree: captured.nodes,
                    checksum: captured.checksum,
                    viewport: captured.viewport,
                    url: captured.url,
                    captured_at: captured.capturedAt,
                    updated_at: new Date().toISOString(),
                    updated_by: userId,
                },
                { onConflict: "target_path" },
            );
            if (error) throw error;
            setSnapshot(captured);
            setTreeSyncedAt(captured.capturedAt);
            setIsError(false);
            setStatus("페이지 트리 " + captured.nodeCount + "개 요소를 DB에 저장했습니다. 코딩 에이전트가 cms_get_page_tree로 읽습니다.");
        } catch (error) {
            setIsError(true);
            setStatus("페이지 트리 저장 실패: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setTreeSyncing(false);
        }
    };

    const onImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            if (file.size > 500_000) throw new Error("초안 JSON 파일은 500KB 이하만 허용됩니다.");
            const imported = sanitizeVisualDocument(JSON.parse(await file.text()), path);
            mutate(() => imported);
            setIsError(false);
            setStatus("JSON 초안을 현재 페이지 미리보기에 적용했습니다. DB 저장은 별도로 필요합니다.");
        } catch (error) {
            setIsError(true);
            setStatus("초안 가져오기 실패: " + String(error));
        }
        event.target.value = "";
    };

    const routes = useMemo(() => {
        const set = new Set(["/", "/programs", "/about/introduction", "/visit/area"]);
        for (const page of catalog.pages) {
            const parsed = normalizeVisualPath(page.path);
            if (parsed) set.add(parsed);
        }
        return [...set];
    }, [catalog.pages]);

    const visibleLayers = layers.filter((layer) => !filter || layer.label.toLowerCase().includes(filter.toLowerCase()));
    const stageWidth = viewport === "desktop" ? "100%" : viewport === "tablet" ? "768px" : "390px";
    const changes = countVisualChanges(history.present);

    const agentRequest = useMemo(() => {
        const lines = [
            "[세종문화회관 CMS 요청]",
            "페이지: " + path,
            "선택 요소: " + (selection ? selection.tag + " · " + selection.selector : "없음"),
        ];
        if (selection?.text) {
            lines.push("요소 텍스트: " + selection.text.replace(/\s+/g, " ").trim().slice(0, 120));
        }
        lines.push(
            "초안 변경: 수정 " + changes.patches + " · 삽입 " + changes.additions + " · 숨김 " + changes.hidden,
            "체크섬: " + visualDocumentChecksum(history.present).slice(0, 16),
            "요청: " + (agentPrompt.trim() || "현재 선택 요소를 사이트 디자인 시스템에 맞게 정리해 줘"),
        );
        return lines.join("\n");
    }, [agentPrompt, changes.additions, changes.hidden, changes.patches, history.present, path, selection]);

    const copyAgentRequest = async () => {
        try {
            await navigator.clipboard.writeText(agentRequest);
            setIsError(false);
            setStatus("에이전트 요청문을 클립보드에 복사했습니다. MCP 에이전트 대화에 붙여넣어 실행하세요.");
        } catch {
            setIsError(false);
            setStatus("브라우저가 클립보드 복사를 허용하지 않았습니다. 요청 내용을 직접 선택해 복사해 주세요.");
        }
    };

    const clearLocalDraft = () => {
        try {
            window.localStorage.removeItem(LOCAL_DRAFT_PREFIX + path);
        } catch {
            /* 저장 공간을 쓸 수 없어도 편집은 계속됩니다. */
        }
        setHistory(createVisualHistory(emptyVisualDocument(path)));
        setSelection(null);
        setDirty(false);
        setIsError(false);
        setStatus(path + "의 브라우저 로컬 초안을 비우고 원본 페이지 상태로 되돌렸습니다.");
    };
    const selectionIsContainer = Boolean(
        selection && ["main", "section", "article", "div", "ul", "form", "header", "footer", "figure"].includes(selection.tag),
    );

    return (
        <div className="cms-visual-designer" data-text="body" data-component-id="cms-visual-designer">
            <header className="cms-visual-topbar">
                <div className="cms-visual-brand">
                    <strong data-text="heading">세종문화회관 · 비주얼 스튜디오</strong>
                    <span data-text="meta">실제 사이트를 그대로 보며 클릭·더블클릭으로 고치는 피그마형 편집 캔버스</span>
                </div>
                <div className="cms-visual-top-actions">
                    <SystemBadge tone={access === "admin" ? "info" : "neutral"} title={accessMessage}>
                        {access === "admin"
                            ? "관리자 연결 · DB 저장 가능" + (accessHandle ? " (" + accessHandle + ")" : "")
                            : access === "checking"
                              ? "세션 확인 중"
                              : "샌드박스 편집 · 브라우저 보관"}
                    </SystemBadge>
                    <SystemBadge tone={dirty ? "highlight" : "neutral"}>
                        {dirty ? "저장되지 않은 변경" : "변경 없음"} · r{revision} / 발행 r{publishedRevision}
                    </SystemBadge>
                    <SystemLink href="/" variant="quiet">사이트 보기</SystemLink>
                    {access === "admin" ? null : (
                        <SystemLink href="/login" variant="quiet">관리자 로그인</SystemLink>
                    )}
                    <SystemButton variant="secondary" disabled={!history.past.length} onClick={() => { setHistory(undoVisualHistory); setDirty(true); }}>실행 취소</SystemButton>
                    <SystemButton variant="secondary" disabled={!history.future.length} onClick={() => { setHistory(redoVisualHistory); setDirty(true); }}>다시 실행</SystemButton>
                    <SystemButton variant="secondary" onClick={() => downloadDraft(history.present)}>JSON 내보내기</SystemButton>
                    <SystemButton variant="secondary" disabled={isPublishing || loading || revision === 0} onClick={() => void publish()}>
                        {isPublishing ? "발행 중…" : "발행"}
                    </SystemButton>
                    <SystemButton variant="primary" disabled={isSaving || loading || !dirty} onClick={() => void save()}>
                        {isSaving ? "DB 저장 중…" : "DB 초안 저장"}
                    </SystemButton>
                </div>
            </header>
            {accessMessage ? (
                <p className="cms-visual-access-note" data-text="caption" data-access={access}>{accessMessage}</p>
            ) : null}
            <section className="cms-visual-navigation" aria-label="편집 위치 및 도구">
                <SystemField label="페이지 목록" as="select" value={path} onChange={(e) => navigate(e.target.value)}>
                    {routes.map((route) => <option key={route} value={route} data-text="body">{route}</option>)}
                </SystemField>
                <div className="cms-visual-route-input">
                    <SystemField label="직접 경로" value={manualPath} onChange={(e) => setManualPath(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") navigate(manualPath); }} />
                    <SystemButton variant="quiet" onClick={() => navigate(manualPath)}>이동</SystemButton>
                </div>
                <div className="cms-visual-tool-group" role="group" aria-label="캔버스 도구">
                    <SystemFilterButton selected={mode === "select"} onClick={() => setMode("select")}>선택 V</SystemFilterButton>
                    <SystemFilterButton selected={mode === "move"} onClick={() => setMode("move")}>이동 M</SystemFilterButton>
                    <SystemFilterButton selected={mode === "text"} onClick={() => setMode("text")}>텍스트 더블클릭</SystemFilterButton>
                    <SystemFilterButton selected={mode === "preview"} onClick={() => setMode("preview")}>사이트 작동 미리보기</SystemFilterButton>
                </div>
                <div className="cms-visual-tool-group" role="group" aria-label="화면 너비">
                    <SystemFilterButton selected={viewport === "desktop"} onClick={() => setViewport("desktop")}>PC</SystemFilterButton>
                    <SystemFilterButton selected={viewport === "tablet"} onClick={() => setViewport("tablet")}>태블릿</SystemFilterButton>
                    <SystemFilterButton selected={viewport === "mobile"} onClick={() => setViewport("mobile")}>모바일</SystemFilterButton>
                </div>
                <div className="cms-visual-tool-group" role="group" aria-label="확대">
                    <SystemFilterButton selected={zoom === 50} onClick={() => setZoom(50)}>50%</SystemFilterButton>
                    <SystemFilterButton selected={zoom === 75} onClick={() => setZoom(75)}>75%</SystemFilterButton>
                    <SystemFilterButton selected={zoom === 100} onClick={() => setZoom(100)}>100%</SystemFilterButton>
                </div>
            </section>
            <div className="cms-visual-status" role={isError ? "alert" : "status"} data-error={isError} data-text="body">{status}</div>
            <div className="cms-visual-workspace">
                <aside className="cms-visual-left" aria-label="페이지, 컴포넌트 팔레트, 레이어">
                    <div className="cms-visual-pane-heading">
                        <h2 data-text="item-title">컴포넌트</h2>
                        <span data-text="meta">클릭 또는 레이어로 드래그</span>
                    </div>
                    <div className="cms-visual-palette" role="list">
                        {VISUAL_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                role="listitem"
                                className="cms-visual-palette-item"
                                data-text="body"
                                data-system-part="palette-item"
                                draggable
                                onDragStart={() => setDragPreset(preset.id)}
                                onDragEnd={() => setDragPreset(null)}
                                onClick={() => insertPreset(preset.id)}
                                title={preset.description}
                            >
                                <span className="cms-visual-palette-glyph" aria-hidden="true" data-glyph={preset.id} />
                                <span className="cms-visual-palette-label" data-text="body">{preset.label}</span>
                                <span className="cms-visual-palette-tag" data-text="meta">{preset.tag}</span>
                            </button>
                        ))}
                    </div>
                    <div className="cms-visual-pane-heading">
                        <h2 data-text="item-title">레이어</h2>
                        <span data-text="meta">{layers.length}개 · {collapsed.size}개 접힘</span>
                    </div>
                    <SystemField label="레이어 검색" labelHidden value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="예: section, h2, 버튼" />
                    <div
                        className="cms-visual-layer-list"
                        role="tree"
                        aria-label="DOM 레이어 트리"
                        data-drop-active={dragPreset ? "true" : "false"}
                        onDragOver={(e) => { if (dragPreset) e.preventDefault(); }}
                        onDrop={(e) => {
                            if (!dragPreset) return;
                            e.preventDefault();
                            const target = (e.target as HTMLElement).closest("[data-layer-selector]") as HTMLElement | null;
                            insertPreset(dragPreset, target?.getAttribute("data-layer-selector") || undefined);
                            setDragPreset(null);
                        }}
                    >
                        {visibleLayers.map((layer, index) => (
                            <div key={layer.selector + "-" + index} className="cms-visual-layer-row" style={{ paddingLeft: 6 + layer.depth * 12 }}>
                                <button
                                    type="button"
                                    className="cms-visual-layer-toggle"
                                    data-text="action"
                                    data-system-part="layer-toggle"
                                    aria-label={collapsed.has(layer.selector) ? "펼치기" : "접기"}
                                    disabled={!layer.children}
                                    onClick={() => {
                                        setCollapsed((current) => {
                                            const next = new Set(current);
                                            if (next.has(layer.selector)) next.delete(layer.selector);
                                            else next.add(layer.selector);
                                            return next;
                                        });
                                    }}
                                >
                                    {layer.children ? (collapsed.has(layer.selector) ? "▸" : "▾") : "·"}
                                </button>
                                <button
                                    type="button"
                                    className="cms-visual-layer"
                                    data-layer-selector={layer.selector}
                                    data-system-part="layer-select"
                                    data-selected={selection?.selector === layer.selector}
                                    data-added={layer.added}
                                    title={layer.selector}
                                    onClick={() => { selectBySelector(layer.selector); setMode("select"); }}
                                >
                                    <span className="cms-visual-layer-tag" data-text="meta">{layer.tag}</span>
                                    <span className="cms-visual-layer-label" data-text="body">{layer.label}</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </aside>
                <section className="cms-visual-center" aria-label="실제 사이트 편집 캔버스">
                    <div className="cms-visual-canvas-meta">
                        <span data-text="label">{"/v5" + (path === "/" ? "/" : path + "/")}</span>
                        <span data-text="meta">
                            {frameReady
                                ? (viewport === "desktop" ? "반응형 · 100%" : stageWidth) +
                                  " · " + zoom + "% · 수정 " + changes.patches + " · 삽입 " + changes.additions + " · 숨김 " + changes.hidden
                                : "실제 사이트 화면을 불러오는 중…"}
                        </span>
                    </div>
                    {selection ? (
                        <div className="cms-visual-breadcrumb" aria-label="선택 경로">
                            {selection.breadcrumb.map((part, index) => (
                                <span key={part + index} data-text="meta">{part}</span>
                            ))}
                        </div>
                    ) : null}
                    <div className="cms-visual-stage" ref={stageRef}>
                        <div className="cms-visual-viewport" style={{ width: stageWidth, transform: "scale(" + zoom / 100 + ")", transformOrigin: "top center" }}>
                            <iframe
                                ref={iframeRef}
                                title="세종문화회관 실제 페이지 시각 편집"
                                src={"/v5" + (path === "/" ? "/" : path + "/")}
                                onLoad={() => {
                                    originals.current.clear();
                                    editingRef.current = null;
                                    setFrameReady(true);
                                    setSelection(null);
                                }}
                            />
                            {overlay ? (
                                <div className="cms-visual-measure" style={{ left: overlay.left, top: overlay.top, width: overlay.width, height: overlay.height }} aria-hidden="true">
                                    <span className="cms-visual-measure-label" data-text="meta">{overlay.label}</span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <div className="cms-visual-help-row">
                        <p data-text="caption" className="cms-visual-help">
                            선택: 요소 클릭 · 이동: 드래그 · 텍스트: 더블클릭 후 바로 입력 · 팔레트: 클릭하거나 레이어로 드래그 · 우측 패널: 레이아웃·간격·글자·표면·속성.
                        </p>
                        <SystemButton variant="secondary" disabled={treeSyncing || !frameReady} onClick={() => void syncTree()}>
                            {treeSyncing ? "트리 저장 중…" : "트리 동기화"}
                        </SystemButton>
                    </div>
                </section>
                <aside className="cms-visual-right" aria-label="선택 요소 속성">
                    <div className="cms-visual-pane-heading">
                        <h2 data-text="item-title">인스펙터</h2>
                        <span data-text="meta">{selection ? selection.tag.toUpperCase() : "선택 없음"}</span>
                    </div>
                    {!selection ? (
                        <SystemNotice variant="flow">
                            페이지에서 요소를 선택하세요. 레이아웃·간격·글자·표면·속성을 피그마처럼 조정할 수 있습니다.
                        </SystemNotice>
                    ) : (
                        <div className="cms-visual-inspector">
                            <div className="cms-visual-selection">
                                <strong data-text="label">{selection.tag.toUpperCase()}</strong>
                                <p data-text="meta" title={selection.selector}>{selection.selector}</p>
                                <div className="cms-visual-selection-actions">
                                    <SystemButton variant="secondary" onClick={deleteSelected}>
                                        {currentPatch?.hidden ? "다시 표시" : selection.selector.startsWith("[data-cms-added=") ? "요소 제거" : "요소 숨김"}
                                    </SystemButton>
                                    <SystemButton variant="quiet" onClick={() => insertPreset("text")} disabled={!selectionIsContainer}>안에 텍스트 추가</SystemButton>
                                </div>
                            </div>

                            <section className="cms-visual-inspector-section">
                                <h3 data-text="label">속성 · Attributes</h3>
                                {selection.isLeaf ? (
                                    <SystemField as="textarea" rows={3} label="텍스트 내용"
                                        value={currentPatch?.text ?? selection.text}
                                        onChange={(e) => setPatch({ text: e.target.value })} />
                                ) : null}
                                {selection.isImage ? (
                                    <>
                                        <SystemField label="이미지 주소" value={currentPatch?.src ?? selection.src}
                                            onChange={(e) => { if (isSafeVisualUrl(e.target.value)) setPatch({ src: e.target.value }); }}
                                            hint="https:// 또는 사이트 내부 /v5/ 경로만 사용합니다." />
                                        <SystemField label="대체 텍스트" value={currentPatch?.alt ?? selection.alt}
                                            onChange={(e) => setPatch({ alt: e.target.value })} />
                                    </>
                                ) : null}
                                {selection.isLink ? (
                                    <SystemField label="링크 주소" value={currentPatch?.href ?? selection.href}
                                        onChange={(e) => { if (isSafeVisualUrl(e.target.value)) setPatch({ href: e.target.value }); }}
                                        hint="안전한 HTTPS 또는 사이트 경로만 허용합니다." />
                                ) : null}
                                <SystemFilterButton selected={Boolean(currentPatch?.hidden)} onClick={() => setPatch({ hidden: !currentPatch?.hidden })}>
                                    {currentPatch?.hidden ? "숨김 상태 · 다시 표시" : "표시 상태 · 숨기기"}
                                </SystemFilterButton>
                            </section>

                            {VISUAL_STYLE_GROUPS.map((group) => (
                                <details key={group.id} open={group.id === "layout" || group.id === "spacing"} className="cms-visual-style-group">
                                    <summary data-text="label">{group.label}</summary>
                                    <div className="cms-visual-style-fields">
                                        {group.keys.map((key) => {
                                            const field = VISUAL_STYLE_FIELDS.find((it) => it.key === key)!;
                                            const value = currentPatch?.style?.[key as VisualStyleKey] || "";
                                            const enumValues = STYLE_ENUMS[key];
                                            if (enumValues) {
                                                return (
                                                    <div key={key} className="cms-visual-field-block">
                                                        <span className="cms-visual-field-label" data-text="label">{field.label}</span>
                                                        <div className="cms-visual-segments" role="group" aria-label={field.label}>
                                                            {enumValues.map((option) => (
                                                                <SystemFilterButton
                                                                    key={option}
                                                                    selected={(value || selection.computed[key]) === option}
                                                                    onClick={() => {
                                                                        if (value === option) mutate((current) => removeVisualStyle(current, selection.selector, key as VisualStyleKey));
                                                                        else setPatch({ style: { [key]: option } });
                                                                    }}
                                                                >
                                                                    {option}
                                                                </SystemFilterButton>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            if (key === "background-color" || key === "color" || key === "border-color") {
                                                return (
                                                    <div key={key} className="cms-visual-field-block">
                                                        <SystemField label={field.label} value={value}
                                                            placeholder={selection.computed[key] || "기본값 유지"}
                                                            onChange={(e) => {
                                                                const safe = sanitizeVisualStyle(key, e.target.value);
                                                                if (safe !== null) setPatch({ style: { [key]: safe } });
                                                                else if (!e.target.value.trim()) mutate((current) => removeVisualStyle(current, selection.selector, key as VisualStyleKey));
                                                            }} />
                                                        <div className="cms-visual-swatches">
                                                            {COLOR_TOKENS.map((token) => (
                                                                <button key={token.value} type="button" className="cms-visual-swatch" title={token.label}
                                                                    aria-label={token.label + " 색상 토큰"}
                                                                    data-system-part="color-swatch"
                                                                    style={{ background: token.value }}
                                                                    onClick={() => setPatch({ style: { [key]: token.value } })} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            if (key === "opacity") {
                                                const numeric = Number(value || selection.computed[key] || 1);
                                                return (
                                                    <div key={key} className="cms-visual-field-block">
                                                        <span className="cms-visual-field-label" data-text="label">{field.label} · {Number.isFinite(numeric) ? Math.round(numeric * 100) : 100}%</span>
                                                        <input className="cms-visual-range" type="range" min={0} max={1} step={0.05}
                                                            data-system-part="opacity-range"
                                                            value={Number.isFinite(numeric) ? numeric : 1}
                                                            onChange={(e) => setPatch({ style: { opacity: e.target.value } })} />
                                                    </div>
                                                );
                                            }
                                            return (
                                                <SystemField key={key} label={field.label} value={value}
                                                    placeholder={selection.computed[key] || "기본값 유지"}
                                                    onChange={(e) => {
                                                        const safe = sanitizeVisualStyle(key, e.target.value);
                                                        if (safe !== null) setPatch({ style: { [key]: safe } });
                                                        else if (!e.target.value.trim()) mutate((current) => removeVisualStyle(current, selection.selector, key as VisualStyleKey));
                                                    }} />
                                            );
                                        })}
                                        {group.id === "spacing" ? (
                                            <div className="cms-visual-quick-scale">
                                                {SPACING_SCALE.map((step) => (
                                                    <button key={step} type="button" className="cms-visual-chip" data-text="meta"
                                                        data-system-part="spacing-chip"
                                                        onClick={() => setPatch({ style: { padding: step } })}>{step}</button>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </details>
                            ))}
                            <p data-text="caption">속성은 캔버스에 즉시 적용되지만, DB 초안 저장 전에는 다른 기기와 공유되지 않습니다.</p>
                        </div>
                    )}
                    <section className="cms-visual-agent-dock" aria-label="코딩 에이전트 독">
                        <div className="cms-visual-pane-heading">
                            <h2 data-text="item-title">에이전트</h2>
                            <span data-text="meta">MCP · 코드 수정</span>
                        </div>
                        <SystemField
                            as="textarea"
                            rows={3}
                            label="요청 내용"
                            value={agentPrompt}
                            onChange={(e) => setAgentPrompt(e.target.value)}
                            placeholder="예: 이 영역을 관람 안내 카드 3개로 정리하고 간격을 24px로 맞취 줘"
                        />
                        <p data-text="caption">
                            페이지·선택 요소·변경 내역을 합친 요청문을 만들어 복사합니다. 실제 소스 반영은 이 저장소에서 동작하는 MCP
                            에이전트가 수행합니다.
                        </p>
                        <SystemButton variant="secondary" onClick={() => void copyAgentRequest()}>
                            요청문 복사
                        </SystemButton>
                    </section>
                    <div className="cms-visual-import">
                        <span data-text="label">이력 · 백업 · 트리</span>
                        <p data-text="caption">
                            되돌리기 {history.past.length}단계 · 다시 실행 {history.future.length}단계 · 체크섬 {visualDocumentChecksum(history.present).slice(0, 10)}
                        </p>
                        <p data-text="caption">
                            {snapshot ? "캔버스 트리 " + snapshot.nodeCount + "개 요소" : "캔버스 트리 없음"}
                            {treeSyncedAt ? " · DB 동기화 " + new Date(treeSyncedAt).toLocaleTimeString("ko-KR") : " · 아직 DB에 저장하지 않음"}
                        </p>
                        <label data-text="label" htmlFor="cms-visual-import-file">기존 JSON 초안 가져오기</label>
                        <input data-text="body" id="cms-visual-import-file" type="file" accept=".json,application/json" data-system-part="draft-file-input" onChange={(e) => void onImport(e)} />
                        <p data-text="caption">운영 게시는 발행 RPC로 확정되며, KV·캐시 반영은 MCP/API 발행 파이프라인에서 수행됩니다.</p>
                        <SystemButton variant="quiet" onClick={clearLocalDraft}>
                            브라우저 초안 비우기
                        </SystemButton>
                    </div>
                </aside>
            </div>
        </div>
    );
}
