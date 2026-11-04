"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import AreaViewport from "./AreaViewport";
import type { AreaMode, AreaStatus } from "./AreaViewport";
import { SystemButton, SystemFilterButton } from "./SystemPrimitives";
import { SystemSurface } from "./SystemSurface";


// [광화문과 서울 전환 / Switch between Gwanghwamun and Seoul]
// 선택 상태와 불러오기·오류 상태를 실제 장면에 맞춰 전달합니다.
// Keep selection, loading and error states aligned with the actual scene.
export default function AreaExperience() {
    const [mode, setMode] = useState<AreaMode>("local");
    const [status, setStatus] = useState<AreaStatus>({ state: "loading", message: "세종문화회관 주변을 불러오고 있습니다." });
    const [resetCount, setResetCount] = useState(0);
    const [zoom, setZoom] = useState({ serial: 0, factor: 1 });
    const [rotation, setRotation] = useState({ serial: 0, angle: 0 });
    const [attempt, setAttempt] = useState(0);
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
                    <AreaViewport key={attempt} mode={mode} resetCount={resetCount} zoom={zoom} rotation={rotation} onStatus={onStatus} />
                    {status.state !== "ready" && <div className="area-stage-message" aria-hidden="true">{status.message}</div>}
                </div>
                <div className="area-toolbar">
                    <div className="area-view-controls" role="group" aria-label="3D 화면 조작">
                        <SystemButton variant="secondary" onClick={() => setZoom(value => ({ serial: value.serial + 1, factor: 0.75 }))}>확대</SystemButton>
                        <SystemButton variant="secondary" onClick={() => setZoom(value => ({ serial: value.serial + 1, factor: 1.33 }))}>축소</SystemButton>
                        <SystemButton variant="secondary" onClick={() => setRotation(value => ({ serial: value.serial + 1, angle: 0.3 }))}>왼쪽 회전</SystemButton>
                        <SystemButton variant="secondary" onClick={() => setRotation(value => ({ serial: value.serial + 1, angle: -0.3 }))}>오른쪽 회전</SystemButton>
                        <SystemButton variant="secondary" onClick={() => setResetCount(value => value + 1)}>처음 보기</SystemButton>
                    </div>
                    <p className="area-status" data-text="meta" role="status" aria-live="polite">{status.message}</p>
                </div>
                {status.state === "error" && <div className="area-error"><p data-text="body">3D 화면을 불러오지 못했습니다. 연결 상태나 브라우저 설정을 확인해 주세요.</p><SystemButton variant="secondary" onClick={() => { setStatus({ state: "loading", message: "다시 불러오고 있습니다." }); setAttempt(value => value + 1); }}>다시 불러오기</SystemButton></div>}
            </SystemSurface>
            <section className="area-explanation" aria-labelledby="area-data-title">
                <h2 data-text="heading" id="area-data-title">화면에 담긴 공간</h2>
                <p data-text="body">광화문 주변은 사진과 GIS 자료를 바탕으로 구성했습니다. 서울 전역은 건물 자료를 50m 격자로 묶은 개요이며, 높이와 위치에는 추정이 포함됩니다.</p>
                <p data-text="body">서울 전역의 노란 표시는 세종문화회관의 위치입니다. 광화문 주변 모형도 함께 포함되어 있습니다. 정확한 길찾기는 <Link href="/visit/directions">오시는 길</Link>을 확인해 주세요.</p>
            </section>
        </div>
    );
}
