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
        let media: ReturnType<typeof gsap.matchMedia> | undefined;
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
        const connectPhotos = () => {
            media?.revert();
            if (document.hidden) return;
            media = gsap.matchMedia(element);
            media.add("(prefers-reduced-motion: no-preference)", () => {
                for (const panel of panels) {
                    const image = panel.querySelector<HTMLImageElement>("[data-intro-media]");
                    if (!image) continue;
                    // 문장은 고정하고 사진의 작은 확대만 실제 스크롤 위치에 연결한다.
                    // Copy stays still; the photograph follows native scrolling without playback lag.
                    gsap.fromTo(image, { scaleX: 1.035, scaleY: 1.035 }, {
                        scaleX: 1, scaleY: 1, ease: "none",
                        scrollTrigger: {
                            trigger: panel, start: "top bottom", end: "bottom top",
                            scrub: true, invalidateOnRefresh: true,
                        },
                    });
                }
            });
        };
        const onVisibility = () => {
            if (document.hidden) media?.revert();
            else { connectPhotos(); refresh(); }
        };
        connectPhotos();
        const sizes = new ResizeObserver(refresh);
        sizes.observe(element);
        if (header) sizes.observe(header);
        element.addEventListener("load", refresh, true);
        document.addEventListener("visibilitychange", onVisibility);
        document.fonts?.addEventListener("loadingdone", refresh);
        void document.fonts?.ready.then(() => { if (!disposed) refresh(); });
        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            sizes.disconnect();
            element.removeEventListener("load", refresh, true);
            document.removeEventListener("visibilitychange", onVisibility);
            document.fonts?.removeEventListener("loadingdone", refresh);
            media?.revert();
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
            <img data-intro-media src="/v5/assets/images/sejong-grand-facade.png" alt="광화문광장에 면한 세종문화회관 외관" width={1160} height={680} />
            <div className="intro-cover-copy container"><p data-text="label">1978년 개관</p><h1 data-text="title" id="intro-title-opening" tabIndex={-1}>광화문에서 만나는<br />세종문화회관</h1><p data-text="body">공연과 전시를 보고, 예술을 배우는 서울의 문화공간입니다.</p><SystemButton variant="inverse" onClick={() => jump("pulse")}>세종문화회관 둘러보기</SystemButton></div>
        </section>
        <section id="intro-pulse" data-intro-scene="pulse" className="intro-panel container intro-editorial" aria-labelledby="intro-title-pulse">
            <div><p data-text="label">서울시예술단</p><h2 data-text="heading" id="intro-title-pulse" tabIndex={-1}>무대를 만드는 사람들</h2><p data-text="body">국악, 무용, 합창, 뮤지컬, 연극과 오페라. 서울시예술단의 공연과 활동을 소개합니다.</p><SystemLink href="/about/companies" variant="secondary">서울시예술단 소개</SystemLink></div>
            <figure><div className="intro-media-frame"><img data-intro-media src="/v5/assets/images/official/ilmu-stage.jpg" alt="서울시무용단 일무의 공연 장면" width={1200} height={675} loading="lazy" /></div><figcaption data-text="meta">서울시무용단 〈일무〉</figcaption></figure>
        </section>
        <section id="intro-space" data-intro-scene="space" className="intro-panel container intro-editorial intro-editorial-reverse" aria-labelledby="intro-title-space">
            <figure><div className="intro-media-frame"><img data-intro-media src="/v5/assets/images/sejong-grand-auditorium.png" alt="세종대극장의 객석과 무대" width={1160} height={680} loading="lazy" /></div><figcaption data-text="meta">세종대극장</figcaption></figure>
            <div><p data-text="label">공연장과 전시장</p><h2 data-text="heading" id="intro-title-space" tabIndex={-1}>공간마다 다른 관람 경험</h2><p data-text="body">대극장과 체임버홀, M씨어터와 S씨어터, 미술관의 위치와 객석을 관람 전에 살펴보세요.</p><SystemLink href="/visit/spaces" variant="secondary">공간과 객석 안내</SystemLink></div>
        </section>
        <section id="intro-together" data-intro-scene="together" className="intro-panel container" aria-labelledby="intro-title-together">
            <SystemSurface as="section" variant="subtle" padding="lg" className="intro-visit"><div><h2 data-text="heading" id="intro-title-together" tabIndex={-1}>관람을 준비하세요</h2><p data-text="body">프로그램 일정과 찾아오는 길, 접근성 서비스를 안내합니다.</p></div><div className="page-layout-actions"><SystemLink href="/programs">프로그램 일정</SystemLink><SystemLink href="/visit/directions" variant="secondary">오시는 길</SystemLink><SystemLink href="/visit/accessibility" variant="secondary">접근성 안내</SystemLink><SystemLink href="/about/introduction/history" variant="quiet">연혁</SystemLink></div></SystemSurface>
        </section>
    </div>;
}
