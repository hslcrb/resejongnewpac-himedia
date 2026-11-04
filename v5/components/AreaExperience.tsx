"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import AreaViewport from "./AreaViewport";
import type { AreaMode, AreaStatus } from "./AreaViewport";
import { SystemButton, SystemFilterButton, SystemField } from "./SystemPrimitives";
import { BUILDING_FIELDS, BuildingStore, buildingAddress } from "../src/area/building-store";
import type { Building, BuildingHit } from "../src/area/buildings";
import type { Inspection, InspectionState } from "../src/area/building-explorer";
import type { BuildingManifest } from "../src/area/building-store";
import { searchAllBuildings } from "../src/area/building-search";
import type { BuildingSearchResult } from "../src/area/building-search";
import { SystemSurface } from "./SystemSurface";


// [광화문과 서울 전환 / Switch between Gwanghwamun and Seoul]
// 선택 상태와 불러오기·오류 상태를 실제 장면에 맞춰 전달합니다.
// Keep selection, loading and error states aligned with the actual scene.
export default function AreaExperience() {
    const [mode, setMode] = useState<AreaMode>("local");
    const [seoulTime, setSeoulTime] = useState("");
    useEffect(() => {
        const update = () => setSeoulTime(new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()));
        update();
        const timer = window.setInterval(update, 60000);
        return () => window.clearInterval(timer);
    }, []);
    const [status, setStatus] = useState<AreaStatus>({ state: "loading", message: "세종문화회관 주변을 불러오고 있습니다." });
    const [resetCount, setResetCount] = useState(0);
    const [zoom, setZoom] = useState({ serial: 0, factor: 1 });
    const [rotation, setRotation] = useState({ serial: 0, angle: 0 });
    const [attempt, setAttempt] = useState(0);
    const [sight, setSight] = useState(false);
    const [magnifier, setMagnifier] = useState(false);
    const [centerRequest, setCenterRequest] = useState(0);
    const [inspection, setInspection] = useState<Inspection | null>(null);
    const [inspectionState, setInspectionState] = useState<InspectionState>({ state: "idle", message: "" });
    const [projectionState, setProjectionState] = useState("");
    const [browse, setBrowse] = useState<"nearby" | "all">("nearby");
    const browseRef = useRef(browse);
    browseRef.current = browse;
    const selectionSequence = useRef(0);
    const searchSelectionActive = useRef(false);
    const [manifest, setManifest] = useState<BuildingManifest | null>(null);
    const [tileIndex, setTileIndex] = useState(-1);
    const [allBuildings, setAllBuildings] = useState<Building[]>([]);
    const [catalogState, setCatalogState] = useState("");
    const [page, setPage] = useState(0);
    const [query, setQuery] = useState("");
    const catalogStore = useRef<BuildingStore | null>(null);
    useEffect(() => {
        const abort = new AbortController();
        catalogStore.current = new BuildingStore(abort.signal);
        return () => { abort.abort(); catalogStore.current = null; };
    }, []);
    useEffect(() => {
        if (!sight || browse !== "all" || !catalogStore.current) return;
        let active = true;
        const store = catalogStore.current;
        setCatalogState("전체 건물 자료를 불러오고 있습니다.");
        void store.manifest().then(async value => {
            if (!active) return;
            setManifest(value);
            if (tileIndex < 0) {
                const initial = value.tiles.findIndex(tile => tile[0] === 197 && tile[1] === 552);
                setTileIndex(Math.max(0, initial));
                return;
            }
            const tile = value.tiles[tileIndex];
            if (!tile) return;
            setAllBuildings([]);
            const buildings = await store.tile(tile[0], tile[1]);
            if (active) { setAllBuildings(buildings); setPage(0); setCatalogState(`선택 지역 ${buildings.length}건`); }
        }).catch(() => { if (active) setCatalogState("전체 건물 자료를 불러오지 못했습니다. 지역을 다시 선택해 주세요."); });
        return () => { active = false; };
    }, [sight, browse, tileIndex]);
    const onStart = useCallback((kind: "click" | "view") => {
        if (kind === "click") { selectionSequence.current++; searchSelectionActive.current = true; }
        return selectionSequence.current;
    }, []);
    const onInspection = useCallback((value: Inspection, token: number) => {
        if (token !== selectionSequence.current || (value.kind === "view" && searchSelectionActive.current)) return;
        setInspection(value);
        if (value.kind === "click" || browseRef.current === "nearby") setPage(0);
        if (value.kind === "click") setBrowse("nearby");
    }, []);
    const onInspectionState = useCallback((value: InspectionState, token?: number) => { if ((token === undefined || token === selectionSequence.current) && (value.kind !== "view" || !searchSelectionActive.current)) setInspectionState(value); }, []);
    const onSelectBuilding = useCallback(async (value: BuildingSearchResult) => {
        const token = ++selectionSequence.current;
        searchSelectionActive.current = true;
        try {
            const store = catalogStore.current;
            if (!store) throw new Error("건물 자료를 준비하지 못했습니다.");
            const building = (await store.tile(value.tileE, value.tileN)).find(item => item.id === value.id);
            if (!building) throw new Error("선택한 건물 정보를 찾지 못했습니다.");
            if (token !== selectionSequence.current) return false;
            setInspection({ hits: [{ building, contains: false, distance: 0 }], easting: building.easting, northing: building.northing, kind: "click" });
            setBrowse("nearby"); setPage(0); setQuery("");
            return true;
        } catch (error) {
            if (token !== selectionSequence.current) return false;
            searchSelectionActive.current = false;
            throw error;
        }
    }, []);
    const onProjection = useCallback((message: string) => setProjectionState(message), []);
    const onStatus = useCallback((value: AreaStatus) => setStatus(value), []);
    return (
        <div className="container page-layout area-page" data-text="body">
            <nav className="page-layout-breadcrumbs" aria-label="현재 위치">
                <Link href="/">홈</Link><span aria-hidden="true">/</span><Link href="/visit">이용안내</Link><span aria-hidden="true">/</span><span data-text="body" aria-current="page">세종과 서울 둘러보기</span>
            </nav>
            <header className="page-layout-heading">
                <h1 data-text="title">세종에서 서울까지</h1>
                <p data-text="body">세종문화회관과 광화문 일대를 살펴보고, 서울 전체로 시야를 넓혀 보세요.</p>
            </header>
            <SystemSurface as="section" className="area-explorer" padding="md" aria-labelledby="area-explorer-title">
                <div className="area-explorer-head">
                    <div>
                        <h2 id="area-explorer-title" data-text="heading">공간 둘러보기</h2>
                        <p data-text="body">화면을 드래그해 회전하고 스크롤하거나 버튼으로 확대할 수 있습니다.</p>
                    </div>
                    <div className="area-mode-controls" role="group" aria-label="탐색 범위">
                        <SystemFilterButton selected={mode === "local"} onClick={() => setMode("local")}>광화문 주변</SystemFilterButton>
                        <SystemFilterButton selected={mode === "seoul"} onClick={() => setMode("seoul")}>서울 전역</SystemFilterButton>
                    </div>
                </div>
                <div className="area-stage" aria-label={mode === "local" ? "세종문화회관과 광화문 주변 3D 모형" : "서울 건물 분포와 광화문 주변 3D 모형"} role="img">
                    <AreaViewport key={attempt} mode={mode} resetCount={resetCount} zoom={zoom} rotation={rotation} sight={sight} magnifier={magnifier} centerRequest={centerRequest} onStatus={onStatus} onStart={onStart} onInspection={onInspection} onInspectionState={onInspectionState} onProjection={onProjection} />
                    {status.state !== "ready" && <div className="area-stage-message" aria-hidden="true">{status.message}</div>}
                </div>
                <div className="area-tool-controls" role="group" aria-label="건물 정보 도구">
                    <SystemFilterButton selected={magnifier} onClick={() => setMagnifier(value => !value)}>돋보기</SystemFilterButton>
                    <SystemFilterButton selected={sight} onClick={() => { setSight(value => !value); setBrowse("nearby"); }}>전시천리안 (全視千里眼)</SystemFilterButton>
                    <SystemButton variant="secondary" onClick={() => { searchSelectionActive.current = false; selectionSequence.current++; setBrowse("nearby"); setCenterRequest(value => value + 1); }}>현재 중심 건물 조회</SystemButton>
                </div>
                {(magnifier || sight) && <p data-text="body" className="area-tool-hint">{magnifier ? "화면의 건물이나 지면을 선택하면 해당 위치와 가까운 건물을 찾습니다. 서울 전역의 50m 격자와 기울어진 시점에서는 실제 건물 위치와 차이가 있을 수 있습니다. " : ""}{sight ? "보이는 건물에 표시를 투사합니다. 화면이 넓거나 겹칠 때는 확대하거나 아래 목록에서 전체 필드를 확인하세요." : ""}</p>}
                <p data-text="meta" className="area-tool-state" role="status" aria-live="polite">{inspectionState.message}</p>
                <p data-text="meta" className="area-tool-state" role="status" aria-live="polite">{projectionState}</p>
                <div className="area-toolbar">
                    <div className="area-view-controls" role="group" aria-label="3D 화면 조작">
                        <SystemButton variant="secondary" onClick={() => setZoom(value => ({ serial: value.serial + 1, factor: 0.75 }))}>확대</SystemButton>
                        <SystemButton variant="secondary" onClick={() => setZoom(value => ({ serial: value.serial + 1, factor: 1.33 }))}>축소</SystemButton>
                        <SystemButton variant="secondary" onClick={() => setRotation(value => ({ serial: value.serial + 1, angle: 0.3 }))}>왼쪽 회전</SystemButton>
                        <SystemButton variant="secondary" onClick={() => setRotation(value => ({ serial: value.serial + 1, angle: -0.3 }))}>오른쪽 회전</SystemButton>
                        <SystemButton variant="secondary" onClick={() => setResetCount(value => value + 1)}>처음 보기</SystemButton>
                    </div>
                    <div className="area-status-group"><p className="area-status" data-text="meta" role="status" aria-live="polite">{status.message}</p><p className="area-status" data-text="meta">서울 시간 {seoulTime || "확인 중"}</p></div>
                </div>
                {status.state === "error" && <div className="area-error"><p data-text="body">3D 화면을 불러오지 못했습니다. 연결 상태나 브라우저 설정을 확인해 주세요.</p><SystemButton variant="secondary" onClick={() => { setStatus({ state: "loading", message: "다시 불러오고 있습니다." }); setAttempt(value => value + 1); }}>다시 불러오기</SystemButton></div>}
            </SystemSurface>
            {(sight || inspection) && <BuildingInformation
                sight={sight} browse={browse} setBrowse={value => { setBrowse(value); setPage(0); setQuery(""); }}
                inspection={inspection} manifest={manifest} tileIndex={tileIndex} setTileIndex={value => { setTileIndex(value); setPage(0); setQuery(""); }}
                allBuildings={allBuildings} catalogState={catalogState} page={page} setPage={setPage} query={query} setQuery={value => { setQuery(value); setPage(0); }} onSelectBuilding={onSelectBuilding}
            />}
            <section className="area-explanation" aria-labelledby="area-data-title">
                <h2 data-text="heading" id="area-data-title">화면에 담긴 공간</h2>
                <p data-text="body">하늘과 햇빛은 서울의 현재 시각과 날짜에 따른 태양 위치를 표현합니다. 실시간 구름과 날씨는 반영하지 않습니다.</p>
                <p data-text="body">광화문 주변은 사진과 GIS 자료를 바탕으로 구성했습니다. 서울 전역은 건물 자료를 50m 격자로 묶은 개요이며, 높이와 위치에는 추정이 포함됩니다.</p>
                <p data-text="body">서울 전역의 노란 표시는 세종문화회관의 위치입니다. 광화문 주변 모형도 함께 포함되어 있습니다. 정확한 길찾기는 <Link href="/visit/directions">오시는 길</Link>을 확인해 주세요.</p>
            </section>
        </div>
    );
}

