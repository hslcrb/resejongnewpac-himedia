"use client";

import { useEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import { SystemField } from "../SystemPrimitives";

type Props = {
    label: string;
    value: string;
    placeholder?: string;
    hint?: string;
    multiline?: boolean;
    onCommit: (value: string) => boolean;
};

export function StudioField({ label, value, placeholder, hint, multiline, onCommit }: Props) {
    const [buffer, setBuffer] = useState(value);
    const [invalid, setInvalid] = useState(false);
    const cancel = useRef(false);
    useEffect(() => { setBuffer(value); setInvalid(false); }, [value]);

    // 입력 중간값은 보관하고 한 번만 반영. / Preserve partial tokens and commit once per edit.
    const blur = (_event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (cancel.current) { cancel.current = false; return; }
        if (buffer === value) { setInvalid(false); return; }
        setInvalid(!onCommit(buffer));
    };
    const keys = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancel.current = true;
            setBuffer(value);
            setInvalid(false);
            event.currentTarget.blur();
        } else if (event.key === "Enter" && (!multiline || event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            event.currentTarget.blur();
        }
    };
    const props = { label, value: buffer, placeholder, hint, onBlur: blur, onKeyDown: keys,
        error: invalid ? "적용되지 않았습니다. 값의 형식을 확인해 주세요." : undefined,
        onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setBuffer(event.target.value);
            setInvalid(false);
        },
    };
    return multiline ? <SystemField {...props} as="textarea" rows={3} /> : <SystemField {...props} />;
}
