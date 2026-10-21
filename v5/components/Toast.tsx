"use client";

import React, { useState, useEffect } from "react";

export function showToast(message: string) {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sejong-toast", { detail: message }));
    }
}

export default function Toast() {
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        const handleToast = (e: CustomEvent<string>) => {
            setMessage(e.detail);
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setMessage(null);
            }, 3000);
        };

        window.addEventListener("sejong-toast", handleToast as EventListener);
        return () => {
            window.removeEventListener("sejong-toast", handleToast as EventListener);
            clearTimeout(timeoutId);
        };
    }, []);

    if (!message) return <div id="toast" className="toast" role="status" aria-live="polite" />;

    return (
        <div id="toast" className="toast visible" role="status" aria-live="polite">
            {message}
        </div>
    );
}
