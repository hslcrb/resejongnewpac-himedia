"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useGSAP, ScrollTrigger } from "../src/lib/gsap";
import { createSectionMotion } from "../src/lib/section-motion";
import type { SectionChapter } from "../src/lib/section-motion";
import { SystemButton } from "./SystemPrimitives";
import "../styles/section-experience.css";

/** Shared editorial navigation for the five public sections. Content stays visible without JavaScript. */
export default function SectionExperience({ children, pathname }: { children: ReactNode; pathname: string }) {
    const content = useRef<HTMLDivElement>(null);
    const progress = useRef<HTMLDivElement>(null);
    const navigator = useRef<HTMLElement>(null);
    const [chapters, setChapters] = useState<SectionChapter[]>([]);
    const [active, setActive] = useState(0);
    useGSAP(() => {
        if (!content.current || !progress.current) return;
        const root = content.current.parentElement!;
        const header = document.getElementById("header");
        let measured = "";
        const measure = () => {
            const headerHeight = header?.offsetHeight || 90, navHeight = navigator.current?.offsetHeight || 0;
            const next = `${headerHeight}:${navHeight}`;
            if (next === measured) return;
            measured = next;
            root.style.setProperty("--section-header-offset", `${headerHeight}px`);
            root.style.setProperty("--section-navigation-height", `${navHeight}px`);
            ScrollTrigger.refresh(true);
        };
        const sizes = new ResizeObserver(measure);
        if (header) sizes.observe(header);
        if (navigator.current) sizes.observe(navigator.current);
        measure();
        const cleanup = createSectionMotion(content.current, progress.current, next => {
            setChapters(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
        }, setActive);
        return () => { sizes.disconnect(); cleanup(); };
    }, { scope: content, dependencies: [pathname], revertOnUpdate: true });
    function jump(index: number) {
        const chapter = chapters[index];
        const heading = chapter && document.getElementById(chapter.id);
        if (!heading) return;
        // Explicit navigation remains native and interruptible. Keyboard focus is never delayed by motion.
        const hadTabIndex = heading.hasAttribute("tabindex");
        if (!hadTabIndex) { heading.tabIndex = -1; heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true }); }
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
        history.replaceState(history.state, "", `#${encodeURIComponent(chapter.id)}`);
        setActive(index);
    }
    return <div className="section-experience" data-component-id="section-experience">
        <nav ref={navigator} className="section-experience__navigator container" aria-label="페이지 빠른 탐색" hidden={chapters.length < 2}>
            <div className="section-experience__position"><span data-text="label">이 페이지 둘러보기</span><span data-text="body" className="section-experience__current" title={chapters[active]?.title}>{chapters[active]?.title}</span></div>
            <div className="section-experience__controls"><SystemButton variant="quiet" disabled={active <= 0} onClick={() => jump(active - 1)}>이전 섹션</SystemButton><SystemButton variant="secondary" disabled={active >= chapters.length - 1} onClick={() => jump(active + 1)}>다음 섹션</SystemButton></div>
            <div className="section-experience__track" aria-hidden="true"><div ref={progress} data-section-progress /></div>
        </nav>
        <div ref={content} data-text="body">{children}</div>
    </div>;
}
