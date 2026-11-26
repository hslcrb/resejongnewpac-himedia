"use client";

import { useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import { resizeStudioBox } from "../../src/cms/studio-resize.ts";
import type { StudioBox } from "../../src/cms/studio-resize.ts";
import { SystemButton } from "../SystemPrimitives";

type Props = {
    scale: number;
    start: () => StudioBox | null;
    preview: (box: StudioBox) => void;
    end: (box: StudioBox | null) => void;
};
type Gesture = { pointerId: number; x: number; y: number; scale: number; base: StudioBox };

export function StudioResizeHandle({ scale, start, preview, end }: Props) {
    const gesture = useRef<Gesture | null>(null);
    const endRef = useRef(end);
    useEffect(() => { endRef.current = end; }, [end]);
    useEffect(() => () => { if (gesture.current) { gesture.current = null; endRef.current(null); } }, []);
    const next = (event: PointerEvent<HTMLButtonElement>, active: Gesture) => {
        const x = event.clientX - active.x;
        const y = event.clientY - active.y;
        return Math.hypot(x, y) >= 2 ? resizeStudioBox(active.base, { x, y }, active.scale, event.shiftKey) : null;
    };
    const finish = (event: PointerEvent<HTMLButtonElement>, commit: boolean) => {
        const active = gesture.current;
        if (!active || active.pointerId !== event.pointerId) return;
        gesture.current = null;
        end(commit ? next(event, active) : null);
    };

    return <SystemButton variant="secondary" className="cms-studio-resize-handle"
        aria-label="선택 요소 크기 조절" title="드래그 또는 방향키로 크기 조절 · Shift로 비율 유지"
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Escape"
        onPointerDown={event => {
            if (event.button !== 0 || !event.isPrimary || gesture.current) return;
            const base = start();
            if (!base) return;
            gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, scale, base };
            try { event.currentTarget.setPointerCapture(event.pointerId); } catch { gesture.current = null; end(null); }
        }}
        onPointerMove={event => {
            const active = gesture.current;
            if (!active || active.pointerId !== event.pointerId) return;
            preview(next(event, active) ?? active.base);
        }}
        onPointerUp={event => finish(event, true)}
        onPointerCancel={event => finish(event, false)}
        onLostPointerCapture={event => finish(event, false)}
        onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.key === "Escape" && gesture.current) {
                event.preventDefault();
                event.stopPropagation();
                gesture.current = null;
                end(null);
                return;
            }
            if (gesture.current || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
            const base = start();
            if (!base) return;
            event.preventDefault();
            const value = event.shiftKey ? 10 : 1;
            const x = event.key === "ArrowLeft" ? -value : event.key === "ArrowRight" ? value : 0;
            const y = event.key === "ArrowUp" ? -value : event.key === "ArrowDown" ? value : 0;
            end(resizeStudioBox(base, { x, y }, 1));
        }}>
        <span aria-hidden="true" data-text="action">↘</span>
    </SystemButton>;
}
