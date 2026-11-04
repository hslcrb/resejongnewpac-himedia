"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SystemSurface } from "./SystemSurface";
import { acceptedViewerHeight, LIVE_3D_URL } from "../src/area/embed";

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
                <Link href="/">홈</Link><span aria-hidden="true">/</span><Link href="/visit">이용안내</Link><span aria-hidden="true">/</span><span data-text="body" aria-current="page">세종과 서울 둘러보기</span>
            </nav>
            <header className="page-layout-heading">
                <h1 data-text="title">세종에서 서울까지</h1>
                <p data-text="body">세종문화회관과 광화문을 둘러보고 서울과 다른 지역의 문화 공간을 살펴보세요.</p>
            </header>
            <SystemSurface as="section" className="area-explorer" padding="md" aria-labelledby="area-explorer-title">
                <div className="area-explorer-head">
                    <div><h2 id="area-explorer-title" data-text="heading">공간 둘러보기</h2>
                        <p data-text="body">화면에서 지면·위성지도, 건물 정보와 전시천리안을 사용할 수 있습니다.</p></div>
                    <a className="area-embed-link" href={LIVE_3D_URL} target="_blank" rel="noopener noreferrer" data-text="body">3D 화면 새 창으로 열기</a>
                </div>
                <iframe ref={frame} className="area-embed-frame" src={LIVE_3D_URL} title="세종문화회관과 서울 3D 공간 탐색" allow="fullscreen" allowFullScreen style={{ height }} />
                <p className="area-embed-note" data-text="body">화면이 표시되지 않으면 위의 새 창 열기를 이용해 주세요.</p>
            </SystemSurface>
        </div>
    );
}
