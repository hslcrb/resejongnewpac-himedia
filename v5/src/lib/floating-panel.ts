export type PanelPoint = { x: number; y: number };
export type PanelFrame = {
    width: number;
    height: number;
    panelWidth: number;
    panelHeight: number;
    inset: number;
};

// [화면 안의 자유로운 배치 / Free positioning within the viewport]
export function constrainPanel(point: PanelPoint, frame: PanelFrame): PanelPoint {
    return {
        x: Math.max(frame.inset, Math.min(point.x, frame.width - frame.panelWidth - frame.inset)),
        y: Math.max(frame.inset, Math.min(point.y, frame.height - frame.panelHeight - frame.inset)),
    };
}

export function initialPanelPosition(frame: PanelFrame): PanelPoint {
    return constrainPanel({ x: (frame.width - frame.panelWidth) / 2, y: 108 }, frame);
}

// [굴절은 가장자리에만 / Refraction at the rim, an undistorted reading area]
// 둥근 사각형의 법선으로 배경의 이동 방향을 계산합니다.
// A rounded rectangle's surface normal determines the backdrop displacement.
export function glassDisplacement(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    rim: number,
): PanelPoint {
    const cx = x - width / 2;
    const cy = y - height / 2;
    const qx = Math.abs(cx) - (width / 2 - radius);
    const qy = Math.abs(cy) - (height / 2 - radius);
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    const length = Math.hypot(ox, oy);
    const depth = -(length + Math.min(Math.max(qx, qy), 0) - radius);
    if (depth < 0 || depth >= rim) return { x: 0, y: 0 };
    const strength = Math.cos(((depth / rim) * Math.PI) / 2) ** 2;
    const nx = length > 0 ? ox / length : qx > qy ? 1 : 0;
    const ny = length > 0 ? oy / length : qy >= qx ? 1 : 0;
    return { x: Math.sign(cx) * nx * strength, y: Math.sign(cy) * ny * strength };
}
