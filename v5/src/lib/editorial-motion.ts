"use client";

import { gsap, ScrollTrigger } from "./gsap";
import { editorialGroup } from "./editorial-policy";

/** Editorial motion owns no navigation or layout: the server-rendered page remains the reading surface. */
export function createEditorialMotion(root: HTMLElement, pathname: string): () => void {
    if (!editorialGroup(pathname)) return () => {};
    const previousReady = root.getAttribute("data-gsap-editorial");
    const previousMode = root.getAttribute("data-gsap-editorial-motion");
    const seen = new WeakSet<HTMLElement>();
    let disposed = false, rebuildFrame = 0, refreshFrame = 0;
    let pageContext: gsap.Context | undefined;
    const excluded = 'form, table, dialog, [hidden], [aria-hidden="true"], [inert], .completed-sources, [data-component-id="introduction"]';
    const readable = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return !element.closest(excluded) && style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    };

    function refresh() {
        if (disposed || document.hidden || refreshFrame) return;
        refreshFrame = requestAnimationFrame(() => {
            refreshFrame = 0;
            if (!disposed && !document.hidden) ScrollTrigger.refresh(true);
        });
    }

    function rebuild() {
        if (disposed) return;
        pageContext?.revert();
        if (document.hidden) { root.dataset.gsapEditorial = "suspended"; return; }
        root.dataset.gsapEditorial = "ready";
        pageContext = gsap.context(() => {
            const media = gsap.matchMedia();
            media.add({
                motion: "(prefers-reduced-motion: no-preference)",
                reduced: "(prefers-reduced-motion: reduce)",
                fine: "(hover: hover) and (pointer: fine)",
            }, context => {
                root.dataset.gsapEditorialMotion = context.conditions?.motion ? "full" : "reduced";
                if (!context.conditions?.motion) return;
                const cleanups: (() => void)[] = [];
                const reveals = new Map<HTMLElement, gsap.core.Tween>();
                const settle = (target: Node) => {
                    for (const [element, tween] of reveals) {
                        if (element === target || element.contains(target) || target instanceof Element && target !== root && target.contains(element)) {
                            seen.add(element); tween.progress(1);
                        }
                    }
                };
                function reveal(target: HTMLElement, from: gsap.TweenVars, duration: number, delay = 0) {
                    if (seen.has(target) || !readable(target)) return;
                    if (target.getBoundingClientRect().bottom < 0) { seen.add(target); return; }
                    const tween = gsap.fromTo(target, from, {
                        opacity: 1, x: 0, y: 0, ...(from.clipPath ? { clipPath: "inset(0%)" } : {}), duration, delay,
                        ease: "power3.out", paused: true, overwrite: "auto",
                        clearProps: "opacity,transform,clipPath",
                    });
                    reveals.set(target, tween);
                    ScrollTrigger.create({ trigger: target, start: "top 94%", once: true,
                        onEnter: () => { seen.add(target); tween.play(); },
                    });
                }
                for (const heading of root.querySelectorAll<HTMLElement>("h1, h2")) {
                    reveal(heading, { opacity: .6, y: 18 }, .6);
                }
                for (const image of root.querySelectorAll<HTMLElement>(".completed-hero-image img, .completed-image img, .completed-list-image > img")) {
                    reveal(image, { opacity: .65, y: 18, clipPath: "inset(3%)" }, .8);
                }
                for (const list of root.querySelectorAll<HTMLElement>(".completed-timeline, .catalog-timeline")) {
                    for (const [index, item] of [...list.children].entries()) {
                        if (item instanceof HTMLElement) reveal(item, { opacity: .6, x: 18 }, .65, Math.min(index % 4 * .045, .135));
                    }
                }
                const focus = (event: FocusEvent) => { if (event.target instanceof Node) settle(event.target); };
                root.addEventListener("focusin", focus, true);
                cleanups.push(() => root.removeEventListener("focusin", focus, true));
                if (document.activeElement && root.contains(document.activeElement)) settle(document.activeElement);

                for (const image of root.querySelectorAll<HTMLElement>(".completed-hero-image img, .completed-image img, .completed-list-image > img")) {
                    if (!readable(image)) continue;
                    const owner = image.closest<HTMLElement>("a, figure");
                    if (!owner) continue;
                    // quickTo/resetTo requires separate numeric scale axes, rather than CSSPlugin's scale alias.
                    const scaleX = gsap.quickTo(image, "scaleX", { duration: .3, ease: "power2.out" });
                    const scaleY = gsap.quickTo(image, "scaleY", { duration: .3, ease: "power2.out" });
                    let hovering = !!context.conditions?.fine && owner.matches(":hover");
                    let focused = owner.contains(document.activeElement);
                    const update = () => {
                        settle(image);
                        const scale = hovering || focused ? 1.025 : 1;
                        scaleX(scale); scaleY(scale);
                    };
                    const enter = () => { hovering = true; update(); };
                    const leave = () => { hovering = false; update(); };
                    const onFocus = () => { focused = true; update(); };
                    const onBlur = (event: FocusEvent) => {
                        if (event.relatedTarget instanceof Node && owner.contains(event.relatedTarget)) return;
                        focused = false; update();
                    };
                    if (context.conditions?.fine) { owner.addEventListener("pointerenter", enter); owner.addEventListener("pointerleave", leave); }
                    owner.addEventListener("focusin", onFocus); owner.addEventListener("focusout", onBlur);
                    if (hovering || focused) update();
                    cleanups.push(() => {
                        owner.removeEventListener("pointerenter", enter); owner.removeEventListener("pointerleave", leave);
                        owner.removeEventListener("focusin", onFocus); owner.removeEventListener("focusout", onBlur);
                    });
                }
                return () => cleanups.forEach(cleanup => cleanup());
            });
        }, root);
        refresh();
    }
    function scheduleRebuild() {
        if (disposed || rebuildFrame) return;
        rebuildFrame = requestAnimationFrame(() => { rebuildFrame = 0; rebuild(); });
    }
    const visibility = () => {
        if (document.hidden) {
            pageContext?.revert();
            root.dataset.gsapEditorial = "suspended";
        } else scheduleRebuild();
    };
    const changes = new MutationObserver(scheduleRebuild);
    changes.observe(root, { childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ["hidden", "open", "aria-hidden"] });
    const sizes = new ResizeObserver(refresh); sizes.observe(root);
    root.addEventListener("load", refresh, true);
    root.addEventListener("toggle", scheduleRebuild, true);
    document.addEventListener("visibilitychange", visibility);
    document.fonts?.addEventListener("loadingdone", refresh);
    void document.fonts?.ready.then(() => { if (!disposed) refresh(); });
    rebuild();
    return () => {
        disposed = true;
        cancelAnimationFrame(rebuildFrame); cancelAnimationFrame(refreshFrame);
        changes.disconnect(); sizes.disconnect();
        root.removeEventListener("load", refresh, true); root.removeEventListener("toggle", scheduleRebuild, true);
        document.removeEventListener("visibilitychange", visibility); document.fonts?.removeEventListener("loadingdone", refresh);
        pageContext?.revert();
        if (previousReady === null) root.removeAttribute("data-gsap-editorial"); else root.setAttribute("data-gsap-editorial", previousReady);
        if (previousMode === null) root.removeAttribute("data-gsap-editorial-motion"); else root.setAttribute("data-gsap-editorial-motion", previousMode);
    };
}
