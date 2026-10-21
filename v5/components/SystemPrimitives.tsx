"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import Icon from "./Icon";

// [토큰을 사용하는 기본 조작 / Token-based interface primitives]
// 문서의 예제와 제품 화면에서 같은 크기·상태·접근성 속성을 사용합니다.
// Documentation and product screens share dimensions, states and accessible attributes.
type SystemButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "accent" | "quiet";
};

export const SystemButton = forwardRef<HTMLButtonElement, SystemButtonProps>(function SystemButton(
    { variant = "primary", className = "", type = "button", ...props }: SystemButtonProps,
    ref,
) {
    return (
        <button
            {...props}
            ref={ref}
            type={type}
            className={`ds-button ds-button-${variant} ${className}`}
        />
    );
});

export function SystemField({
    id,
    label,
    hint,
    error,
    ...props
}: InputHTMLAttributes<HTMLInputElement> & {
    id: string;
    label: string;
    hint?: string;
    error?: string;
}) {
    const message = error || hint;
    const describedBy =
        [props["aria-describedby"], message ? `${id}-message` : undefined]
            .filter(Boolean)
            .join(" ") || undefined;
    return (
        <div className="ds-field">
            <label htmlFor={id}>
                {label}
                {props.required && <span> (필수)</span>}
            </label>
            <input
                {...props}
                id={id}
                aria-invalid={error ? true : props["aria-invalid"]}
                aria-describedby={describedBy}
            />
            {message && (
                <p id={`${id}-message`} className={error ? "ds-field-error" : "ds-field-hint"}>
                    {error && <Icon name="close" size={20} />}
                    {message}
                </p>
            )}
        </div>
    );
}

export function SystemBadge({
    children,
    tone = "neutral",
}: {
    children: ReactNode;
    tone?: "neutral" | "highlight" | "info";
}) {
    return <span className={`ds-badge ds-badge-${tone}`}>{children}</span>;
}

export function SystemNotice({
    title,
    children,
    error = false,
}: {
    title: string;
    children: ReactNode;
    error?: boolean;
}) {
    return (
        <div className="ds-notice" role={error ? "alert" : "status"}>
            <Icon name={error ? "close" : "check"} size={24} />
            <div>
                <strong>{title}</strong>
                <p>{children}</p>
            </div>
        </div>
    );
}
