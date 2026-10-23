"use client";

import { SystemIconButton } from "./SystemPrimitives";
import React, { useState, useEffect } from "react";

export default function ReturnTop() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 400) {
                setVisible(true);
            } else {
                setVisible(false);
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        });
    };

    if (!visible) return null;

    return (
        <SystemIconButton data-component-id="return-top" data-text="action"
            variant="secondary"
            className="return-top is-visible"
            type="button"
            aria-label="맨 위로 이동"
            onClick={scrollToTop}
        >
            <svg
                className="material-icon"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                focusable="false"
            >
                <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" />
            </svg>
        </SystemIconButton>
    );
}
