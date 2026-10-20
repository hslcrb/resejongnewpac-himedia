"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { showToast } from "../../components/Toast";
import type { UserProfile, BookingRecord } from "../../types/sejong.ts";
import { PROGRAMS } from "../../src/data/catalog";

export default function AccountPage() {
    const [profile, setProfile] = useState<UserProfile>({ name: "", email: "", phone: "" });
    const [bookings, setBookings] = useState<BookingRecord[]>([]);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<string>("dashboard");

    useEffect(() => {
        try {
            const rawSession = localStorage.getItem("sejong-v4:session");
            if (rawSession) {
                const sess = JSON.parse(rawSession);
                if (sess.active) setIsLoggedIn(true);
            }
            const rawProfile = localStorage.getItem("sejong-v4:profile");
            if (rawProfile) {
                setProfile(JSON.parse(rawProfile));
            }
            const rawBookings = localStorage.getItem("sejong-v4:bookings");
            if (rawBookings) {
                setBookings(JSON.parse(rawBookings));
            }
            const rawFavorites = localStorage.getItem("sejong-v4:favorites");
            if (rawFavorites) {
                setFavorites(JSON.parse(rawFavorites));
            }
        } catch {}
    }, []);

    const handleLogout = () => {
        try {
            localStorage.setItem("sejong-v4:session", JSON.stringify({ active: false }));
            setIsLoggedIn(false);
            showToast("로그아웃되었습니다.");
        } catch {
            showToast("로그아웃 처리 중 오류가 발생했습니다.");
        }
    };

    const handleCancelBooking = (bookingId: string) => {
        try {
            const updated = bookings.map((b) =>
                b.id === bookingId ? { ...b, status: "cancelled" } : b
            );
            setBookings(updated as any);
            localStorage.setItem("sejong-v4:bookings", JSON.stringify(updated));
            showToast("예매가 취소되었습니다.");
        } catch {
            showToast("취소 처리 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="flow-page account-page">
            {/* 상단 페이지 헤딩 */}
            <section className="page-heading" id="page-heading">
                <div className="container">
                    <nav className="breadcrumbs" aria-label="현재 위치">
                        <Link href="/">홈</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">마이페이지</span>
                    </nav>
                    <div className="page-title-row">
                        <div>
                            <p className="eyebrow">MY SEJONG</p>
                            <h1>마이페이지</h1>
                            <p className="page-description">예매 내역과 관심 프로그램을 관리하는 페이지입니다.</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="container page-content flow-content">
                {/* 계정 네비게이션 */}
                <nav className="account-nav" aria-label="계정 메뉴">
                    <button
                        type="button"
                        className={activeTab === "dashboard" ? "active" : ""}
                        onClick={() => setActiveTab("dashboard")}
                    >
                        마이페이지
                    </button>
                    <button
                        type="button"
                        className={activeTab === "bookings" ? "active" : ""}
                        onClick={() => setActiveTab("bookings")}
                    >
                        예매내역 ({bookings.length})
                    </button>
                    <button
                        type="button"
                        className={activeTab === "favorites" ? "active" : ""}
                        onClick={() => setActiveTab("favorites")}
                    >
                        관심 프로그램 ({favorites.length})
                    </button>
                </nav>

                {/* 대시보드 환영 영역 */}
                <section className="account-welcome">
                    <div>
                        <h2>
                            {isLoggedIn ? (profile.name || "관람객") : "관람객"}님,
                            <br />
                            오늘도 반갑습니다.
                        </h2>
                        <p>
                            {isLoggedIn
                                ? "예매 내역과 관심 프로그램을 한곳에서 관리하세요."
                                : "로그인하면 예매 내역과 관심 프로그램이 열립니다."}
                        </p>
                    </div>
                    {isLoggedIn ? (
                        <button
                            type="button"
                            className="button button--outline"
                            onClick={handleLogout}
                        >
                            로그아웃
                        </button>
                    ) : (
                        <Link href="/account/login" className="button button--dark">
                            로그인
                        </Link>
                    )}
                </section>

                {/* 통계 카드 */}
                <div className="account-stats">
                    <button
                        type="button"
                        className="account-stat-card"
                        onClick={() => setActiveTab("bookings")}
                    >
                        <svg className="material-icon" width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22 10V6c0-1.11-.9-2-2-2H4c-1.1 0-1.99.89-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-2-1.46c-1.19.69-2 1.99-2 3.46s.81 2.77 2 3.46V18H4v-2.54c1.19-.69 2-1.99 2-3.46 0-1.48-.8-2.77-1.99-3.46L4 6h16v2.54z" />
                        </svg>
                        <span>예매내역</span>
                        <strong>
                            {bookings.length}
                            <small>건</small>
                        </strong>
                        <span className="arrow-icon">→</span>
                    </button>

                    <button
                        type="button"
                        className="account-stat-card"
                        onClick={() => setActiveTab("favorites")}
                    >
                        <svg className="material-icon" width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                        <span>관심 프로그램</span>
                        <strong>
                            {favorites.length}
                            <small>건</small>
                        </strong>
                        <span className="arrow-icon">→</span>
                    </button>

                    <Link href="/programs/education" className="account-stat-card">
                        <svg className="material-icon" width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                        </svg>
                        <span>신청내역</span>
                        <strong>
                            0<small>건</small>
                        </strong>
                        <span className="arrow-icon">→</span>
                    </Link>
                </div>

                {/* 추천 피처 박스 */}
                <div className="account-feature">
                    <div>
                        <h3>다음 관람은 어떤 공연인가요?</h3>
                        <p>
                            예정된 공연·전시·교육 일정을
                            <br />
                            확인해 보세요.
                        </p>
                    </div>
                    <Link className="button button--dark" href="/programs">
                        프로그램 둘러보기 →
                    </Link>
                </div>

                {/* 예매 내역 목록 */}
                {activeTab === "bookings" && (
                    <section className="account-section" style={{ marginTop: "2rem" }}>
                        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem" }}>
                            예매내역 ({bookings.length}건)
                        </h3>
                        {bookings.length > 0 ? (
                            <div className="account-list">
                                {bookings.map((booking) => {
                                    const program = PROGRAMS.find((p) => p.id === booking.programId);
                                    const isCancelled = (booking as any).status === "cancelled";
                                    return (
                                        <article key={booking.id} className="account-booking">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={`/v5/assets/images/${program?.image || "poster-carmen.png"}`}
                                                alt={booking.title}
                                            />
                                            <div className="account-booking__body">
                                                <div className="flow-record-top">
                                                    <span className={`flow-tag ${isCancelled ? "is-muted" : ""}`}>
                                                        {isCancelled ? "취소 완료" : "예매 완료"}
                                                    </span>
                                                    <small>{booking.id}</small>
                                                </div>
                                                <Link href={`/programs/${booking.programId}`}>
                                                    <h3>{booking.title}</h3>
                                                </Link>
                                                <p>
                                                    {booking.date} {booking.time} · {booking.venue}
                                                </p>
                                                <p>
                                                    좌석: {booking.seats.join(", ")} · {booking.total.toLocaleString()}원
                                                </p>
                                                {!isCancelled && (
                                                    <button
                                                        type="button"
                                                        className="flow-text-button"
                                                        onClick={() => handleCancelBooking(booking.id)}
                                                    >
                                                        예매 취소
                                                    </button>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>아직 예매한 프로그램이 없습니다.</p>
                                <Link className="button button--dark" href="/programs">
                                    프로그램 둘러보기 →
                                </Link>
                            </div>
                        )}
                    </section>
                )}

                {/* 관심 프로그램 목록 */}
                {activeTab === "favorites" && (
                    <section className="account-section" style={{ marginTop: "2rem" }}>
                        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem" }}>
                            관심 프로그램 ({favorites.length}건)
                        </h3>
                        {favorites.length > 0 ? (
                            <div className="account-list">
                                {favorites.map((favId) => {
                                    const program = PROGRAMS.find((p) => p.id === favId);
                                    if (!program) return null;
                                    return (
                                        <article key={favId} className="account-booking">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={`/v5/assets/images/${program.image}`}
                                                alt={program.title}
                                            />
                                            <div className="account-booking__body">
                                                <div className="flow-record-top">
                                                    <span className="flow-tag">{program.category}</span>
                                                    <small>{program.venue}</small>
                                                </div>
                                                <Link href={`/programs/${program.id}`}>
                                                    <h3>{program.title}</h3>
                                                </Link>
                                                <p>
                                                    {program.start} ~ {program.end}
                                                </p>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>아직 관심 목록에 담은 프로그램이 없습니다.</p>
                                <Link className="button button--dark" href="/programs">
                                    프로그램 둘러보기 →
                                </Link>
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}
