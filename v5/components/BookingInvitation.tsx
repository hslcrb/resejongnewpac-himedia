"use client";

import { Fragment, memo, useEffect, useRef } from "react";

const invitation = "언제 만나볼까요?";

// [왼쪽부터 인사하는 글자 / A greeting that ripples from left to right]
// 글자는 살짝 내려갔다 올라오며, 읽기 순서와 제목의 자리는 그대로 유지합니다.
// Letters dip and spring back without changing reading order or the heading layout.
const greetingFrames: Keyframe[] = [
    { offset: 0, transform: "translate3d(0, 0, 0) rotate(0deg) scale(1)", easing: "cubic-bezier(.45, 0, .7, 1)" },
    { offset: .28, transform: "translate3d(-.055em, .18em, 0) rotate(-3deg) scale(1.025, .96)", easing: "cubic-bezier(.16, 1, .3, 1)" },
    { offset: .62, transform: "translate3d(.025em, -.14em, 0) rotate(2deg) scale(.985, 1.025)", easing: "cubic-bezier(.45, 0, .55, 1)" },
    { offset: .82, transform: "translate3d(0, .035em, 0) rotate(-.6deg) scale(1)", easing: "cubic-bezier(.22, 1, .36, 1)" },
    { offset: 1, transform: "translate3d(0, 0, 0) rotate(0deg) scale(1)" },
];

const BookingInvitation = memo(function BookingInvitation() {
    const headingRef = useRef<HTMLHeadingElement>(null);

    // [등장·다시 인사·동작 감소 / Entrance, replay and reduced motion]
    // 화면 밖이나 숨긴 탭에서는 정지하고, 재생 중인 인사는 새 입력으로 끊지 않습니다.
    // Stop outside the viewport or a hidden tab, and let an active greeting settle.
    useEffect(() => {
        const heading = headingRef.current;
        if (!heading) return;
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const letters = Array.from(heading.querySelectorAll<HTMLElement>(".booking-invitation-letter"));
        let animations: Animation[] = [];
        let inView = false;

        const stop = () => {
            animations.forEach((animation) => animation.cancel());
            animations = [];
        };
        const play = () => {
            if (!inView || preference.matches || document.hidden || animations.some((animation) => animation.playState === "running")) return;
            stop();
            animations = letters.map((letter, index) => letter.animate(greetingFrames, {
                duration: 1120,
                delay: index * 58,
                fill: "none",
            }));
        };
        const updatePreference = () => {
            if (preference.matches) stop();
        };
        const updateVisibility = () => {
            if (document.hidden) stop();
        };
        const observer = new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting && entry.intersectionRatio >= .75;
            if (inView) play();
            else stop();
        }, { threshold: .75, rootMargin: "0px 0px -8% 0px" });

        observer.observe(heading);
        heading.addEventListener("pointerenter", play);
        preference.addEventListener("change", updatePreference);
        document.addEventListener("visibilitychange", updateVisibility);
        return () => {
            observer.disconnect();
            heading.removeEventListener("pointerenter", play);
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
