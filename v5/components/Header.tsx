"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV } from "../src/data/catalog";
import FloatingMenu from "./FloatingMenu";
import { SystemField, SystemIconButton } from "./SystemPrimitives";
import SystemDialog from "./SystemDialog";
import Icon from "./Icon";
import type { PanelPoint } from "../src/lib/floating-panel";
import { warmPanelSnapshot } from "../src/lib/panel-snapshot";
import useAccountIdentity from "./useAccountIdentity";

export const HEADER_VARIANTS = ["default", "inverse"] as const;
export type HeaderVariant = (typeof HEADER_VARIANTS)[number];

export default function Header({ variant }: { variant?: HeaderVariant } = {}) {
    const pathname = usePathname();
    const router = useRouter();
    const headerVariant = variant || (pathname === "/about/introduction" || pathname === "/about/introduction/" ? "inverse" : "default");
    const { isLoggedIn } = useAccountIdentity();
    const [searchOpen, setSearchOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const menuTrigger = useRef<HTMLButtonElement>(null);
    const searchTrigger = useRef<HTMLButtonElement>(null);
    const searchField = useRef<HTMLInputElement>(null);
    const menuPosition = useRef<PanelPoint | null>(null);
    const closeMenu = useCallback(() => setMenuOpen(false), []);

    // ESC 키로 모달 닫기
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setSearchOpen(false);
                setMenuOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // 라우트 변경 시 모달 자동 닫기
    useEffect(() => {
        setSearchOpen(false);
        setMenuOpen(false);
    }, [pathname]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
            setSearchOpen(false);
        }
    };

    return (
        <header id="header" className="renewal-header" data-component-id="header" data-header-variant={headerVariant}>
            <div className="masthead container">
                <Link data-text="action" href="/" className="sejong-brand" aria-label="세종문화회관 홈">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        className="sejong-wordmark"
                        src="/v5/assets/images/sejong-wordmark.png"
                        alt="세종문화회관"
                        width={236}
                        height={43}
                        onError={(e) => {
                            // fallback if basePath isn't prepended automatically
                            const target = e.currentTarget;
                            if (!target.src.includes("/assets/")) {
                                target.src = "/assets/images/sejong-wordmark.png";
                            }
                        }}
                    />
                </Link>

                <nav data-text="body" className="desktop-nav" aria-label="주 메뉴">
                    {NAV.map((item: any) => {
                        const active =
                            pathname === item.path || pathname.startsWith(item.path + "/");
                        return (
                            <Link data-text="navigation"
                                key={item.id}
                                href={item.path}
                                data-nav={item.id}
                                aria-current={active ? "page" : undefined}
                                className={active ? "active" : ""}
                            >
                                {item.title}
                            </Link>
                        );
                    })}
                </nav>

                <div data-text="body" className="masthead-actions">
                    {/* [실제 세션의 회원 진입 / Account access for the authenticated session] */}
                    {isLoggedIn ? <Link data-text="utility" href="/account" className="account-link">마이페이지</Link> : <>
                        <Link data-text="utility" href="/account/login" className="account-link">로그인</Link>
                        <Link data-text="utility" href="/account/login" className="account-link signup-link">회원가입</Link>
                    </>}
                    <Link data-text="utility" href="/english" className="english-link" lang="en">
                        EN
                    </Link>
                    <SystemIconButton data-text="action"
                        variant={headerVariant === "inverse" ? "inverse-quiet" : "quiet"}
                        ref={searchTrigger}
                        type="button"
                        onClick={() => {
                            setMenuOpen(false);
                            setSearchOpen(true);
                        }}
                        aria-label="통합검색 열기"
                        aria-haspopup="dialog"
                        aria-expanded={searchOpen}
                        aria-controls="search-dialog"
                    >
                        <Icon name="search" group="header-action" />
                    </SystemIconButton>
                    <SystemIconButton data-text="action"
                        variant={headerVariant === "inverse" ? "inverse-quiet" : "quiet"}
                        ref={menuTrigger}
                        type="button"
                        onClick={() => {
                            setSearchOpen(false);
                            setMenuOpen(!menuOpen);
                        }}
                        aria-label="전체 메뉴 열기"
                        aria-haspopup="dialog"
                        aria-expanded={menuOpen}
                        aria-controls="menu-dialog"
                        onPointerEnter={() => {
                            void warmPanelSnapshot();
                        }}
                        onFocus={() => {
                            void warmPanelSnapshot();
                        }}
                    >
                        <Icon name="menu" group="header-action" />
                    </SystemIconButton>
                </div>
            </div>

            {/* [공통 검색 대화상자와 초점 복원 / Shared search dialog and focus restoration] */}
            <SystemDialog
                className="navigation-dialog"
                open={searchOpen}
                onClose={() => setSearchOpen(false)}
                triggerRef={searchTrigger}
                initialFocusRef={searchField}
                id="search-dialog"
                aria-labelledby="search-heading"
            >
                <div className="dialog-top">
                    <SystemIconButton data-text="action"
                        type="button"
                        onClick={() => setSearchOpen(false)}
                        aria-label="검색 닫기"
                    >
                        <Icon name="close" size={22} />
                    </SystemIconButton>
                </div>
                <h2 data-text="heading" id="search-heading">어떤 예술을 찾고 계세요?</h2>
                <form className="site-search" onSubmit={handleSearchSubmit}>
                    <SystemField data-text="body"
                        ref={searchField}
                        label="검색어"
                        labelHidden
                        outerClassName="site-search-field"
                        id="global-query"
                        name="q"
                        type="search"
                        placeholder="공연, 전시, 공간을 검색해 보세요"
                        required
                        autoComplete="off"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <SystemIconButton data-text="action" type="submit" aria-label="검색">
                        <Icon name="search" size={22} />
                    </SystemIconButton>
                </form>
                <div data-text="body" className="search-terms">
                    <span data-text="body">추천 검색어</span>
                    {["일무", "클래식", "주차", "대관"].map((term) => (
                        <Link data-text="action" key={term} href={`/search?q=${encodeURIComponent(term)}`}>
                            {term}
                        </Link>
                    ))}
                </div>
            </SystemDialog>

            {/* [화면과 분리된 유리 메뉴 / Glass menu detached from the header layout] */}
            <FloatingMenu
                open={menuOpen}
                onClose={closeMenu}
                returnFocus={menuTrigger}
                position={menuPosition}
            />
        </header>
    );
}
