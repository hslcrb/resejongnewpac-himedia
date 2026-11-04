// [개별 건물 공간 질의 / Individual building spatial queries]
// 원본 FID를 식별자로 사용하고 윤곽의 구멍을 보존합니다.
// Use source FIDs as identifiers and preserve holes in footprint polygons.
export type Building = { id: number; easting: number; northing: number; tile: [number, number]; polygons: number[][][]; fields: (string | number | null)[] };
export type BuildingHit = { building: Building; contains: boolean; distance: number };
export type AreaMode = 'local' | 'seoul';

export function worldToGeo(mode: AreaMode, x: number, z: number) {
    return mode === 'local' ? { easting: 197897 + z, northing: 552531 + x } : { easting: 200000 + x, northing: 550000 - z };
}
export function geoToWorld(mode: AreaMode, easting: number, northing: number) {
    return mode === 'local' ? { x: northing - 552531, z: easting - 197897 } : { x: easting - 200000, z: 550000 - northing };
}
function inRing(ring: number[], x: number, y: number) {
    let inside = false;
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
        const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}
export function pointInBuilding(building: Building, easting: number, northing: number) {
    const x = (easting - building.tile[0] * 1000) * 10;
    const y = (northing - building.tile[1] * 1000) * 10;
    return building.polygons.some(polygon => polygon.length > 0 && inRing(polygon[0], x, y) && !polygon.slice(1).some(ring => inRing(ring, x, y)));
}
export function nearbyBuildings(buildings: Building[], easting: number, northing: number, radius: number): BuildingHit[] {
    const seen = new Set<number>();
    const hits: BuildingHit[] = [];
    for (const building of buildings) {
        if (seen.has(building.id)) continue;
        seen.add(building.id);
        const distance = Math.hypot(building.easting - easting, building.northing - northing);
        const contains = pointInBuilding(building, easting, northing);
        if (contains || distance <= radius) hits.push({ building, contains, distance });
    }
    return hits.sort((a, b) => Number(b.contains) - Number(a.contains) || a.distance - b.distance);
}
