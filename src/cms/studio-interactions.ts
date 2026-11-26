// 문서 픽셀 좌표를 사용한다. / Use unscaled document pixel coordinates.
type Point = { x: number; y: number };
export type StudioDrag = { pointerId: number; start: Point; base: Point };

export function startStudioDrag(pointerId: number, start: Point, translate: string): StudioDrag {
    const prior = /^(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px$/.exec(translate);
    return { pointerId, start, base: prior ? { x: Number(prior[1]), y: Number(prior[2]) } : { x: 0, y: 0 } };
}

export function moveStudioDrag(drag: StudioDrag, pointerId: number, point: Point): string | null {
    if (drag.pointerId !== pointerId) return null;
    const x = point.x - drag.start.x;
    const y = point.y - drag.start.y;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < 3) return null;
    return `${Math.round(drag.base.x + x)}px ${Math.round(drag.base.y + y)}px`;
}

type ShortcutEvent = {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    isComposing?: boolean;
};

export type StudioShortcut = "edit-text" | "cancel" | "remove" | "undo" | "redo" | "select" | "move" | "text" | "preview";

export function studioShortcut(event: ShortcutEvent, isInput = false): StudioShortcut | null {
    if (event.isComposing || event.altKey) return null;
    const key = event.key.toLowerCase();
    if (key === "escape") return "cancel";
    if (isInput) return null;
    if (event.ctrlKey || event.metaKey) {
        if (key === "z") return event.shiftKey ? "redo" : "undo";
        return key === "y" ? "redo" : null;
    }
    if (key === "f2") return "edit-text";
    if (key === "delete" || key === "backspace") return "remove";
    if (key === "v") return "select";
    if (key === "m") return "move";
    if (key === "t") return "text";
    return key === "p" ? "preview" : null;
}

// 빈 문자열도 편집값이다. / An intentional clear is distinct from cancel or no change.
export function studioTextChange(original: string, raw: string, cancel: boolean): string | null {
    if (cancel) return null;
    const text = raw.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").slice(0, 10000).replace(/[\uD800-\uDBFF]$/, "");
    return text === original ? null : text;
}
