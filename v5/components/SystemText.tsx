import { createElement } from "react";
import type { ComponentPropsWithoutRef, ElementType } from "react";
import type { TextVariant } from "../src/data/design-tokens";

export type { TextVariant } from "../src/data/design-tokens";

// [래퍼 없이 연결하는 공유 텍스트 속성 / Shared text attributes without an extra wrapper]
export function textAttributes(variant: TextVariant = "body", size?: TextVariant) {
    return {
        "data-text": variant,
        ...(size ? { "data-text-size": size } : {}),
    } as const;
}

export type SystemTextProps<As extends ElementType = "span"> = {
    as?: As;
    variant?: TextVariant;
    size?: TextVariant;
} & Omit<ComponentPropsWithoutRef<As>, "as" | "variant" | "size">;

// [의미와 표시 역할을 분리한 공유 텍스트 / Shared text with independent semantics and visual roles]
export function SystemText<As extends ElementType = "span">({
    as,
    variant = "body",
    size,
    className,
    ...props
}: SystemTextProps<As>) {
    return createElement(as || "span", {
        ...props,
        ...textAttributes(variant, size),
        className: ["system-text", className].filter(Boolean).join(" "),
    });
}
