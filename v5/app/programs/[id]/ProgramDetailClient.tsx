"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Program } from "../../../types/sejong.ts";
import Icon from "../../../components/Icon";
import ProgramCard from "../../../components/ProgramCard";
import { showToast } from "../../../components/Toast";
import { PROGRAMS } from "../../../src/data/catalog";

interface ProgramDetailClientProps { program: Program; }

// [작품 정보와 예매 회차 / Program information and booking session]
export default function ProgramDetailClient({ program }: ProgramDetailClientProps) {
    const router = useRouter();
    const times: string[] = Array.isArray(program.times) ? program.times : program.time ? [program.time] : [];
    const [selectedDate, setSelectedDate] = useState(program.start || "");
    const [selectedTime, setSelectedTime] = useState(times[0] || "");
    const [isFavorite, setIsFavorite] = useState(false);
    const imageSource = program.image || program.poster;
    const imagePath = imageSource
        ? /^(https?:)?\/\//.test(imageSource) ? imageSource : `/v5/${imageSource.replace(/^\/?(v5\/)?/, "")}`
        : `/v5/assets/images/poster-${program.id}.svg`;
    const formatDate = (value?: string) => (value || "").replaceAll("-", ".");
    const dateLabel = program.start === program.end || !program.end ? formatDate(program.start) : `${formatDate(program.start)} - ${formatDate(program.end)}`;
    const priceLabel = typeof program.price === "number" ? program.price === 0 ? "무료" : `${program.price.toLocaleString("ko-KR")}원` : program.price || "상세 문의";
    const duration = program.duration || program.runningTime;
    const age = program.age || program.ageLimit || program.target;
    const related = PROGRAMS.filter(item => item.id !== program.id && item.category === program.category).slice(0, 3);

    // [관심 상태 공유와 주소 복사 / Shared favorites and program sharing]
    useEffect(() => {
        const refresh = () => {
            try {
                const favorites: unknown = JSON.parse(localStorage.getItem("sejong-v4:favorites") || "[]");
                setIsFavorite(Array.isArray(favorites) && favorites.includes(program.id));
            } catch { setIsFavorite(false); }
        };
        const storage = (event: StorageEvent) => { if (event.key === "sejong-v4:favorites" || event.key === null) refresh(); };
        refresh();
        window.addEventListener("storage", storage);
        window.addEventListener("sejong:favorites-changed", refresh);
        return () => {
            window.removeEventListener("storage", storage);
            window.removeEventListener("sejong:favorites-changed", refresh);
        };
    }, [program.id]);

    function toggleFavorite() {
        try {
            const value: unknown = JSON.parse(localStorage.getItem("sejong-v4:favorites") || "[]");
            const favorites: string[] = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
            const exists = favorites.includes(program.id);
            localStorage.setItem("sejong-v4:favorites", JSON.stringify(exists ? favorites.filter(id => id !== program.id) : [...favorites, program.id]));
            setIsFavorite(!exists);
            window.dispatchEvent(new Event("sejong:favorites-changed"));
            showToast(exists ? "관심 프로그램에서 삭제했어요." : "관심 프로그램에 저장했어요.");
        } catch { showToast("관심 프로그램을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요."); }
    }

    async function shareProgram() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            showToast("프로그램 주소를 복사했어요.");
        } catch { showToast("주소를 복사하지 못했어요. 주소창의 링크를 복사해 주세요."); }
    }

    function startBooking(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const params = new URLSearchParams();
        if (selectedDate) params.set("date", selectedDate);
        if (selectedTime) params.set("time", selectedTime);
        router.push(`/booking/${program.id}?${params.toString()}`);
    }

    return (
        <div className="program-detail-glass">
            <nav className="discovery-breadcrumbs detail-breadcrumbs" aria-label="현재 위치">
                <Link href="/">홈</Link><Icon name="chevron" size={18} /><Link href="/programs">공연·전시·교육</Link><Icon name="chevron" size={18} /><span aria-current="page">{program.title}</span>
            </nav>

            {/* [포스터와 핵심 정보 / Poster and essential information] */}
            <article className="detail-introduction">
                <div className="detail-poster-column">
                    <div className="detail-poster">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imagePath} alt={`${program.title} 포스터`} width={600} height={800} fetchPriority="high"
                            onError={(event) => { const target = event.currentTarget; if (target.src.includes("/v5/assets/")) target.src = target.src.replace("/v5/assets/", "/assets/"); }} />
                    </div>
                    <div className="detail-poster-actions">
                        <button type="button" aria-pressed={isFavorite} onClick={toggleFavorite}><Icon name="heart" filled={isFavorite} />{isFavorite ? "관심 프로그램에 담았어요" : "관심 프로그램 담기"}</button>
                        <button type="button" onClick={shareProgram} aria-label="프로그램 주소 복사"><Icon name="diagonal" size={22} /><span>공유</span></button>
                    </div>
                </div>

                <div className="detail-information">
                    <div className="detail-classification"><span>{program.category}</span>{program.genre && <span>{program.genre}</span>}{program.status && <span className="detail-status">{program.status}</span>}</div>
                    <h1>{program.title}</h1>
                    <dl className="detail-facts">
                        <div><dt>기간</dt><dd>{dateLabel}</dd></div>
                        <div><dt>장소</dt><dd>{program.venue}<a href="#detail-visit" aria-label="공연장 찾아오는 길"><Icon name="pin" size={21} /></a></dd></div>
                        {duration && <div><dt>관람 시간</dt><dd>{duration}</dd></div>}
                        {age && <div><dt>관람 연령</dt><dd>{age}</dd></div>}
                        <div><dt>관람료</dt><dd className="detail-price">{priceLabel}</dd></div>
                    </dl>

                    {/* [날짜·시간 선택과 예매 연결 / Date and session selection with booking continuity] */}
                    <form className="detail-booking" onSubmit={startBooking}>
                        <div className="detail-booking-heading"><h2>나의 관람 일정</h2><Icon name="calendar" size={24} /></div>
                        <div className="detail-session-fields">
                            <label htmlFor="detail-date">날짜<input id="detail-date" aria-label="날짜" name="date" type="date" value={selectedDate} min={program.start} max={program.end || program.start} required onChange={event => setSelectedDate(event.target.value)} /></label>
                            {times.length > 0 && <label htmlFor="detail-time">시간<select id="detail-time" aria-label="시간" name="time" value={selectedTime} required onChange={event => setSelectedTime(event.target.value)}>{times.map(time => <option key={time} value={time}>{time}</option>)}</select></label>}
                        </div>
                        <button type="submit" className="detail-book-button"><span>{program.category === "교육" ? "수강 신청하기" : "예매하기"}</span><Icon name="arrow" size={24} /></button>
                        <p className="detail-experience-note">리뉴얼 체험용 프로그램입니다. 실제 결제나 티켓 발행은 이루어지지 않습니다.</p>
                    </form>
                    <Link href="/programs/booking-guide" className="detail-booking-guide">예매 전 알아두세요 <Icon name="diagonal" size={20} /></Link>
                </div>
            </article>

            {/* [실제 본문으로 연결되는 안내 탭 / Navigation to program information sections] */}
            <nav className="detail-section-nav" aria-label="프로그램 상세 안내">
                <a href="#detail-about">프로그램 소개</a><a href="#detail-guide">관람 안내</a><a href="#detail-visit">오시는 길</a>
            </nav>
            <div className="detail-content">
                <section id="detail-about" className="detail-content-section">
                    <h2>프로그램 소개</h2>
                    <div><p className="detail-description">{program.description}</p>
                        {Array.isArray(program.highlights) && program.highlights.length > 0 && <ul className="detail-highlights">{program.highlights.map((item: string) => <li key={item}>{item}</li>)}</ul>}
                        {(program.organizer || program.sponsor || program.inquiry) && <dl className="detail-credits">{program.organizer && <div><dt>주최</dt><dd>{program.organizer}</dd></div>}{program.sponsor && <div><dt>후원</dt><dd>{program.sponsor}</dd></div>}{program.inquiry && <div><dt>문의</dt><dd>{program.inquiry}</dd></div>}</dl>}
                    </div>
                </section>
                <section id="detail-guide" className="detail-content-section">
                    <h2>관람 안내</h2>
                    <div className="detail-guidance">
                        <details open><summary>예매와 관람 준비<Icon name="plus" size={22} /></summary><div><p>선택한 날짜와 회차, 관람 연령을 확인해 주세요. 할인 조건과 티켓 수령 방법은 예매 안내에서 확인할 수 있습니다.</p><Link href="/programs/booking-guide">예매 안내 보기 <Icon name="diagonal" size={20} /></Link></div></details>
                        <details><summary>모두를 위한 관람 지원<Icon name="plus" size={22} /></summary><div><p>휠체어석과 이동 동선, 장애인 편의시설을 미리 확인하고 편안하게 방문하세요.</p><Link href="/visit/accessibility">접근성 안내 보기 <Icon name="diagonal" size={20} /></Link></div></details>
                        <details><summary>궁금한 점이 있다면<Icon name="plus" size={22} /></summary><div><p>예매 확인과 취소, 관람에 관한 자주 묻는 질문을 모았습니다.</p><Link href="/visit/support/faq">자주 묻는 질문 <Icon name="diagonal" size={20} /></Link></div></details>
                    </div>
                </section>
                <section id="detail-visit" className="detail-content-section">
                    <h2>오시는 길</h2>
                    <div className="detail-visit"><div><Icon name="pin" size={28} /><div><h3>{program.venue}</h3><p>서울특별시 종로구 세종대로 175</p></div></div><nav aria-label="방문 안내"><Link href="/visit/directions">교통 안내 <Icon name="diagonal" size={20} /></Link><Link href="/visit/directions/parking">주차 안내 <Icon name="diagonal" size={20} /></Link><Link href="/visit/spaces">공간 둘러보기 <Icon name="diagonal" size={20} /></Link></nav></div>
                </section>
            </div>

            {/* [같은 분야의 다음 작품 / More programs in the same category] */}
            {related.length > 0 && <section className="detail-related"><div className="detail-related-heading"><h2>이런 만남도 있어요</h2><Link href={`/programs?category=${encodeURIComponent(program.category || "전체")}`}>전체 보기 <Icon name="arrow" size={22} /></Link></div><div className="detail-related-grid">{related.map(item => <ProgramCard key={item.id} program={item} />)}</div></section>}
            <Link href="/programs" className="detail-back"><Icon name="back" size={22} />프로그램 목록으로</Link>
        </div>
    );
}
