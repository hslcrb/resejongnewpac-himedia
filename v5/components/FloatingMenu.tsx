"use client";

import type { RefObject } from "react";
import Icon from "./Icon";
import FloatingPanel from "./FloatingPanel";
import { NAV } from "../src/data/catalog";
import type { PanelPoint } from "../src/lib/floating-panel";

// [흰 덮개 없는 떠 있는 탐색 / Floating navigation without a page-covering backdrop]
// 정적 범주·상세 문서는 각 문서 주소로 엽니다. / Document links preserve exported category and detail routes.
export default function FloatingMenu({
    open,
    onClose,
    returnFocus,
    position,
}: {
    open: boolean;
    onClose: () => void;
    returnFocus: RefObject<HTMLButtonElement>;
    position: { current: PanelPoint | null };
}) {
    return (
        <FloatingPanel
            open={open}
            onClose={onClose}
            anchorRef={returnFocus}
            position={position}
            id="menu-dialog"
            className="glass-menu"
            title="전체 메뉴"
            eyebrow="세종문화회관"
            closeLabel="전체 메뉴 닫기"
            moveLabel="메뉴 위치 이동"
        >
            <div className="glass-menu-content">
                <div className="glass-menu-journeys">
                    <a href="/v5/visit/plan/">
                        <span>관람할 날부터 이동 안내까지</span>
                        <strong>
                            방문 계획 <Icon name="arrow" size={28} />
                        </strong>
                    </a>
                    <a href="/v5/rental/compare/">
                        <span>공간 조건을 한눈에 비교</span>
                        <strong>
                            대관 공간 비교 <Icon name="arrow" size={28} />
                        </strong>
                    </a>
                </div>
                <nav className="glass-menu-columns" aria-label="전체 메뉴">
                    {NAV.map((group) => (
                        <div key={group.id}>
                            <a className="glass-menu-title" href={`/v5${group.path}/`}>
                                {group.title}
                            </a>
                            {group.items.map(([label, path]) => (
                                <a key={path} href={`/v5${path}/`}>
                                    {label}
                                </a>
                            ))}
                        </div>
                    ))}
                </nav>
                <nav className="glass-menu-utilities" aria-label="개인 서비스">
                    <a href="/v5/account/">마이페이지</a>
                    <a href="/v5/account/">예매내역</a>
                    <a href="/v5/account/">관심 프로그램</a>
                    <a href="/v5/sitemap/">사이트맵</a>
                    <a href="/v5/english/" lang="en">
                        English guide
                    </a>
                </nav>
            </div>
        </FloatingPanel>
    );
}
