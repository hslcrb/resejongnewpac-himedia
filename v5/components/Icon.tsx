"use client";

import React from "react";

const names: Record<string, string> = {
    arrow: "arrow_forward",
    back: "arrow_back",
    diagonal: "arrow_outward",
    up: "arrow_upward",
    search: "search",
    menu: "menu",
    close: "close",
    calendar: "calendar_month",
    pin: "location_on",
    ticket: "confirmation_number",
    user: "person",
    heart: "favorite",
    chevron: "chevron_right",
    clock: "schedule",
    plus: "add",
    check: "check",
    wheelchair: "accessible",
    car: "directions_car",
    building: "apartment",
    coffee: "local_cafe",
    mail: "mail",
    download: "download",
    play: "play_arrow",
    pause: "pause",
};

interface IconProps {
    name: string;
    size?: number;
    className?: string;
    filled?: boolean;
}

export default function Icon({ name, size = 24, className = "", filled = false }: IconProps) {
    const symbol = names[name] || name || "arrow_forward";
    const hasFilledVariant = symbol === "favorite" || symbol === "lightbulb";

    return (
        <svg
            data-component-id="icon"
            className={`material-icon ${className}`.trim()}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
        >
            <use
                href={`/v5/assets/icons/material-symbols-rounded.svg#${hasFilledVariant && filled ? `${symbol}-fill` : symbol}`}
            />
        </svg>
    );
}
