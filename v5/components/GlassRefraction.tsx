"use client";

import { useId, useEffect, useRef } from "react";
import type { RefObject } from "react";
import { glassDisplacement } from "../src/lib/floating-panel";

// [배경을 실제로 굴절시키는 렌즈 / A lens that displaces the actual backdrop]
// 크기가 바뀔 때만 굴절 지도를 만들고 드래그 중에는 다시 그리지 않습니다.
// Regenerate the displacement map on resize, never during pointer movement.
export default function GlassRefraction({ panelRef }: { panelRef: RefObject<HTMLDivElement> }) {
    const id = "glass-lens-" + useId().replace(/:/g, "");
    const image = useRef<SVGFEImageElement>(null);
    useEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;
        let previousSize = "";
        const update = () => {
            const width = Math.ceil(panel.offsetWidth);
            const height = Math.ceil(panel.offsetHeight);
            if (!width || !height || previousSize === `${width}x${height}`) return;
            previousSize = `${width}x${height}`;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d");
            if (!context) return;
            const map = context.createImageData(width, height);
            const radius = parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 24;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const index = (y * width + x) * 4;
                    let dx = 0;
                    let dy = 0;
                    if (x < 24 || x > width - 24 || y < 24 || y > height - 24) {
                        const normal = glassDisplacement(x, y, width, height, radius, 18);
                        dx = normal.x;
                        dy = normal.y;
                    }
                    map.data[index] = Math.round(128 + dx * 127);
                    map.data[index + 1] = Math.round(128 + dy * 127);
                    map.data[index + 2] = 128;
                    map.data[index + 3] = 255;
                }
            }
            context.putImageData(map, 0, 0);
            image.current?.setAttribute("href", canvas.toDataURL());
            panel.style.setProperty("--glass-refraction", `url("#${id}")`);
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(panel);
        return () => observer.disconnect();
    }, [id, panelRef]);
    return (
        <svg
            className="glass-lens-definitions"
            width="0"
            height="0"
            aria-hidden="true"
            focusable="false"
        >
            <defs>
                <filter
                    id={id}
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    colorInterpolationFilters="sRGB"
                >
                    <feImage
                        ref={image}
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        preserveAspectRatio="none"
                        result="lens"
                    />
                    <feDisplacementMap
                        in="SourceGraphic"
                        in2="lens"
                        scale="26"
                        xChannelSelector="R"
                        yChannelSelector="G"
                    />
                </filter>
            </defs>
        </svg>
    );
}
