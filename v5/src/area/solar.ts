// [서울 태양 위치 / Solar position for Seoul]
// NOAA 근사식을 사용하며 실제 구름·기상 관측값은 포함하지 않습니다.
// Uses NOAA's approximation without claiming observed weather or cloud cover.
export type SolarPosition = { azimuth: number; elevation: number };
const LATITUDE = 37.572 * Math.PI / 180;
const LONGITUDE = 126.9763;

export function seoulSolarPosition(date: Date): SolarPosition {
    const local = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const year = local.getUTCFullYear();
    const day = Math.floor((Date.UTC(year, local.getUTCMonth(), local.getUTCDate()) - Date.UTC(year, 0, 1)) / 86400000) + 1;
    const hours = local.getUTCHours() + local.getUTCMinutes() / 60 + local.getUTCSeconds() / 3600;
    const days = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
    const gamma = 2 * Math.PI / days * (day - 1 + (hours - 12) / 24);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
    const minutes = (hours * 60 + eq + 4 * LONGITUDE - 540 + 1440) % 1440;
    const hourAngle = (minutes / 4 - 180) * Math.PI / 180;
    const elevation = Math.asin(Math.sin(LATITUDE) * Math.sin(decl) + Math.cos(LATITUDE) * Math.cos(decl) * Math.cos(hourAngle));
    const azimuth = (Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(LATITUDE) - Math.tan(decl) * Math.cos(LATITUDE)) + Math.PI) % (2 * Math.PI);
    return { azimuth, elevation };
}

export function sunDirection(position: SolarPosition, mode: 'local' | 'seoul') {
    const horizontal = Math.cos(position.elevation);
    const north = Math.cos(position.azimuth) * horizontal;
    const east = Math.sin(position.azimuth) * horizontal;
    return mode === 'seoul'
        ? { x: east, y: Math.sin(position.elevation), z: -north }
        : { x: north, y: Math.sin(position.elevation), z: east };
}
