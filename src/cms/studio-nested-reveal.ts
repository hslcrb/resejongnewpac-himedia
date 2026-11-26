import { revealStudioAxis } from "./studio-reveal.ts";

const userScrollable = (overflow: string) => overflow === "auto" || overflow === "scroll";

// 스크롤 상자를 안쪽부터 이동한다. / Reveal inner scroll boxes first without touching the host page.
export function revealStudioScrollParents(target: HTMLElement, view: Window, scrollingElement: Element | null): void {
    for (let parent = target.parentElement; parent && parent !== scrollingElement; parent = parent.parentElement) {
        const horizontal = parent.clientWidth > 0 && parent.scrollWidth > parent.clientWidth;
        const vertical = parent.clientHeight > 0 && parent.scrollHeight > parent.clientHeight;
        if (!horizontal && !vertical) continue;

        const style = view.getComputedStyle(parent);
        const canScrollX = horizontal && userScrollable(style.overflowX);
        const canScrollY = vertical && userScrollable(style.overflowY);
        if (!canScrollX && !canScrollY) continue;
        const box = parent.getBoundingClientRect();
        const rect = target.getBoundingClientRect();
        const sx = box.width > 0 && parent.offsetWidth > 0 ? box.width / parent.offsetWidth : 1;
        const sy = box.height > 0 && parent.offsetHeight > 0 ? box.height / parent.offsetHeight : 1;
        const left = canScrollX ? revealStudioAxis((rect.left - box.left) / sx - parent.clientLeft, rect.width / sx, parent.clientWidth) : 0;
        const top = canScrollY ? revealStudioAxis((rect.top - box.top) / sy - parent.clientTop, rect.height / sy, parent.clientHeight) : 0;
        if (left || top) parent.scrollBy({ left, top, behavior: "instant" });
    }
}
