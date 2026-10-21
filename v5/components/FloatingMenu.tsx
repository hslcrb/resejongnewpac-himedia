"use client";

import { useEffect, useId, useRef } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import LiquidGlass from "./LiquidGlass";
import useFloatingPanel from "./useFloatingPanel";
import { NAV } from "../src/data/catalog";
import type { PanelPoint } from "../src/lib/floating-panel";

// [흰 덮개 없는 떠 있는 탐색 / Floating navigation without a page-covering backdrop]
// 정적 범주·상세 문서는 각 문서 주소로 엽니다. / Document links preserve exported category and detail routes.
export default function FloatingMenu({
    onClose,
    returnFocus,
    position,
}: {
    onClose: () => void;
    returnFocus: RefObject<HTMLButtonElement>;
    position: { current: PanelPoint | null };
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const id = useId().replace(/:/g, "");
    const { moveMode, setMoveMode, announcement } = useFloatingPanel(panelRef, position, onClose);
    useEffect(() => {
        const panel = panelRef.current;
        const trigger = returnFocus.current;
        closeRef.current?.focus({ preventScroll: true });
        return () => {
            if (
                panel?.contains(document.activeElement) ||
                document.activeElement === document.body
            ) {
                trigger?.focus({ preventScroll: true });
            }
        };
    }, [returnFocus]);

    return createPortal(
        <LiquidGlass
            className="glass-menu"
            id="menu-dialog"
            role="dialog"
            aria-modal="false"
            aria-labelledby={`${id}-heading`}
            data-move-mode={moveMode || undefined}
            ref={panelRef}
        >
            <div className="glass-menu-header">
                <div>
                    <p className="glass-menu-brand">세종문화회관</p>
                    <h2 id={`${id}-heading`}>전체 메뉴</h2>
                </div>
                <div className="glass-menu-actions">
                    <button
                        type="button"
                        className="glass-menu-move"
                        data-panel-move
                        aria-label="메뉴 위치 이동"
                        aria-pressed={moveMode}
                        aria-describedby={`${id}-move-help`}
                        onClick={() => setMoveMode(!moveMode)}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/v5/assets/icons/rounded/open_with.svg"
                            width="24"
                            height="24"
                            alt=""
                            aria-hidden="true"
                        />
                        <span>이동</span>
                    </button>
                    <button
                        ref={closeRef}
                        type="button"
                        className="round-button"
                        onClick={onClose}
                        aria-label="전체 메뉴 닫기"
                    >
                        <Icon name="close" size={24} />
                    </button>
                </div>
            </div>
            <p id={`${id}-move-help`} className="sr-only">
                마우스로 메뉴의 글자나 여백을 잡아 옮길 수 있습니다. 터치에서는 제목을 잡거나 이동
                버튼을 켜세요. 이동 버튼에서 방향키로 옮기고 Home 키로 처음 위치로 돌립니다.
            </p>
            <span className="sr-only" role="status" aria-live="polite">
                {announcement}
            </span>
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
        </LiquidGlass>,
        document.body,
    );
}