// [건물 속성과 전체 자료 탐색 / Building attributes and complete data browsing]
// 선택 후보의 원본 29개 필드를 누락 상태까지 표시합니다.
// Show all 29 original fields for candidate records, including missing values.
function BuildingInformation({ sight, browse, setBrowse, inspection, manifest, tileIndex, setTileIndex, allBuildings, catalogState, page, setPage, query, setQuery, onSelectBuilding }: {
    sight: boolean; browse: "nearby" | "all"; setBrowse: (value: "nearby" | "all") => void;
    inspection: Inspection | null; manifest: BuildingManifest | null; tileIndex: number; setTileIndex: (value: number) => void;
    allBuildings: Building[]; catalogState: string; page: number; setPage: (value: number) => void; query: string; setQuery: (value: string) => void;
    onSelectBuilding: (value: BuildingSearchResult) => Promise<boolean>;
}) {
    const [globalQuery, setGlobalQuery] = useState("");
    const [searchResults, setSearchResults] = useState<BuildingSearchResult[]>([]);
    const [searchStatus, setSearchStatus] = useState("");
    const [searching, setSearching] = useState(false);
    const searchAbort = useRef<AbortController | null>(null);
    useEffect(() => () => searchAbort.current?.abort(), []);
    const runSearch = async () => {
        searchAbort.current?.abort();
        const abort = new AbortController(); searchAbort.current = abort;
        setSearching(true); setSearchResults([]); setSearchStatus("서울 전체 자료를 검색하고 있습니다.");
        try {
            const result = await searchAllBuildings(globalQuery, abort.signal, (done, total) => setSearchStatus(`서울 전체 검색 ${done} / ${total}개 구역`));
            if (abort.signal.aborted) return;
            setSearchResults(result.results);
            setSearchStatus(result.limited ? "200건까지 표시합니다. 더 자세한 주소나 이름으로 검색해 주세요." : `검색 결과 ${result.results.length}건`);
        } catch (error) {
            if (!abort.signal.aborted) setSearchStatus(error instanceof Error ? error.message : "검색하지 못했습니다.");
        } finally { if (!abort.signal.aborted) setSearching(false); }
    };
    const selectResult = async (value: BuildingSearchResult) => {
        try { if (await onSelectBuilding(value)) setSearchStatus("선택한 건물의 모든 필드를 아래에 표시합니다."); }
        catch { setSearchStatus("선택한 건물 정보를 불러오지 못했습니다. 다시 선택해 주세요."); }
    };
    const entries: BuildingHit[] = browse === "all" ? allBuildings.map(building => ({ building, contains: false, distance: 0 })) : inspection?.hits || [];
    const filtered = entries.filter(({ building }) => !query.trim() || [buildingAddress(building), ...building.fields].some(value => String(value ?? "").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
    const pageCount = Math.max(1, Math.ceil(filtered.length / 3));
    const safePage = Math.min(page, pageCount - 1);
    return <SystemSurface as="section" className="area-information" padding="md" aria-labelledby="building-information-title">
        <h2 data-text="heading" id="building-information-title">{sight ? "전시천리안 · 건물 정보" : "돋보기 · 건물 정보"}</h2>
        <p data-text="body">GIS 지번 주소와 원본 29개 필드입니다. 비어 있는 값은 미기재로 표시하며, 사진 기반 모형과 위치는 근사치입니다. 원본의 날짜와 값은 현재 현황과 다를 수 있습니다.</p>
        <form className="area-global-search" onSubmit={event => { event.preventDefault(); void runSearch(); }}>
            <SystemField id="building-global-search" label="서울 전체 주소·건물명 검색" value={globalQuery} onChange={event => setGlobalQuery(event.currentTarget.value)} placeholder="예: 세종로 81-3" />
            <SystemButton type="submit" disabled={searching}>전체 검색</SystemButton>
            {searching && <SystemButton variant="secondary" onClick={() => { searchAbort.current?.abort(); setSearching(false); setSearchStatus("검색을 중단했습니다."); }}>검색 중단</SystemButton>}
        </form>
        <p data-text="meta" role="status" aria-live="polite">{searchStatus}</p>
        {searchResults.length > 0 && <ul className="area-search-results" aria-label="서울 전체 검색 결과">{searchResults.map(value => <li key={value.id}><SystemButton variant="quiet" data-tile={`${value.tileE}_${value.tileN}`} data-building-id={value.id} onClick={() => void selectResult(value)}>{value.name || value.address}{value.name && value.address ? ` · ${value.address}` : ""}</SystemButton></li>)}</ul>}
        {sight && <div className="area-mode-controls" role="group" aria-label="건물 목록 범위">
            <SystemFilterButton selected={browse === "nearby"} onClick={() => setBrowse("nearby")}>현재 주변</SystemFilterButton>
            <SystemFilterButton selected={browse === "all"} onClick={() => setBrowse("all")}>서울 전체 자료</SystemFilterButton>
        </div>}
        {browse === "all" && sight && <>
            <p data-text="body">전체 {manifest?.totalRecords.toLocaleString("ko-KR") || "695,753"}건을 지역별로 찾아볼 수 있습니다. 좌표 이상치 2건도 원본 목록에 포함합니다.</p>
            {manifest && <SystemField as="select" id="building-tile" label="자료 지역 선택" value={tileIndex} onChange={event => setTileIndex(Number(event.currentTarget.value))}>
                {manifest.tiles.map(([e,n,count], index) => <option data-text="body" key={`${e}_${n}`} value={index}>동쪽 {e}km · 북쪽 {n}km · {count.toLocaleString("ko-KR")}건</option>)}
            </SystemField>}
            <p data-text="meta" role="status">{catalogState}</p>
        </>}
        {browse === "nearby" && <p data-text="body">{inspection ? `${inspection.kind === "click" ? "선택 지점" : "화면 중심"} 주변 ${inspection.hits.length.toLocaleString("ko-KR")}건` : "돋보기로 화면을 선택하거나 현재 중심 건물을 조회하세요."}</p>}
        {entries.length > 0 && <SystemField id="building-filter" label="현재 목록에서 찾기" value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder="주소, 건물명, 용도 검색" />}
        <p data-text="meta">{filtered.length.toLocaleString("ko-KR")}건 · {safePage + 1} / {pageCount}쪽</p>
        <div className="area-building-list">
            {filtered.slice(safePage * 3, safePage * 3 + 3).map(({ building, contains }) => <article className="area-building" key={building.id}>
                <h3 data-text="item-title">{String(building.fields[24] || buildingAddress(building))}</h3>
                <p data-text="body">{buildingAddress(building)}{contains ? " · 선택 지점 포함" : ""}</p>
                <dl>{BUILDING_FIELDS.map((label, index) => <div key={label}><dt data-text="label">{label}</dt><dd data-text="body">{building.fields[index] === null || building.fields[index] === "" ? "미기재" : String(building.fields[index])}</dd></div>)}</dl>
                <p data-text="meta">원본 도형 행 번호 {building.id}</p>
            </article>)}
        </div>
        {filtered.length > 3 && <div className="area-view-controls" role="group" aria-label="건물 목록 페이지">
            <SystemButton variant="secondary" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>이전 건물</SystemButton>
            <SystemButton variant="secondary" disabled={safePage + 1 >= pageCount} onClick={() => setPage(safePage + 1)}>다음 건물</SystemButton>
        </div>}
    </SystemSurface>;
}
