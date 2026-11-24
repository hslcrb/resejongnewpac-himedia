"use client";
import { useCatalog } from "../src/catalog/CatalogProvider";

import { memo, useEffect, useState } from "react";
import Icon from "./Icon";
import LiquidGlass from "./LiquidGlass";
import {
    openingDateLabel,
    openingDayLabel,
    seoulClock,
    upcomingTicketOpenings,
} from "../src/lib/ticket-openings";

// [작품 옆의 예매 정보 / Booking information beside the featured work]
// 실시간 시계와 게시된 오픈 일정을 외부 이동 없이 표시합니다.
// Display the live clock and published opening dates without outbound navigation.
function HeroCompanion() {
    const { catalog } = useCatalog();
    const TICKET_OPENINGS = catalog.ticketOpenings;
    const [now, setNow] = useState<number | null>(null);
    useEffect(() => {
        let timer: ReturnType<typeof setInterval> | undefined;
        const refresh = () => setNow(Date.now());
        const resume = () => {
            clearInterval(timer);
            if (!document.hidden) {
                refresh();
                timer = setInterval(refresh, 1000);
            }
        };
        resume();
        document.addEventListener("visibilitychange", resume);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", resume);
        };
    }, []);

    const next = now === null ? null : upcomingTicketOpenings(TICKET_OPENINGS, now)[0];
    const calendarDate =
        now === null
            ? "서울 기준"
            : new Intl.DateTimeFormat("ko-KR", {
                  timeZone: "Asia/Seoul",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
              }).format(now);

    return (
        <aside
            data-component-id="hero-companion"
            className="hero-companion"
            aria-label="티켓오픈과 현재 시각"
        >
            <section className="hero-release-list" aria-labelledby="hero-release-heading">
                <div className="hero-companion-heading">
                    <h2 data-text="heading" id="hero-release-heading">
                        티켓오픈
                    </h2>
                </div>
                <ul>
                    {TICKET_OPENINGS.map((item) => (
                        <li data-text="body" key={item.id}>
                            <div data-text="body" className="hero-release-entry">
                                <strong data-text="item-title">{item.title}</strong>
                                <span className="hero-release-meta">
                                    <time data-text="meta" dateTime={item.opensAt}>
                                        {openingDateLabel(item.opensAt)}
                                    </time>
                                    <span data-text="body">
                                        {now === null
                                            ? "오픈 안내"
                                            : openingDayLabel(item.opensAt, now)}
                                    </span>
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            <LiquidGlass className="hero-time-glass" variant="hero">
                <div className="hero-clock-heading">
                    <span data-text="body">현재 시각 · 서울</span>
                    <Icon name="clock" size={22} />
                </div>
                <time
                    data-text="meta"
                    className="hero-clock"
                    dateTime={now === null ? undefined : new Date(now).toISOString()}
                    aria-label={
                        now === null ? "현재 시각 확인 중" : `서울 현재 시각 ${seoulClock(now)}`
                    }
                >
                    {now === null ? "--:--:--" : seoulClock(now)}
                </time>
                <p data-text="caption" className="hero-clock-date">
                    {calendarDate}
                </p>
                <div data-text="body" className="hero-next-release">
                    <p data-text="body">
                        {"다음 티켓오픈 "}
                        <span data-text="body">
                            {next && now !== null ? openingDayLabel(next.opensAt, now) : ""}
                        </span>
                    </p>
                    {next ? (
                        <div data-text="body" className="hero-next-release-content">
                            <time data-text="meta" dateTime={next.opensAt}>
                                {openingDateLabel(next.opensAt)}
                            </time>
                            <span data-text="body">{next.title}</span>
                        </div>
                    ) : (
                        <div data-text="body" className="hero-next-release-content">
                            <strong data-text="item-title">
                                {now === null ? "일정 확인 중" : "예정된 티켓오픈이 없습니다"}
                            </strong>
                        </div>
                    )}
                </div>
            </LiquidGlass>
        </aside>
    );
}

export default memo(HeroCompanion);
