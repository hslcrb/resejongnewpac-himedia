import { studioLayerTranslation, studioSelectionLimit } from "./studio-batch.ts";
import { isSafeVisualSelector } from "./visual-document.ts";

export type StudioDragLayer = {
    element: HTMLElement;
    selector: string;
    translate: string;
    inline: string;
    priority: string;
};

// 선택 요소 내부를 눌러도 묶음을 유지하며 부모·자식 중 한 번만 움직입니다.
export function studioMoveRoots<T extends { parentElement: T | null }>(hit: T, selection: readonly T[]): T[] {
    const selected = new Set(selection);
    let inside = false;
    for (let node: T | null = hit; node; node = node.parentElement) {
        if (selected.has(node)) { inside = true; break; }
    }
    if (!inside) return [hit];
    return [...selected].filter(node => {
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            if (selected.has(parent)) return false;
        }
        return true;
    });
}

export function captureStudioDrag(element: HTMLElement, selector: string, translate: string): StudioDragLayer {
    return {
        element, selector, translate,
        inline: element.style.getPropertyValue("translate"),
        priority: element.style.getPropertyPriority("translate"),
    };
}

export function restoreStudioDrag(layers: readonly StudioDragLayer[]): void {
    for (const layer of layers) {
        if (!layer.element.isConnected) continue;
        if (layer.inline) layer.element.style.setProperty("translate", layer.inline, layer.priority);
        else layer.element.style.removeProperty("translate");
    }
}

export function previewStudioDrag(layers: readonly StudioDragLayer[], x: number, y: number): boolean {
    if (!layers.length || layers.length > studioSelectionLimit || Math.hypot(x, y) < 3) return false;
    const planned = layers.map(({ element, selector, translate }) =>
        element.isConnected && isSafeVisualSelector(selector) ? studioLayerTranslation(translate, x, y) : null);
    if (planned.some(value => value === null)) return false;
    // 포인터 이동 중에는 캔버스만 바꿉니다. / Preview only; persist a single edit on pointer-up.
    for (let i = 0; i < layers.length; i++) layers[i].element.style.setProperty("translate", planned[i]!, "important");
    return true;
}
