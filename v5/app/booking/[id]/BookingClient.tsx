"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Program } from "../../../types/sejong.ts";
import { showToast } from "../../../components/Toast";
import { SystemButton, SystemField, SystemLink } from "../../../components/SystemPrimitives";

interface BookingClientProps {
    program: Program;
}

// [기존 예매 상태와 브라우저 저장 / Existing booking state and browser persistence]
export default function BookingClient({ program }: BookingClientProps) {
    const [step, setStep] = useState<number>(1);
    const [selectedDate, setSelectedDate] = useState<string>(program?.start || "2026-05-01");
    const [selectedTime, setSelectedTime] = useState<string>("19:30");
    const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
    const [completed, setCompleted] = useState<boolean>(false);

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

    const handleCompleteBooking = () => {
        try {
            const raw = localStorage.getItem("sejong-v4:bookings");
            const bookings = raw ? JSON.parse(raw) : [];
            const newBooking = {
                id: "BKG-" + Date.now().toString(36).toUpperCase(),
                programId: program.id,
                title: program.title,
                date: selectedDate,
                time: selectedTime,
                venue: program.venue,
                seats: selectedSeats,
                total: totalAmount,
                createdAt: new Date().toISOString(),
            };
            localStorage.setItem("sejong-v4:bookings", JSON.stringify([...bookings, newBooking]));
            setCompleted(true);
            showToast("예매 내용을 저장했습니다.");
        } catch {
            showToast("예매 저장 중 오류가 발생했습니다.");
        }
    };

    // [넓은 페이지와 내용에 맞춘 예매 단계 / A wide frame with intrinsic booking steps]
    return (
        <div className="container page-layout booking-page">
            <nav className="page-layout-breadcrumbs" aria-label="현재 위치">
                <Link href="/">홈</Link>
                <span aria-hidden="true">/</span>
                <Link href={`/programs/${program.id}`}>{program.title}</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">예매</span>
            </nav>

            <header className="page-layout-heading">
                <div className="page-layout-actions">
                    <span>{program.venue}</span>
                </div>
                <h1>{program.title}</h1>
            </header>

            <div className="booking-page-content">
                <ol className="booking-page-steps" aria-label="예매 진행 단계">
                    {[
                        { num: 1, label: "회차 선택" },
                        { num: 2, label: "좌석 선택" },
                        { num: 3, label: "내용 확인" },
                    ].map((item) => (
                        <li key={item.num} aria-current={step === item.num ? "step" : undefined}>
                            <span aria-hidden="true">{item.num}</span>
                            {item.label}
                        </li>
                    ))}
                </ol>

                {!completed ? (
                    <div>
                        {step === 1 && (
                            <section className="booking-page-panel" aria-labelledby="booking-date-heading">
                                <h2 id="booking-date-heading">관람 일시 선택</h2>
                                <div className="booking-page-fields">
                                    <SystemField
                                        variant="flow"
                                        id="booking-date"
                                        label="관람 날짜"
                                        type="date"
                                        value={selectedDate}
                                        onChange={(event) => setSelectedDate(event.target.value)}
                                    />
                                    <SystemField
                                        as="select"
                                        variant="flow"
                                        id="booking-time"
                                        label="회차 시간"
                                        value={selectedTime}
                                        onChange={(event) => setSelectedTime(event.target.value)}
                                    >
                                        <option value="15:00">1회차 (15:00)</option>
                                        <option value="19:30">2회차 (19:30)</option>
                                    </SystemField>
                                </div>
                                <div className="page-layout-actions booking-page-actions">
                                    <SystemButton context="flow" onClick={() => setStep(2)}>
                                        다음: 좌석 선택하기 →
                                    </SystemButton>
                                </div>
                            </section>
                        )}

                        {/* [좌석 크기를 유지하는 내부 스크롤 / Internal scrolling preserves seat targets] */}
                        {step === 2 && (
                            <section className="booking-page-panel" aria-labelledby="booking-seat-heading">
                                <div className="booking-page-section-heading">
                                    <h2 id="booking-seat-heading">좌석 선택 (최대 4매)</h2>
                                    <p role="status">선택한 좌석: {selectedSeats.length > 0 ? selectedSeats.join(", ") : "없음"}</p>
                                </div>
                                <p className="booking-page-seat-help" id="booking-seat-help">좌석도를 좌우로 움직여 전체 좌석을 확인할 수 있어요.</p>
                                <div className="booking-page-seat-scroll" role="region" aria-label="좌석 배치도" aria-describedby="booking-seat-help" tabIndex={0}>
                                    <div className="booking-page-seat-canvas">
                                        <div className="booking-page-stage">STAGE (무대)</div>
                                        <div className="booking-page-seat-rows">
                                            {seatsGrid.map((row, rowIndex) => (
                                                <div className="booking-page-seat-row" key={rowIndex}>
                                                    {row.map((seat) => (
                                                        <button
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
                                    <SystemButton context="flow" variant="secondary" onClick={() => setStep(1)}>이전</SystemButton>
                                    <SystemButton context="flow" disabled={selectedSeats.length === 0} onClick={() => setStep(3)}>
                                        선택 내용 확인
                                    </SystemButton>
                                </div>
                            </section>
                        )}

                        {step === 3 && (
                            <section className="booking-page-panel" aria-labelledby="booking-review-heading">
                                <h2 id="booking-review-heading">예매 내용 확인</h2>
                                <dl className="page-layout-facts booking-page-review">
                                    <dt>프로그램</dt><dd>{program.title}</dd>
                                    <dt>일시</dt><dd>{selectedDate} {selectedTime}</dd>
                                    <dt>장소</dt><dd>{program.venue}</dd>
                                    <dt>선택 좌석</dt><dd>{selectedSeats.join(", ")} ({selectedSeats.length}매)</dd>
                                    <dt className="booking-page-total">선택한 티켓 금액</dt>
                                    <dd className="booking-page-total"><strong>{totalAmount.toLocaleString()}원</strong></dd>
                                </dl>
                                <div className="page-layout-actions booking-page-actions">
                                    <SystemButton context="flow" variant="secondary" onClick={() => setStep(2)}>좌석 다시 선택</SystemButton>
                                    <SystemButton context="flow" onClick={handleCompleteBooking}>예매 기록 저장</SystemButton>
                                </div>
                            </section>
                        )}
                    </div>
                ) : (
                    <section className="booking-page-panel booking-page-complete" aria-labelledby="booking-complete-heading">
                        <h2 id="booking-complete-heading">예매 내용을 저장했습니다.</h2>
                        <p>저장한 일정과 좌석은 마이페이지의 예매 기록에서 확인할 수 있습니다.</p>
                        <div className="page-layout-actions">
                            <SystemLink context="flow" href="/account">예매 내역 확인하기 →</SystemLink>
                            <SystemLink context="flow" variant="secondary" href="/programs">다른 프로그램 둘러보기</SystemLink>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
