import type { VisualDraftDocument } from "./visual-document.ts";

export const studioAddedId = (selector: string): string | null =>
    /^\[data-cms-added="([a-z0-9-]{6,64})"\]$/.exec(selector)?.[1] ?? null;

// 삽입 순서가 기본이며, 같은 부모 안에서만 명시 순서를 적용한다.
// Insertion order is the default; explicit order never crosses parent boundaries.
export function studioSiblingIds(doc: VisualDraftDocument, parent: string): string[] {
    return doc.additions.filter(item => item.parent === parent)
        .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
        .map(item => item.id);
}

export function moveStudioLayer(doc: VisualDraftDocument, id: string, targetId: string): VisualDraftDocument {
    if (id === targetId) return doc;
    const source = doc.additions.find(item => item.id === id);
    if (!source) return doc;
    const siblings = studioSiblingIds(doc, source.parent);
    const from = siblings.indexOf(id);
    const to = siblings.indexOf(targetId);
    if (to < 0) return doc;

    siblings.splice(from, 1);
    siblings.splice(to, 0, id);
    const orderById = new Map(siblings.map((sibling, index) => [sibling, index]));
    return {
        ...doc,
        additions: doc.additions.map(item => {
            const order = orderById.get(item.id);
            return order === undefined || order === item.order ? item : { ...item, order };
        }),
    };
}
