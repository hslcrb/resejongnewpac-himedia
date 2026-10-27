"use client";

import { useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP } from "../src/lib/gsap";
import { SystemButton, SystemLink } from "./SystemPrimitives";
import SystemSurface from "./SystemSurface";
import "./introduction.css";

const scenes = [
    { id: "opening", label: "세종문화회관" },
    { id: "pulse", label: "서울시예술단" },
    { id: "space", label: "공연장과 전시장" },
    { id: "together", label: "관람 안내" },
] as const;

// [공연장 사진과 기관 정보로 읽는 소개 / An introduction grounded in venues and people]
export default function IntroductionExperience() {
    const root = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState<string>("opening");
    useGSAP(() => {
        const element = root.current;
        if (!element) return;
        const panels = [...element.querySelectorAll<HTMLElement>("[data-intro-scene]")];
        const header = document.getElementById("header");
        const seen = new WeakSet<Element>();
        const sequences = new Map<HTMLElement, gsap.core.Timeline>();
        let disposed = false, frame = 0, headerOffset = 116;
        let boundaries: number[] = [];
        const measure = () => {
            headerOffset = (header?.offsetHeight || 90) + 24;
            const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
            element.style.setProperty("--intro-header-offset", `${headerOffset}px`);
            element.style.setProperty("--intro-root-padding", `${padding}px`);
            boundaries = panels.map(panel => panel.getBoundingClientRect().top + window.scrollY);
        };
        const syncScene = (self: ScrollTrigger) => {
            if (disposed) return;
            const scroll = self.scroll();
            const cursor = scroll + headerOffset + Math.min(innerHeight * .15, 80);
            let index = 0;
            boundaries.forEach((boundary, position) => { if (cursor >= boundary) index = position; });
            // 큰 화면에서는 마지막 제목이 헤더까지 오기 전에 네이티브 스크롤이 끝날 수 있다.
            // Use the real document boundary, not trigger progress, when that last scene is visible.
            const last = panels.length - 1;
            const maxScroll = ScrollTrigger.maxScroll(window);
            if (maxScroll > 0 && scroll >= maxScroll - 2 && boundaries[last] < scroll + innerHeight) {
                const focused = document.activeElement;
                const panel = focused instanceof HTMLElement && focused.matches("h1, h2") ? focused.closest<HTMLElement>("[data-intro-scene]") : null;
                const focusedIndex = panel ? panels.indexOf(panel) : -1;
                const rect = panel && focused instanceof HTMLElement ? focused.getBoundingClientRect() : null;
                const headerBottom = Math.max(0, header?.getBoundingClientRect().bottom || 0);
                if (focusedIndex >= 0 && rect && rect.top >= headerBottom && rect.bottom <= innerHeight) index = focusedIndex;
                else if (scroll > 0) index = last;
            }
            setActive(panels[index]?.dataset.introScene || "opening");
        };
        const refresh = () => {
            if (disposed || frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                if (!disposed && !document.hidden) { measure(); ScrollTrigger.refresh(true); }
            });
        };
        measure();
        // 끝 장면이 화면 위쪽에 도달할 때까지 현재 위치를 추적한다.
        // Keep tracking beyond "bottom bottom" so a focused third scene is not mistaken for the last.
        ScrollTrigger.create({
            trigger: element, start: "top top", end: "bottom top",
            onRefresh: self => { measure(); syncScene(self); }, onUpdate: syncScene,
        });
        const media = gsap.matchMedia(element);
        media.add("(prefers-reduced-motion: no-preference)", () => {
            for (const panel of panels) {
                const copy = [...panel.querySelectorAll<HTMLElement>('h1, h2, [data-text="label"]')].filter(target => !seen.has(target));
                const image = panel.querySelector<HTMLImageElement>(".intro-editorial img, .intro-cover > img");
                const strokes = [...panel.querySelectorAll<SVGPathElement>("[data-intro-stroke]")];
                const traveller = panel.querySelector<SVGCircleElement>("[data-intro-traveller]");
                const route = strokes[0];
                const targets: Element[] = [...copy, ...(image ? [image] : []), ...strokes, ...(traveller ? [traveller] : [])];
                if (targets.every(target => seen.has(target))) continue;
                // 읽는 본문과 버튼은 그대로 두고 제목·사진·장식만 한 번 연결한다.
                // Reading copy and controls stay in place; only the editorial sequence moves.
                const sequence = gsap.timeline({ paused: true, defaults: { ease: "power2.out" }, onComplete: () => targets.forEach(target => seen.add(target)) });
                sequences.set(panel, sequence);
                if (copy.length) sequence.fromTo(copy, { opacity: .65, y: 18 }, { opacity: 1, y: 0, duration: .65, stagger: .09, clearProps: "opacity,transform" }, 0);
                if (image && !seen.has(image)) sequence.fromTo(image,
                    { opacity: panel.classList.contains("intro-cover") ? .3 : .68, scaleX: 1.025, scaleY: 1.025 },
                    { opacity: panel.classList.contains("intro-cover") ? .42 : 1, scaleX: 1, scaleY: 1, duration: 1, clearProps: "opacity,transform" }, .05);
                if (strokes.length && !seen.has(strokes[0])) sequence.fromTo(strokes, { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.25, stagger: .08 }, .15);
                if (traveller && route && !seen.has(traveller)) sequence.to(traveller, { motionPath: { path: route, align: route, alignOrigin: [.5, .5] }, duration: 1.25, ease: "power1.inOut" }, .15);
                if (document.hidden || panel.getBoundingClientRect().bottom < 0) sequence.progress(1).pause();
                else ScrollTrigger.create({ trigger: panel, start: "top 85%", animation: sequence, once: true, toggleActions: "play none none none" });
            }
            return () => { sequences.clear(); };
        });
        const onFocus = (event: FocusEvent) => {
            const panel = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-intro-scene]") : null;
            if (panel) sequences.get(panel)?.progress(1).pause();
        };
        const onVisibility = () => {
            if (document.hidden) sequences.forEach(sequence => sequence.progress(1).pause());
            else refresh();
        };
        const sizes = new ResizeObserver(refresh);
        sizes.observe(element);
        if (header) sizes.observe(header);
        element.addEventListener("load", refresh, true);
        element.addEventListener("focusin", onFocus, true);
        document.addEventListener("visibilitychange", onVisibility);
        document.fonts?.addEventListener("loadingdone", refresh);
        void document.fonts?.ready.then(() => { if (!disposed) refresh(); });
        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            sizes.disconnect();
            element.removeEventListener("load", refresh, true);
            element.removeEventListener("focusin", onFocus, true);
            document.removeEventListener("visibilitychange", onVisibility);
            document.fonts?.removeEventListener("loadingdone", refresh);
            media.revert();
            element.style.removeProperty("--intro-header-offset");
            element.style.removeProperty("--intro-root-padding");
        };
    }, { scope: root });
    function jump(id: string) {
        const heading = root.current?.querySelector<HTMLElement>(`#intro-title-${id}`);
        if (!heading) return;
        heading.focus({ preventScroll: true });
        setActive(id);
        heading.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    }
    return <div ref={root} className="sejong-intro" data-component-id="introduction">
        <nav className="intro-scenes container" aria-label="기관 소개 장면">{scenes.map(scene => <SystemButton key={scene.id} variant="quiet" aria-current={active === scene.id ? "step" : undefined} onClick={() => jump(scene.id)}>{scene.label}</SystemButton>)}</nav>
        <section id="intro-opening" data-intro-scene="opening" className="intro-panel intro-cover" aria-labelledby="intro-title-opening">
            <img src="/v5/assets/images/sejong-grand-facade.png" alt="광화문광장에 면한 세종문화회관 외관" width={1160} height={680} />
            <div className="intro-cover-copy container"><p data-text="label">1978년 개관</p><h1 data-text="title" id="intro-title-opening" tabIndex={-1}>광화문에서 만나는<br />세종문화회관</h1><p data-text="body">공연과 전시를 보고, 예술을 배우는 서울의 문화공간입니다.</p><SystemButton variant="inverse" onClick={() => jump("pulse")}>세종문화회관 둘러보기</SystemButton></div>
            <svg data-intro-journey className="intro-journey" viewBox="0 0 640 72" fill="none" aria-hidden="true" focusable="false">
                <path data-intro-stroke d="M8 52C96 52 122 16 210 24S340 64 420 40S546 16 632 28" vectorEffect="non-scaling-stroke" />
                <path data-intro-stroke d="M8 62C106 62 136 34 224 40S350 64 440 52S556 30 632 40" vectorEffect="non-scaling-stroke" />
                <circle data-intro-traveller cx="8" cy="52" r="5" />
            </svg>
        </section>
        <section id="intro-pulse" data-intro-scene="pulse" className="intro-panel container intro-editorial" aria-labelledby="intro-title-pulse">
            <div><p data-text="label">서울시예술단</p><h2 data-text="heading" id="intro-title-pulse" tabIndex={-1}>무대를 만드는 사람들</h2><p data-text="body">국악, 무용, 합창, 뮤지컬, 연극과 오페라. 서울시예술단의 공연과 활동을 소개합니다.</p><SystemLink href="/about/companies" variant="secondary">서울시예술단 소개</SystemLink></div>
            <figure><img src="/v5/assets/images/official/ilmu-stage.jpg" alt="서울시무용단 일무의 공연 장면" width={1200} height={675} loading="lazy" /><figcaption data-text="meta">서울시무용단 〈일무〉</figcaption></figure>
        </section>
        <section id="intro-space" data-intro-scene="space" className="intro-panel container intro-editorial intro-editorial-reverse" aria-labelledby="intro-title-space">
            <figure><img src="/v5/assets/images/sejong-grand-auditorium.png" alt="세종대극장의 객석과 무대" width={1160} height={680} loading="lazy" /><figcaption data-text="meta">세종대극장</figcaption></figure>
            <div><p data-text="label">공연장과 전시장</p><h2 data-text="heading" id="intro-title-space" tabIndex={-1}>공간마다 다른 관람 경험</h2><p data-text="body">대극장과 체임버홀, M씨어터와 S씨어터, 미술관의 위치와 객석을 관람 전에 살펴보세요.</p><SystemLink href="/visit/spaces" variant="secondary">공간과 객석 안내</SystemLink></div>
        </section>
        <section id="intro-together" data-intro-scene="together" className="intro-panel container" aria-labelledby="intro-title-together">
            <SystemSurface as="section" variant="subtle" padding="lg" className="intro-visit"><div><h2 data-text="heading" id="intro-title-together" tabIndex={-1}>관람을 준비하세요</h2><p data-text="body">프로그램 일정과 찾아오는 길, 접근성 서비스를 안내합니다.</p></div><div className="page-layout-actions"><SystemLink href="/programs">프로그램 일정</SystemLink><SystemLink href="/visit/directions" variant="secondary">오시는 길</SystemLink><SystemLink href="/visit/accessibility" variant="secondary">접근성 안내</SystemLink><SystemLink href="/about/introduction/history" variant="quiet">연혁</SystemLink></div></SystemSurface>
        </section>
    </div>;
}
