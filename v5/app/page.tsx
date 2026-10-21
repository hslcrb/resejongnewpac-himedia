"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { PROGRAMS, NOTICES } from "../src/data/catalog";
import ProgramCard from "../components/ProgramCard";
import Icon from "../components/Icon";
import VioletQuickMenu from "../components/VioletQuickMenu";
import HomeAnchorNavigation from "../components/HomeAnchorNavigation";
import {
    seoulToday,
    monthDates,
    moveMonth,
    programsForDate,
    canSelectProgram,
    discoverPrograms,
} from "../src/features/home-domain";
import type { Program } from "../types/sejong.ts";

// 히어로 캐러셀 슬라이드 데이터
const features = [
    {
        id: "dance",
        theme: "dance",
        label: "2026 세종시즌 · 서울시무용단",
        title: "오래된 춤의 걸음,\n지금의 무대.",
        name: "서울시무용단 〈일무〉",
        date: "2026.10.20 - 10.25",
        venue: "세종대극장",
        image: "hero-dance.png",
        alt: "금빛 무대에서 춤추는 무용수의 리뉴얼 콘셉트 이미지",
    },
    {
        id: "carmen",
        theme: "opera",
        label: "2026 세종시즌 · 서울시오페라단",
        title: "자유롭게 사랑하고,\n자유롭게 떠나는 카르멘.",
        name: "서울시오페라단 〈카르멘〉",
        date: "2026.10.15 - 10.18",
        venue: "세종대극장",
        image: "poster-carmen.svg",
        alt: "오페라 카르멘 콘셉트 포스터",
    },
    {
        id: "light",
        theme: "light",
        label: "전시 · 빛과 공간",
        title: "빛의 각도에 따라\n달라지는 공간.",
        name: "빛이 머무는 자리",
        date: "2026.10.01 - 11.15",
        venue: "세종미술관",
        image: "poster-light.svg",
        alt: "빛이 머무는 자리 전시 콘셉트 포스터",
    },
];

// 방문 안내 데이터
const visitGuides = [
    {
        id: "directions",
        title: "오시는 길과 주차",
        description: "지하철·버스·주차장 안내",
        path: "/visit/directions",
        image: "sejong-grand-facade.png",
        alt: "광화문 광장에 면한 세종문화회관 대극장 외관",
        kind: "photo",
        width: 1160,
        height: 680,
    },
    {
        id: "spaces",
        title: "공간과 좌석",
        description: "객석 배치와 좌석 시야 미리보기",
        path: "/visit/spaces",
        image: "sejong-grand-auditorium.png",
        alt: "무대에서 바라본 세종대극장 객석",
        kind: "photo",
        width: 1160,
        height: 680,
    },
    {
        id: "accessibility",
        title: "모두를 위한 관람",
        description: "접근성 서비스와 편의시설",
        path: "/visit/accessibility",
        image: "visit-guide-access.png",
        alt: "휠체어와 경사로, 객석을 표현한 접근성 안내 삽화",
        kind: "illustration",
        width: 1254,
        height: 1254,
    },
    {
        id: "etiquette",
        title: "관람 전 알아두세요",
        description: "예매와 관람에 필요한 안내",
        path: "/visit/etiquette",
        image: "visit-guide-etiquette.png",
        alt: "객석과 닫힌 프로그램북, 뒤집어 둔 휴대전화를 표현한 관람 안내 삽화",
        kind: "illustration",
        width: 1254,
        height: 1254,
    },
];

const programCategoryIds: Record<string, string> = {
    "전체": "all", "공연": "performance", "전시": "exhibition", "교육": "education", "기획·시즌": "season",
};
const newsCategoryIds: Record<string, string> = {
    "전체": "all", "공지": "notices", "티켓오픈": "ticket-open", "대관공고": "rental",
};

