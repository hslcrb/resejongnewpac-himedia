export type StudioBox = { width: number; height: number };
type Delta = { x: number; y: number };
const MIN = 12;
const MAX = 4096;
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

// 화면 좌표를 아트보드 CSS 픽셀로 변환. / Convert screen movement to artboard CSS pixels.
export function resizeStudioBox(base: StudioBox, delta: Delta, scale: number, lockAspect = false): StudioBox | null {
    if (![base.width, base.height, delta.x, delta.y, scale].every(Number.isFinite)
        || base.width <= 0 || base.height <= 0 || scale <= 0) return null;
    if (!delta.x && !delta.y) return { width: Math.round(base.width), height: Math.round(base.height) };
    let width = base.width + delta.x / scale;
    let height = base.height + delta.y / scale;
    if (lockAspect) {
        const fx = width / base.width;
        const fy = height / base.height;
        const lo = Math.max(MIN / base.width, MIN / base.height);
        const hi = Math.min(MAX / base.width, MAX / base.height);
        if (lo <= hi) {
            const factor = clamp(Math.abs(fx - 1) >= Math.abs(fy - 1) ? fx : fy, lo, hi);
            width = base.width * factor;
            height = base.height * factor;
        }
    }
    return { width: Math.round(clamp(width, MIN, MAX)), height: Math.round(clamp(height, MIN, MAX)) };
}
