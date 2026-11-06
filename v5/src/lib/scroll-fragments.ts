// [스크롤 위치 공유 / Share the section reached by a deliberate scroll]
export function selectScrollFragment(
    sections: { id: string; top: number }[],
    line: number,
    atBottom: boolean,
): string | null {
    if (!sections.length) return null;
    if (atBottom) return sections[sections.length - 1].id;
    let current = sections[0].id;
    for (const section of sections) if (section.top <= line) current = section.id;
    return current;
}

export function trackScrollFragments(
    getSections: () => { element: HTMLElement; fragment: string }[],
) {
    let intentUntil = 0;
    let frame = 0;
    let dragging = false;
    const intent = () => {
        intentUntil = Date.now() + 1500;
    };
    const cancelIntent = () => {
        intentUntil = 0;
        cancelAnimationFrame(frame);
    };
    const onKey = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        if (
            !["PageDown", "PageUp", "Home", "End"].includes(event.key) &&
            target?.closest("input, textarea, select, button, [contenteditable=true]")
        )
            return;
        if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key))
            intent();
    };
    const onPointerDown = (event: PointerEvent) => {
        if (event.target === document.documentElement || event.target === document.body) {
            dragging = true;
            intent();
        }
    };
    const onPointerMove = () => {
        if (dragging) intent();
    };
    const onPointerUp = () => {
        dragging = false;
    };
    const onClick = (event: MouseEvent) => {
        if ((event.target as Element | null)?.closest("a[href], button, select, input, textarea"))
            cancelIntent();
    };
    const onScroll = () => {
        if (Date.now() > intentUntil) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            const sections = getSections().filter(
                ({ element }) =>
                    !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
                    element.getClientRects().length > 0,
            );
            const header = document.getElementById("header");
            const line =
                Math.max(0, header?.getBoundingClientRect().bottom || 0) +
                Math.min(120, window.innerHeight * 0.2);
            const atBottom =
                window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
            const fragment = selectScrollFragment(
                sections.map(({ element, fragment }) => ({
                    id: fragment,
                    top: element.getBoundingClientRect().top,
                })),
                line,
                atBottom,
            );
            if (fragment) {
                const url = new URL(window.location.href);
                url.hash = fragment;
                if (url.hash !== window.location.hash)
                    window.history.replaceState(
                        window.history.state,
                        "",
                        url.pathname + url.search + url.hash,
                    );
            }
        });
    };
    window.addEventListener("wheel", intent, { passive: true });
    window.addEventListener("touchmove", intent, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", cancelIntent);
    window.addEventListener("popstate", cancelIntent);
    document.addEventListener("click", onClick, true);
    return () => {
        cancelIntent();
        window.removeEventListener("wheel", intent);
        window.removeEventListener("touchmove", intent);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("hashchange", cancelIntent);
        window.removeEventListener("popstate", cancelIntent);
        document.removeEventListener("click", onClick, true);
    };
}
