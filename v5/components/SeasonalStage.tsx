"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";

export interface StageFeature {
    id: string;
    label: string;
    name: string;
    date: string;
    venue: string;
    image: string;
    alt: string;
    href?: string;
}

// [무대 위 유리 프로그램 창 / Glass programme window on the stage]
// 수동 선택, 스와이프, 키보드와 재생 제어가 동일한 슬라이드 상태를 공유합니다.
// Pointer, keyboard, direct selection and playback share one slide state.
export default function SeasonalStage({ features, active, onSelect }: {
    features: StageFeature[];
    active: number;
    onSelect: (index: number) => void;
}) {
    const [paused, setPaused] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [visible, setVisible] = useState(true);
    const [reduced, setReduced] = useState(true);
    const [announcement, setAnnouncement] = useState("");
    const stage = useRef<HTMLElement>(null);
    const start = useRef<{ x: number; y: number } | null>(null);
    const swiped = useRef(false);
    const inViewport = useRef(true);
    const feature = features[active];
    const playing = !paused && !hovered && !focused && visible && !reduced;

    useEffect(() => {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const preference = () => setReduced(query.matches);
        const visibility = () => setVisible(inViewport.current && !document.hidden);
        preference();
        if (window.location.hash.startsWith("#home-feature-")) setPaused(true);
        query.addEventListener("change", preference);
        document.addEventListener("visibilitychange", visibility);
        const observer = new IntersectionObserver(([entry]) => {
            inViewport.current = entry.isIntersecting;
            setVisible(entry.isIntersecting && !document.hidden);
        }, { threshold: 0.2 });
        if (stage.current) observer.observe(stage.current);
        return () => {
            observer.disconnect();
            query.removeEventListener("change", preference);
            document.removeEventListener("visibilitychange", visibility);
        };
    }, []);

    useEffect(() => {
        if (!playing) return;
        const timer = window.setTimeout(() => onSelect((active + 1) % features.length), 6500);
        return () => window.clearTimeout(timer);
    }, [active, features.length, onSelect, playing]);

    const select = (index: number) => {
        const next = (index + features.length) % features.length;
        onSelect(next);
        setPaused(true);
        setAnnouncement(`${next + 1} / ${features.length}, ${features[next].name}`);
    };

    return (
        <section className="stage-experience" id="featured-season" data-home-anchor ref={stage} aria-label="세종문화회관과 주요 프로그램">
            <img className="stage-backdrop" src="/v5/assets/images/sejong-grand-auditorium.png" alt="세종대극장의 붉은 객석과 따뜻하게 빛나는 천장" width={1160} height={680} fetchPriority="high" />
            <div className="stage-shade" />
            <div className="stage-introduction">
                <p className="stage-location">세종문화회관</p>
                <h1>당신의 하루에,<br /><span>예술 한 장면.</span></h1>
                <p className="stage-description">어떤 날은 한 편의 공연이<br />오래도록 마음에 남으니까.</p>
                <a className="stage-primary" href="#discover-programs">나의 다음 공연 찾기 <Icon name="diagonal" size={24} /></a>
            </div>

            <div className="stage-programme" aria-roledescription="캐러셀" aria-label="주요 프로그램"
                onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
                onFocusCapture={() => setFocused(true)}
                onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
                onKeyDown={(event) => {
                    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                        event.preventDefault();
                        select(active + (event.key === "ArrowRight" ? 1 : -1));
                    }
                }}
                onClickCapture={(event) => { if (swiped.current) { event.preventDefault(); event.stopPropagation(); swiped.current = false; } }}
                onPointerDown={(event) => { swiped.current = false; start.current = { x: event.clientX, y: event.clientY }; }}
                onPointerUp={(event) => {
                    if (!start.current) return;
                    const dx = event.clientX - start.current.x;
                    const dy = event.clientY - start.current.y;
                    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped.current = true; select(active + (dx < 0 ? 1 : -1)); }
                    start.current = null;
                }}
                onPointerCancel={() => { start.current = null; }}>
                <div className="stage-programme-heading"><span>지금, 세종에서</span><Link href="/programs/season" aria-label="기획·시즌 프로그램 전체 보기"><Icon name="diagonal" size={23} /></Link></div>
                <article className="stage-feature season-slide is-active" id={`home-feature-${feature.id}`} data-home-anchor data-feature={feature.id}>
                    <Link href={feature.href || `/programs/${feature.id}`} target={feature.href ? "_blank" : undefined} rel={feature.href ? "noopener noreferrer" : undefined} className="stage-feature-image" draggable={false} aria-label={`${feature.name} ${feature.href ? "공식 공연 안내 (새 창)" : "자세히 보기"}`}>
                        <img key={feature.id} src={`/v5/assets/images/${feature.image}`} alt={feature.alt} width={450} height={280} draggable={false} />
                        <span><Icon name="diagonal" size={23} /></span>
                    </Link>
                    <div className="stage-feature-copy">
                        <p>{feature.label}</p>
                        <h2><Link href={feature.href || `/programs/${feature.id}`} target={feature.href ? "_blank" : undefined} rel={feature.href ? "noopener noreferrer" : undefined}>{feature.name}{feature.href && <span className="sr-only"> 공식 공연 안내 (새 창)</span>}</Link></h2>
                        <span>{feature.date}</span><span>{feature.venue}</span>
                    </div>
                </article>
                <div className="stage-controls" id="home-feature-controls" data-home-anchor role="group" aria-label="주요 프로그램 제어">
                    <span className="stage-count"><b>{String(active + 1).padStart(2, "0")}</b><span> / {String(features.length).padStart(2, "0")}</span></span>
                    <div className="stage-segments">{features.map((item, index) => <button key={item.id} type="button" className={index === active ? "is-active" : ""} aria-label={`${item.name} 보기`} aria-pressed={index === active} onClick={() => select(index)}><i key={`${active}-${playing}`} className={playing && index === active ? "is-playing" : ""} /></button>)}</div>
                    <button id="home-feature-previous" type="button" onClick={() => select(active - 1)} aria-label="이전 프로그램"><Icon name="back" size={21} /></button>
                    <button id="home-feature-next" type="button" onClick={() => select(active + 1)} aria-label="다음 프로그램"><Icon name="arrow" size={21} /></button>
                    <button id="home-feature-playback" type="button" onClick={() => {
                        if (paused || reduced) { setPaused(false); setReduced(false); }
                        else setPaused(true);
                    }} aria-label={paused || reduced ? "자동 재생 시작" : "자동 재생 일시정지"} aria-pressed={paused || reduced}><Icon name={paused || reduced ? "play" : "pause"} size={21} /></button>
                </div>
                <span className="sr-only" aria-live="polite">{announcement}</span>
            </div>

            <nav className="stage-dock" aria-label="빠른 서비스">
                <a href="#quick-booking"><Icon name="calendar" size={22} /><span>날짜로 찾기</span></a>
                <Link href="/account/bookings"><Icon name="ticket" size={22} /><span>예매 확인</span></Link>
                <Link href="/visit/directions"><Icon name="pin" size={22} /><span>오시는 길</span></Link>
                <Link href="/services"><Icon name="menu" size={22} /><span>이용 안내</span></Link>
            </nav>
            <a href="#discover-programs" className="stage-scroll" aria-label="프로그램 영역으로 이동"><span>아래로 둘러보기</span><Icon name="arrow" size={20} /></a>
        </section>
    );
}
