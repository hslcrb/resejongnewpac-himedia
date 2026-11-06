"use client";

import { useState } from "react";
import DeepSearch from "./DeepSearch";
import { SystemDisclosure } from "./SystemNavigation";

/** Progressive enhancement: native filter stays visible and usable at every width. */
export default function DeepSearchDisclosure({
    title = "대화형 검색으로 더 찾아보기",
    onSearch,
}: {
    title?: string;
    onSearch?: (query: string) => string;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div data-component-id="deep-search-disclosure">
            <SystemDisclosure
                className="sejong-deep-search-disclosure"
                onToggle={(event) => setOpen(event.currentTarget.open)}
                summary={
                    <>
                        <span data-text="action" data-text-size="control">
                            {title}
                        </span>
                        <span data-text="meta">Deep Chat</span>
                    </>
                }
            >
                {open && <DeepSearch compact onSearch={onSearch} />}
            </SystemDisclosure>
        </div>
    );
}
