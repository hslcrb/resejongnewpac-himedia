import type { CmsPageViewport } from "./page-tree.ts";

export type StudioZoom = "fit" | 25 | 50 | 75 | 100 | 125 | 150 | 200;
export const STUDIO_ZOOMS = ["fit", 25, 50, 75, 100, 125, 150, 200] as const satisfies readonly StudioZoom[];
export const STUDIO_ARTBOARDS = {
    desktop: { label: "PC", width: 1440, height: 900 },
    tablet: { label: "태블릿", width: 768, height: 1024 },
    mobile: { label: "모바일", width: 390, height: 844 },
} as const satisfies Record<CmsPageViewport, { label: string; width: number; height: number }>;

// 캔버스 배율은 문서 뷰포트를 바꾸지 않는다. / Canvas zoom never changes responsive breakpoints.
export function studioArtboardScale(width: number, available: number, zoom: StudioZoom): number {
    if (zoom !== "fit") return zoom / 100;
    if (!Number.isFinite(available) || available <= 0 || !Number.isFinite(width) || width <= 0) return 1;
    return Math.max(0.05, Math.min(1, available / width));
}
