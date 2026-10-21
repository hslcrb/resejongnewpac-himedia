"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV, PAGES } from "../src/data/catalog";
import Icon from "./Icon";

// [빠른 탐색 정보 / Quick navigation content]
const QUICK_LINKS = [
    { title: "공연 일정", detail: "날짜에 맞는 무대 찾기", path: "/programs?view=calendar", icon: "calendar" },
    { title: "오시는 길", detail: "교통·주차 한눈에 보기", path: "/visit/directions", icon: "pin" },
    { title: "예매내역", detail: "기다리는 공연 확인하기", path: "/account/bookings", icon: "ticket" },
];
const SEARCH_TERMS = ["클래식", "뮤지컬", "전시", "누구나", "주차"];
type Overlay = "search" | "menu" | null;

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const [overlay, setOverlay] = useState<Overlay>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const dialogRef = useRef<HTMLDialogElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const openerRef = useRef<HTMLElement | null>(null);
    const query = searchQuery.trim().toLocaleLowerCase("ko");
    const suggestions = query
        ? PAGES.filter((page) => page.title.toLocaleLowerCase("ko").includes(query)).slice(0, 5)
        : [];

    // [모달 접근성과 초점 관리 / Modal accessibility and focus management]
    // 네이티브 모달은 배경을 inert 처리하고, 명시적인 Tab 순환은 초점을 창 안에 유지합니다.
    // Native modality makes the background inert; explicit Tab wrapping keeps focus inside.
    useEffect(() => {
        if (!overlay) return;
        const dialog = dialogRef.current;
        if (!dialog) return;
        const previousOverflow = document.body.style.overflow;
        const previousPadding = document.body.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        const bodyPadding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
        document.body.style.overflow = "hidden";
        if (scrollbarWidth > 0) document.body.style.paddingRight = `${bodyPadding + scrollbarWidth}px`;
        if (!dialog.open) dialog.showModal();
        dialog.scrollTop = 0;
        if (overlay === "search") searchRef.current?.focus({ preventScroll: true });

        const trapFocus = (event: KeyboardEvent) => {
            // 검색 입력의 기본 ESC 초기화보다 모달 닫기를 우선합니다.
            // Close before the native search field consumes Escape to clear its value.
            if (event.key === "Escape") {
                event.preventDefault();
                setOverlay(null);
                return;
            }
            if (event.key !== "Tab") return;
            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]',
            )).filter((element) => element.getClientRects().length > 0);
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first) {
                event.preventDefault();
                dialog.focus();
            } else if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        dialog.addEventListener("keydown", trapFocus);
        return () => {
            dialog.removeEventListener("keydown", trapFocus);
            if (dialog.open) dialog.close();
            document.body.style.overflow = previousOverflow;
            document.body.style.paddingRight = previousPadding;
            openerRef.current?.focus({ preventScroll: true });
        };
    }, [overlay]);

    useEffect(() => { setOverlay(null); }, [pathname]);

    // [탐색 실행 및 닫기 / Open, navigate, and dismiss]
    const openOverlay = (next: Exclude<Overlay, null>, event: MouseEvent<HTMLButtonElement>) => {
        openerRef.current = event.currentTarget;
        setOverlay(next);
    };
    const submitSearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!searchQuery.trim()) return;
        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        setOverlay(null);
    };
    const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
            setOverlay(null);
        }
    };

    return (
        <header id="header" className="renewal-header glass-header">
            {/* [떠 있는 유리 내비게이션 / Floating glass navigation] */}
            <div className="glass-masthead">
                <Link href="/" className="glass-brand" aria-label="세종문화회관 홈">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/v5/assets/images/sejong-wordmark.png" alt="세종문화회관" width={236} height={43} />
                </Link>
                <nav className="glass-primary-nav" aria-label="주 메뉴">
                    {NAV.map((item) => {
                        const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
                        return <Link key={item.id} href={item.path} data-nav={item.id} aria-current={active ? "page" : undefined}>{item.title}</Link>;
                    })}
                </nav>
                <div className="glass-header-actions">
                    <Link href="/account/login" className="glass-login">로그인</Link>
                    <Link href="/english" className="glass-language" lang="en" aria-label="English guide">EN</Link>
                    <button type="button" className="glass-icon-button" onClick={(event) => openOverlay("search", event)} aria-label="통합검색 열기" aria-haspopup="dialog" aria-controls="sejong-navigation-dialog" aria-expanded={overlay === "search"}>
                        <Icon name="search" size={25} />
                    </button>
                    <button type="button" className="glass-icon-button glass-menu-button" onClick={(event) => openOverlay("menu", event)} aria-label="전체 메뉴 열기" aria-haspopup="dialog" aria-controls="sejong-navigation-dialog" aria-expanded={overlay === "menu"}>
                        <Icon name="menu" size={25} />
                    </button>
                </div>
            </div>

            {/* [검색·전체 메뉴 모달 / Search and full navigation modal] */}
            <dialog
                ref={dialogRef}
                id="sejong-navigation-dialog"
                className={`glass-nav-dialog ${overlay === "menu" ? "glass-nav-dialog--menu" : "glass-nav-dialog--search"}`}
                aria-labelledby={overlay === "menu" ? "menu-heading" : "search-heading"}
                aria-modal="true"
                onCancel={(event) => { event.preventDefault(); setOverlay(null); }}
                onClick={closeOnBackdrop}
                tabIndex={-1}
            >
                <div className="glass-dialog-content" onClick={(event) => { if ((event.target as Element).closest("a[href]")) setOverlay(null); }}>
                    <div className="glass-dialog-top">
                        <span className="glass-dialog-label">세종문화회관</span>
                        <button type="button" className="glass-icon-button glass-dialog-close" onClick={() => setOverlay(null)} aria-label={overlay === "menu" ? "전체 메뉴 닫기" : "검색 닫기"}>
                            <Icon name="close" size={26} />
                        </button>
                    </div>
                    {overlay === "search" ? (
                        <div className="glass-search-content">
                            <h2 id="search-heading">어떤 예술을<br />만나고 싶으세요?</h2>
                            <form className="glass-search-form" onSubmit={submitSearch} role="search">
                                <label className="sr-only" htmlFor="global-query">공연, 전시, 이용안내 검색</label>
                                <input ref={searchRef} id="global-query" name="q" type="search" placeholder="공연, 전시, 이용안내 검색" required autoComplete="off" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
                                <button className="glass-icon-button" type="submit" aria-label="검색"><Icon name="arrow" size={28} /></button>
                            </form>
                            {query ? (
                                <div className="glass-search-suggestions">
                                    <p className="glass-search-caption" aria-live="polite">{suggestions.length ? "찾으시는 내용인가요?" : "검색 버튼을 눌러 전체 결과를 확인하세요."}</p>
                                    {suggestions.map((page) => <Link href={page.path} key={page.path}><span>{page.title}</span><Icon name="arrow" size={20} /></Link>)}
                                    <Link className="glass-search-all" href={`/search?q=${encodeURIComponent(searchQuery.trim())}`}>‘{searchQuery.trim()}’ 전체 검색 결과<Icon name="arrow" size={20} /></Link>
                                </div>
                            ) : (
                                <div className="glass-search-terms">
                                    <span>이런 검색은 어때요?</span>
                                    <div>{SEARCH_TERMS.map((term) => <Link key={term} href={`/search?q=${encodeURIComponent(term)}`}>{term}</Link>)}</div>
                                </div>
                            )}
                            <nav className="glass-search-shortcuts" aria-label="자주 찾는 안내">
                                <Link href="/programs?view=calendar"><Icon name="calendar" size={21} />공연 일정</Link>
                                <Link href="/visit/directions"><Icon name="pin" size={21} />오시는 길</Link>
                                <Link href="/visit/support/faq">자주 묻는 질문<Icon name="arrow" size={20} /></Link>
                            </nav>
                        </div>
                    ) : overlay === "menu" ? (
                        <>
                            <div className="glass-menu-heading"><h2 id="menu-heading">예술과 만나는<br />모든 길.</h2><p>공연을 고르는 순간부터<br />집으로 돌아가는 길까지.</p></div>
                            <nav className="glass-menu-columns" aria-label="전체 메뉴">
                                {NAV.map((group, index) => (
                                    <section key={group.id} aria-labelledby={`menu-group-${group.id}`}>
                                        <span className="glass-menu-number" aria-hidden="true">0{index + 1}</span>
                                        <h3 id={`menu-group-${group.id}`}><Link href={group.path}>{group.title}<Icon name="arrow" size={20} /></Link></h3>
                                        {group.items.map(([label, path]) => <Link key={path} href={path} aria-current={pathname === path ? "page" : undefined}>{label}</Link>)}
                                    </section>
                                ))}
                            </nav>
                            <nav className="glass-menu-quick" aria-label="빠른 이용 안내">
                                {QUICK_LINKS.map((item) => <Link key={item.path} href={item.path}><Icon name={item.icon} size={27} /><span><strong>{item.title}</strong><span>{item.detail}</span></span><Icon name="arrow" size={22} /></Link>)}
                            </nav>
                            <nav className="glass-menu-utilities" aria-label="개인 서비스와 전체 안내">
                                <Link href="/account/login">로그인</Link><Link href="/account/signup">회원가입</Link><Link href="/account/favorites">관심 프로그램</Link><Link href="/services">전체 서비스</Link><Link href="/sitemap">사이트맵</Link><Link href="/english" lang="en">English guide</Link>
                            </nav>
                        </>
                    ) : null}
                </div>
            </dialog>
        </header>
    );
}
