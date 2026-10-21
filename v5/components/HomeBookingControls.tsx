"use client";

import Icon from "./Icon";
import { SystemButton, SystemIconButton } from "./SystemPrimitives";
import { monthDates, moveMonth, programsForDate } from "../src/features/home-domain";
import { mediaPath } from "../src/lib/media";
import type { Program } from "../types/sejong";

export type BookingCalendarProps = {
    month: string;
    selectedDate: string;
    today: string;
    programs: readonly Program[];
    dateLabel: (date: string) => string;
    onMonthChange: (month: string) => void;
    onDateChange: (date: string) => void;
};

// [일곱 열을 유지하는 달력 / A calendar retaining its seven-column spatial layout]
// 날짜 셀은 좁은 화면의 공간 관계를 보존하는 등록된 특수 조작입니다.
// Date cells are registered spatial controls, preserving the narrow-screen grid.
export function BookingCalendar({ month, selectedDate, today, programs, dateLabel, onMonthChange, onDateChange }: BookingCalendarProps) {
    return (
        <div className="quick-calendar" id="home-booking-calendar" data-home-anchor data-component="BookingCalendar">
            <div className="quick-calendar-heading">
                <h3 id="quick-month" aria-live="polite">{month.replace("-", ". ")}</h3>
                <div className="quick-month-controls">
                    <SystemIconButton id="home-booking-previous-month" onClick={() => onMonthChange(moveMonth(month, -1))} aria-label="이전 달"><Icon name="back" size={20} /></SystemIconButton>
                    <SystemButton variant="quiet" id="home-booking-today" onClick={() => { onMonthChange(today.slice(0, 7)); onDateChange(today); }}>오늘</SystemButton>
                    <SystemIconButton id="home-booking-next-month" onClick={() => onMonthChange(moveMonth(month, 1))} aria-label="다음 달"><Icon name="arrow" size={20} /></SystemIconButton>
                </div>
            </div>
            <div className="quick-calendar-week" aria-hidden="true">{["일", "월", "화", "수", "목", "금", "토"].map(day => <span key={day}>{day}</span>)}</div>
            <div className="quick-calendar-grid" role="group" aria-labelledby="quick-month">
                {monthDates(month).map((date, index) => {
                    if (!date) return <span key={`blank-${index}`} className="quick-calendar-blank" aria-hidden="true" />;
                    const count = programsForDate([...programs], date).length;
                    const current = date === today;
                    const selected = date === selectedDate;
                    return (
                        <button
                            key={date}
                            id={`home-booking-date-${date}`}
                            data-home-anchor
                            data-system-part="calendar-day"
                            type="button"
                            onClick={() => onDateChange(date)}
                            aria-label={`${dateLabel(date)}${current ? ", 오늘" : ""}, ${count ? `${count}개 프로그램` : "등록된 일정 없음"}`}
                            aria-pressed={selected}
                            aria-current={current ? "date" : undefined}
                            className={`quick-date${selected ? " is-selected" : ""}${current ? " is-today" : ""}`}
                        >
                            <span>{Number(date.slice(-2))}</span>{count > 0 && <i aria-hidden="true" />}
                        </button>
                    );
                })}
            </div>
            <p className="quick-calendar-key"><i aria-hidden="true" />프로그램이 있는 날</p>
        </div>
    );
}

// [포스터를 포함한 선택 타일 / Rich selection tile with a program poster]
export function BookingProgramChoice({ program, selected, available, past, onSelect }: {
    program: Program; selected: boolean; available: boolean; past: boolean; onSelect: () => void;
}) {
    return (
        <button
            id={`home-booking-program-${program.id}`}
            data-home-anchor
            data-component="BookingProgramChoice"
            data-system-part="program-choice"
            type="button"
            className={`quick-program${selected ? " is-selected" : ""}`}
            onClick={onSelect}
            aria-pressed={selected}
            disabled={!available}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaPath(program.image)} alt="" width="90" height="120" loading="lazy" onError={event => {
                if (event.currentTarget.dataset.fallback) return;
                event.currentTarget.dataset.fallback = "true";
                event.currentTarget.src = mediaPath();
            }} />
            <span className="quick-program-copy">
                <span className="quick-program-category">{program.category} · {available ? program.status : past ? "지난 일정" : program.status}</span>
                <strong>{program.title}</strong><span>{program.venue}</span><span>{program.times?.join(" · ")}</span>
            </span>
            <span className="quick-program-check" aria-hidden="true">{selected ? "✓" : "+"}</span>
        </button>
    );
}
