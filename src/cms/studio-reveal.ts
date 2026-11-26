// 대상이 이미 보이면 스크롤을 생략한다. / Leave an already visible target in place.
export function revealStudioAxis(start: number, size: number, viewport: number): number {
    if (!Number.isFinite(start) || !Number.isFinite(size) || !Number.isFinite(viewport) || size <= 0 || viewport <= 0) return 0;
    if (size >= viewport) return Math.round(start);
    if (start >= 0 && start + size <= viewport) return 0;
    return Math.round(start + (size - viewport) / 2);
}

type Box = Pick<DOMRect, "left" | "top" | "width" | "height">;

// 프레임 픽셀을 바깥 스테이지의 확대된 좌표로 변환한다.
// Map document pixels to the stage's scaled viewport, limiting the target to the visible frame.
export function studioStageTarget(box: Box, frame: Box, width: number, height: number): Box | null {
    if (width <= 0 || height <= 0 || frame.width <= 0 || frame.height <= 0) return null;
    const left = Math.max(0, box.left);
    const top = Math.max(0, box.top);
    const right = Math.min(width, box.left + box.width);
    const bottom = Math.min(height, box.top + box.height);
    if (right <= left || bottom <= top) return null;
    const sx = frame.width / width;
    const sy = frame.height / height;
    return { left: frame.left + left * sx, top: frame.top + top * sy, width: (right - left) * sx, height: (bottom - top) * sy };
}
