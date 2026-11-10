"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCatalog } from "../src/catalog/CatalogProvider";
import { supabase } from "../src/lib/supabase.ts";
import {
    VISUAL_STYLE_FIELDS,
    createVisualHistory,
    emptyVisualDocument,
    isSafeVisualUrl,
    normalizeVisualPath,
    pushVisualHistory,
    redoVisualHistory,
    sanitizeVisualDocument,
    sanitizeVisualStyle,
    undoVisualHistory,
    upsertVisualPatch,
} from "../src/cms/visual-document.ts";
import type {
    VisualAddedElement,
    VisualAddTag,
    VisualDraftDocument,
    VisualHistory,
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

type ToolMode = "select" | "move" | "preview";
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
};
type Layer = { selector: string; label: string; depth: number };
type Original = {
    style: string | null;
    text: string | null;
    src: string | null;
    alt: string | null;
    href: string | null;
    hidden: boolean;
};
const EDITABLE_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "SPAN", "STRONG", "EM", "SMALL", "LABEL", "BUTTON", "A", "LI", "FIGCAPTION", "TD", "TH", "TIME"]);
const LAYER_TAGS = new Set(["HEADER", "FOOTER", "MAIN", "SECTION", "ARTICLE", "NAV", "DIV", "H1", "H2", "H3", "P", "A", "BUTTON", "IMG", "UL", "LI", "FIGURE", "SPAN", "SVG"]);
const BODY_PREVIEW_STYLE = '[data-cms-visual-selected="true"]{outline:2px solid var(--color-blue,#3477c9)!important;outline-offset:-2px!important}[data-cms-visual-hover="true"]:not([data-cms-visual-selected]){outline:1px dashed var(--color-blue,#3477c9)!important;outline-offset:-1px!important}';
const STYLE_GROUPS = [
    { name: "타이포그래피", keys: ["color", "font-size", "font-weight", "text-align", "line-height", "letter-spacing"] },
    { name: "크기·배치", keys: ["width", "height", "max-width", "min-height", "display", "flex-direction", "justify-content", "align-items", "translate"] },
    { name: "표면·간격", keys: ["background-color", "padding", "margin", "gap", "border-radius", "opacity"] },
];

function selectorFor(element: Element): string {
    const added = element.closest("[data-cms-added]")?.getAttribute("data-cms-added");
    if (added) return '[data-cms-added="' + added + '"]';
    const segments: string[] = [];
    let current: Element | null = element;
    while (current && current.localName !== "body") {
        const tag = current.localName.toLowerCase();
        let nth = 1;
        let sibling = current.previousElementSibling;
        while (sibling) {
            if (sibling.localName === tag) nth++;
            sibling = sibling.previousElementSibling;
        }
        segments.unshift(tag + ":nth-of-type(" + nth + ")");
        current = current.parentElement;
    }
    return "body" + (segments.length ? " > " + segments.join(" > ") : "");
}

function describeElement(el: Element): string {
    const text = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30);
    const id = el.getAttribute("id");
    return el.tagName.toLowerCase() + (id ? "#" + id : "") + (text ? " · " + text : "");
}

