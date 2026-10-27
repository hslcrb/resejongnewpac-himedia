"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Flip, gsap, useGSAP } from "../src/lib/gsap";

type CapturedPrograms = { state: Flip.FlipState; signature: string; scopeKey: string; ids: Set<string> };
const useCommitEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Capture in the input handler, then animate only after React commits the new list.
 * A catalog refresh without a user capture remains an immediate, ordinary render.
 */
export default function useProgramFlip(ids: readonly string[], scopeKey = "") {
    const containerRef = useRef<HTMLDivElement>(null);
    const pending = useRef<CapturedPrograms | null>(null);
    const pendingFrame = useRef<number | null>(null);
    const committedSignature = useRef(ids.join("\0"));
    const committedScope = useRef(scopeKey);
    const transition = useRef<gsap.Context | null>(null);
    const disposed = useRef(false);
    const signature = ids.join("\0");

    const settle = useCallback(() => {
        pending.current = null;
        if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
        pendingFrame.current = null;
        // Revert only the context owned by this list, including any entering cards.
        transition.current?.revert();
        transition.current = null;
        if (containerRef.current) containerRef.current.dataset.gsapFlip = "ready";
    }, []);

    useGSAP(() => {
        disposed.current = false;
        const root = containerRef.current;
        if (!root) return;
        const previousState = root.getAttribute("data-gsap-flip");
        root.dataset.gsapFlip = "ready";
        const preference = matchMedia("(prefers-reduced-motion: reduce)");
        const onPreference = () => { if (preference.matches) settle(); };
        const onVisibility = () => { if (document.hidden) settle(); };
        const onFocus = (event: FocusEvent) => {
            if (event.target instanceof Element && (event.target.closest("[data-program-flip]") || event.target.querySelector("[data-program-flip]"))) settle();
        };
        const onLayout = () => settle();
        preference.addEventListener("change", onPreference);
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pagehide", onLayout);
        window.addEventListener("resize", onLayout);
        root.addEventListener("load", onLayout, true);
        root.addEventListener("focusin", onFocus);
        void document.fonts?.ready.then(() => { if (!disposed.current) settle(); });
        return () => {
            disposed.current = true;
            settle();
            preference.removeEventListener("change", onPreference);
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("pagehide", onLayout);
            window.removeEventListener("resize", onLayout);
            root.removeEventListener("load", onLayout, true);
            root.removeEventListener("focusin", onFocus);
            if (previousState === null) root.removeAttribute("data-gsap-flip");
            else root.setAttribute("data-gsap-flip", previousState);
        };
    }, { scope: containerRef });

    const capture = useCallback(() => {
        settle();
        const root = containerRef.current;
        if (!root || disposed.current || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const cards = [...root.querySelectorAll<HTMLElement>("[data-program-flip]")];
        pending.current = {
            state: Flip.getState(cards, { simple: true }),
            signature: committedSignature.current,
            scopeKey: committedScope.current,
            ids: new Set(cards.map(card => card.dataset.flipId || "")),
        };
        // A no-op input may not commit. Never reuse that capture for a later catalog update.
        pendingFrame.current = requestAnimationFrame(() => {
            pendingFrame.current = null;
            pending.current = null;
        });
    }, [settle]);

    useCommitEffect(() => {
        committedSignature.current = signature;
        committedScope.current = scopeKey;
        const captured = pending.current;
        pending.current = null;
        if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
        pendingFrame.current = null;
        const root = containerRef.current;
        transition.current?.revert();
        transition.current = null;
        if (root) root.dataset.gsapFlip = "ready";
        if (!root || !captured || captured.scopeKey !== scopeKey || captured.signature === signature || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const cards = [...root.querySelectorAll<HTMLElement>("[data-program-flip]")];
        if (!cards.length) { root.dataset.gsapFlip = "ready"; return; }
        root.dataset.gsapFlip = "running";
        // The explicit context also owns tweens created after the initial useGSAP callback.
        transition.current = gsap.context(() => {
            const animation = gsap.timeline({ onComplete: () => { if (!disposed.current) root.dataset.gsapFlip = "ready"; } });
            animation.add(Flip.from(captured.state, {
                targets: cards,
                duration: .38,
                ease: "power2.out",
                nested: true,
                prune: true,
                stagger: { amount: .06 },
            }), 0);
            const entering = cards.filter(card => !captured.ids.has(card.dataset.flipId || ""));
            if (entering.length) animation.fromTo(entering,
                { opacity: .65, y: 10 },
                { opacity: 1, y: 0, duration: .28, stagger: { amount: .06 }, clearProps: "opacity,transform" }, 0);
            if (!animation.duration()) root.dataset.gsapFlip = "ready";
        }, root);
    }, [signature, scopeKey]);

    return { containerRef, capture };
}
