"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";
import { useCatalog } from "../src/catalog/CatalogProvider";
import { HERO_MOTION } from "../src/data/design-tokens";
import HeroSlide from "./HeroSlide";
import HeroCompanion from "./HeroCompanion";
import Icon from "./Icon";
import { SystemButton, SystemIconButton } from "./SystemPrimitives";

export type HeroCarouselHandle = { showFeature: (anchor: string) => boolean };

// CSS motion preferences can cancel a native transitionend; finish through Swiper's own listeners.
function finishTransition(instance: SwiperInstance) {
    instance.wrapperEl.style.transitionDuration = "0ms";
    if (instance.animating) instance.wrapperEl.dispatchEvent(new Event("transitionend", { bubbles: true }));
}

// [작품·양옆 미리보기·정보 레일의 조합 / Compose the work, neighbour previews and information rail]
const HeroCarousel = forwardRef<HeroCarouselHandle, { externalPaused?: boolean }>(function HeroCarousel({ externalPaused = false }, ref) {
    const { catalog } = useCatalog();
    const HOME_FEATURES = catalog.homeFeatures;
    const [active, setActive] = useState(0);
    const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
    const [paused, setPaused] = useState(true);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [inView, setInView] = useState(true);
    const [documentHidden, setDocumentHidden] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);

    const [announcement, setAnnouncement] = useState("");
    const section = useRef<HTMLElement>(null);
    const instanceRef = useRef<SwiperInstance | null>(null);
    const pendingFeature = useRef<number | null>(null);
    const progress = useRef<HTMLElement>(null);
    const announceMove = useRef(false);
    const count = HOME_FEATURES.length;
    const featureSignature = HOME_FEATURES.map(feature => feature.id).join("\0");
    const safeActive = Math.min(active, Math.max(0, count - 1));
    const previous = HOME_FEATURES[(safeActive - 1 + count) % count];
    const next = HOME_FEATURES[(safeActive + 1) % count];

    // Repeat complete catalog cycles so small catalogs can loop with both neighbours visible.
    const slides = useMemo(() => count > 1
        ? Array.from({ length: Math.max(1, Math.ceil(6 / count)) }, () => HOME_FEATURES).flat()
        : HOME_FEATURES, [HOME_FEATURES]);

    function resetProgress() {
        if (progress.current) progress.current.style.transform = "scaleX(0)";
    }

    function move(by: 1 | -1) {
        if (!swiper || swiper.destroyed || swiper.animating || count < 2) return;
        announceMove.current = true;
        resetProgress();
        if (by < 0) swiper.slidePrev(reducedMotion ? 0 : HERO_MOTION.transition);
        else swiper.slideNext(reducedMotion ? 0 : HERO_MOTION.transition);
    }

    function selectNeighbor(by: 1 | -1) {
        // The preview unmounts as it becomes active; retain focus on the persistent equivalent.
        if (document.activeElement?.closest(".season-peer-title")) {
            section.current?.querySelector<HTMLButtonElement>(by < 0 ? "#home-feature-previous" : "#home-feature-next")?.focus({ preventScroll: true });
        }
        move(by);
    }

    function updateSlide(instance: SwiperInstance) {
        const index = instance.realIndex % count;
        setActive(index);
        resetProgress();
        if (announceMove.current) {
            setAnnouncement(`${index + 1} / ${count}, ${HOME_FEATURES[index].name}`);
            announceMove.current = false;
        }
    }

    useEffect(() => { resetProgress(); }, [featureSignature]);

    // [공유 앵커는 Swiper의 실제 슬라이드에 연결 / Shared anchors select the actual Swiper slide]
    useImperativeHandle(ref, () => ({ showFeature(anchor) {
        const index = HOME_FEATURES.findIndex(feature => anchor === `home-feature-${feature.id}`);
        if (index < 0) return false;
        setPaused(true);
        resetProgress();
        const instance = instanceRef.current;
        if (instance && !instance.destroyed) {
            finishTransition(instance);
            instance.slideToLoop(index, 0);
        } else {
            pendingFeature.current = index;
        }
        return true;
    } }));

    useEffect(() => {
        const preference = matchMedia("(prefers-reduced-motion: reduce)");
        const updatePreference = () => {
            setReducedMotion(preference.matches);
            const anchoredFeature = HOME_FEATURES.some(feature => window.location.hash === `#home-feature-${feature.id}`);
            setPaused(preference.matches || anchoredFeature);
        };
        const updateVisibility = () => setDocumentHidden(document.hidden);
        updatePreference();
        updateVisibility();
        preference.addEventListener("change", updatePreference);
        document.addEventListener("visibilitychange", updateVisibility);
        const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.15 });
        if (section.current) observer.observe(section.current);
        return () => {
            preference.removeEventListener("change", updatePreference);
            document.removeEventListener("visibilitychange", updateVisibility);
            observer.disconnect();
        };
    }, [featureSignature]);

    useEffect(() => {
        if (swiper && !swiper.destroyed && reducedMotion) finishTransition(swiper);
    }, [swiper, reducedMotion]);

    const suspended = count < 2 || paused || reducedMotion || hovered || focused || externalPaused || !inView || documentHidden;
    useEffect(() => {
        if (!swiper || swiper.destroyed) return;
        // Stopping also prevents Swiper's transition/visibility hooks from resuming a blocked carousel.
        if (suspended) swiper.autoplay.stop();
        else swiper.autoplay.start();
        return () => { if (!swiper.destroyed) swiper.autoplay.stop(); };
    }, [swiper, suspended]);

    if (!count) return <section className="season-hero container" data-component-id="hero-carousel" aria-label="이번 달의 문화예술"><p data-text="body">현재 공개된 주요 프로그램이 없습니다.</p></section>;

    return <section
        className="season-hero"
        id="featured-season"
        data-home-anchor
        data-component="HeroCarousel" data-component-id="hero-carousel"
        aria-label="이번 달의 문화예술"
        aria-roledescription="캐러셀"
        ref={section}
        onMouseEnter={() => setHovered(matchMedia("(hover: hover)").matches)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
    >
        <Swiper
            key={featureSignature}
            className="season-stage"
            wrapperClass="season-track"
            modules={[Autoplay]}
            onSwiper={instance => {
                instanceRef.current = instance;
                setSwiper(instance);
                setActive(instance.realIndex % count);
                if (pendingFeature.current !== null) {
                    instance.slideToLoop(pendingFeature.current, 0);
                    pendingFeature.current = null;
                }
            }}
            slidesPerView="auto"
            centeredSlides
            loop={count > 1}
            speed={reducedMotion ? 0 : HERO_MOTION.transition}
            allowTouchMove={count > 1}
            grabCursor={count > 1}
            threshold={8}
            longSwipesRatio={0.12}
            preventInteractionOnTransition
            noSwipingSelector="button, input, select, textarea"
            autoplay={{ delay: HERO_MOTION.interval, disableOnInteraction: false, waitForTransition: true }}
            onRealIndexChange={updateSlide}
            onSliderFirstMove={() => { announceMove.current = true; resetProgress(); }}
            onAutoplayTimeLeft={(_, __, remaining) => {
                if (progress.current) progress.current.style.transform = `scaleX(${Math.max(0, Math.min(1, 1 - remaining))})`;
            }}
        >
            {slides.map((feature, index) => <SwiperSlide
                key={`${feature.id}-${index}`}
                className="season-swiper-slide"
                role="group"
                aria-roledescription="슬라이드"
                aria-label={`${index % count + 1} / ${count}`}
            >
                {({ isActive, isPrev, isNext }) => <HeroSlide
                    feature={feature}
                    active={isActive || (!swiper && index === 0)}
                    preview={count > 1 ? isPrev ? "previous" : isNext ? "next" : undefined : undefined}
                    onSelect={isPrev ? () => selectNeighbor(-1) : isNext ? () => selectNeighbor(1) : undefined}
                />}
            </SwiperSlide>)}
        </Swiper>

        <div className="hero-neighbor-navigation container" role="group" aria-label="양옆 프로그램">
            <SystemButton data-text="action" variant="quiet" disabled={count < 2} onClick={() => move(-1)} aria-label={`${previous.name} 이전 슬라이드로 보기`}><Icon name="back" size={20} /><span data-text="body">{previous.programTitle}</span></SystemButton>
            <SystemButton data-text="action" variant="quiet" disabled={count < 2} onClick={() => move(1)} aria-label={`${next.name} 다음 슬라이드로 보기`}><span data-text="body">{next.programTitle}</span><Icon name="arrow" size={20} /></SystemButton>
        </div>
        <HeroCompanion />
        <div className="season-toolbar container">
            <p data-text="body">이번 달의 문화예술</p>
            <div className="season-controls" id="home-feature-controls" data-home-anchor role="group" aria-label="주요 프로그램 제어">
                <span className="season-pagination" aria-hidden="true"><span data-text="body">{String(safeActive + 1).padStart(2, "0")}</span><span data-text="body" className="season-pagination-total"> / {String(count).padStart(2, "0")}</span></span>
                <span className="season-progress" aria-hidden="true"><i ref={progress} /></span>
                <SystemIconButton data-text="action" id="home-feature-previous" disabled={count < 2} className="round-button" onClick={() => move(-1)} aria-label="이전 프로그램"><Icon name="back" size={24} /></SystemIconButton>
                <SystemIconButton data-text="action" id="home-feature-next" disabled={count < 2} className="round-button" onClick={() => move(1)} aria-label="다음 프로그램"><Icon name="arrow" size={24} /></SystemIconButton>
                <SystemIconButton data-text="action" id="home-feature-playback" disabled={count < 2} className="round-button" onClick={() => { if (paused) setFocused(false); setPaused(value => !value); }} aria-label={paused ? "자동 재생 시작" : "자동 재생 일시정지"} aria-pressed={paused}><Icon name={paused ? "play" : "pause"} size={24} /></SystemIconButton>
                <span data-text="body" className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
            </div>
        </div>
    </section>;
});

export default HeroCarousel;
