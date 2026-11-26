import { sanitizeVisualStyle, VISUAL_STYLE_FIELDS } from "./visual-document.ts";
import { studioSiblingIds } from "./studio-layer-order.ts";
import type { VisualDraftDocument } from "./visual-document.ts";

// 실제 페이지의 시각 패치 어댑터. / Adapt versioned drafts to the trusted preview DOM only.
export type SelectionInfo = {
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
export type Original = {
    style: string | null;
    text: string | null;
    src: string | null;
    alt: string | null;
    href: string | null;
    hidden: boolean;
};
export const EDITABLE_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "SPAN", "STRONG", "EM", "SMALL", "LABEL", "BUTTON", "A", "LI", "FIGCAPTION", "TD", "TH", "TIME"]);
export const BODY_PREVIEW_STYLE = [
    '[data-entry-intro]{display:none!important}',
    '[data-cms-visual-selected="true"]{outline:2px solid var(--accent-primary, #6b5b4a)!important;outline-offset:-2px!important}',
    '[data-cms-visual-hover="true"]:not([data-cms-visual-selected]){outline:1px dashed var(--text-secondary, #6b5b4a)!important;outline-offset:-1px!important}',
    '[data-cms-editing="true"]{outline:2px solid var(--text-primary, #211f1c)!important;cursor:text!important}',
    '[data-cms-visual-target="true"]{outline:2px dashed var(--accent-primary, #6b5b4a)!important;outline-offset:-4px!important}',
].join("");

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

function setLeafText(element: HTMLElement, text: string) {
    // React가 가진 텍스트 노드 참조를 보존합니다. / Preserve React's existing text node when possible.
    const node = element.firstChild;
    if (node?.nodeType === 3 && node === element.lastChild) {
        if (node.nodeValue !== text) node.nodeValue = text;
    } else if (element.textContent !== text) element.textContent = text;
}

function restoreOriginals(map: Map<HTMLElement, Original>): void {
    for (const [el, original] of map) {
        if (!el.isConnected) continue;
        if (original.style == null) el.removeAttribute("style");
        else el.setAttribute("style", original.style);
        if (original.text != null && el.children.length === 0) setLeafText(el, original.text);
        for (const key of ["src", "alt", "href"] as const) {
            if (original[key] == null) el.removeAttribute(key);
            else el.setAttribute(key, original[key]!);
        }
        el.hidden = original.hidden;
    }
}

export function resolveElement(doc: Document, selector: string): HTMLElement | null {
    try {
        const element = doc.querySelector(selector);
        return element && element.namespaceURI === "http://www.w3.org/1999/xhtml" ? (element as HTMLElement) : null;
    } catch {
        return null;
    }
}

export function htmlTarget(event: Event): HTMLElement | null {
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
export function clearVisualDraft(scope: Document | HTMLElement, originals: Map<HTMLElement, Original>): void {
    restoreOriginals(originals);
    originals.clear();
    scope.querySelectorAll("[data-cms-added]").forEach((element) => element.remove());
}

export function applyVisualDraft(doc: Document, draft: VisualDraftDocument, originals: Map<HTMLElement, Original>, scope?: HTMLElement): void {
    clearVisualDraft(scope ?? doc, originals);
    const resolveTarget = (selector: string, allowRoot = false) => {
        const element = resolveElement(doc, selector);
        if (scope && element && (!scope.contains(element) || (!allowRoot && element === scope))) return null;
        return element;
    };
    const inserted = new Map<string, HTMLElement>();
    const orderedParents = new Set<string>();
    for (const added of draft.additions) {
        const parent = resolveTarget(added.parent, true);
        if (!parent) continue;
        const node = doc.createElement(added.tag);
        node.setAttribute("data-cms-added", added.id);
        node.setAttribute("data-cms-preset", added.preset);
        node.setAttribute("data-text", dataTextFor(added.tag));
        if (added.tag === "img") {
            node.setAttribute("src", added.src || "/assets/favicon.svg");
            node.setAttribute("alt", added.alt || "새 이미지");
        } else if (!added.children?.length) {
            node.textContent = added.text;
        }
        if (added.tag === "a") node.setAttribute("href", added.href || "/");
        for (const [name, value] of Object.entries(added.style || {})) {
            const safe = sanitizeVisualStyle(name, value);
            if (safe != null) node.style.setProperty(name, safe);
        }
        if (added.children?.length) {
            for (const child of added.children) {
                const childNode = doc.createElement(child.tag);
                childNode.setAttribute("data-text", dataTextFor(child.tag));
                if (child.tag === "a" && child.href) childNode.setAttribute("href", child.href);
                if (child.tag === "img") {
                    childNode.setAttribute("src", child.src || "/assets/favicon.svg");
                    childNode.setAttribute("alt", child.alt || "새 이미지");
                } else childNode.textContent = child.text;
                node.appendChild(childNode);
            }
        }
        parent.appendChild(node);
        inserted.set(added.id, node);
        if (added.order !== undefined) orderedParents.add(added.parent);
    }
    // DOM을 먼저 구축해 자식 삽입과 위치 지정 패치의 대상이 바뀌지 않게 한다.
    // Build the DOM first, then move only this draft's own inserted sibling nodes.
    for (const selector of orderedParents) {
        const parent = resolveTarget(selector, true);
        if (!parent) continue;
        for (const id of studioSiblingIds(draft, selector)) {
            const node = inserted.get(id);
            if (node?.parentElement === parent) parent.appendChild(node);
        }
    }
    for (const patch of draft.patches) {
        const el = resolveTarget(patch.selector);
        if (!el) continue;
        if (!el.hasAttribute("data-cms-added")) saveOriginal(originals, el);
        if (patch.text !== undefined && el.children.length === 0 && EDITABLE_TAGS.has(el.tagName)) setLeafText(el, patch.text);
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

export function selectionSnapshot(doc: Document, selector: string): SelectionInfo | null {
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

