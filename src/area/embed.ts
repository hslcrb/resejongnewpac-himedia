// [내장 3D 메시지 검증 / Embedded 3D message validation]
// 지정된 서비스와 실제 프레임에서 온 버전 1 높이만 수락합니다.
// Accept only version 1 height messages from the expected origin and frame.
export const LIVE_3D_ORIGIN = "https://live.renewsejongpac.rhee.life";
export const LIVE_3D_URL = `${LIVE_3D_ORIGIN}/explore/?embed=1`;
export const LIVE_MAP_URL = `${LIVE_3D_ORIGIN}/map/`;
export function acceptedViewerHeight(
    event: { origin: string; source: unknown; data: unknown },
    frame: unknown,
): number | null {
    if (
        !frame ||
        event.origin !== LIVE_3D_ORIGIN ||
        event.source !== frame ||
        !event.data ||
        typeof event.data !== "object"
    )
        return null;
    const data = event.data as { type?: unknown; version?: unknown; height?: unknown };
    if (
        data.type !== "sejong3d:height" ||
        data.version !== 1 ||
        typeof data.height !== "number" ||
        !Number.isInteger(data.height) ||
        data.height < 200 ||
        data.height > 20000
    )
        return null;
    return Math.max(700, data.height);
}
