import type { Building } from "./buildings";

export type BuildingManifest = { version: number; crs: string; totalRecords: number; tileSize: number; tiles: [number, number, number, number][] };
type RawRecord = [number, number, number, number[][][], (string | number | null)[]];

export async function compressedJson(response: Response): Promise<unknown> {
    if (!response.ok) throw new Error("건물 정보를 불러오지 못했습니다.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let text: string;
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        if (typeof DecompressionStream === "undefined") throw new Error("이 브라우저는 건물 자료 압축 해제를 지원하지 않습니다.");
        text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    } else text = new TextDecoder().decode(bytes);
    return JSON.parse(text);
}

// [건물 원본의 공간 타일 / Spatial tiles for original building records]
// 필요한 타일만 불러오며 압축·실패·경계 건물을 명시적으로 처리합니다.
// Load only needed tiles, handling compression, failures and boundary features.
export class BuildingStore {
    private manifestPromise: Promise<BuildingManifest> | null = null;
    private cache = new Map<string, Promise<Building[]>>();
    constructor(private signal: AbortSignal) {}

    manifest() {
        if (!this.manifestPromise) this.manifestPromise = fetch("/v5/area/buildings/manifest.json", { signal: this.signal }).then(async response => {
            if (!response.ok) throw new Error("건물 목록을 불러오지 못했습니다.");
            const data = await response.json() as BuildingManifest;
            if (data.version !== 1 || data.crs !== "EPSG:5186" || data.tileSize !== 1000 || data.totalRecords !== 695753) throw new Error("건물 자료 형식이 올바르지 않습니다.");
            return data;
        }).catch(error => { this.manifestPromise = null; throw error; });
        return this.manifestPromise;
    }

    async tile(e: number, n: number) {
        const manifest = await this.manifest();
        if (!manifest.tiles.some(tile => tile[0] === e && tile[1] === n)) return [];
        const key = `${e}_${n}`;
        if (!this.cache.has(key)) {
            const promise = fetch(`/v5/area/buildings/${key}.json.gz`, { signal: this.signal }).then(async response => {
                const data = await compressedJson(response) as { tile: [number, number]; records: RawRecord[] };
                if (data.tile[0] !== e || data.tile[1] !== n || !Array.isArray(data.records)) throw new Error("건물 타일 형식이 올바르지 않습니다.");
                return data.records.map(([id, x, y, polygons, fields]) => ({ id, easting: e * 1000 + x / 10, northing: n * 1000 + y / 10, tile: [e, n] as [number, number], polygons, fields }));
            }).catch(error => { this.cache.delete(key); throw error; });
            this.cache.set(key, promise);
            if (this.cache.size > 36) this.cache.delete(this.cache.keys().next().value!);
        }
        return this.cache.get(key)!;
    }

    async around(easting: number, northing: number) {
        const e = Math.floor(easting / 1000), n = Math.floor(northing / 1000);
        const parts = await Promise.all([-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => this.tile(e + dx, n + dy))));
        return parts.flat();
    }
}

export const BUILDING_FIELDS = ["원천도형 ID", "GIS 건물통합 식별번호", "고유번호", "법정동 코드", "법정동명", "지번", "특수지 코드", "특수지 구분명", "건축물 용도 코드", "건축물 용도명", "건축물 구조 코드", "건축물 구조명", "건축물 면적(㎡)", "사용 승인일", "연면적(㎡)", "대지 면적(㎡)", "높이(m)", "건폐율(%)", "용적률(%)", "건축물 ID", "위반 건축물 여부", "참조체계 연계키", "데이터 기준일", "시군구 코드", "건물명", "건물 동명", "지상층 수", "지하층 수", "데이터 생성·변경일"] as const;
export function buildingAddress(building: Building) {
    return [building.fields[4], building.fields[5]].filter(value => value !== null && value !== "").join(" ") || "주소 미기재";
}
