"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Program } from "../../../types/sejong.ts";
import { showToast } from "../../../components/Toast";
import { SystemButton, SystemField, SystemLink, SystemNotice } from "../../../components/SystemPrimitives";
import SystemSurface from "../../../components/SystemSurface";
import { createMemberBooking } from "../../../src/lib/account-db.ts";
import type { AccountBooking } from "../../../src/lib/account-space.ts";
import useAccountIdentity from "../../../components/useAccountIdentity";

interface BookingClientProps {
    program: Program;
}

// [선택한 내용과 회원 DB 저장 / Booking selection and authenticated database persistence]
export default function BookingClient({ program }: BookingClientProps) {
    const identity = useAccountIdentity();
    const activeIdentity = useRef(identity.identityId);
    activeIdentity.current = identity.identityId;
    const [step, setStep] = useState<number>(1);
    const [selectedDate, setSelectedDate] = useState<string>(program?.start || "2026-05-01");
    const [selectedTime, setSelectedTime] = useState<string>("19:30");
    const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
    const [completed, setCompleted] = useState<AccountBooking | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const bookingAttempts = useRef(new Map<string, string>());

    useEffect(() => {
        setCompleted(null);
        setSaveError("");
        setSelectedSeats([]);
        setStep(1);
        bookingAttempts.current.clear();
    }, [identity.identityId]);

    const pricePerSeat = 70000;
    const totalAmount = selectedSeats.length * pricePerSeat;
    const seatsGrid = [
        ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"],
        ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"],
        ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"],
        ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"],
        ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"],
    ];

    const toggleSeat = (seat: string) => {
        if (selectedSeats.includes(seat)) {
            setSelectedSeats(selectedSeats.filter((item) => item !== seat));
        } else {
            if (selectedSeats.length >= 4) {
                showToast("최대 4매까지 선택 가능합니다.");
                return;
            }
            setSelectedSeats([...selectedSeats, seat]);
        }
    };

    const handleCompleteBooking = async () => {
        if (saving || !selectedSeats.length) return;
        if (!identity.isLoggedIn) { setSaveError("로그인한 뒤 예매 내용을 저장해 주세요."); return; }
        const owner = identity.identityId;
        setSaving(true);
        setSaveError("");
        try {
            // 같은 선택을 재시도하면 같은 키를 사용 / Reuse the request key only for the same booking draft.
            const draftKey = JSON.stringify([owner, program.id, selectedDate, selectedTime, [...selectedSeats].sort(), totalAmount]);
            const bookingId = bookingAttempts.current.get(draftKey) || crypto.randomUUID();
            bookingAttempts.current.set(draftKey, bookingId);
            const newBooking = {
                id: bookingId,
                programId: program.id,
                title: program.title,
                date: selectedDate,
                time: selectedTime,
                venue: program.venue,
                seats: selectedSeats,
                total: totalAmount,
                reference: bookingId,
                createdAt: new Date().toISOString(),
            };
            const saved = await createMemberBooking(newBooking, owner);
            if (activeIdentity.current !== owner) return;
            setCompleted(saved);
            showToast("예매 내용을 저장했습니다.");
        } catch (error) { if (activeIdentity.current === owner) setSaveError(error instanceof Error ? error.message : "예매 내용을 저장하지 못했습니다."); }
        finally { setSaving(false); }
    };

    // [넓은 페이지와 내용에 맞춘 예매 단계 / A wide frame with intrinsic booking steps]
    return (
        <div className="container page-layout booking-page">
            <nav className="page-layout-breadcrumbs" aria-label="현재 위치">
                <Link data-text="action" href="/">홈</Link>
                <span data-text="body" aria-hidden="true">/</span>
                <Link data-text="action" href={`/programs/${program.id}`}>{program.title}</Link>
                <span data-text="body" aria-hidden="true">/</span>
                <span data-text="body" aria-current="page">예매</span>
            </nav>

            <header className="page-layout-heading">
                <div className="page-layout-actions">
                    <span data-text="body">{program.venue}</span>
                </div>
                <h1 data-text="title">{program.title}</h1>
            </header>

            <div data-text="body" className="booking-page-content">
                {saveError && <SystemNotice data-text="body" error title="예매 내용을 저장하지 못했습니다">{saveError}<SystemLink data-text="action" variant="quiet" href="/account/login/">로그인하기</SystemLink></SystemNotice>}
                <ol className="booking-page-steps" aria-label="예매 진행 단계">
                    {[
                        { num: 1, label: "회차 선택" },
                        { num: 2, label: "좌석 선택" },
                        { num: 3, label: "내용 확인" },
                    ].map((item) => (
                        <li data-text="body" key={item.num} aria-current={step === item.num ? "step" : undefined}>
                            <span data-text="body" aria-hidden="true">{item.num}</span>
                            {item.label}
                        </li>
                    ))}
                </ol>

                {!completed ? (
                    <div data-text="body">
                        {step === 1 && (
                            <SystemSurface as="section" padding="lg" className="booking-page-panel" aria-labelledby="booking-date-heading">
                                <h2 data-text="heading" id="booking-date-heading">관람 일시 선택</h2>
                                <div className="booking-page-fields">
                                    <SystemField data-text="body"
                                        variant="flow"
                                        id="booking-date"
                                        label="관람 날짜"
                                        type="date"
                                        value={selectedDate}
                                        onChange={(event) => setSelectedDate(event.target.value)}
                                    />
                                    <SystemField data-text="body"
                                        as="select"
                                        variant="flow"
                                        id="booking-time"
                                        label="회차 시간"
                                        value={selectedTime}
                                        onChange={(event) => setSelectedTime(event.target.value)}
                                    >
                                        <option data-text="label" value="15:00">1회차 (15:00)</option>
                                        <option data-text="label" value="19:30">2회차 (19:30)</option>
                                    </SystemField>
                                </div>
                                <div className="page-layout-actions booking-page-actions">
                                    <SystemButton data-text="action" context="flow" onClick={() => setStep(2)}>
                                        다음: 좌석 선택하기 →
                                    </SystemButton>
                                </div>
                            </SystemSurface>
                        )}

                        {/* [좌석 크기를 유지하는 내부 스크롤 / Internal scrolling preserves seat targets] */}
                        {step === 2 && (
                            <SystemSurface as="section" padding="lg" className="booking-page-panel" aria-labelledby="booking-seat-heading">
                                <div className="booking-page-section-heading">
                                    <h2 data-text="heading" id="booking-seat-heading">좌석 선택 (최대 4매)</h2>
                                    <p data-text="body" role="status">선택한 좌석: {selectedSeats.length > 0 ? selectedSeats.join(", ") : "없음"}</p>
                                </div>
                                <p data-text="body" className="booking-page-seat-help" id="booking-seat-help">좌석도를 좌우로 움직여 전체 좌석을 확인할 수 있어요.</p>
                                <div className="booking-page-seat-scroll" role="region" aria-label="좌석 배치도" aria-describedby="booking-seat-help" tabIndex={0}>
                                    <div className="booking-page-seat-canvas">
                                        <div data-text="body" className="booking-page-stage">STAGE (무대)</div>
                                        <div data-text="body" className="booking-page-seat-rows">
                                            {seatsGrid.map((row, rowIndex) => (
                                                <div data-text="body" className="booking-page-seat-row" key={rowIndex}>
                                                    {row.map((seat) => (
                                                        <button data-text="action"
                                                            className="booking-page-seat"
                                                            key={seat}
                                                            type="button"
                                                            data-system-part="seat"
                                                            aria-label={`${seat} 좌석`}
                                                            aria-pressed={selectedSeats.includes(seat)}
                                                            onClick={() => toggleSeat(seat)}
                                                        >
                                                            {seat}
                                                        </button>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="page-layout-actions booking-page-actions">
                                    <SystemButton data-text="action" context="flow" variant="secondary" onClick={() => setStep(1)}>이전</SystemButton>
                                    <SystemButton data-text="action" context="flow" disabled={selectedSeats.length === 0} onClick={() => setStep(3)}>
                                        선택 내용 확인
                                    </SystemButton>
                                </div>
                            </SystemSurface>
                        )}

                        {step === 3 && (
                            <SystemSurface as="section" padding="lg" className="booking-page-panel" aria-labelledby="booking-review-heading">
                                <h2 data-text="heading" id="booking-review-heading">예매 내용 확인</h2>
                                <dl className="page-layout-facts booking-page-review">
                                    <dt data-text="label">프로그램</dt><dd data-text="body">{program.title}</dd>
                                    <dt data-text="label">일시</dt><dd data-text="body">{selectedDate} {selectedTime}</dd>
                                    <dt data-text="label">장소</dt><dd data-text="body">{program.venue}</dd>
                                    <dt data-text="label">선택 좌석</dt><dd data-text="body">{selectedSeats.join(", ")} ({selectedSeats.length}매)</dd>
                                    <dt data-text="label" className="booking-page-total">선택한 티켓 금액</dt>
                                    <dd data-text="body" className="booking-page-total"><strong data-text="item-title">{totalAmount.toLocaleString()}원</strong></dd>
                                </dl>
                                <div className="page-layout-actions booking-page-actions">
                                    <SystemButton data-text="action" context="flow" variant="secondary" disabled={saving} onClick={() => setStep(2)}>좌석 다시 선택</SystemButton>
                                    <SystemButton data-text="action" context="flow" disabled={saving} onClick={handleCompleteBooking}>{saving ? "저장 중…" : "예매 기록 저장"}</SystemButton>
                                </div>
                            </SystemSurface>
                        )}
                    </div>
                ) : (
                    <SystemSurface as="section" padding="lg" className="booking-page-panel booking-page-complete" aria-labelledby="booking-complete-heading">
                        <h2 data-text="heading" id="booking-complete-heading">예매 내용을 저장했습니다.</h2>
                        <p data-text="body">저장한 일정과 좌석은 마이페이지의 예매 기록에서 확인할 수 있습니다.</p>
                        <p data-text="body" className="booking-page-saved-selection">{completed.date} {completed.time} · {completed.seats.join(", ")} · {completed.total.toLocaleString()}원</p>
                        <div className="page-layout-actions">
                            <SystemLink data-text="action" context="flow" href="/account">예매 내역 확인하기 →</SystemLink>
                            <SystemLink data-text="action" context="flow" variant="secondary" href="/programs">다른 프로그램 둘러보기</SystemLink>
                        </div>
                    </SystemSurface>
                )}
            </div>
        </div>
    );
}
