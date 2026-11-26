import { applyVisualDraft, clearVisualDraft } from "./studio-canvas-dom.ts";
import type { Original } from "./studio-canvas-dom.ts";
import type { VisualDraftDocument } from "./visual-document.ts";

// 본문만 편집하고 사이트 셸은 원본을 사용합니다. / Keep site chrome outside public page revisions.
export function applyPublicVisual(doc: Document, main: HTMLElement, draft: VisualDraftDocument): () => void {
    const originals = new Map<HTMLElement, Original>();
    const restore = () => clearVisualDraft(main, originals);
    try { applyVisualDraft(doc, draft, originals, main); }
    catch (error) {
        restore();
        throw error;
    }
    return restore;
}
