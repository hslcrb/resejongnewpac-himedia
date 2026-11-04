// [GIS 좌표와 상세 영역 / GIS coordinates and detailed area]
// 회관 상세 모델을 서울 집계 격자와 같은 미터 좌표로 배치합니다.
// Place the detailed Sejong model in the Seoul aggregate grid's metre coordinates.
export const SEJONG_IN_SEOUL = { x: -2103, z: -2531, rotationY: Math.PI / 2 };

export function gridCellPosition(easting: number, northing: number, height: number) {
    return { x: easting * 50 - 200000 + 23.5, y: height / 2, z: -(northing * 50 - 550000 + 23.5) };
}

export function isDetailedArea(x: number, z: number) {
    return x >= -2303 && x <= -1843 && z >= -2771 && z <= -2321;
}
