import { isSafeVisualSelector, sanitizeVisualDocument, sanitizeVisualStyle } from "./visual-document.ts";
import type { VisualDraftDocument, VisualElementPatch } from "./visual-document.ts";

export const studioSelectionLimit = 50;

export function toggleStudioSelection<T>(
    current: readonly T[], target: T, extend: boolean, key: (item: T) => string = item => String(item),
): T[] {
    const selector = key(target);
    if (!isSafeVisualSelector(selector)) return [...current];
    if (!extend) return [target];
    if (current.some(item => key(item) === selector)) return current.filter(item => key(item) !== selector);
    return current.length >= studioSelectionLimit ? [...current] : [...current, target];
}

// 한 번에 정제하고, 하나라도 소실되면 전체 변경을 폐기합니다. / Sanitize once and reject partial writes.
function applyBatch(doc: VisualDraftDocument, edits: readonly VisualElementPatch[]): VisualDraftDocument | null {
    if (!edits.length || edits.length > studioSelectionLimit || edits.some(patch => !isSafeVisualSelector(patch.selector))) return null;
    const prior = new Map(doc.patches.map(patch => [patch.selector, patch]));
    for (const edit of edits) {
        const entry = prior.get(edit.selector);
        prior.set(edit.selector, { ...entry, ...edit, ...(edit.style ? { style: { ...entry?.style, ...edit.style } } : {}) });
    }
    const next = sanitizeVisualDocument({ ...doc, patches: [...prior.values()] }, doc.path);
    const actual = new Map(next.patches.map(patch => [patch.selector, patch]));
    for (const { selector, style, hidden } of edits) {
        const patch = actual.get(selector);
        if (!patch || (hidden !== undefined && patch.hidden !== hidden) ||
            (style?.translate !== undefined && patch.style?.translate !== style.translate)) return null;
    }
    return JSON.stringify(doc) === JSON.stringify(next) ? null : next;
}

export function setStudioLayersHidden(doc: VisualDraftDocument, selectors: readonly string[], hidden: boolean) {
    return applyBatch(doc, [...new Set(selectors)].map(selector => ({ selector, hidden })));
}

export function studioLayerTranslation(value: string, x: number, y: number): string | null {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const previous = /^(?<x>-?\d+(?:\.\d+)?)px(?:\s+(?<y>-?\d+(?:\.\d+)?)px)?$/.exec(value)?.groups;
    if (!previous && value !== "" && value !== "none") return null;
    const sum = (start: string | undefined, delta: number) => Math.round((Number(start ?? 0) + delta) * 100) / 100;
    return sanitizeVisualStyle("translate", `${sum(previous?.x, x)}px ${sum(previous?.y, y)}px`);
}

type StudioNudgeTarget = { selector: string; translate: string; coveredByAncestor?: boolean };

export function nudgeStudioLayers(doc: VisualDraftDocument, targets: readonly StudioNudgeTarget[], x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || (!x && !y)) return null;
    const translations = new Map(doc.patches.map(patch => [patch.selector, patch.style?.translate]));
    const edits: VisualElementPatch[] = [];
    for (const item of targets) {
        if (!isSafeVisualSelector(item.selector)) return null;
        if (item.coveredByAncestor) continue;
        const value = translations.get(item.selector) ?? item.translate;
        const translate = studioLayerTranslation(value, x, y);
        if (!translate) return null;
        edits.push({ selector: item.selector, style: { translate } });
    }
    return applyBatch(doc, edits);
}

export type StudioAlignment = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";
type StudioAlignmentTarget = { selector: string; translate: string; left: number; top: number; right: number; bottom: number };

export function alignStudioLayers(doc: VisualDraftDocument, targets: readonly StudioAlignmentTarget[], alignment: StudioAlignment) {
    if (targets.length < 2 || targets.length > studioSelectionLimit) return null;
    const selectors = new Set<string>();
    for (const { selector, left, top, right, bottom } of targets) {
        if (!isSafeVisualSelector(selector) || selectors.has(selector) ||
            ![left, top, right, bottom].every(Number.isFinite) || left >= right || top >= bottom) return null;
        selectors.add(selector);
    }
    const horizontal = alignment === "left" || alignment === "center-x" || alignment === "right";
    const start = (target: StudioAlignmentTarget) => horizontal ? target.left : target.top;
    const end = (target: StudioAlignmentTarget) => horizontal ? target.right : target.bottom;
    const alignStart = alignment === "left" || alignment === "top";
    const alignEnd = alignment === "right" || alignment === "bottom";
    const min = Math.min(...targets.map(start));
    const max = Math.max(...targets.map(end));
    // 선택 전체의 외곽선을 기준으로 정렬합니다. / Align against the selection's bounding box.
    const anchor = alignStart ? min : alignEnd ? max : min + (max - min) / 2;
    const prior = new Map(doc.patches.map(patch => [patch.selector, patch.style?.translate]));
    const edits: VisualElementPatch[] = [];
    for (const target of targets) {
        const layerAnchor = alignStart ? start(target) : alignEnd ? end(target) : start(target) + (end(target) - start(target)) / 2;
        const delta = Math.round((anchor - layerAnchor) * 100) / 100;
        if (!delta) continue;
        const translate = studioLayerTranslation(prior.get(target.selector) ?? target.translate,
            horizontal ? delta : 0, horizontal ? 0 : delta);
        if (!translate) return null;
        edits.push({ selector: target.selector, style: { translate } });
    }
    return applyBatch(doc, edits);
}