function collectLayers(doc: Document): Layer[] {
    const layers: Layer[] = [];
    const walk = (el: Element, depth: number) => {
        if (layers.length >= 350) return;
        if (["SCRIPT", "STYLE", "NOSCRIPT", "META", "LINK"].includes(el.tagName)) return;
        if (LAYER_TAGS.has(el.tagName) || el.hasAttribute("data-cms-added")) {
            layers.push({ selector: selectorFor(el), label: describeElement(el), depth: Math.min(depth, 5) });
        }
        for (const child of Array.from(el.children)) walk(child, depth + 1);
    };
    for (const child of Array.from(doc.body.children)) walk(child, 0);
    return layers;
}
function resolveElement(doc: Document, selector: string): HTMLElement | null {
    try {
        const element = doc.querySelector(selector);
        return element instanceof HTMLElement ? element : null;
    } catch {
        return null;
    }
}
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
function applyVisualDraft(doc: Document, draft: VisualDraftDocument, originals: Map<HTMLElement, Original>): void {
    restoreOriginals(originals);
    doc.querySelectorAll("[data-cms-added]").forEach((element) => element.remove());
    for (const added of draft.additions) {
        const parent = resolveElement(doc, added.parent);
        if (!parent) continue;
        const node = doc.createElement(added.tag);
        node.setAttribute("data-cms-added", added.id);
        node.setAttribute("data-text", added.tag === "h2" ? "heading" : "body");
        if (added.tag === "img") {
            node.setAttribute("src", added.src || "/v5/assets/favicon.svg");
            node.setAttribute("alt", added.alt || "새 이미지");
        } else {
            node.textContent = added.text;
        }
        if (added.tag === "a") node.setAttribute("href", added.href || "/v5/");
        parent.appendChild(node);
    }
    for (const patch of draft.patches) {
        const el = resolveElement(doc, patch.selector);
        if (!el) continue;
        if (!el.hasAttribute("data-cms-added")) saveOriginal(originals, el);
        if (patch.text !== undefined && el.children.length === 0 && EDITABLE_TAGS.has(el.tagName)) el.textContent = patch.text;
        if (patch.src && el instanceof HTMLImageElement) el.setAttribute("src", patch.src);
        if (patch.alt !== undefined && el instanceof HTMLImageElement) el.setAttribute("alt", patch.alt);
        if (patch.href && el instanceof HTMLAnchorElement) el.setAttribute("href", patch.href);
        if (patch.hidden !== undefined) el.hidden = patch.hidden;
        for (const [name, value] of Object.entries(patch.style || {})) {
            const safe = sanitizeVisualStyle(name, value);
            if (safe != null) el.style.setProperty(name, safe);
        }
    }
}
function selectionSnapshot(doc: Document, selector: string): SelectionInfo | null {
    const el = resolveElement(doc, selector);
    if (!el) return null;
    const styles = doc.defaultView?.getComputedStyle(el);
    const computed: Record<string, string> = {};
    for (const field of VISUAL_STYLE_FIELDS) computed[field.key] = styles?.getPropertyValue(field.key).trim() || "";
    const isImage = el instanceof HTMLImageElement;
    const isLink = el instanceof HTMLAnchorElement;
    return {
        selector, tag: el.tagName.toLowerCase(), text: el.textContent || "",
        src: isImage ? el.getAttribute("src") || "" : "",
        alt: isImage ? el.getAttribute("alt") || "" : "",
        href: isLink ? el.getAttribute("href") || "" : "",
        isLeaf: el.children.length === 0 && EDITABLE_TAGS.has(el.tagName),
        isImage, isLink, computed,
    };
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

export default function CmsVisualDesigner({ userId }: { userId: string }) {
    const { catalog } = useCatalog();
    const [path, setPath] = useState("/");
    const [manualPath, setManualPath] = useState("/");
    const [history, setHistory] = useState<VisualHistory>(() => createVisualHistory(emptyVisualDocument("/")));
    const [revision, setRevision] = useState(0);
    const [dirty, setDirty] = useState(false);
    const [status, setStatus] = useState("실제 웹페이지를 선택해 디자인을 편집하세요. DB 저장과 운영 게시는 별개입니다.");
    const [isError, setIsError] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [frameReady, setFrameReady] = useState(false);
    const [mode, setMode] = useState<ToolMode>("select");
    const [viewport, setViewport] = useState<Viewport>("desktop");
    const [selection, setSelection] = useState<SelectionInfo | null>(null);
    const [layers, setLayers] = useState<Layer[]>([]);
    const [filter, setFilter] = useState("");
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const originals = useRef<Map<HTMLElement, Original>>(new Map());
    const dragRef = useRef<{ element: HTMLElement; selector: string; startX: number; startY: number; baseX: number; baseY: number } | null>(null);

    const mutate = useCallback((updater: (doc: VisualDraftDocument) => VisualDraftDocument) => {
        setHistory((current) => pushVisualHistory(current, updater(current.present)));
        setDirty(true);
    }, []);

    const selectBySelector = useCallback((selector: string) => {
        const doc = iframeRef.current?.contentDocument;
        if (!doc) return;
        setSelection(selectionSnapshot(doc, selector));
    }, []);

    useEffect(() => {
        let live = true;
        originals.current = new Map();
        setFrameReady(false);
        setSelection(null);
        setHistory(createVisualHistory(emptyVisualDocument(path)));
        setRevision(0);
        setDirty(false);
        setLoading(true);
        const load = async () => {
            if (!supabase) {
                if (live) {
                    setLoading(false);
                    setIsError(true);
                    setStatus("Supabase 연결이 설정되지 않았습니다. 편집은 가능하지만 DB 저장은 불가능합니다.");
                }
                return;
            }
            const { data, error } = await supabase.from("sejong_cms_visual_drafts")
                .select("document, revision").eq("target_path", path).maybeSingle();
            if (!live) return;
            setLoading(false);
            if (error) {
                setIsError(true);
                setStatus("시각 편집 초안 조회 실패: " + error.message + " (DB 테이블/권한/마이그레이션을 확인하세요)");
                return;
            }
            if (data) {
                try {
                    setHistory(createVisualHistory(sanitizeVisualDocument(data.document, path)));
                    setRevision(Number(data.revision) || 0);
                    setIsError(false);
                    setStatus(path + "의 DB 저장 초안 r" + data.revision + "을 불러왔습니다.");
                } catch (err) {
                    setIsError(true);
                    setStatus("저장된 문서 정화 오류: " + String(err));
                }
            } else {
                setIsError(false);
                setStatus(path + "에서 아직 시각 편집 초안이 없습니다. 새 초안을 만들 수 있습니다.");
            }
        };
        void load();
        return () => { live = false; };
    }, [path]);

    // 실제 동일 출처 iframe의 DOM을 편집합니다. 공개 사용자 페이지에는 편집 스크립트를 주입하지 않습니다.
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
        setLayers(collectLayers(doc));

        if (mode === "preview") return;
        const pointerOver = (event: PointerEvent) => {
            const el = event.target instanceof HTMLElement ? event.target : (event.target as Element | null)?.closest("div,span,p,section");
            if (!el || el === doc.body) return;
            doc.querySelector("[data-cms-visual-hover]")?.removeAttribute("data-cms-visual-hover");
            el.setAttribute("data-cms-visual-hover", "true");
        };
        const click = (event: MouseEvent) => {
            const el = event.target instanceof HTMLElement ? event.target : (event.target as Element | null)?.closest("div,span,p,section");
            if (!el || el === doc.body) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            selectBySelector(selectorFor(el));
        };
        const pointerDown = (event: PointerEvent) => {
            if (mode !== "move") return;
            const el = event.target instanceof HTMLElement ? event.target : (event.target as Element | null)?.closest("div,span,p,section");
            if (!el || el === doc.body) return;
            event.preventDefault();
            const selector = selectorFor(el);
            const previous = history.present.patches.find((p) => p.selector === selector)?.style?.translate || "";
            const match = previous.match(/^(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px$/);
            dragRef.current = {
                element: el, selector, startX: event.clientX, startY: event.clientY,
                baseX: match ? Number(match[1]) : 0, baseY: match ? Number(match[2]) : 0,
            };
            selectBySelector(selector);
        };
        const pointerMove = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            const x = Math.round(drag.baseX + event.clientX - drag.startX);
            const y = Math.round(drag.baseY + event.clientY - drag.startY);
            drag.element.style.setProperty("translate", x + "px " + y + "px");
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
        doc.addEventListener("pointerdown", pointerDown, true);
        doc.addEventListener("pointermove", pointerMove, true);
        doc.addEventListener("pointerup", pointerUp, true);
        return () => {
            doc.removeEventListener("pointerover", pointerOver, true);
            doc.removeEventListener("click", click, true);
            doc.removeEventListener("pointerdown", pointerDown, true);
            doc.removeEventListener("pointermove", pointerMove, true);
            doc.removeEventListener("pointerup", pointerUp, true);
        };
    }, [frameReady, history.present, mode, mutate, selection, selectBySelector]);

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
    const addElement = (tag: VisualAddTag) => {
        const frameDoc = iframeRef.current?.contentDocument;
        if (!frameDoc?.body) return;
        const target = selection ? resolveElement(frameDoc, selection.selector) : null;
        const parent = target && ["MAIN", "SECTION", "ARTICLE", "DIV"].includes(target.tagName)
            ? target : target?.parentElement || frameDoc.querySelector("#main") || frameDoc.body;
        const id = "node-" + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
        const addition: VisualAddedElement = {
            id, parent: selectorFor(parent), tag,
            text: tag === "h2" ? "새로운 제목" : tag === "a" ? "새 링크" : "새로운 내용",
        };
        if (tag === "img") {
            addition.src = "/v5/assets/favicon.svg";
            addition.alt = "새 이미지";
        }
        if (tag === "a") addition.href = "/v5/";
        mutate((current) => ({ ...current, additions: [...current.additions, addition] }));
        setStatus("선택한 컨테이너 안에 " + tag + " 요소를 추가했습니다. 속성에서 수정하세요.");
        setSelection(null);
    };
    const deleteSelected = () => {
        if (!selection) return;
        const match = selection.selector.match(/^\[data-cms-added="([^"]+)"\]$/);
        if (match) {
            mutate((doc) => ({
                ...doc,
                additions: doc.additions.filter((item) => item.id !== match[1]),
                patches: doc.patches.filter((item) => item.selector !== selection.selector),
            }));
        } else setPatch({ hidden: !currentPatch?.hidden });
        setSelection(null);
    };
    const save = async () => {
        if (!supabase || loading || !userId) {
            setIsError(true);
            setStatus("관리자 세션 또는 DB 연결이 준비되지 않았습니다.");
            return;
        }
        setIsSaving(true);
        try {
            const clean = sanitizeVisualDocument(history.present, path);
            const { data: auth } = await supabase.auth.getUser();
            if (auth.user?.id !== userId) throw new Error("로그인 계정이 변경되었습니다. 다시 로그인하세요.");
            if (revision === 0) {
                const { data, error } = await supabase.from("sejong_cms_visual_drafts")
                    .insert({ target_path: path, document: clean, revision: 1, author_id: userId })
                    .select("revision").single();
                if (error) throw error;
                setRevision(Number(data.revision));
            } else {
                const { data, error } = await supabase.from("sejong_cms_visual_drafts")
                    .update({ document: clean, revision: revision + 1, updated_at: new Date().toISOString() })
                    .eq("target_path", path).eq("revision", revision).eq("author_id", userId)
                    .select("revision").maybeSingle();
                if (error) throw error;
                if (!data) throw new Error("동시 편집 충돌입니다. 서버 리비전이 바뀌었으므로 덮어쓰지 않았습니다.");
                setRevision(Number(data.revision));
            }
            setDirty(false);
            setIsError(false);
            setStatus("Supabase DB에 비공개 시각 편집 초안을 저장했습니다. 운영 사이트에 게시되지는 않았습니다.");
        } catch (error) {
            setIsError(true);
            setStatus("DB 저장 실패: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsSaving(false);
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
    const visibleLayers = layers.filter((layer) =>
        !filter || layer.label.toLowerCase().includes(filter.toLowerCase()));
    const stageWidth = viewport === "desktop" ? "100%" : viewport === "tablet" ? "768px" : "390px";

    return (
        <div className="cms-visual-designer" data-text="body" data-component-id="cms-visual-designer">
            <header className="cms-visual-topbar">
                <div className="cms-visual-brand">
                    <strong data-text="heading">SEJONG / VISUAL STUDIO</strong>
                    <span data-text="meta">실제 사이트 직접 편집 · 비공개 초안</span>
                </div>
                <div className="cms-visual-top-actions">
                    <SystemBadge tone={dirty ? "info" : "neutral"}>{dirty ? "저장되지 않은 변경" : "초안 동기화됨"} · r{revision}</SystemBadge>
                    <SystemLink href="/admin" variant="quiet">CMS 관제탑</SystemLink>
                    <SystemButton variant="secondary" disabled={!history.past.length} onClick={() => { setHistory(undoVisualHistory); setDirty(true); }}>실행 취소</SystemButton>
                    <SystemButton variant="secondary" disabled={!history.future.length} onClick={() => { setHistory(redoVisualHistory); setDirty(true); }}>다시 실행</SystemButton>
                    <SystemButton variant="secondary" onClick={() => downloadDraft(history.present)}>JSON 내보내기</SystemButton>
                    <SystemButton variant="primary" disabled={isSaving || loading || !dirty} onClick={() => void save()}>{isSaving ? "DB 저장 중…" : "DB 초안 저장"}</SystemButton>
                </div>
            </header>
            <section className="cms-visual-navigation" aria-label="편집 위치 및 도구">
                <SystemField label="페이지 목록" as="select" value={path} onChange={(e) => navigate(e.target.value)}>
                    {routes.map((route) => <option key={route} value={route}>{route}</option>)}
                </SystemField>
                <div className="cms-visual-route-input">
                    <SystemField label="직접 경로" value={manualPath} onChange={(e) => setManualPath(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") navigate(manualPath); }} />
                    <SystemButton variant="quiet" onClick={() => navigate(manualPath)}>이동</SystemButton>
                </div>
                <div className="cms-visual-tool-group" role="group" aria-label="캔버스 도구">
                    <SystemFilterButton selected={mode === "select"} onClick={() => setMode("select")}>선택 V</SystemFilterButton>
                    <SystemFilterButton selected={mode === "move"} onClick={() => setMode("move")}>이동 M</SystemFilterButton>
                    <SystemFilterButton selected={mode === "preview"} onClick={() => setMode("preview")}>사이트 작동 미리보기</SystemFilterButton>
                </div>
                <div className="cms-visual-tool-group" role="group" aria-label="화면 너비">
                    <SystemFilterButton selected={viewport === "desktop"} onClick={() => setViewport("desktop")}>PC</SystemFilterButton>
                    <SystemFilterButton selected={viewport === "tablet"} onClick={() => setViewport("tablet")}>태블릿</SystemFilterButton>
                    <SystemFilterButton selected={viewport === "mobile"} onClick={() => setViewport("mobile")}>모바일</SystemFilterButton>
                </div>
            </section>
            <div className="cms-visual-status" role={isError ? "alert" : "status"} data-error={isError}>{status}</div>
            <div className="cms-visual-workspace">
                <aside className="cms-visual-left" aria-label="페이지 및 레이어">
                    <h2 data-text="item-title">레이어</h2>
                    <p data-text="caption">운영 페이지의 실제 HTML 구조입니다. 요소를 선택하거나 화면에서 클릭하세요.</p>
                    <SystemField label="레이어 검색" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="예: section, h2, 버튼 제목" />
                    <div className="cms-visual-insert">
                        <span data-text="label">요소 추가</span>
                        {(["h2", "p", "button", "a", "img", "div"] as VisualAddTag[]).map((tag) =>
                            <SystemButton key={tag} variant="secondary" onClick={() => addElement(tag)}>+ {tag}</SystemButton>)}
                    </div>
                    <nav className="cms-visual-layer-list" aria-label="DOM 레이어 트리">
                        {visibleLayers.map((layer, index) =>
                            <SystemFilterButton key={layer.selector + "-" + index}
                                className="cms-visual-layer"
                                style={{ paddingLeft: 10 + layer.depth * 10 }}
                                selected={selection?.selector === layer.selector}
                                onClick={() => { selectBySelector(layer.selector); setMode("select"); }}
                                title={layer.selector}>
                                {layer.label}
                            </SystemFilterButton>)}
                    </nav>
                </aside>
                <section className="cms-visual-center" aria-label="실제 사이트 편집 캔버스">
                    <div className="cms-visual-canvas-meta">
                        <span data-text="label">{"/v5" + (path === "/" ? "/" : path + "/")}</span>
                        <span data-text="meta">{viewport === "desktop" ? "반응형 · 100%" : stageWidth} · {history.present.patches.length}개 수정 · {history.present.additions.length}개 삽입</span>
                    </div>
                    <div className="cms-visual-stage">
                        <div className="cms-visual-viewport" style={{ width: stageWidth }}>
                            <iframe ref={iframeRef} title="세종문화회관 실제 페이지 시각 편집"
                                src={"/v5" + (path === "/" ? "/" : path + "/")}
                                onLoad={() => {
                                    originals.current.clear();
                                    setFrameReady(true);
                                    setSelection(null);
                                }} />
                        </div>
                    </div>
                    <p data-text="caption" className="cms-visual-help">
                        선택 도구: 요소 클릭 · 이동 도구: 드래그 · 우측 패널: 글자·이미지·링크·CSS 수정 · 공개 페이지의 원래 React 디자인을 유지하는 비파괴 초안입니다.
                    </p>
                </section>
                <aside className="cms-visual-right" aria-label="선택 요소 속성">
                    <h2 data-text="item-title">속성 검사기</h2>
                    {!selection ? (
                        <SystemNotice variant="flow">페이지에서 요소를 선택하세요. 텍스트뿐 아니라 컨테이너·사진·버튼·레이아웃까지 다룰 수 있습니다.</SystemNotice>
                    ) : (
                        <div className="cms-visual-inspector">
                            <div className="cms-visual-selection">
                                <strong data-text="label">{selection.tag.toUpperCase()}</strong>
                                <p data-text="meta" title={selection.selector}>{selection.selector}</p>
                                <SystemButton variant="secondary" onClick={deleteSelected}>
                                    {currentPatch?.hidden ? "다시 표시" : "요소 숨김 / 제거"}
                                </SystemButton>
                            </div>
                            {selection.isLeaf && <SystemField as="textarea" rows={4} label="텍스트 내용"
                                value={currentPatch?.text ?? selection.text}
                                onChange={(e) => setPatch({ text: e.target.value })} />}
                            {selection.isImage && <>
                                <SystemField label="이미지 주소" value={currentPatch?.src ?? selection.src}
                                    onChange={(e) => { if (isSafeVisualUrl(e.target.value)) setPatch({ src: e.target.value }); }}
                                    hint="https:// 또는 사이트 내부 /v5/ 경로만 사용합니다." />
                                <SystemField label="대체 텍스트" value={currentPatch?.alt ?? selection.alt}
                                    onChange={(e) => setPatch({ alt: e.target.value })} />
                            </>}
                            {selection.isLink && <SystemField label="링크 주소" value={currentPatch?.href ?? selection.href}
                                onChange={(e) => { if (isSafeVisualUrl(e.target.value)) setPatch({ href: e.target.value }); }}
                                hint="안전한 HTTPS 또는 사이트 경로만 허용합니다." />}
                            {STYLE_GROUPS.map((group) => <details key={group.name} open={group.name === "타이포그래피"} className="cms-visual-style-group">
                                <summary data-text="label">{group.name}</summary>
                                <div className="cms-visual-style-fields">
                                    {group.keys.map((key) => {
                                        const field = VISUAL_STYLE_FIELDS.find((it) => it.key === key)!;
                                        const value = currentPatch?.style?.[key as VisualStyleKey] || "";
                                        return <SystemField key={key} label={field.label} value={value}
                                            placeholder={selection.computed[key] || "기본값 유지"}
                                            onChange={(e) => {
                                                const safe = sanitizeVisualStyle(key, e.target.value);
                                                if (safe !== null) setPatch({ style: { [key]: safe } });
                                                else if (!e.target.value.trim()) {
                                                    mutate((current) => {
                                                        const old = current.patches.find((p) => p.selector === selection.selector);
                                                        const style = { ...old?.style };
                                                        delete (style as Record<string, string>)[key];
                                                        return upsertVisualPatch(current, selection.selector, { style });
                                                    });
                                                }
                                            }} />;
                                    })}
                                </div>
                            </details>)}
                            <p data-text="caption">속성은 실제 페이지에 즉시 미리보기로 적용되지만, DB 초안 저장 전에는 다른 기기와 공유되지 않습니다.</p>
                        </div>
                    )}
                    <div className="cms-visual-import">
                        <span data-text="label">변경 이력 · 안전한 백업</span>
                        <p data-text="caption">되돌리기 {history.past.length}단계, 다시 실행 {history.future.length}단계</p>
                        <label data-text="label" htmlFor="cms-visual-import-file">기존 JSON 초안 가져오기</label>
                        <input data-text="body" id="cms-visual-import-file" type="file" accept=".json,application/json" onChange={(e) => void onImport(e)} />
                        <p data-text="caption">운영 게시는 아직 연결하지 않았습니다. 저장 버튼은 관리자 전용 DB 초안만 변경하며, 별도의 검토·배포 절차를 유지합니다.</p>
                    </div>
                </aside>
            </div>
        </div>
    );
}
