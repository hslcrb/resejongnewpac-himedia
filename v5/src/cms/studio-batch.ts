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
