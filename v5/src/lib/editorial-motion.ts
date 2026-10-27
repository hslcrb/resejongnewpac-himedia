"use client";

import { gsap } from "./gsap";
import { editorialGroup } from "./editorial-policy";

/** Editorial motion owns no navigation or layout: the server-rendered page remains the reading surface. */
export function createEditorialMotion(root: HTMLElement, pathname: string): () => void {
    if (!editorialGroup(pathname)) return () => {};
    const previousReady = root.getAttribute("data-gsap-editorial");
    const previousMode = root.getAttribute("data-gsap-editorial-motion");
    let disposed = false, rebuildFrame = 0;
    let pageContext: gsap.Context | undefined;
    const excluded = 'form, table, dialog, [hidden], [aria-hidden="true"], [inert], .completed-sources, [data-component-id="introduction"]';
    const readable = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return !element.closest(excluded) && style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    };

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
            return () => media.revert();
        }, root);
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
    const sizes = new ResizeObserver(scheduleRebuild); sizes.observe(root);
    root.addEventListener("load", scheduleRebuild, true);
    root.addEventListener("toggle", scheduleRebuild, true);
    document.addEventListener("visibilitychange", visibility);
    document.fonts?.addEventListener("loadingdone", scheduleRebuild);
    void document.fonts?.ready.then(() => { if (!disposed) scheduleRebuild(); });
    rebuild();
    return () => {
        disposed = true;
        cancelAnimationFrame(rebuildFrame);
        changes.disconnect(); sizes.disconnect();
        root.removeEventListener("load", scheduleRebuild, true); root.removeEventListener("toggle", scheduleRebuild, true);
        document.removeEventListener("visibilitychange", visibility); document.fonts?.removeEventListener("loadingdone", scheduleRebuild);
        pageContext?.revert();
        if (previousReady === null) root.removeAttribute("data-gsap-editorial"); else root.setAttribute("data-gsap-editorial", previousReady);
        if (previousMode === null) root.removeAttribute("data-gsap-editorial-motion"); else root.setAttribute("data-gsap-editorial-motion", previousMode);
    };
}
