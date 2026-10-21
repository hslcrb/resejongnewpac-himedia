import { createElement } from "react";
import type { ComponentPropsWithoutRef } from "react";

// [의미를 보존하는 공통 표면 / Shared surfaces that preserve native semantics]
export const SYSTEM_SURFACE_VARIANTS = ["panel", "subtle", "inset", "banner", "elevated"] as const;
export type SystemSurfaceVariant = (typeof SYSTEM_SURFACE_VARIANTS)[number];
export type SystemSurfacePadding = "none" | "sm" | "md" | "lg";
export type SystemSurfaceRadius = "panel" | "compact" | "dialog";
export type SystemSurfaceTag = "div" | "section" | "article" | "aside" | "header" | "footer" | "main" | "nav" | "form" | "fieldset" | "ul" | "ol" | "li";

type SurfaceStyle<Element extends SystemSurfaceTag> = {
    as?: Element;
    variant?: SystemSurfaceVariant;
    padding?: SystemSurfacePadding;
    radius?: SystemSurfaceRadius;
};

export type SystemSurfaceProps<Element extends SystemSurfaceTag = "div"> =
    SurfaceStyle<Element> & Omit<ComponentPropsWithoutRef<Element>, keyof SurfaceStyle<Element>>;

// [배치와 콘텐츠는 소비자가 소유 / Consumers own layout and content]
// overflow를 숨기지 않아 중첩 조작의 초점과 팝업을 보존합니다.
// Preserve nested control focus and popups by leaving overflow visible.
export function SystemSurface<Element extends SystemSurfaceTag = "div">({
    as,
    variant = "panel",
    padding = "md",
    radius = "panel",
    className = "",
    ...props
}: SystemSurfaceProps<Element>) {
    return createElement(as || "div", {
        ...props,
        className: `system-surface ${className}`.trim(),
        "data-component": "surface",
        "data-surface-variant": variant,
        "data-surface-padding": padding,
        "data-surface-radius": radius,
    });
}

export default SystemSurface;
