"use client";

import { Fragment, memo, useEffect, useRef } from "react";

const invitation = "언제 만나볼까요?";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const BookingInvitation = memo(function BookingInvitation() {
    const headingRef = useRef<HTMLHeadingElement>(null);

    // [스크롤에 연결된 곡선 진입 / Scroll-linked entrance along a rising curve]
    // 왼쪽 아래에서 한 글자씩 빠르게 들어오며, 스크롤을 멈추면 같은 위치에 머뭅니다.
    // Letters enter from the lower left, one by one, and stay in place when scrolling stops.
    useEffect(() => {
        const heading = headingRef.current;
        if (!heading) return;
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const letters = Array.from(heading.querySelectorAll<HTMLElement>(".booking-invitation-letter"));
        let animations: Animation[] = [];
        let frame = 0;
        let needsMeasure = true;
        let previousProgress = -1;
        let alive = true;

        const stop = () => {
            animations.forEach((animation) => animation.cancel());
            animations = [];
        };
        const prepare = (left: number) => {
            stop();
            const rise = Math.min(76, parseFloat(getComputedStyle(heading).fontSize) * 1.25);
            const distances = letters.map((letter) => left + letter.offsetLeft + letter.offsetWidth + 28);
            animations = letters.map((letter, index) => {
                const path: Keyframe[] = Array.from({ length: 17 }, (_, step) => {
                    const progress = step / 16;
                    const curve = progress * progress * (3 - 2 * progress);
                    return {
                        offset: progress,
                        transform: `translate3d(${-distances[index] * (1 - progress)}px, ${rise * (1 - curve)}px, 0)`,
                        opacity: Math.min(1, progress * 10),
                    };
                });
                const animation = letter.animate(path, {
                    duration: 1000,
                    easing: "cubic-bezier(.6, 0, .16, 1)",
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
            if (needsMeasure) {
                needsMeasure = false;
                prepare(bounds.left);
            }
            const progress = clamp((innerHeight * .88 - bounds.top) / (innerHeight * .24));
            if (progress === previousProgress) return;
            previousProgress = progress;
            for (let index = 0; index < animations.length; index++) {
                animations[index].currentTime = 1000 * clamp((progress - index * .04) / .64);
            }
        };
        const schedule = () => {
            if (!frame && !document.hidden) frame = requestAnimationFrame(render);
        };
        const measure = () => {
            needsMeasure = true;
            schedule();
        };
        const updatePreference = () => {
            stop();
            measure();
        };

        // [단일 프레임 갱신과 정리 / Coalesced updates and cleanup]
        // 스크롤은 프레임당 한 번만 읽고, 크기와 글꼴이 바뀔 때 경로를 다시 계산합니다.
        // Read scrolling once per frame; rebuild paths only after size or font changes.
        const updateVisibility = () => {
            if (document.hidden && frame) {
                cancelAnimationFrame(frame);
                frame = 0;
            } else schedule();
        };
        const observer = new ResizeObserver(measure);
        observer.observe(heading);
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", measure, { passive: true });
        preference.addEventListener("change", updatePreference);
        document.addEventListener("visibilitychange", updateVisibility);
        document.fonts.ready.then(() => { if (alive) measure(); });
        schedule();
        return () => {
            alive = false;
            if (frame) cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", measure);
            preference.removeEventListener("change", updatePreference);
            document.removeEventListener("visibilitychange", updateVisibility);
            stop();
        };
    }, []);

    return (
        <h2 id="quick-booking-heading" className="booking-invitation" aria-label={invitation} ref={headingRef}>
            <span aria-hidden="true">
                {invitation.split(" ").map((word, wordIndex) => (
                    <Fragment key={word}>
                        {wordIndex > 0 && " "}
                        <span className="booking-invitation-word">
                            {Array.from(word).map((letter, index) => <span className="booking-invitation-letter" key={index}>{letter}</span>)}
                        </span>
                    </Fragment>
                ))}
            </span>
        </h2>
    );
});

export default BookingInvitation;
