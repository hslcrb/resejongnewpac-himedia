"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PROGRAMS } from "../../src/data/catalog";
import ProgramCard from "../../components/ProgramCard";
import Icon from "../../components/Icon";
import type { Program } from "../../types/sejong.ts";

// [프로그램 탐색 기준 / Program discovery options]
const CATEGORIES = ["전체", "공연", "전시", "교육"];
const VENUES = [...new Set(PROGRAMS.map((program) => program.venue).filter(Boolean))];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
type View = "poster" | "list" | "calendar";
type Sort = "recommended" | "date" | "title";

function getToday() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function shiftMonth(month: string, direction: number) {
    const [year, number] = month.split("-").map(Number);
    const date = new Date(year, number - 1 + direction, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function runsOn(program: Program, date: string) {
    if (!program.start) return false;
    return program.start <= date && (program.end || program.start) >= date;
}

function runsInMonth(program: Program, month: string) {
    return !!program.start && program.start <= `${month}-31` && (program.end || program.start) >= `${month}-01`;
}

const MONTHS = [...new Set(PROGRAMS.flatMap((program) => {
    if (!program.start) return [];
    const values: string[] = [];
    let current = program.start.slice(0, 7);
    const end = (program.end || program.start).slice(0, 7);
    while (current <= end && values.length < 120) {
        values.push(current);
        current = shiftMonth(current, 1);
    }
    return values;
}))].sort();

// [검색·필터·보기 상태 / Search, filters and view state]
export default function ProgramsPage() {
    const [category, setCategory] = useState("전체");
    const [search, setSearch] = useState("");
    const [venue, setVenue] = useState("");
    const [month, setMonth] = useState("");
    const [view, setView] = useState<View>("poster");
    const [sort, setSort] = useState<Sort>("recommended");
    const [freeOnly, setFreeOnly] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(() => getToday().slice(0, 7));
    const [selectedDay, setSelectedDay] = useState("");
    const [ready, setReady] = useState(false);
    const [today, setToday] = useState("");

    // [공유 가능한 탐색 주소 / Shareable discovery URLs]
    useEffect(() => {
        const readLocation = () => {
            const params = new URLSearchParams(window.location.search);
            const nextCategory = params.get("category") || "전체";
            const nextView = params.get("view");
            const nextMonth = params.get("month") || "";
            const nextSort = params.get("sort");
            const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(nextMonth) ? nextMonth : "";
            setCategory(CATEGORIES.includes(nextCategory) ? nextCategory : "전체");
            setSearch(params.get("q") || "");
            setVenue(VENUES.includes(params.get("venue")) ? params.get("venue") || "" : "");
            setView(nextView === "calendar" || nextView === "list" ? nextView : "poster");
            setMonth(validMonth);
            setCalendarMonth(validMonth || getToday().slice(0, 7));
            setSort(nextSort === "date" || nextSort === "title" ? nextSort : "recommended");
            setFreeOnly(params.get("free") === "true");
            setSelectedDay("");
            setToday(getToday());
            setReady(true);
        };
        readLocation();
        window.addEventListener("popstate", readLocation);
        return () => window.removeEventListener("popstate", readLocation);
    }, []);

    useEffect(() => {
        if (!ready) return;
        const url = new URL(window.location.href);
        const values: Record<string, string> = {
            category: category === "전체" ? "" : category,
            q: search.trim(), venue,
            view: view === "poster" ? "" : view,
            month: view === "calendar" ? calendarMonth : month,
            sort: sort === "recommended" ? "" : sort,
            free: freeOnly ? "true" : "",
        };
        Object.entries(values).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }, [category, search, venue, view, month, calendarMonth, sort, freeOnly, ready]);

    const activeMonth = view === "calendar" ? calendarMonth : month;
    const query = search.trim().toLocaleLowerCase("ko-KR");
    const matched = PROGRAMS.filter((program) => {
        if (category !== "전체" && program.category !== category) return false;
        if (venue && program.venue !== venue) return false;
        if (freeOnly && program.price !== 0 && program.price !== "무료") return false;
        if (activeMonth && !runsInMonth(program, activeMonth)) return false;
        return !query || [program.title, program.genre, program.venue, program.description].join(" ").toLocaleLowerCase("ko-KR").includes(query);
    });
    const filtered = matched.filter((program) => view !== "calendar" || !selectedDay || runsOn(program, selectedDay));
    if (sort === "date") filtered.sort((a, b) => (a.start || "").localeCompare(b.start || ""));
    if (sort === "title") filtered.sort((a, b) => a.title.localeCompare(b.title, "ko"));

    const [calendarYear, calendarNumber] = calendarMonth.split("-").map(Number);
    const firstWeekday = new Date(calendarYear, calendarNumber - 1, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarNumber, 0).getDate();
    const calendarDays = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
        const day = index - firstWeekday + 1;
        return day > 0 && day <= daysInMonth ? `${calendarMonth}-${String(day).padStart(2, "0")}` : "";
    });
    const hasFilters = category !== "전체" || !!query || !!venue || !!month || freeOnly || !!selectedDay;

    function resetFilters() {
        setCategory("전체"); setSearch(""); setVenue(""); setMonth("");
        setFreeOnly(false); setSelectedDay(""); setSort("recommended"); setCalendarMonth(getToday().slice(0, 7));
    }

    function changeMonth(value: string) {
        setMonth(value);
        if (value) setCalendarMonth(value);
        setSelectedDay("");
    }

    function changeView(value: View) {
        setView(value);
        if (value === "calendar" && month) setCalendarMonth(month);
        setSelectedDay("");
    }

    return (
        <div className="programs-discovery">
            <nav className="discovery-breadcrumbs" aria-label="현재 위치">
                <Link href="/">홈</Link><Icon name="chevron" size={18} /><span aria-current="page">공연·전시·교육</span>
            </nav>

            {/* [프로그램 소개 / Program introduction] */}
            <header className="discovery-heading">
                <div>
                    <h1>어떤 예술을<br /><span>만나고 싶나요?</span></h1>
                </div>
                <div className="discovery-heading-aside">
                    <p>오래 기억할 무대부터<br />일상을 바꾸는 새로운 발견까지.</p>
                    <Link href="/programs/booking-guide">예매 안내 <Icon name="diagonal" size={22} /></Link>
                </div>
            </header>

            {/* [유리 표면 탐색 도구 / Glass discovery controls] */}
            <section className="discovery-controls" aria-label="프로그램 검색 조건">
                <div className="discovery-controls-top">
                    <div className="discovery-categories" role="group" aria-label="프로그램 분야">
                        {CATEGORIES.map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
                    </div>
                    <label className="discovery-search">
                        <Icon name="search" size={24} />
                        <span className="discovery-sr-only">공연명, 장르, 공연장 검색</span>
                        <input type="search" placeholder="어떤 작품을 찾으세요?" value={search} onChange={(event) => setSearch(event.target.value)} />
                    </label>
                </div>
                <div className="discovery-controls-bottom">
                    <div className="discovery-selects">
                        <label><span>공간</span><select aria-label="공간" value={venue} onChange={(event) => setVenue(event.target.value)}><option value="">모든 공간</option>{VENUES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                        {view !== "calendar" && <label><span>기간</span><select aria-label="기간" value={month} onChange={(event) => changeMonth(event.target.value)}><option value="">모든 일정</option>{MONTHS.map((item) => <option key={item} value={item}>{item.replace("-", "년 ")}월</option>)}</select></label>}
                        <label className="discovery-free"><input type="checkbox" checked={freeOnly} onChange={(event) => setFreeOnly(event.target.checked)} /><span>무료 프로그램</span></label>
                    </div>
                    {hasFilters && <button type="button" className="discovery-reset" onClick={resetFilters}>조건 초기화 <Icon name="close" size={18} /></button>}
                </div>
            </section>

            {/* [결과 정렬과 보기 선택 / Result sorting and view selection] */}
            <div className="discovery-results-toolbar">
                <p aria-live="polite" aria-atomic="true"><strong>{filtered.length}</strong>개의 프로그램</p>
                <div className="discovery-result-options">
                    <label className="discovery-sort"><span className="discovery-sr-only">프로그램 정렬</span><select aria-label="프로그램 정렬" value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="recommended">추천순</option><option value="date">시작일순</option><option value="title">가나다순</option></select></label>
                    <div className="discovery-views" role="group" aria-label="프로그램 보기 방식">
                        <button type="button" aria-pressed={view === "poster"} onClick={() => changeView("poster")}>포스터</button>
                        <button type="button" aria-pressed={view === "list"} onClick={() => changeView("list")}><Icon name="menu" size={20} /><span>목록</span></button>
                        <button type="button" aria-pressed={view === "calendar"} onClick={() => changeView("calendar")}><Icon name="calendar" size={20} /><span>달력</span></button>
                    </div>
                </div>
            </div>

            {/* [월간 일정과 날짜별 탐색 / Monthly schedule and day selection] */}
            {view === "calendar" && <section className="discovery-calendar" aria-label="월간 프로그램 일정">
                <div className="discovery-calendar-heading">
                    <div className="discovery-month-nav">
                        <button type="button" aria-label="이전 달" onClick={() => { setCalendarMonth(shiftMonth(calendarMonth, -1)); setSelectedDay(""); }}><Icon name="back" /></button>
                        <h2>{calendarYear}<span>.</span>{String(calendarNumber).padStart(2, "0")}</h2>
                        <button type="button" aria-label="다음 달" onClick={() => { setCalendarMonth(shiftMonth(calendarMonth, 1)); setSelectedDay(""); }}><Icon name="arrow" /></button>
                    </div>
                    <button type="button" className="discovery-today" onClick={() => { const date = getToday(); setCalendarMonth(date.slice(0, 7)); setSelectedDay(date); }}>오늘</button>
                </div>
                <div className="discovery-calendar-week" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
                <div className="discovery-calendar-days">
                    {calendarDays.map((date, index) => {
                        if (!date) return <span key={`blank-${index}`} className="discovery-calendar-blank" />;
                        const count = matched.filter((program) => runsOn(program, date)).length;
                        return <button type="button" key={date} className={`discovery-calendar-day${date === today ? " is-today" : ""}${count ? " has-programs" : ""}`} aria-label={`${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일, 프로그램 ${count}개`} aria-pressed={selectedDay === date} onClick={() => setSelectedDay(selectedDay === date ? "" : date)}>
                            <span className="discovery-day-number">{Number(date.slice(8))}</span>
                            {count > 0 && <span className="discovery-day-count"><span className="discovery-day-count-label">프로그램 </span>{count}<span className="discovery-day-count-label">개</span></span>}
                        </button>;
                    })}
                </div>
                <p className="discovery-calendar-note">프로그램 운영 기간을 기준으로 표시합니다. 자세한 회차와 휴관일은 상세 안내에서 확인하세요.</p>
                {selectedDay && <div className="discovery-selected-day"><h3>{Number(selectedDay.slice(5, 7))}월 {Number(selectedDay.slice(8))}일 프로그램</h3><button type="button" onClick={() => setSelectedDay("")}>이달 전체 보기 <Icon name="close" size={18} /></button></div>}
            </section>}

            {/* [작품 목록과 빈 결과 / Program results and empty state] */}
            {filtered.length > 0 ? <div className={`program-results-grid discovery-results discovery-results--${view}`}>
                {filtered.map((program) => <ProgramCard key={program.id} program={program} layout={view === "poster" ? "poster" : "list"} />)}
            </div> : <div className="discovery-empty">
                <Icon name="search" size={40} />
                <h2>{selectedDay ? "이날은 잠시 쉬어갑니다" : "아직 맞는 프로그램이 없어요"}</h2>
                <p>다른 날짜나 검색어로 새로운 만남을 찾아보세요.</p>
                <button type="button" onClick={resetFilters}>검색 조건 지우기 <Icon name="arrow" size={20} /></button>
            </div>}

            <aside className="discovery-help"><p>공연을 만나기 전, 궁금한 것이 있나요?</p><div><Link href="/visit/directions">오시는 길 <Icon name="diagonal" size={20} /></Link><Link href="/visit/accessibility">관람 지원 <Icon name="diagonal" size={20} /></Link><Link href="/visit/support/faq">자주 묻는 질문 <Icon name="diagonal" size={20} /></Link></div></aside>
        </div>
    );
}
