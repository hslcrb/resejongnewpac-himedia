import { compressedJson } from "./building-store";

export type BuildingSearchResult = { id: number; tileE: number; tileN: number; address: string; name: string };
type SearchRow = [number, number, number, string, string];
type SearchManifest = { version: number; totalRecords: number; shards: [string, number, number][] };

// [서울 전체 건물 검색 / Search buildings across Seoul]
// 사용자가 요청할 때만 구별 색인을 순차 검색하고 결과 상한을 명확히 알립니다.
// Search district shards only on request and explicitly report the result limit.
export async function searchAllBuildings(query: string, signal: AbortSignal, onProgress: (done: number, total: number) => void) {
    const needle = query.trim().toLocaleLowerCase().replace(/\s+/g, " ");
    if (needle.length < 2) throw new Error("검색어를 두 글자 이상 입력해 주세요.");
    const response = await fetch("/v5/area/building-search/manifest.json", { signal });
    if (!response.ok) throw new Error("검색 색인을 불러오지 못했습니다.");
    const manifest = await response.json() as SearchManifest;
    if (manifest.version !== 1 || manifest.totalRecords !== 695753) throw new Error("검색 색인 형식이 올바르지 않습니다.");
    const results: BuildingSearchResult[] = [];
    for (let i = 0; i < manifest.shards.length; i++) {
        const [code] = manifest.shards[i];
        const rows = await compressedJson(await fetch(`/v5/area/building-search/${code}.json.gz`, { signal })) as SearchRow[];
        for (const [id, tileE, tileN, address, name] of rows) {
            if (`${address} ${name}`.toLocaleLowerCase().replace(/\s+/g, " ").includes(needle)) {
                results.push({ id, tileE, tileN, address, name });
                if (results.length >= 200) return { results, limited: true };
            }
        }
        onProgress(i + 1, manifest.shards.length);
    }
    return { results, limited: false };
}
