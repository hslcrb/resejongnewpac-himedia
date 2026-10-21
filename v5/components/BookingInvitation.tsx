"use client";

import { Fragment, memo, useEffect, useRef } from "react";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const entrancePath: Keyframe[] = Array.from({ length: 17 }, (_, step) => {
    const progress = step / 16;
    const curve = progress * progress * (3 - 2 * progress);
    return {
        offset: progress,
        transform: `translate3d(${-108 * (1 - progress)}%, ${72 * (1 - curve)}%, 0)`,
        opacity: progress,
    };
});

const BookingInvitation = memo(function BookingInvitation({
    id = "quick-booking-heading",
    text = "언제 만나볼까요?",
}: {
    id?: string;
    text?: string;
}) {
    const headingRef = useRef<HTMLHeadingElement>(null);

    // [스크롤에 연결된 곡선 진입 / Scroll-linked entrance along a rising curve]
    // 각 글자는 독립 마스크 안에서 천천히 들어오며 서로의 영역을 침범하지 않습니다.
    // Each character enters slowly inside its own mask, without crossing another character.
    useEffect(() => {
        const heading = headingRef.current;
        if (!heading) return;
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const letters = Array.from(
            heading.querySelectorAll<HTMLElement>(".booking-invitation-letter"),
        );
        const scene = heading.closest<HTMLElement>("[data-scroll-scene]");
        const scrollTarget = scene || window;
        let animations: Animation[] = [];
        let frame = 0;
        let previousProgress = -1;

        const stop = () => {
            animations.forEach((animation) => animation.cancel());
            animations = [];
        };
        const prepare = () => {
            stop();
            if (preference.matches) return;
            animations = letters.map((letter) => {
                const animation = letter.animate(entrancePath, {
                    duration: 1000,
                    easing: "cubic-bezier(.4, 0, .2, 1)",
                    fill: "both",
                });
                animation.pause();
                animation.currentTime = 0;
                return animation;
            });
            previousProgress = -1;
        };
        const render = () => {
            frame = 0;
            if (preference.matches) return;
            const bounds = heading.getBoundingClientRect();
            const viewHeight = scene ? scene.clientHeight : innerHeight;
            const top =
                bounds.top - (scene ? scene.getBoundingClientRect().top + scene.clientTop : 0);
            const end = scene ? viewHeight * 0.18 : Math.max(viewHeight * 0.18, 124);
            const distance = Math.max(1, viewHeight * 0.9 - end);
            const progress = clamp((viewHeight * 0.9 - top) / distance);
            if (progress === previousProgress) return;
            previousProgress = progress;
            for (let index = 0; index < animations.length; index++) {
                animations[index].currentTime = 1000 * clamp((progress - index * 0.105) / 0.265);
            }
        };
        const schedule = () => {
            if (!frame && !document.hidden) frame = requestAnimationFrame(render);
        };
        const measure = () => {
            previousProgress = -1;
            schedule();
        };
        const updatePreference = () => {
            prepare();
            measure();
        };

        // [단일 프레임 갱신과 정리 / Coalesced updates and cleanup]
        // 퍼센트 경로는 글자 크기를 따라가며 스크롤 입력만 프레임당 한 번 읽습니다.
        // Percentage paths follow the glyph size; scroll input is read once per frame.
        const updateVisibility = () => {
            if (document.hidden && frame) {
                cancelAnimationFrame(frame);
                frame = 0;
            } else schedule();
        };
        const observer = new ResizeObserver(measure);
        observer.observe(heading);
        scrollTarget.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", measure, { passive: true });
        preference.addEventListener("change", updatePreference);
        document.addEventListener("visibilitychange", updateVisibility);
        prepare();
        schedule();
        return () => {
            if (frame) cancelAnimationFrame(frame);
            observer.disconnect();
            scrollTarget.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", measure);
            preference.removeEventListener("change", updatePreference);
            document.removeEventListener("visibilitychange", updateVisibility);
            stop();
        };
    }, [text]);

    return (
        <h2 id={id} className="booking-invitation" aria-label={text} ref={headingRef}>
            <span aria-hidden="true">
                {text.split(" ").map((word, wordIndex) => (
                    <Fragment key={`${word}-${wordIndex}`}>
                        {wordIndex > 0 && " "}
                        <span className="booking-invitation-word">
                            {Array.from(word).map((letter, index) => (
                                <span className="booking-invitation-letter-slot" key={index}>
                                    <span className="booking-invitation-letter">{letter}</span>
                                </span>
                            ))}
                        </span>
                    </Fragment>
                ))}
            </span>
        </h2>
    );
});

export default BookingInvitation;
