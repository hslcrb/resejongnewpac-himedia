"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SystemSurface } from "./SystemSurface";
import { acceptedViewerHeight, LIVE_3D_URL, LIVE_MAP_URL } from "../src/area/embed";

// [독립 3D 서비스 연결 / Connect the standalone 3D service]
// 프레임의 출처와 발신자를 검증해 콘텐츠 높이만 동기화합니다.
// Validate the frame origin and sender before synchronizing content height.
export default function AreaExperience() {
    const frame = useRef<HTMLIFrameElement>(null);
    const [height, setHeight] = useState(1200);
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const next = acceptedViewerHeight(event, frame.current?.contentWindow);
            if (next !== null) setHeight(next);
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);
    return (
        <div className="container page-layout area-page" data-text="body">
            <nav className="page-layout-breadcrumbs" aria-label="현재 위치">
                <Link href="/">홈</Link><span aria-hidden="true">/</span><Link href="/visit">이용안내</Link><span aria-hidden="true">/</span><span data-text="body" aria-current="page">세종과 광화문 둘러보기</span>
            </nav>
            <header className="page-layout-heading">
                <h1 data-text="title">세종과 광화문을 걷다</h1>
                <p data-text="body">세종문화회관과 광화문 주변을 3D로 둘러보세요. 서울과 전국의 지도 정보는 별도 화면에서 살펴볼 수 있습니다.</p>
            </header>
            <SystemSurface as="section" className="area-explorer" padding="md" aria-labelledby="area-explorer-title">
                <div className="area-explorer-head">
                    <div><h2 id="area-explorer-title" data-text="heading">공간 둘러보기</h2>
                        <p data-text="body">회관과 광화문 주변을 살펴보고 대극장에 들어가 보세요.</p></div>
                    <div className="area-embed-links"><a className="area-embed-link" href={LIVE_3D_URL} target="_blank" rel="noopener noreferrer" data-text="body">3D 화면 새 창으로 열기</a><a className="area-embed-link" href={LIVE_MAP_URL} target="_blank" rel="noopener noreferrer" data-text="body">지도와 전시천리안 열기</a></div>
                </div>
                <iframe ref={frame} className="area-embed-frame" src={LIVE_3D_URL} title="세종문화회관과 광화문 3D 공간 탐색" allow="fullscreen" allowFullScreen style={{ height }} />
                <p className="area-embed-note" data-text="body">화면이 표시되지 않으면 위의 새 창 열기를 이용해 주세요.</p>
            </SystemSurface>
        </div>
    );
}
