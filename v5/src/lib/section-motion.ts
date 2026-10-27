"use client";

import { gsap, ScrollTrigger } from "./gsap";

export type SectionChapter = { id: string; title: string };

/** Own only this page's tweens, media queries, listeners and triggers. */
export function createSectionMotion(
    content: HTMLElement, progress: HTMLElement,
    chaptersChanged: (chapters: SectionChapter[]) => void,
    activeChanged: (index: number) => void,
): () => void {
    let disposed = false;
    let rebuildFrame = 0, refreshFrame = 0;
    let pageContext: gsap.Context | undefined;
    let nextHeadingId = 0;
    const seen = new WeakSet<HTMLElement>();
    const generatedIds = new Map<HTMLElement, string>();
    const originalCurrent = new Map<HTMLAnchorElement, string | null>();
    const headingSelector = "h2:not(.completed-sources h2)";
    const readable = (node: HTMLElement) => !node.closest('form, table, dialog, [hidden], [aria-hidden="true"]') && getComputedStyle(node).display !== "none" && node.getClientRects().length > 0;
    const restoreLinks = () => {
        for (const [link, value] of originalCurrent) {
            if (value === null) link.removeAttribute("aria-current"); else link.setAttribute("aria-current", value);
        }
        originalCurrent.clear();
    };
    function refresh() {
        if (disposed || refreshFrame) return;
        refreshFrame = requestAnimationFrame(() => { refreshFrame = 0; if (!disposed && document.visibilityState !== "hidden") ScrollTrigger.refresh(true); });
    }
    function rebuild() {
        if (disposed) return;
        pageContext?.revert();
        restoreLinks();
        if (document.visibilityState === "hidden") return;
        for (const [heading, assigned] of generatedIds) {
            if (!content.contains(heading)) { if (heading.id === assigned) heading.removeAttribute("id"); generatedIds.delete(heading); }
        }
        const headings = [...content.querySelectorAll<HTMLElement>(headingSelector)].filter(readable);
        headings.forEach(heading => {
            if (heading.id) return;
            let id: string;
            do { id = `section-experience-heading-${nextHeadingId++}`; } while (document.getElementById(id));
            generatedIds.set(heading, id); heading.id = id;
        });
        chaptersChanged(headings.map(heading => ({ id: heading.id, title: heading.textContent?.trim() || "섹션" })));
        const links = [...content.querySelectorAll<HTMLAnchorElement>('.completed-outline a[href^="#"], .intro-scenes a[href^="#"]')];
        links.forEach(link => originalCurrent.set(link, link.getAttribute("aria-current")));
        const activate = (index: number) => {
            const current = Math.max(0, Math.min(index, headings.length - 1));
            activeChanged(current);
            const heading = headings[current];
            for (const link of links) {
                const id = link.hash.slice(1);
                if (heading && (heading.id === id || heading.closest("section[id]")?.id === id)) link.setAttribute("aria-current", "location");
                else link.removeAttribute("aria-current");
            }
        };
        pageContext = gsap.context(() => {
            const sections = headings.map(heading => heading.closest<HTMLElement>(".completed-section, .intro-panel, .catalog-content-block") || heading);
            let boundaries: number[] = [];
            const syncChapter = (scroll: number, position: number) => {
                let current = 0;
                boundaries.forEach((boundary, index) => { if (scroll + 1 >= boundary) current = index; });
                if (position >= .999 && headings.length) current = headings.length - 1;
                activate(current);
            };
            gsap.fromTo(progress, { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, ease: "none",
                scrollTrigger: { trigger: content, start: "top top", end: "bottom bottom", scrub: true, invalidateOnRefresh: true,
                    onRefresh: self => {
                        const rootPadding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
                        content.parentElement?.style.setProperty("--section-root-padding", `${rootPadding}px`);
                        boundaries = sections.map((section, index) => section.getBoundingClientRect().top + self.scroll() - (parseFloat(getComputedStyle(headings[index]).scrollMarginTop) || 0) - rootPadding - 8);
                        syncChapter(self.scroll(), self.progress);
                    },
                    onUpdate: self => syncChapter(self.scroll(), self.progress),
                },
            });
            const media = gsap.matchMedia();
            media.add({ motion: "(prefers-reduced-motion: no-preference)", fine: "(hover: hover) and (pointer: fine)" }, context => {
                if (!context.conditions?.motion) return;
                const cleanups: (() => void)[] = [];
                const reveals = new Map<HTMLElement, gsap.core.Tween>();
                const targets = [...content.querySelectorAll<HTMLElement>("h1, h2, .completed-hero-image, .intro-editorial figure")].filter(readable);
                for (const target of targets) {
                    if (target.closest(".completed-sources") || seen.has(target) || targets.some(parent => parent !== target && parent.contains(target))) continue;
                    if (target.getBoundingClientRect().bottom < 0) { seen.add(target); continue; }
                    const tween = gsap.fromTo(target, { opacity: .5, y: 18 }, { opacity: 1, y: 0, duration: .55, ease: "power2.out", paused: true, clearProps: "opacity,transform", onComplete: () => { seen.add(target); } });
                    reveals.set(target, tween);
                    ScrollTrigger.create({ trigger: target, start: "top 92%", once: true, onEnter: () => { tween.play(); } });
                }
                const settle = (target: Node) => { for (const [element, tween] of reveals) if (element === target || element.contains(target)) tween.progress(1); };
                const onFocus = (event: FocusEvent) => { if (event.target instanceof Node) settle(event.target); };
                content.addEventListener("focusin", onFocus, true);
                cleanups.push(() => content.removeEventListener("focusin", onFocus, true));
                for (const image of content.querySelectorAll<HTMLElement>(".completed-list-image > img, .intro-editorial figure img")) {
                    const owner = image.closest<HTMLElement>("a, figure");
                    if (!owner) continue;
                    // quickTo resets one numeric property; CSSPlugin's composite "scale" alias is not resettable.
                    const scaleX = gsap.quickTo(image, "scaleX", { duration: .3, ease: "power2.out" });
                    const scaleY = gsap.quickTo(image, "scaleY", { duration: .3, ease: "power2.out" });
                    let hovering = !!context.conditions?.fine && owner.matches(":hover"), focused = owner.contains(document.activeElement);
                    const update = () => { settle(image); const value = hovering || focused ? 1.025 : 1; scaleX(value); scaleY(value); };
                    const enter = () => { hovering = true; update(); }, leave = () => { hovering = false; update(); };
                    const focus = () => { focused = true; update(); };
                    const blur = (event: FocusEvent) => { if (event.relatedTarget instanceof Node && owner.contains(event.relatedTarget)) return; focused = false; update(); };
                    if (context.conditions?.fine) { owner.addEventListener("pointerenter", enter); owner.addEventListener("pointerleave", leave); }
                    owner.addEventListener("focusin", focus); owner.addEventListener("focusout", blur);
                    if (hovering || focused) update();
                    cleanups.push(() => { owner.removeEventListener("pointerenter", enter); owner.removeEventListener("pointerleave", leave); owner.removeEventListener("focusin", focus); owner.removeEventListener("focusout", blur); });
                }
                return () => { cleanups.forEach(cleanup => cleanup()); };
            });
        }, content);
        refresh();
    }
    const scheduleRebuild = () => {
        if (disposed || rebuildFrame) return;
        rebuildFrame = requestAnimationFrame(() => { rebuildFrame = 0; rebuild(); });
    };
    const changes = new MutationObserver(scheduleRebuild);
    changes.observe(content, { childList: true, subtree: true, characterData: true });
    const sizes = new ResizeObserver(refresh);
    sizes.observe(content);
    content.addEventListener("load", refresh, true);
    content.addEventListener("toggle", scheduleRebuild, true);
    document.addEventListener("visibilitychange", scheduleRebuild);
    void document.fonts?.ready.then(() => { if (!disposed) refresh(); });
    rebuild();
    return () => {
        disposed = true;
        cancelAnimationFrame(rebuildFrame); cancelAnimationFrame(refreshFrame);
        changes.disconnect(); sizes.disconnect();
        content.removeEventListener("load", refresh, true); content.removeEventListener("toggle", scheduleRebuild, true);
        document.removeEventListener("visibilitychange", scheduleRebuild);
        pageContext?.revert(); restoreLinks();
        for (const [heading, assigned] of generatedIds) { if (heading.id === assigned) heading.removeAttribute("id"); }
    };
}
