"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import LiquidGlass from "./LiquidGlass";
import Icon from "./Icon";
import useFloatingPanel from "./useFloatingPanel";
import { createPanelTransition } from "../src/lib/panel-transition";
import type { PanelPhase, PanelTransition } from "../src/lib/panel-transition";
import type { PanelPoint } from "../src/lib/floating-panel";

export type FloatingPanelProps = {
    open: boolean;
    onClose: () => void;
    anchorRef: RefObject<HTMLButtonElement>;
    position?: { current: PanelPoint | null };
    title: string;
    eyebrow?: string;
    closeLabel?: string;
    moveLabel?: string;
    id?: string;
    className?: string;
    children: ReactNode;
};

// [퇴장이 끝날 때까지 유지되는 창 / Keep the panel mounted through its complete exit]
export default function FloatingPanel(props: FloatingPanelProps) {
    const [retained, setRetained] = useState(props.open);
    const onExited = useCallback(() => setRetained(false), []);
    useLayoutEffect(() => {
        if (props.open) setRetained(true);
    }, [props.open]);
    if ((!props.open && !retained) || typeof document === "undefined") return null;
    return <PanelSurface {...props} onExited={onExited} />;
}

// [LiquidGlass를 사용하는 이동·모션·탐색의 공통 창 / Shared glass, positioning and motion lifecycle]
function PanelSurface({
    open,
    onClose,
    onExited,
    anchorRef,
    position,
    title,
    eyebrow,
    closeLabel = "창 닫기",
    moveLabel = "창 위치 이동",
    id,
    className = "",
    children,
}: FloatingPanelProps & { onExited: () => void }) {
    const panelRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const defaultPosition = useRef<PanelPoint | null>(null);
    const transitionRef = useRef<PanelTransition | null>(null);
    const desiredOpen = useRef(open);
    desiredOpen.current = open;
    const [currentPhase, setPhase] = useState<PanelPhase>("opening");
    const labelId = "floating-panel-" + useId().replace(/:/g, "");
    const { moveMode, setMoveMode, announcement } = useFloatingPanel(
        panelRef,
        position || defaultPosition,
        onClose,
    );

    useLayoutEffect(() => {
        const panel = panelRef.current!;
        const transition = createPanelTransition({
            panel,
            canvas: canvasRef.current!,
            anchor: () => anchorRef.current,
            onPhase: setPhase,
            onClosed: () => {
                if (!desiredOpen.current) onExited();
            },
        });
        transitionRef.current = transition;
        transition.setOpen(desiredOpen.current);
        return () => {
            transitionRef.current = null;
            transition.dispose();
        };
    }, [anchorRef, onExited]);
    useLayoutEffect(() => {
        transitionRef.current?.setOpen(open);
    }, [open]);
    useEffect(() => {
        if (
            currentPhase === "open" &&
            (document.activeElement === anchorRef.current ||
                document.activeElement === document.body)
        ) {
            closeRef.current?.focus({ preventScroll: true });
        }
    }, [currentPhase, anchorRef]);
    useEffect(() => {
        const panel = panelRef.current;
        const anchor = anchorRef.current;
        return () => {
            if (
                anchor?.isConnected &&
                (document.activeElement === document.body ||
                    panel?.contains(document.activeElement))
            ) {
                anchor.focus({ preventScroll: true });
            }
        };
    }, [anchorRef]);

    return createPortal(
        <>
            <LiquidGlass
                ref={panelRef}
                id={id}
                className={`floating-panel ${className}`.trim()}
                role="dialog"
                aria-modal="false"
                aria-labelledby={`${labelId}-heading`}
                aria-hidden={currentPhase !== "open" || undefined}
                data-phase={currentPhase}
                data-move-mode={moveMode || undefined}
            >
                <div className="glass-menu-header floating-panel-header">
                    <div>
                        {eyebrow && <p className="glass-menu-brand">{eyebrow}</p>}
                        <h2 id={`${labelId}-heading`}>{title}</h2>
                    </div>
                    <div className="glass-menu-actions">
                        <button
                            type="button"
                            className="glass-menu-move"
                            data-panel-move
                            aria-label={moveLabel}
                            aria-pressed={moveMode}
                            aria-describedby={`${labelId}-move-help`}
                            onClick={() => setMoveMode(!moveMode)}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/v5/assets/icons/rounded/open_with.svg"
                                width="24"
                                height="24"
                                alt=""
                                aria-hidden="true"
                            />
                            <span>이동</span>
                        </button>
                        <button
                            ref={closeRef}
                            type="button"
                            className="round-button"
                            onClick={onClose}
                            aria-label={closeLabel}
                        >
                            <Icon name="close" size={24} />
                        </button>
                    </div>
                </div>
                <p id={`${labelId}-move-help`} className="sr-only">
                    마우스로 글자나 여백을 잡아 옮길 수 있습니다. 터치에서는 제목을 잡거나 이동
                    버튼을 켜세요. 이동 버튼에서 방향키로 옮기고 Home 키로 처음 위치로 돌립니다.
                </p>
                <span className="sr-only" role="status" aria-live="polite">
                    {announcement}
                </span>
                {children}
            </LiquidGlass>
            <canvas ref={canvasRef} className="floating-panel-webgl" aria-hidden="true" />
        </>,
        document.body,
    );
}
