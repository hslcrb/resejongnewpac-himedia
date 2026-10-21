"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV } from "../src/data/catalog";
import FloatingMenu from "./FloatingMenu";
import { SystemField, SystemIconButton } from "./SystemPrimitives";
import SystemDialog from "./SystemDialog";
import type { PanelPoint } from "../src/lib/floating-panel";
import { warmPanelSnapshot } from "../src/lib/panel-snapshot";

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
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
        <header id="header" className="renewal-header">
            <div className="project-note">
                <span>
                    v5 · 세종문화회관 리뉴얼 <span lang="en">· Unofficial design concept</span>
                </span>
                <a href="/">
                    버전 선택{" "}
                    <svg
                        className="material-icon"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="M6 6v2h8.59L3.71 18.88l1.41 1.41L16 9.41V18h2V6z" />
                    </svg>
                </a>
            </div>

            <div className="masthead container">
                <Link href="/" className="sejong-brand" aria-label="세종문화회관 홈">
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

                <nav className="desktop-nav" aria-label="주 메뉴">
                    {NAV.map((item: any) => {
                        const active =
                            pathname === item.path || pathname.startsWith(item.path + "/");
                        return (
                            <Link
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

                <div className="masthead-actions">
                    <Link href="/account/login" className="account-link">
                        로그인
                    </Link>
                    <Link href="/account/signup" className="account-link signup-link">
                        회원가입
                    </Link>
                    <Link href="/english" className="english-link" lang="en">
                        EN
                    </Link>
                    <SystemIconButton
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
                        <svg
                            className="material-icon"
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                        </svg>
                    </SystemIconButton>
                    <SystemIconButton
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
                        <svg
                            className="material-icon"
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                        </svg>
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
                    <SystemIconButton
                        type="button"
                        onClick={() => setSearchOpen(false)}
                        aria-label="검색 닫기"
                    >
                        <svg
                            className="material-icon"
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                    </SystemIconButton>
                </div>
                <h2 id="search-heading">어떤 예술을 찾고 계세요?</h2>
                <form className="site-search" onSubmit={handleSearchSubmit}>
                    <SystemField
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
                    <SystemIconButton type="submit" aria-label="검색">
                        <svg
                            className="material-icon"
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                        </svg>
                    </SystemIconButton>
                </form>
                <div className="search-terms">
                    <span>추천 검색어</span>
                    {["일무", "클래식", "주차", "대관"].map((term) => (
                        <Link key={term} href={`/search?q=${encodeURIComponent(term)}`}>
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
