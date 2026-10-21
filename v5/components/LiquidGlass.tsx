"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import GlassRefraction from "./GlassRefraction";
import { resolveGlassOptions } from "../src/lib/liquid-glass";
import type { GlassOptions } from "../src/lib/liquid-glass";

export type LiquidGlassProps = HTMLAttributes<HTMLDivElement> & Partial<GlassOptions>;

// [콘텐츠와 분리된 공통 유리 표면 / Reusable glass without altering its content]
// 기본값은 디자인 토큰을 따르며 개별 표면만 props로 조정할 수 있습니다.
// Defaults inherit design tokens; props override only this particular surface.
const LiquidGlass = forwardRef<HTMLDivElement, LiquidGlassProps>(function LiquidGlass(
    { children, className = "", style, opacity, refraction, blur, thickness, ...props },
    forwardedRef,
) {
    const surfaceRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(forwardedRef, () => surfaceRef.current!, []);
    const options = resolveGlassOptions({ opacity, refraction, blur, thickness });
    const surfaceStyle: CSSProperties & Record<string, string | number> = {};
    if (opacity !== undefined) surfaceStyle["--glass-opacity"] = options.opacity;
    if (refraction !== undefined) surfaceStyle["--glass-refraction"] = options.refraction;
    if (blur !== undefined) surfaceStyle["--glass-blur"] = `${options.blur}px`;
    if (thickness !== undefined) surfaceStyle["--glass-thickness"] = `${options.thickness}px`;

    return (
        <div
            {...props}
            ref={surfaceRef}
            className={`liquid-glass ${className}`.trim()}
            style={{ ...surfaceStyle, ...style }}
        >
            <GlassRefraction
                surfaceRef={surfaceRef}
                blur={blur}
                refraction={refraction}
                thickness={thickness}
            />
            <div className="liquid-glass-optics" aria-hidden="true" />
            {children}
        </div>
    );
});

export default LiquidGlass;
