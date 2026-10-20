"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Program } from "../../../types/sejong.ts";
import { showToast } from "../../../components/Toast";

interface BookingClientProps {
    program: Program;
}

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
            setSelectedSeats(selectedSeats.filter((s) => s !== seat));
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
            showToast("예매가 성공적으로 완료되었습니다!");
        } catch {
            showToast("예매 저장 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="container" style={{ padding: "3rem 1.5rem 6rem", maxWidth: "900px", margin: "0 auto" }}>
            <nav className="breadcrumbs" aria-label="현재 위치" style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>홈</Link>
                <span>/</span>
                <Link href={`/programs/${program.id}`} style={{ textDecoration: "none", color: "inherit" }}>{program.title}</Link>
                <span>/</span>
                <span aria-current="page" style={{ fontWeight: 600, color: "var(--text-primary)" }}>온라인 예매</span>
            </nav>

            <header style={{ marginBottom: "2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.8rem", padding: "3px 10px", background: "var(--accent-information)", color: "var(--text-on-brand)", borderRadius: "9999px", fontWeight: 700 }}>
                        ONLINE BOOKING
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{program.venue}</span>
                </div>
                <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.03em" }}>
                    {program.title}
                </h1>
            </header>

            {/* 단계 표시 인디케이터 */}
            <ol className="flow-steps" style={{ display: "flex", listStyle: "none", padding: 0, margin: "0 0 2rem 0", gap: "1rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "1rem" }}>
                {[
                    { num: 1, label: "회차 선택" },
                    { num: 2, label: "좌석 선택" },
                    { num: 3, label: "결제 및 확인" },
                ].map((s) => (
                    <li
                        key={s.num}
                        style={{
                            fontWeight: step === s.num ? 700 : 500,
                            color: step === s.num ? "var(--text-primary)" : "var(--text-secondary)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: "0.95rem",
                        }}
                    >
                        <span
                            style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                background: step === s.num ? "var(--action-primary)" : "var(--surface-subtle)",
                                color: step === s.num ? "var(--text-inverse)" : "var(--text-secondary)",
                                border: step === s.num ? "none" : "1px solid var(--border-default)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.8rem",
                            }}
                        >
                            {s.num}
                        </span>
                        {s.label}
                    </li>
                ))}
            </ol>

            {/* 단계별 콘텐츠 */}
            {!completed ? (
                <div>
                    {step === 1 && (
                        <div style={{ background: "var(--surface-default)", border: "1px solid var(--border-default)", borderRadius: "12px", padding: "2rem" }}>
                            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 1rem 0" }}>관람 일시 선택</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>관람 날짜</label>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border-strong)", borderRadius: "6px", background: "var(--surface-default)", color: "var(--text-primary)" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>회차 시간</label>
                                    <select
                                        value={selectedTime}
                                        onChange={(e) => setSelectedTime(e.target.value)}
                                        style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border-strong)", borderRadius: "6px", background: "var(--surface-default)", color: "var(--text-primary)" }}
                                    >
                                        <option value="15:00">1회차 (15:00)</option>
                                        <option value="19:30">2회차 (19:30)</option>
                                    </select>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                style={{
                                    width: "100%",
                                    padding: "0.85rem",
                                    fontSize: "1rem",
                                    fontWeight: 700,
                                    background: "var(--action-primary)",
                                    color: "var(--text-inverse)",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                }}
                            >
                                다음: 좌석 선택하기 →
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div style={{ background: "var(--surface-default)", border: "1px solid var(--border-default)", borderRadius: "12px", padding: "2rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>좌석 선택 (최대 4매)</h3>
                                <span style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 600 }}>
                                    선택한 좌석: {selectedSeats.length > 0 ? selectedSeats.join(", ") : "없음"}
                                </span>
                            </div>

                            {/* 무대 영역 */}
                            <div style={{ textAlign: "center", padding: "0.75rem", background: "var(--surface-subtle)", border: "1px solid var(--border-default)", borderRadius: "6px", fontWeight: 700, color: "var(--text-secondary)", margin: "0 auto 2rem", maxWidth: "400px", fontSize: "0.85rem", letterSpacing: "0.05em" }}>
                                STAGE (무대)
                            </div>

                            {/* 좌석 배치도 그리드 */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", alignItems: "center", marginBottom: "2rem" }}>
                                {seatsGrid.map((row, rIdx) => (
                                    <div key={rIdx} style={{ display: "flex", gap: "0.5rem" }}>
                                        {row.map((seat) => {
                                            const active = selectedSeats.includes(seat);
                                            return (
                                                <button
                                                    key={seat}
                                                    type="button"
                                                    onClick={() => toggleSeat(seat)}
                                                    style={{
                                                        width: "36px",
                                                        height: "36px",
                                                        borderRadius: "6px",
                                                        border: active ? "2px solid var(--border-focus)" : "1px solid var(--border-strong)",
                                                        background: active ? "var(--action-primary)" : "var(--surface-default)",
                                                        color: active ? "var(--text-inverse)" : "var(--text-primary)",
                                                        fontWeight: 700,
                                                        fontSize: "0.75rem",
                                                        cursor: "pointer",
                                                        transition: "all 0.15s ease",
                                                    }}
                                                >
                                                    {seat}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: "flex", gap: "1rem" }}>
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    style={{
                                        flex: 1,
                                        padding: "0.8rem",
                                        border: "1px solid var(--border-strong)",
                                        borderRadius: "6px",
                                        background: "var(--surface-default)",
                                        color: "var(--text-primary)",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                    }}
                                >
                                    이전
                                </button>
                                <button
                                    type="button"
                                    disabled={selectedSeats.length === 0}
                                    onClick={() => setStep(3)}
                                    style={{
                                        flex: 2,
                                        padding: "0.8rem",
                                        border: "none",
                                        borderRadius: "6px",
                                        background: selectedSeats.length === 0 ? "var(--action-disabled)" : "var(--action-primary)",
                                        color: selectedSeats.length === 0 ? "var(--action-disabled-text)" : "var(--text-inverse)",
                                        cursor: selectedSeats.length === 0 ? "not-allowed" : "pointer",
                                        fontWeight: 700,
                                    }}
                                >
                                    선택 완료 (결제 단계로) →
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div style={{ background: "var(--surface-default)", border: "1px solid var(--border-default)", borderRadius: "12px", padding: "2rem" }}>
                            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 1.25rem 0" }}>예매 내역 확인 및 결제</h3>
                            <div style={{ background: "var(--surface-subtle)", border: "1px solid var(--border-default)", borderRadius: "10px", padding: "1.25rem", marginBottom: "1.5rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                                    <span style={{ color: "var(--text-secondary)" }}>프로그램</span>
                                    <strong style={{ color: "var(--text-primary)" }}>{program.title}</strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                                    <span style={{ color: "var(--text-secondary)" }}>일시</span>
                                    <span style={{ color: "var(--text-primary)" }}>{selectedDate} {selectedTime}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                                    <span style={{ color: "var(--text-secondary)" }}>장소</span>
                                    <span style={{ color: "var(--text-primary)" }}>{program.venue}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                                    <span style={{ color: "var(--text-secondary)" }}>선택 좌석</span>
                                    <strong style={{ color: "var(--text-primary)" }}>{selectedSeats.join(", ")} ({selectedSeats.length}매)</strong>
                                </div>
                                <hr style={{ border: "none", borderTop: "1px solid var(--border-default)", margin: "1rem 0" }} />
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>총 결제 금액</span>
                                    <strong style={{ fontSize: "1.4rem", color: "var(--text-primary)" }}>{totalAmount.toLocaleString()}원</strong>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "1rem" }}>
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    style={{
                                        flex: 1,
                                        padding: "0.85rem",
                                        border: "1px solid var(--border-strong)",
                                        borderRadius: "6px",
                                        background: "var(--surface-default)",
                                        color: "var(--text-primary)",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                    }}
                                >
                                    좌석 다시 선택
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCompleteBooking}
                                    style={{
                                        flex: 2,
                                        padding: "0.85rem",
                                        fontSize: "1.05rem",
                                        fontWeight: 700,
                                        background: "var(--action-primary)",
                                        color: "var(--text-inverse)",
                                        border: "none",
                                        borderRadius: "6px",
                                        cursor: "pointer",
                                    }}
                                >
                                    예매 확정하기 ✓
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* 예매 완료 화면 */
                <div style={{ background: "var(--surface-default)", border: "2px solid var(--border-strong)", borderRadius: "12px", padding: "3rem 2rem", textAlign: "center" }}>
                    <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "var(--surface-subtle)", border: "1px solid var(--border-strong)", color: "var(--text-primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", marginBottom: "1rem" }}>
                        ✓
                    </div>
                    <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 0.5rem 0", letterSpacing: "-0.03em" }}>
                        예매가 성공적으로 완료되었습니다!
                    </h2>
                    <p style={{ color: "var(--text-secondary)", margin: "0 0 2rem 0" }}>
                        선택하신 좌석({selectedSeats.join(", ")})으로 예매 정보가 안전하게 저장되었습니다.
                    </p>
                    <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
                        <Link
                            href="/account"
                            style={{
                                padding: "0.85rem 1.5rem",
                                background: "var(--action-primary)",
                                color: "var(--text-inverse)",
                                borderRadius: "6px",
                                textDecoration: "none",
                                fontWeight: 700,
                            }}
                        >
                            예매 내역 확인하기 →
                        </Link>
                        <Link
                            href="/programs"
                            style={{
                                padding: "0.85rem 1.25rem",
                                border: "1px solid var(--border-strong)",
                                borderRadius: "6px",
                                color: "var(--text-primary)",
                                textDecoration: "none",
                                fontWeight: 600,
                            }}
                        >
                            다른 프로그램 둘러보기
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