export default function HomePage() {
    // 1. 서울 기준 오늘 날짜
    const today = seoulToday();

    // 2. 히어로 캐러셀 상태
    const [heroActive, setHeroActive] = useState(0);
    const [dragX, setDragX] = useState(0);
    const [isMoving, setIsMoving] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
    const [progress, setProgress] = useState(0);
    const stageRef = useRef<HTMLDivElement>(null);
    const heroMoveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const moveHero = (dir: 1 | -1) => {
        if (isMoving) return;
        setIsMoving(true);
        setProgress(0);

        const stage = stageRef.current;
        const slideEl = stage?.querySelector(".season-slide");
        const step = slideEl ? slideEl.getBoundingClientRect().width + 24 : 1224;

        setDragX(-dir * step);

        heroMoveTimer.current = setTimeout(() => {
            setHeroActive((prev) => (prev + dir + features.length) % features.length);
            setIsMoving(false);
            setDragX(0);
            heroMoveTimer.current = null;
        }, 750);
    };

    useEffect(() => () => {
        if (heroMoveTimer.current) clearTimeout(heroMoveTimer.current);
    }, []);

    // 캐러셀 자동 재생 (3500ms)
    useEffect(() => {
        if (isPaused || isMoving || isQuickMenuOpen) return;
        const interval = 50;
        const totalDuration = 3500;
        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 1) {
                    moveHero(1);
                    return 0;
                }
                return prev + interval / totalDuration;
            });
        }, interval);

        return () => clearInterval(timer);
    }, [isPaused, isMoving, heroActive, isQuickMenuOpen]);

    // 3. 캘린더 빠른 예매 위젯 상태
    const [bookingDate, setBookingDate] = useState(today);
    const [bookingMonth, setBookingMonth] = useState(today.slice(0, 7));
    const [selectedProgramId, setSelectedProgramId] = useState<string>("");
    const [selectedTime, setSelectedTime] = useState<string>("");
    const [participants, setParticipants] = useState<number>(1);

    const monthCells = monthDates(bookingMonth);
    const programsOnBookingDate = programsForDate(PROGRAMS, bookingDate);
    const selectedProgram = (PROGRAMS as unknown as Program[]).find((p) => p.id === selectedProgramId);

    // 날짜 변경 시 프로그램 자동 선택 또는 정리
    const handleDateSelect = (date: string) => {
        setBookingDate(date);
        const progs = programsForDate(PROGRAMS, date);
        if (progs.length > 0) {
            const firstAvailable = progs.find((p: any) => canSelectProgram(p) && date >= today);
            if (firstAvailable) {
                setSelectedProgramId(firstAvailable.id);
                setSelectedTime(firstAvailable.times?.[0] || "");
            } else {
                setSelectedProgramId("");
                setSelectedTime("");
            }
        } else {
            setSelectedProgramId("");
            setSelectedTime("");
        }
    };

    // 프로그램 수동 선택
    const handleProgramSelect = (prog: any) => {
        if (!canSelectProgram(prog) || bookingDate < today) return;
        setSelectedProgramId(prog.id);
        setSelectedTime(prog.times?.[0] || "");
    };

    const dateLabel = (date: string) => {
        if (!date) return "날짜를 선택하세요";
        try {
            return new Intl.DateTimeFormat("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "short",
                timeZone: "Asia/Seoul",
            }).format(new Date(`${date}T03:00:00Z`));
        } catch {
            return date;
        }
    };

    const isBookingValid =
        Boolean(selectedProgram) &&
        Boolean(selectedTime) &&
        bookingDate >= today &&
        canSelectProgram(selectedProgram);

    const bookingButtonLabel =
        selectedProgram?.category === "교육"
            ? "교육 신청으로"
            : selectedProgram?.category === "전시"
            ? "전시 예매로"
            : "공연 예매로";

    const bookingDestinationUrl = selectedProgram
        ? selectedProgram.category === "교육"
            ? `/apply/education?program=${selectedProgram.id}&date=${bookingDate}&time=${encodeURIComponent(
                  selectedTime
              )}&participants=${participants}&source=home`
            : `/booking/${selectedProgram.id}?date=${bookingDate}&time=${encodeURIComponent(
                  selectedTime
              )}&participants=${participants}&source=home`
        : "";

    // 4. 프로그램 탐색 섹션 상태
    const [selectedCategory, setSelectedCategory] = useState<string>("전체");
    const [anchorProgramId, setAnchorProgramId] = useState("");
    const categories = ["전체", "공연", "전시", "교육", "기획·시즌"];
    const programChoices = discoverPrograms(PROGRAMS, selectedCategory, today);
    const anchoredProgram = PROGRAMS.find(program => program.id === anchorProgramId);
    const filteredPrograms = (anchoredProgram
        ? [anchoredProgram, ...programChoices.filter(program => program.id !== anchoredProgram.id)]
        : programChoices).slice(0, 4) as Program[];

    // 5. 방문 안내 미리보기 상태
    const [activeVisitId, setActiveVisitId] = useState<string>("directions");
    const activeGuide = visitGuides.find((g) => g.id === activeVisitId) || visitGuides[0];

    // 6. 소식 & 참여 섹션 상태
    const [newsCategory, setNewsCategory] = useState<string>("전체");
    const [anchorNoticeId, setAnchorNoticeId] = useState("");
    const newsCategories = ["전체", "공지", "티켓오픈", "대관공고"];
    const noticeChoices = NOTICES.filter(notice => newsCategory === "전체" || notice.category === newsCategory);
    const anchoredNotice = NOTICES.find(notice => notice.id === anchorNoticeId);
    const filteredNotices = (anchoredNotice
        ? [anchoredNotice, ...noticeChoices.filter(notice => notice.id !== anchoredNotice.id)]
        : noticeChoices).slice(0, 4);

    const resolveHomeAnchor = (id: string) => {
        const featureIndex = features.findIndex(feature => id === `home-feature-${feature.id}`);
        if (featureIndex >= 0) {
            if (heroMoveTimer.current) clearTimeout(heroMoveTimer.current);
            heroMoveTimer.current = null;
            setHeroActive(featureIndex);
            setIsMoving(false);
            setDragX(0);
            setProgress(0);
            setIsPaused(true);
            return true;
        }

        const programCategory = categories.find(category => id === `home-program-category-${programCategoryIds[category]}`);
        if (programCategory) {
            setAnchorProgramId("");
            setSelectedCategory(programCategory);
            return true;
        }
        const program = PROGRAMS.find(item => id === `home-program-${item.id}`);
        if (program) {
            if (!filteredPrograms.some(item => item.id === program.id)) {
                setSelectedCategory("전체");
                setAnchorProgramId(program.id);
            }
            return true;
        }

        const noticeCategory = newsCategories.find(category => id === `home-news-category-${newsCategoryIds[category]}`);
        if (noticeCategory) {
            setAnchorNoticeId("");
            setNewsCategory(noticeCategory);
            return true;
        }
        const notice = NOTICES.find(item => id === `home-notice-${item.id}`);
        if (notice) {
            if (!filteredNotices.some(item => item.id === notice.id)) {
                setNewsCategory("전체");
                setAnchorNoticeId(notice.id);
            }
            return true;
        }

        const date = id.startsWith("home-booking-date-") ? id.slice("home-booking-date-".length) : "";
        if (date && monthDates(date.slice(0, 7)).includes(date)) {
            setBookingMonth(date.slice(0, 7));
            handleDateSelect(date);
            return true;
        }
        const bookingProgram = PROGRAMS.find(item => id === `home-booking-program-${item.id}`);
        if (bookingProgram) {
            if (!programsOnBookingDate.some(item => item.id === bookingProgram.id)) {
                const date = today < bookingProgram.start || today > bookingProgram.end ? bookingProgram.start : today;
                setBookingMonth(date.slice(0, 7));
                handleDateSelect(date);
            }
            return true;
        }

        const guide = visitGuides.find(item => id === `home-visit-${item.id}`);
        if (guide) setActiveVisitId(guide.id);
        const target = document.getElementById(id);
        return Boolean(target && (target.closest(".home-v4-wrap, #footer") || ["header", "main"].includes(id)));
    };

    return (
        <div className="home-v4-wrap" id="home" data-home-anchor>
            <HomeAnchorNavigation resolveAnchor={resolveHomeAnchor} />
            <h1 className="sr-only">세종문화회관 - 공연·전시·교육 일정, 예매와 이용 안내</h1>

            {/* 1. 시즌 히어로 캐러셀 (Season Hero Carousel) */}
            <section
                className="season-hero"
                id="featured-season"
                data-home-anchor
                aria-label="주요 프로그램"
                aria-roledescription="캐러셀"
            >
                <div
                    className="season-stage"
                    ref={stageRef}
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                >
                    <div
                        className={`season-track${isMoving ? " is-moving" : ""}`}
                        style={{
                            "--drag-x": `${dragX}px`,
                            "--carousel-duration": "750ms",
                        } as React.CSSProperties}
                    >
                        {[-2, -1, 0, 1, 2].map((offset) => {
                            const slideIndex = (heroActive + offset + features.length) % features.length;
                            const item = features[slideIndex];
                            const isCurrent = offset === 0;
                            const imgPath = `/v5/assets/images/${item.image}`;

                            return (
                                <article
                                    key={`${item.id}-${offset}`}
                                    className={`card card--hero season-slide season-${item.theme}${
                                        isCurrent ? " is-active" : ""
                                    }`}
                                    data-card="hero"
                                    data-feature={item.id}
                                    id={isCurrent ? `home-feature-${item.id}` : undefined}
                                    data-home-anchor={isCurrent ? "" : undefined}
                                    aria-hidden={!isCurrent}
                                >
                                    <Link
                                        className="season-card-link"
                                        href={`/programs/${item.id}`}
                                        draggable={false}
                                        tabIndex={isCurrent ? 0 : -1}
                                        aria-label={`${item.name} 자세히 보기`}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            className="season-image"
                                            src={imgPath}
                                            alt={item.alt}
                                            width={1672}
                                            height={941}
                                            draggable={false}
                                            loading={isCurrent ? "eager" : "lazy"}
                                            onError={(e) => {
                                                const target = e.currentTarget;
                                                if (target.src.includes("/v5/assets/")) {
                                                    target.src = target.src.replace("/v5/assets/", "/assets/");
                                                }
                                            }}
                                        />
                                        <div className="season-copy">
                                            <p className="season-label">{item.label}</p>
                                            <h2>
                                                {item.title.split("\n").map((line, idx) => (
                                                    <React.Fragment key={idx}>
                                                        {line}
                                                        {idx < item.title.split("\n").length - 1 && <br />}
                                                    </React.Fragment>
                                                ))}
                                            </h2>
                                            <p className="season-name">{item.name}</p>
                                            <p className="season-meta">
                                                {item.date}
                                                <span>{item.venue}</span>
                                            </p>
                                            <span className="button button--yellow">
                                                공연·전시 자세히 보기 <Icon name="arrow" size={20} />
                                            </span>
                                        </div>
                                    </Link>
                                </article>
                            );
                        })}
                    </div>
                </div>

                {/* 캐러셀 툴바 & 컨트롤 */}
                <div className="season-toolbar container">
                    <p>2026 세종시즌 · 지금 상연 중</p>
                    <div className="season-controls" id="home-feature-controls" data-home-anchor role="group" aria-label="주요 프로그램 제어">
                        <span className="season-pagination" aria-hidden="true">
                            <span>{String(heroActive + 1).padStart(2, "0")}</span>
                            <span className="season-pagination-total"> / 03</span>
                        </span>
                        <span className="season-progress" aria-hidden="true">
                            <i style={{ transform: `scaleX(${progress})` }} />
                        </span>
                        <button
                            type="button"
                            id="home-feature-previous"
                            className="round-button"
                            onClick={() => moveHero(-1)}
                            aria-label="이전 프로그램"
                        >
                            <Icon name="back" size={24} />
                        </button>
                        <button
                            type="button"
                            id="home-feature-next"
                            className="round-button"
                            onClick={() => moveHero(1)}
                            aria-label="다음 프로그램"
                        >
                            <Icon name="arrow" size={24} />
                        </button>
                        <button
                            type="button"
                            id="home-feature-playback"
                            className="round-button"
                            onClick={() => setIsPaused(!isPaused)}
                            aria-label={isPaused ? "자동 재생 시작" : "자동 재생 일시정지"}
                            aria-pressed={isPaused}
                        >
                            <Icon name={isPaused ? "play" : "pause"} size={24} />
                        </button>
                        <span className="sr-only" aria-live="polite">
                            {heroActive + 1} / {features.length}, {features[heroActive].name}
                        </span>
                    </div>
                </div>
            </section>

            <VioletQuickMenu heroId="featured-season" onOpenChange={setIsQuickMenuOpen} />

            {/* 2. 목적별 빠른 진입 (Quick Pathways) */}
            <nav className="home-pathways container" id="home-pathways" data-home-anchor aria-label="이용 목적별 바로가기">
                <Link href="/programs" id="home-pathway-programs" data-home-anchor>
                    <Icon name="calendar" size={26} />
                    <span>
                        <strong>일정·예매</strong>
                        <small>공연·전시·교육 살펴보기</small>
                    </span>
                    <Icon name="arrow" size={22} />
                </Link>
                <Link href="/visit/group" id="home-pathway-group" data-home-anchor>
                    <Icon name="ticket" size={26} />
                    <span>
                        <strong>단체 관람</strong>
                        <small>단체관람 안내와 신청</small>
                    </span>
                    <Icon name="arrow" size={22} />
                </Link>
                <Link href="/rental" id="home-pathway-rental" data-home-anchor>
                    <Icon name="pin" size={26} />
                    <span>
                        <strong>대관</strong>
                        <small>대관 시설과 일정 확인</small>
                    </span>
                    <Icon name="arrow" size={22} />
                </Link>
            </nav>

            {/* 3. 캘린더 빠른 예매 위젯 (Quick Booking Widget) */}
            <section className="home-booking container" id="quick-booking" data-home-anchor aria-labelledby="quick-booking-heading">
                <div className="section-heading">
                    <div>
                        <p className="home-section-label">날짜로 찾는 예술</p>
                        <h2 id="quick-booking-heading">언제 만나볼까요?</h2>
                        <p className="section-description">관람할 날을 고르면, 그날의 예술이 보여요.</p>
                    </div>
                    <Link className="text-link" href="/programs?view=calendar" id="home-booking-full-calendar" data-home-anchor>
                        전체 일정 <Icon name="arrow" size={20} />
                    </Link>
                </div>

                <div className="quick-booking-layout">
                    {/* 달력 영역 */}
                    <div className="quick-calendar" id="home-booking-calendar" data-home-anchor>
                        <div className="quick-calendar-heading">
                            <h3 id="quick-month" aria-live="polite">
                                {bookingMonth.replace("-", ". ")}
                            </h3>
                            <div className="quick-month-controls">
                                <button
                                    type="button"
                                    id="home-booking-previous-month"
                                    onClick={() => setBookingMonth(moveMonth(bookingMonth, -1))}
                                    aria-label="이전 달"
                                >
                                    <Icon name="back" size={20} />
                                </button>
                                <button
                                    type="button"
                                    id="home-booking-today"
                                    onClick={() => {
                                        setBookingMonth(today.slice(0, 7));
                                        handleDateSelect(today);
                                    }}
                                >
                                    오늘
                                </button>
                                <button
                                    type="button"
                                    id="home-booking-next-month"
                                    onClick={() => setBookingMonth(moveMonth(bookingMonth, 1))}
                                    aria-label="다음 달"
                                >
                                    <Icon name="arrow" size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="quick-calendar-week" aria-hidden="true">
                            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                                <span key={day}>{day}</span>
                            ))}
                        </div>

                        <div className="quick-calendar-grid" role="group" aria-labelledby="quick-month">
                            {monthCells.map((date, idx) => {
                                if (!date) {
                                    return <span key={`blank-${idx}`} className="quick-calendar-blank" aria-hidden="true" />;
                                }
                                const progs = programsForDate(PROGRAMS, date);
                                const count = progs.length;
                                const isCurrentDate = date === today;
                                const isSelected = date === bookingDate;

                                return (
                                    <button
                                        key={date}
                                        id={`home-booking-date-${date}`}
                                        data-home-anchor
                                        type="button"
                                        onClick={() => handleDateSelect(date)}
                                        aria-label={`${dateLabel(date)}${isCurrentDate ? ", 오늘" : ""}, ${
                                            count ? `${count}개 프로그램` : "등록된 일정 없음"
                                        }`}
                                        aria-pressed={isSelected}
                                        aria-current={isCurrentDate ? "date" : undefined}
                                        className={`quick-date${isSelected ? " is-selected" : ""}${
                                            isCurrentDate ? " is-today" : ""
                                        }`}
                                    >
                                        <span>{Number(date.slice(-2))}</span>
                                        {count > 0 && <i aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="quick-calendar-key">
                            <i aria-hidden="true" />
                            프로그램이 있는 날
                        </p>
                    </div>

                    {/* 선택 프로그램 및 회차 선택 영역 */}
                    <div className="quick-booking-choices" id="home-booking-programs" data-home-anchor>
                        <div className="quick-day-heading">
                            <div>
                                <p>선택한 날짜</p>
                                <h3 id="home-booking-day-heading">{dateLabel(bookingDate)}</h3>
                            </div>
                            <span>{programsOnBookingDate.length}개 프로그램</span>
                        </div>

                        {programsOnBookingDate.length > 0 ? (
                            <div className="quick-program-list" role="group" aria-label="프로그램 선택">
                                {programsOnBookingDate.map((prog: any) => {
                                    const available = canSelectProgram(prog) && bookingDate >= today;
                                    const isSelected = selectedProgramId === prog.id;
                                    const posterSrc = prog.image
                                        ? `/v5/${prog.image.replace(/^\/?(v5\/)?/, "")}`
                                        : `/v5/assets/images/poster-${prog.id}.svg`;

                                    return (
                                        <button
                                            key={prog.id}
                                            id={`home-booking-program-${prog.id}`}
                                            data-home-anchor
                                            type="button"
                                            className={`quick-program${isSelected ? " is-selected" : ""}`}
                                            onClick={() => handleProgramSelect(prog)}
                                            aria-pressed={isSelected}
                                            disabled={!available}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={posterSrc}
                                                alt=""
                                                width="90"
                                                height="120"
                                                loading="lazy"
                                                onError={(e) => {
                                                    const target = e.currentTarget;
                                                    if (target.src.includes("/v5/assets/")) {
                                                        target.src = target.src.replace("/v5/assets/", "/assets/");
                                                    }
                                                }}
                                            />
                                            <span className="quick-program-copy">
                                                <span className="quick-program-category">
                                                    {prog.category} ·{" "}
                                                    {available
                                                        ? prog.status
                                                        : bookingDate < today
                                                        ? "지난 일정"
                                                        : prog.status}
                                                </span>
                                                <strong>{prog.title}</strong>
                                                <span>{prog.venue}</span>
                                                <span>{prog.times?.join(" · ")}</span>
                                            </span>
                                            <span className="quick-program-check" aria-hidden="true">
                                                {isSelected ? "✓" : "+"}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="quick-empty">
                                <h4>등록된 프로그램이 없는 날이에요.</h4>
                                <p>달력에 점이 있는 날짜를 선택하거나 전체 일정을 살펴보세요.</p>
                                <Link className="text-link" href={`/programs?view=calendar&month=${bookingMonth}`}>
                                    전체 일정 보기 <Icon name="arrow" size={20} />
                                </Link>
                            </div>
                        )}

                        <div className="quick-selection-fields" id="home-booking-options" data-home-anchor role="group" aria-label="회차와 인원 선택">
                            <label htmlFor="quick-time">
                                회차
                                <select
                                    id="quick-time"
                                    value={selectedTime}
                                    onChange={(e) => setSelectedTime(e.target.value)}
                                    disabled={!selectedProgram}
                                >
                                    <option value="">
                                        {selectedProgram ? "회차를 선택하세요" : "프로그램을 먼저 선택하세요"}
                                    </option>
                                    {(selectedProgram?.times || []).map((t: string) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label htmlFor="quick-participants">
                                인원
                                <select
                                    id="quick-participants"
                                    value={participants}
                                    onChange={(e) => setParticipants(Number(e.target.value))}
                                    disabled={!selectedProgram}
                                >
                                    {[1, 2, 3, 4].map((count) => (
                                        <option key={count} value={count}>
                                            {count}명
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="quick-booking-action" id="home-booking-action" data-home-anchor>
                            <p>
                                {isBookingValid && selectedProgram ? (
                                    <>
                                        {selectedProgram.title}
                                        <br />
                                        {selectedTime} · {participants}명
                                    </>
                                ) : (
                                    "프로그램과 회차를 선택해 주세요."
                                )}
                            </p>
                            {isBookingValid ? (
                                <Link className="button button--dark" href={bookingDestinationUrl}>
                                    {bookingButtonLabel} <Icon name="arrow" size={20} />
                                </Link>
                            ) : (
                                <button className="button button--dark" type="button" disabled>
                                    예매·신청
                                </button>
                            )}
                        </div>
                    </div>
                </div>

            </section>

            {/* 4. 프로그램 탐색 섹션 (Discover Programs) */}
            <section className="home-programs container" id="discover-programs" data-home-anchor aria-labelledby="discover-heading">
                <div className="section-heading">
                    <div>
                        <p className="home-section-label">프로그램</p>
                        <h2 id="discover-heading">
                            공연·전시·교육
                            <br />
                            전체 일정을 확인하세요.
                        </h2>
                        <p className="section-description">오늘 열리는 무대부터 다음 달 일정까지.</p>
                    </div>
                    <Link className="text-link" href="/programs" id="home-program-all" data-home-anchor>
                        모든 프로그램 <Icon name="arrow" size={20} />
                    </Link>
                </div>

                <div className="program-filter-row">
                    <div className="program-choice" id="home-program-filters" data-home-anchor role="group" aria-label="프로그램 분류">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                id={`home-program-category-${programCategoryIds[cat]}`}
                                data-home-anchor
                                type="button"
                                onClick={() => { setAnchorProgramId(""); setSelectedCategory(cat); }}
                                className={selectedCategory === cat ? "is-selected" : ""}
                                aria-pressed={selectedCategory === cat}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    <Link className="calendar-link" href="/programs?view=calendar" id="home-program-calendar" data-home-anchor>
                        <Icon name="calendar" size={18} /> 일정으로 보기
                    </Link>
                </div>

                <div className="home-program-grid" id="home-program-results" data-home-anchor>
                    {filteredPrograms.length > 0 ? (
                        filteredPrograms.map((program) => (
                            <div key={program.id} id={`home-program-${program.id}`} className="home-program-anchor" data-home-anchor>
                                <ProgramCard program={program} />
                            </div>
                        ))
                    ) : (
                        <p className="selection-empty">
                            이 분류의 다음 일정은 아직 확정 전입니다.{" "}
                            <Link href="/programs">전체 프로그램을 살펴보세요.</Link>
                        </p>
                    )}
                </div>


                <Link href="/programs/season" className="home-season-link" id="home-season-programs" data-home-anchor>
                    <span>
                        <strong>한 편에서 시작하는, 나만의 시즌.</strong>
                        <span>세종시즌부터 Sync Next까지, 취향을 넓히는 기획 프로그램</span>
                    </span>
                    <span>
                        기획·시즌 살펴보기 <Icon name="arrow" size={22} />
                    </span>
                </Link>
            </section>

            {/* 5. 방문 안내와 호버 미리보기 (Visit Guide with Photographic Previews) */}
            <section className="home-visit container" id="plan-your-visit" data-home-anchor aria-labelledby="visit-heading">
                <figure className="visit-photograph" id="home-visit-preview" data-home-anchor aria-label="방문 안내 미리보기">
                    {visitGuides.map((guide) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            key={guide.id}
                            src={`/v5/assets/images/${guide.image}`}
                            alt={guide.alt}
                            width={guide.width}
                            height={guide.height}
                            loading="lazy"
                            data-visit-image={guide.id}
                            data-visit-kind={guide.kind}
                            aria-hidden={activeVisitId !== guide.id}
                        />
                    ))}
                </figure>

                <div className="visit-editorial">
                    <h2 id="visit-heading">
                        오시는 길부터
                        <br />
                        관람 준비까지.
                    </h2>
                    <p className="visit-description">
                        지하철 광화문역 출구 안내부터 주차.
                        <br />
                        접근성 서비스와 관람 예절까지 정리했습니다.
                    </p>
                    <Link className="text-link home-visit-planner" href="/visit/plan" id="home-visit-planner" data-home-anchor>
                        방문 계획 만들기 <Icon name="arrow" size={20} />
                    </Link>

                    <div className="visit-links-layout">
                        <div className="visit-link-list">
                            {visitGuides.map((guide) => (
                                <Link
                                    key={guide.id}
                                    id={`home-visit-${guide.id}`}
                                    data-home-anchor
                                    href={guide.path}
                                    data-visit-preview={guide.id}
                                    onPointerEnter={() => setActiveVisitId(guide.id)}
                                    onFocus={() => setActiveVisitId(guide.id)}
                                    className={activeVisitId === guide.id ? "is-previewed" : ""}
                                >
                                    <span>
                                        <strong>{guide.title}</strong>
                                        <small>{guide.description}</small>
                                    </span>
                                    <Icon name="arrow" size={22} />
                                </Link>
                            ))}
                        </div>
                        <div className="visit-hover-rail" aria-hidden="true">
                            <div className="visit-hover-preview">
                                {visitGuides.map((guide) => (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        key={guide.id}
                                        src={`/v5/assets/images/${guide.image}`}
                                        alt=""
                                        width={guide.width}
                                        height={guide.height}
                                        loading="lazy"
                                        data-visit-hover-image={guide.id}
                                        data-visit-kind={guide.kind}
                                        className={activeVisitId === guide.id ? "is-active" : ""}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 6. 소식과 참여 (News & Participation) */}
            <section className="home-news container" id="sejong-news" data-home-anchor aria-labelledby="news-heading">
                <div className="section-heading">
                    <div>
                        <p className="home-section-label">새로운 소식</p>
                        <h2 id="news-heading">소식과 참여</h2>
                        <p className="section-description">공지와 티켓오픈, 대관공고 소식.</p>
                    </div>
                    <Link href="/news" className="text-link" id="home-news-all" data-home-anchor>
                        소식 전체 보기 <Icon name="arrow" size={20} />
                    </Link>
                </div>

                <div className="home-news-layout">
                    <div>
                        <div className="home-news-filters" id="home-news-filters" data-home-anchor role="group" aria-label="소식 분류">
                            {newsCategories.map((cat) => (
                                <button
                                    key={cat}
                                    id={`home-news-category-${newsCategoryIds[cat]}`}
                                    data-home-anchor
                                    type="button"
                                    onClick={() => { setAnchorNoticeId(""); setNewsCategory(cat); }}
                                    aria-pressed={newsCategory === cat}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        <div className="news-editorial-list" id="home-news-results" data-home-anchor>
                            {filteredNotices.map((notice) => (
                                <Link key={notice.id} href={`/news/notices/${notice.id}`} id={`home-notice-${notice.id}`} data-home-anchor>
                                    <span className="news-category">{notice.category}</span>
                                    <h3>{notice.title}</h3>
                                    <time dateTime={notice.date}>
                                        {notice.date.replaceAll("-", ".")}
                                    </time>
                                    <Icon name="arrow" size={22} />
                                </Link>
                            ))}
                        </div>
                    </div>

                    <aside className="membership-feature" id="home-membership" data-home-anchor aria-labelledby="membership-heading">
                        <p className="membership-label">세종 멤버십</p>
                        <h3 id="membership-heading">
                            자주 관람한다면,
                            <br />
                            멤버십이 유리합니다.
                        </h3>
                        <p>
                            등급별 예매 할인과 초대 공연 혜택
                            <br />
                            지금 확인해 보세요.
                        </p>
                        <Link className="text-link" href="/news/membership" id="home-membership-details" data-home-anchor>
                            멤버십 알아보기 <Icon name="arrow" size={22} />
                        </Link>
                    </aside>
                </div>

                <nav className="home-participation" id="home-participation" data-home-anchor aria-label="문화예술 참여">
                    <Link href="/news/events" id="home-participation-events" data-home-anchor>
                        <span>
                            <strong>이벤트</strong>
                            <small>진행 중인 이벤트와 당첨자 발표</small>
                        </span>
                        <Icon name="arrow" size={22} />
                    </Link>
                    <Link href="/news/newsletter" id="home-participation-newsletter" data-home-anchor>
                        <span>
                            <strong>뉴스레터 · 세종문화N</strong>
                            <small>공연·전시 소식을 이메일로 받아보세요</small>
                        </span>
                        <Icon name="arrow" size={22} />
                    </Link>
                    <Link href="/about/donation" id="home-participation-donation" data-home-anchor>
                        <span>
                            <strong>문화예술 후원</strong>
                            <small>후원 방법과 참여 안내</small>
                        </span>
                        <Icon name="arrow" size={22} />
                    </Link>
                </nav>
            </section>

            {/* 7. 기관 아이덴티티 및 천지인 섹션 (Identity Section) */}
            <section className="home-identity" id="our-identity" data-home-anchor aria-labelledby="identity-heading">
                <div className="container identity-layout">
                    <div>
                        <h2 id="identity-heading">
                            서울의 중심,
                            <br />
                            예술의 다음.
                        </h2>
                        <p className="identity-description">
                            하늘과 땅, 그리고 사람.
                            <br />
                            서로 다른 우리가 예술로 만나는 곳입니다.
                        </p>
                        <Link className="identity-link" href="/about" id="home-identity-about" data-home-anchor>
                            세종문화회관을 소개합니다 <Icon name="arrow" size={23} />
                        </Link>
                    </div>

                    <Link
                        href="/about/introduction/ci"
                        id="home-identity-marks"
                        data-home-anchor
                        className="identity-composition"
                        aria-label="천지인 색상과 세종문화회관의 아이덴티티 알아보기"
                    >
                        <div className="identity-channel channel-sky" id="home-identity-sky" data-home-anchor>
                            <i />
                            <span>
                                天<span>하늘</span>
                            </span>
                        </div>
                        <div className="identity-channel channel-earth" id="home-identity-earth" data-home-anchor>
                            <i />
                            <span>
                                地<span>땅</span>
                            </span>
                        </div>
                        <div className="identity-channel channel-human" id="home-identity-human" data-home-anchor>
                            <i />
                            <span>
                                人<span>사람</span>
                            </span>
                        </div>
                    </Link>
                </div>

                <nav className="home-institution-links container" id="home-institution" data-home-anchor aria-label="기관 이야기">
                    <Link href="/about/companies" id="home-institution-companies" data-home-anchor>
                        서울시예술단 <Icon name="arrow" size={20} />
                    </Link>
                    <Link href="/about/esg" id="home-institution-esg" data-home-anchor>
                        지속가능한 예술 <Icon name="arrow" size={20} />
                    </Link>
                    <Link href="/about/disclosure" id="home-institution-disclosure" data-home-anchor>
                        정보공개 <Icon name="arrow" size={20} />
                    </Link>
                    <Link href="/about/partners" id="home-institution-partners" data-home-anchor>
                        협력과 협찬 <Icon name="arrow" size={20} />
                    </Link>
                </nav>
            </section>
        </div>
    );
}
