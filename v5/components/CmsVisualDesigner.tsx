"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StudioField } from "./cms-studio/StudioField";
import { StudioWorkspace } from "./cms-studio/StudioWorkspace";
import { StudioResizeHandle } from "./cms-studio/StudioResizeHandle";
import type { StudioBox } from "../src/cms/studio-resize.ts";
import { StudioToolbar } from "./cms-studio/StudioToolbar";
import type { StudioMode } from "./cms-studio/StudioToolbar";
import { applyVisualDraft, BODY_PREVIEW_STYLE, EDITABLE_TAGS, htmlTarget, resolveElement, selectionSnapshot } from "../src/cms/studio-canvas-dom.ts";
import type { Original, SelectionInfo } from "../src/cms/studio-canvas-dom.ts";
import { STUDIO_ARTBOARDS, studioArtboardScale } from "../src/cms/studio-artboard.ts";
import type { StudioZoom } from "../src/cms/studio-artboard.ts";
import { createStudioWrites } from "../src/cms/studio-writes.ts";
import { readStudioFrame } from "../src/cms/studio-frame.ts";
import { flattenStudioLayers } from "../src/cms/studio-layers.ts";
import { useCatalog } from "../src/catalog/CatalogProvider";
import { supabase } from "../src/lib/supabase.ts";
import {
    CMS_ADMIN_RPC,
    CMS_PAGE_SNAPSHOTS_TABLE,
    CMS_PUBLISH_RPC,
    CMS_VISUAL_DOCUMENTS_TABLE,
} from "../src/cms/cms-tables.ts";
import { capturePageTree, visualSelectorFor } from "../src/cms/page-tree-capture.ts";
import { moveStudioDrag, startStudioDrag, studioShortcut } from "../src/cms/studio-interactions.ts";
import type { StudioDrag, StudioShortcut } from "../src/cms/studio-interactions.ts";
import type { CmsPageSnapshot } from "../src/cms/page-tree.ts";
import {
    VISUAL_PRESETS,
    VISUAL_STYLE_FIELDS,
    VISUAL_STYLE_GROUPS,
    addVisualElement,
    autosaveVisualDraft,
    visualLocalDraftKey,
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

type Viewport = "desktop" | "tablet" | "mobile";
type Overlay = { left: number; top: number; width: number; height: number; label: string };
type Editing = { element: HTMLElement; selector: string; original: string };

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


function readLocalDraft(path: string): VisualDraftDocument | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(visualLocalDraftKey(path));
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
    const [frameBlocked, setFrameBlocked] = useState(false);
    const [frameEpoch, setFrameEpoch] = useState(0);
    const [frameVersion, setFrameVersion] = useState(0);
    const [mode, setMode] = useState<StudioMode>("select");
    const [viewport, setViewport] = useState<Viewport>("desktop");
    const [zoom, setZoom] = useState<StudioZoom>("fit");
    const [stageWidth, setStageWidth] = useState(0);
    const [originalView, setOriginalView] = useState(false);
    const [selection, setSelection] = useState<SelectionInfo | null>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState("");
    const [dragPreset, setDragPreset] = useState<VisualPresetId | null>(null);
    const [overlay, setOverlay] = useState<Overlay | null>(null);
    const [agentPrompt, setAgentPrompt] = useState("");
    const [snapshot, setSnapshot] = useState<CmsPageSnapshot | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const getFrameDocument = useCallback(() => readStudioFrame(iframeRef.current, window.location.origin, path), [path]);
    const stageRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;
        const measure = () => {
            const style = getComputedStyle(stage);
            const width = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            if (width > 0) setStageWidth(width);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(stage);
        return () => observer.disconnect();
    }, []);
    const originals = useRef<Map<HTMLElement, Original>>(new Map());
    const editingRef = useRef<Editing | null>(null);
    const resizing = useRef<{ element: HTMLElement; selector: string; width: string; height: string;
        widthPriority: string; heightPriority: string } | null>(null);
    const dragRef = useRef<{ element: HTMLElement; selector: string; gesture: StudioDrag; value: string; priority: string } | null>(null);
    const [writes] = useState(createStudioWrites);
    const pathRef = useRef(path);
    const markDirty = useCallback(() => { writes.changed(); setDirty(true); }, [writes]);
    const shortcutRef = useRef<(action: StudioShortcut) => boolean>(() => false);
    const cancelDrag = useCallback((pointerId?: number) => {
        const drag = dragRef.current;
        if (!drag || (pointerId != null && drag.gesture.pointerId !== pointerId)) return false;
        dragRef.current = null;
        if (drag.value) drag.element.style.setProperty("translate", drag.value, drag.priority);
        else drag.element.style.removeProperty("translate");
        if (drag.element.hasPointerCapture?.(drag.gesture.pointerId)) drag.element.releasePointerCapture(drag.gesture.pointerId);
        return true;
    }, []);
    // 패널 선택이 갱신되어도 제스처는 이어지고, 도구나 페이지를 바꿀 때만 취소합니다.
    // Preserve the gesture across selection updates; cancel when the tool or page changes.
    useEffect(() => () => { cancelDrag(); }, [cancelDrag, mode, path]);

    const mutate = useCallback((updater: (doc: VisualDraftDocument) => VisualDraftDocument) => {
        setHistory((current) => pushVisualHistory(current, updater(current.present)));
        markDirty();
    }, [markDirty]);

    const refreshOverlay = useCallback(() => {
        const doc = getFrameDocument();
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
        setOverlay({
            left: rect.left,
            top: rect.top,
            width: Math.max(rect.width, 2),
            height: Math.max(rect.height, 2),
            label: selection.tag + " · " + Math.round(rect.width) + "×" + Math.round(rect.height),
        });
    }, [getFrameDocument, selection]);

    const selectBySelector = useCallback((selector: string) => {
        const doc = getFrameDocument();
        if (!doc) return;
        setSelection(selectionSnapshot(doc, selector));
    }, [getFrameDocument]);

    // 1) 페이지 초안 불러오기 (Supabase sejong_cms_visual_documents)
    useEffect(() => {
        let live = true;
        originals.current = new Map();
        editingRef.current = null;
        setFrameReady(false);
        setFrameBlocked(false);
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
        autosaveVisualDraft(() => window.localStorage, path, history.present, dirty);
    }, [dirty, frameReady, history.present, path]);

    // 문서 반영과 레이어 수집은 선택·호버와 독립적으로 수행합니다.
    // Apply a document and capture its layer tree independently of pointer selection.
    useEffect(() => {
        const doc = getFrameDocument();
        if (!frameReady || !doc) return;
        if (!doc.getElementById("cms-visual-preview-style")) {
            const style = doc.createElement("style");
            style.id = "cms-visual-preview-style";
            style.textContent = BODY_PREVIEW_STYLE;
            doc.head.appendChild(style);
        }
        try {
            applyVisualDraft(doc, originalView ? emptyVisualDocument(path) : history.present, originals.current);
        } catch (error) {
            setIsError(true);
            setStatus("미리보기 적용 중 오류: " + String(error));
        }
    }, [frameReady, frameVersion, getFrameDocument, history.present, originalView, path]);

    useEffect(() => {
        const doc = getFrameDocument();
        if (!frameReady || !doc) return;
        try { setSnapshot(capturePageTree({ document: doc, path, viewport })); }
        catch { setSnapshot(null); }
    }, [frameReady, frameVersion, getFrameDocument, history.present, originalView, path, viewport]);

    // Tool listeners can be replaced without reapplying the document.
    useEffect(() => {
        const doc = getFrameDocument();
        if (!frameReady || !doc) return;
        doc.querySelectorAll("[data-cms-visual-selected], [data-cms-visual-hover]").forEach((el) => {
            el.removeAttribute("data-cms-visual-selected");
            el.removeAttribute("data-cms-visual-hover");
        });
        const selected = selection ? resolveElement(doc, selection.selector) : null;
        if (selected && mode !== "preview") selected.setAttribute("data-cms-visual-selected", "true");
        refreshOverlay();
        if (mode === "preview") {
            setOverlay(null);
            const escapePreview = (event: KeyboardEvent) => {
                if (!event.isComposing && event.key === "Escape" && shortcutRef.current("cancel")) event.preventDefault();
            };
            doc.addEventListener("keydown", escapePreview, true);
            return () => doc.removeEventListener("keydown", escapePreview, true);
        }
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
            el.setAttribute("contenteditable", "plaintext-only");
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
            if (event.isComposing || event.keyCode === 229) return;
            if (editingRef.current && (event.key === "Enter" || event.key === "Escape")) {
                event.preventDefault();
                event.stopPropagation();
                commitEditing(event.key === "Escape");
                return;
            }
            const target = htmlTarget(event);
            const action = studioShortcut(event, Boolean(target?.closest("input,textarea,select,[contenteditable]:not([contenteditable=false])")));
            if (action && shortcutRef.current(action)) event.preventDefault();
        };
        const blur = (event: FocusEvent) => {
            const editing = editingRef.current;
            if (!editing || event.target !== editing.element) return;
            const next = event.relatedTarget as Node | null;
            if (next && editing.element.contains(next)) return;
            commitEditing();
        };
        const pointerDown = (event: PointerEvent) => {
            if (mode !== "move" || event.button !== 0 || !event.isPrimary || dragRef.current) return;
            const el = htmlTarget(event);
            if (!el || el === doc.body) return;
            event.preventDefault();
            const selector = visualSelectorFor(el);
            const value = el.style.getPropertyValue("translate");
            dragRef.current = {
                element: el,
                selector,
                value,
                priority: el.style.getPropertyPriority("translate"),
                gesture: startStudioDrag(event.pointerId, { x: event.clientX, y: event.clientY }, value),
            };
            try { el.setPointerCapture?.(event.pointerId); } catch { /* Pointer already ended. */ }
            selectBySelector(selector);
        };
        const pointerMove = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag || drag.gesture.pointerId !== event.pointerId) return;
            const value = moveStudioDrag(drag.gesture, event.pointerId, { x: event.clientX, y: event.clientY });
            if (value) drag.element.style.setProperty("translate", value);
            else if (drag.value) drag.element.style.setProperty("translate", drag.value, drag.priority);
            else drag.element.style.removeProperty("translate");
            refreshOverlay();
        };
        const pointerUp = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag || drag.gesture.pointerId !== event.pointerId) return;
            const value = moveStudioDrag(drag.gesture, event.pointerId, { x: event.clientX, y: event.clientY });
            cancelDrag(event.pointerId);
            if (value && value !== drag.value) {
                mutate((current) => upsertVisualPatch(current, drag.selector, { style: { translate: value } }));
            } else refreshOverlay();
        };
        const pointerCancel = (event: PointerEvent) => {
            if (cancelDrag(event.pointerId)) refreshOverlay();
        };
        doc.addEventListener("pointerover", pointerOver, true);
        doc.addEventListener("click", click, true);
        doc.addEventListener("dblclick", doubleClick, true);
        doc.addEventListener("keydown", keyDown, true);
        doc.addEventListener("focusout", blur, true);
        doc.addEventListener("pointerdown", pointerDown, true);
        doc.addEventListener("pointermove", pointerMove, true);
        doc.addEventListener("pointerup", pointerUp, true);
        doc.addEventListener("pointercancel", pointerCancel, true);
        doc.addEventListener("lostpointercapture", pointerCancel, true);
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
            doc.removeEventListener("pointercancel", pointerCancel, true);
            doc.removeEventListener("lostpointercapture", pointerCancel, true);
            doc.removeEventListener("scroll", refreshOverlay, true);
            doc.defaultView?.removeEventListener("resize", refreshOverlay);
        };
    }, [cancelDrag, frameReady, frameVersion, getFrameDocument, history.present, mode, mutate, refreshOverlay, selectBySelector, selection]);

    useEffect(() => {
        if (mode !== "preview") refreshOverlay();
    }, [mode, refreshOverlay, zoom, viewport]);

    // 2-b) React 하이드레이션 전에 iframe 로드가 이미 끝난 경우에도 캔버스를 연결합니다.
    // (이 경우 load 이벤트를 놓쳐 레이어·선택기능이 비어 보이는 문제를 막습니다.)
    useEffect(() => {
        const frame = iframeRef.current;
        if (!frame) return;
        let cancelled = false;
        const mark = () => {
            const doc = getFrameDocument();
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
    }, [frameEpoch, getFrameDocument]);

    const setPatch = (change: Parameters<typeof upsertVisualPatch>[2]) => {
        if (!selection || originalView) return;
        mutate((current) => upsertVisualPatch(current, selection.selector, change));
    };

    const commitStyle = (key: VisualStyleKey, raw: string): boolean => {
        if (!selection) return false;
        if (!raw.trim()) {
            mutate(current => removeVisualStyle(current, selection.selector, key));
            return true;
        }
        const safe = sanitizeVisualStyle(key, raw);
        if (safe === null) return false;
        setPatch({ style: { [key]: safe } });
        return true;
    };

    const startResize = (): StudioBox | null => {
        const doc = getFrameDocument();
        if (!selection || !doc || resizing.current) return null;
        const element = resolveElement(doc, selection.selector);
        if (!element || element === doc.body) return null;
        const computed = doc.defaultView?.getComputedStyle(element);
        if (!computed || ["none", "contents", "inline"].includes(computed.display)) return null;
        const width = parseFloat(computed.width);
        const height = parseFloat(computed.height);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null;
        resizing.current = { element, selector: selection.selector,
            width: element.style.getPropertyValue("width"), height: element.style.getPropertyValue("height"),
            widthPriority: element.style.getPropertyPriority("width"), heightPriority: element.style.getPropertyPriority("height") };
        return { width, height };
    };

    const previewResize = ({ width, height }: StudioBox) => {
        const active = resizing.current;
        if (!active) return;
        active.element.style.setProperty("width", width + "px");
        active.element.style.setProperty("height", height + "px");
        refreshOverlay();
    };

    const finishResize = (box: StudioBox | null) => {
        const active = resizing.current;
        if (!active) return;
        resizing.current = null;
        const style = active.element.style;
        if (active.width) style.setProperty("width", active.width, active.widthPriority);
        else style.removeProperty("width");
        if (active.height) style.setProperty("height", active.height, active.heightPriority);
        else style.removeProperty("height");
        if (box && active.selector === selection?.selector) {
            mutate(doc => upsertVisualPatch(doc, active.selector, { style: { width: box.width + "px", height: box.height + "px" } }));
        } else refreshOverlay();
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
        if (next === path || writes.busy()) return;
        if (dirty && !window.confirm("현재 페이지에 저장하지 않은 변경사항이 있습니다. 다른 페이지로 이동할까요?")) return;
        pathRef.current = next;
        setPath(next);
        setOriginalView(false);
        setManualPath(next);
        setMode("select");
    };

    const insertPreset = (preset: VisualPresetId, parentSelector?: string) => {
        if (originalView) return;
        const frameDoc = getFrameDocument();
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
        markDirty();
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

    useEffect(() => {
        shortcutRef.current = (action) => {
            if (action === "cancel") {
                const hadDrag = cancelDrag();
                if (hadDrag) refreshOverlay();
                if (selection) setSelection(null);
                if (mode === "preview") { setOriginalView(false); setMode("select"); }
                return hadDrag || Boolean(selection) || mode === "preview";
            }
            if (loading || mode === "preview") return false;
            if (action === "undo" || action === "redo") {
                if (!(action === "undo" ? history.past.length : history.future.length)) return false;
                setHistory(action === "undo" ? undoVisualHistory : redoVisualHistory);
                markDirty();
            } else if (action === "remove") {
                if (!selection) return false;
                deleteSelected();
            } else setMode(action);
            return true;
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
            if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s" && access === "admin" && dirty) {
                event.preventDefault();
                void save();
                return;
            }
            const target = event.target instanceof Element ? event.target : null;
            const action = studioShortcut(event, Boolean(target?.closest("input,textarea,select,button,[contenteditable]:not([contenteditable=false])")));
            if (action && shortcutRef.current(action)) event.preventDefault();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    const checkAdmin = async (): Promise<boolean> => {
        if (!supabase || !userId) return false;
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user?.id !== userId) return false;
        const { data: permitted, error } = await supabase.rpc(CMS_ADMIN_RPC, { p_user_id: userId });
        if (error || permitted !== true) return false;
        return true;
    };

    const save = async () => {
        if (writes.busy()) return;
        if (!supabase || loading || !userId || access !== "admin") {
            setIsError(false);
            setStatus(
                userId
                    ? "DB 연결이 준비되지 않았습니다. 편집한 내용은 이 브라우저에 안전하게 보관됩니다."
                    : "편집한 내용은 이 브라우저에 자동 보관됩니다. DB 초안 저장은 관리자 Google 로그인 후 사용할 수 있습니다.",
            );
            return;
        }
        const request = writes.begin();
        if (!request) return;
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
            const unchanged = writes.isCurrent(request);
            if (unchanged) setDirty(false);
            setIsError(false);
            setStatus(unchanged
                ? "DB 초안을 저장했습니다. 운영 사이트에는 아직 게시되지 않았습니다."
                : "DB에 이전 변경을 저장했습니다. 저장 도중 추가한 편집은 아직 저장되지 않았습니다.");
        } catch (error) {
            setIsError(true);
            setStatus("DB 저장 실패: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            writes.finish(request);
            setIsSaving(false);
        }
    };

    const publish = async () => {
        if (writes.busy()) return;
        if (!supabase || access !== "admin" || revision === 0) {
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
        const request = writes.begin();
        if (!request) return;
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
            writes.finish(request);
            setIsPublishing(false);
        }
    };

    const syncTree = async () => {
        const frameDoc = getFrameDocument();
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
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (!file) return;
        try {
            if (file.size > 500_000) throw new Error("초안 JSON 파일은 500KB 이하만 허용됩니다.");
            const raw = await file.text();
            if (pathRef.current !== path) return;
            const imported = sanitizeVisualDocument(JSON.parse(raw), path);
            mutate(() => imported);
            setIsError(false);
            setStatus("JSON 초안을 현재 페이지 미리보기에 적용했습니다. DB 저장은 별도로 필요합니다.");
        } catch (error) {
            setIsError(true);
            setStatus("초안 가져오기 실패: " + String(error));
        } finally {
            input.value = "";
        }
    };

    const routes = useMemo(() => {
        const set = new Set(["/", "/programs", "/about/introduction", "/visit/area"]);
        for (const page of catalog.pages) {
            const parsed = normalizeVisualPath(page.path);
            if (parsed) set.add(parsed);
        }
        return [...set];
    }, [catalog.pages]);

    const visibleLayers = useMemo(() => flattenStudioLayers(snapshot?.nodes || [], collapsed, filter), [snapshot, collapsed, filter]);
    const artboard = STUDIO_ARTBOARDS[viewport];
    const scale = studioArtboardScale(artboard.width, stageWidth, zoom);
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
        if (writes.busy()) return;
        try {
            window.localStorage.removeItem(visualLocalDraftKey(path));
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
                    <span data-text="meta">{path} · 시각 편집</span>
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
                    <SystemButton variant="secondary" disabled={!history.past.length} onClick={() => { setHistory(undoVisualHistory); markDirty(); }}>실행 취소</SystemButton>
                    <SystemButton variant="secondary" disabled={!history.future.length} onClick={() => { setHistory(redoVisualHistory); markDirty(); }}>다시 실행</SystemButton>
                    <SystemButton variant="secondary" onClick={() => downloadDraft(history.present)}>JSON 내보내기</SystemButton>
                    <SystemButton variant="secondary" disabled={access !== "admin" || isSaving || isPublishing || loading || dirty || revision === 0} onClick={() => void publish()}>
                        {isPublishing ? "발행 중…" : "발행"}
                    </SystemButton>
                    <SystemButton variant="primary" disabled={access !== "admin" || isSaving || isPublishing || loading || !dirty} onClick={() => void save()}>
                        {isSaving ? "DB 저장 중…" : "DB 초안 저장"}
                    </SystemButton>
                </div>
            </header>
            {accessMessage ? (
                <p className="cms-visual-access-note" data-text="caption" data-access={access}>{accessMessage}</p>
            ) : null}
            <StudioToolbar mode={mode} viewport={viewport} zoom={zoom} path={path} manualPath={manualPath}
                original={originalView} routes={routes.includes(path) ? routes : [...routes, path]}
                onMode={tool => { setOriginalView(false); setMode(tool); }}
                onViewport={setViewport} onZoom={setZoom} onPathInput={setManualPath} onNavigate={navigate}
                onOriginal={show => { setOriginalView(show); setMode(show ? "preview" : "select"); setSelection(null); }} />
            <div className="cms-visual-status" role={isError ? "alert" : "status"} data-error={isError} data-text="body">{status}</div>
            <StudioWorkspace layers={<>
                    <div className="cms-visual-pane-heading">
                        <h2 data-text="item-title">컴포넌트</h2>
                        <span data-text="meta">클릭 또는 레이어로 드래그</span>
                    </div>
                    <div className="cms-visual-palette" role="group" aria-label="추가 가능한 컴포넌트">
                        {VISUAL_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                className="cms-visual-palette-item"
                                data-text="body"
                                data-system-part="palette-item"
                                draggable={!originalView}
                                disabled={originalView}
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
                        <span data-text="meta">{visibleLayers.length}개 표시 · {collapsed.size}개 접힘</span>
                    </div>
                    <SystemField label="레이어 검색" labelHidden value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="예: section, h2, 버튼" />
                    {filter.trim() && !visibleLayers.length ? <p data-text="body">일치하는 레이어가 없습니다.</p> : null}
                    <div
                        className="cms-visual-layer-list"
                        role="group"
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
                                    disabled={!layer.children || Boolean(filter.trim())}
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
                                    aria-pressed={selection?.selector === layer.selector}
                                    data-selected={selection?.selector === layer.selector}
                                    data-added={layer.added}
                                    title={layer.selector}
                                    disabled={originalView}
                                    onClick={() => { selectBySelector(layer.selector); setMode("select"); }}
                                >
                                    <span className="cms-visual-layer-tag" data-text="meta">{layer.tag}</span>
                                    <span className="cms-visual-layer-label" data-text="body">{layer.label}</span>
                                </button>
                            </div>
                        ))}
                    </div>
            </>} canvas={<>
                    <div className="cms-visual-canvas-meta">
                        <span data-text="label">{"/v5" + (path === "/" ? "/" : path + "/")}</span>
                        <span data-text="meta">
                            {frameReady
                                ? (originalView ? "원본 · " : "초안 · ") + artboard.width + "×" + artboard.height +
                                  " · " + Math.round(scale * 100) + "% · 수정 " + changes.patches + " · 삽입 " + changes.additions + " · 숨김 " + changes.hidden
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
                        <div className="cms-studio-artboard-shell" style={{ width: artboard.width * scale, height: artboard.height * scale }}>
                        <div className="cms-visual-viewport" style={{ width: artboard.width, height: artboard.height, transform: "scale(" + scale + ")" }}>
                            {frameBlocked ? <div className="cms-visual-frame-fallback" role="status">
                                <p data-text="body">다른 페이지로 이동해 이 아트보드의 편집을 멈췄습니다.</p>
                                <SystemButton variant="secondary" onClick={() => {
                                    setFrameReady(false);
                                    setFrameBlocked(false);
                                    setFrameEpoch(value => value + 1);
                                }}>원래 아트보드 열기</SystemButton>
                            </div> : null}
                            <iframe
                                key={frameEpoch + ":" + path}
                                ref={iframeRef}
                                hidden={frameBlocked}
                                sandbox="allow-scripts allow-same-origin"
                                title="세종문화회관 실제 페이지 시각 편집"
                                src={"/v5" + (path === "/" ? "/" : path + "/")}
                                onLoad={() => {
                                    cancelDrag();
                                    finishResize(null);
                                    originals.current.clear();
                                    editingRef.current = null;
                                    const documentMatches = Boolean(getFrameDocument());
                                    setFrameReady(documentMatches);
                                    if (documentMatches) setFrameVersion(value => value + 1);
                                    setFrameBlocked(!documentMatches);
                                    setSelection(null);
                                    if (!documentMatches) { setSnapshot(null); setOverlay(null); }
                                }}
                            />
                            {overlay ? (
                                <div className="cms-visual-measure" style={{ left: overlay.left, top: overlay.top, width: overlay.width, height: overlay.height }}>
                                    <span className="cms-visual-measure-label" data-text="meta" aria-hidden="true">{overlay.label}</span>
                                    {mode === "select" && selection && selection.tag !== "body"
                                        && !["none", "contents", "inline"].includes(selection.computed.display) ?
                                        <StudioResizeHandle key={selection.selector} scale={scale} start={startResize}
                                            preview={previewResize} end={finishResize} /> : null}
                                </div>
                            ) : null}
                        </div>
                        </div>
                    </div>
                    <div className="cms-visual-help-row">
                        <p data-text="caption" className="cms-visual-help">
                            선택 V · 이동 M · 텍스트 더블클릭 T · 미리보기 P · 취소 Esc
                        </p>
                        <SystemButton variant="secondary" disabled={treeSyncing || !frameReady} onClick={() => void syncTree()}>
                            {treeSyncing ? "트리 저장 중…" : "트리 동기화"}
                        </SystemButton>
                    </div>
            </>} inspector={<>
                    <div className="cms-visual-pane-heading">
                        <h2 data-text="item-title">속성</h2>
                        <span data-text="meta">{selection ? selection.tag.toUpperCase() : "선택 없음"}</span>
                    </div>
                    {!selection ? (
                        <SystemNotice variant="flow">
                            페이지에서 요소를 선택하세요. 레이아웃·간격·글자·표면·속성을 피그마처럼 조정할 수 있습니다.
                        </SystemNotice>
                    ) : (
                        <div className="cms-visual-inspector" key={selection.selector}>
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

                            <section className="cms-visual-inspector-section" key={selection.selector}>
                                <h3 data-text="label">속성</h3>
                                {selection.isLeaf ? (
                                    <StudioField multiline label="텍스트 내용" value={currentPatch?.text ?? selection.text}
                                        onCommit={(text) => { setPatch({ text }); return true; }} />
                                ) : null}
                                {selection.isImage ? (
                                    <>
                                        <StudioField label="이미지 주소" value={currentPatch?.src ?? selection.src}
                                            hint="https:// 또는 사이트 내부 /v5/ 경로만 사용합니다."
                                            onCommit={(src) => { if (!isSafeVisualUrl(src)) return false; setPatch({ src }); return true; }} />
                                        <StudioField label="대체 텍스트" value={currentPatch?.alt ?? selection.alt}
                                            onCommit={(alt) => { setPatch({ alt }); return true; }} />
                                    </>
                                ) : null}
                                {selection.isLink ? (
                                    <StudioField label="링크 주소" value={currentPatch?.href ?? selection.href}
                                        hint="안전한 HTTPS 또는 사이트 경로만 허용합니다."
                                        onCommit={(href) => { if (!isSafeVisualUrl(href)) return false; setPatch({ href }); return true; }} />
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
                                                        <StudioField label={field.label} value={value}
                                                            placeholder={selection.computed[key] || "기본값 유지"}
                                                            onCommit={(raw) => commitStyle(key, raw)} />
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
                                                <StudioField key={key} label={field.label} value={value}
                                                    placeholder={selection.computed[key] || "기본값 유지"}
                                                    onCommit={(raw) => commitStyle(key, raw)} />
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
                    <details className="cms-studio-advanced">
                        <summary data-text="action">작업 도구 · MCP · 백업</summary>
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
                    </details>
            </>} />
        </div>
    );
}
