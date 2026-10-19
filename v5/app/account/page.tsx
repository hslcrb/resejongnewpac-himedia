"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { showToast } from "../../components/Toast";
import { UserProfile, BookingRecord } from "../../types/sejong";
import { PROGRAMS } from "../../src/data/catalog";

export default function AccountPage() {
    const [profile, setProfile] = useState<UserProfile>({ name: "", email: "", phone: "" });
    const [bookings, setBookings] = useState<BookingRecord[]>([]);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [isSignup, setIsSignup] = useState<boolean>(false);
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

    const handleLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const newProfile: UserProfile = {
                name: profile.name || "예술을 사랑하는 관람객",
                email: profile.email || "visitor@example.com",
                phone: profile.phone || "",
            };
            localStorage.setItem("sejong-v4:profile", JSON.stringify(newProfile));
            localStorage.setItem("sejong-v4:session", JSON.stringify({ active: true }));
            setProfile(newProfile);
            setIsLoggedIn(true);
            showToast(isSignup ? "프로필이 생성되었습니다." : "로그인되었습니다.");
        } catch {
            showToast("처리에 실패했습니다.");
        }
    };

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
            {/* 상단 페이지 헤딩 (v4 표준 page-heading) */}
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
                            <p className="page-description">예술로 채워지는 나의 일상, 나만의 세종.</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="container page-content flow-content">
                {isLoggedIn ? (
                    <>
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
                                    {profile.name || "관람객"}님,
                                    <br />
                                    오늘도 예술 가까이.
                                </h2>
                                <p>나의 문화생활을 한곳에서 만나보세요.</p>
                            </div>
                            <button
                                type="button"
                                className="button button--outline"
                                onClick={handleLogout}
                            >
                                로그아웃
                            </button>
                        </section>

                        {/* 통계 카드 (예매내역, 관심 프로그램, 신청내역) */}
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
                                <span>교육·신청</span>
                                <strong>
                                    0<small>건</small>
                                </strong>
                                <span className="arrow-icon">→</span>
                            </Link>
                        </div>

                        {/* 추천 피처 박스 */}
                        <div className="account-feature">
                            <div>
                                <h3>다음 감동을 만나볼까요?</h3>
                                <p>
                                    공연부터 전시, 배움의 순간까지.
                                    <br />
                                    당신을 기다리는 프로그램을 찾아보세요.
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
                    </>
                ) : (
                    /* 로그인 / 회원가입 폼 (v4 표준 account-auth-layout) */
                    <div className="account-auth-layout">
                        <section className="account-auth-intro" aria-labelledby="account-intro-title">
                            <h2 id="account-intro-title">
                                좋아하는 예술로
                                <br />
                                채우는 나의 일상.
                            </h2>
                            <p>
                                {isSignup
                                    ? "관심 가는 프로그램을 모으고, 다음 관람을 준비해 보세요."
                                    : "나의 예매와 관심 프로그램을 한곳에서 만나보세요."}
                            </p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                className="account-auth-photo"
                                src="/v5/assets/images/sejong-grand-auditorium.png"
                                width={1160}
                                height={680}
                                alt="세종대극장의 객석"
                            />
                            <span className="account-auth-caption">예술과 가까워지는 나만의 공간.</span>
                        </section>

                        <form className="flow-panel" onSubmit={handleLoginSubmit}>
                            <h2>{isSignup ? "프로필 만들기" : "로그인"}</h2>
                            <p className="flow-fineprint">
                                이 브라우저에서 사용하는 프로필입니다. 비밀번호는 입력하지 않습니다.
                            </p>

                            <div className="flow-field">
                                <label htmlFor="login-name">이름</label>
                                <input
                                    id="login-name"
                                    type="text"
                                    required
                                    placeholder="예술을 사랑하는 관람객"
                                    value={profile.name}
                                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                />
                            </div>

                            <div className="flow-field">
                                <label htmlFor="login-email">이메일</label>
                                <input
                                    id="login-email"
                                    type="email"
                                    required
                                    placeholder="visitor@example.com"
                                    value={profile.email}
                                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                />
                            </div>

                            {isSignup && (
                                <div className="flow-field">
                                    <label htmlFor="login-phone">휴대전화 (선택)</label>
                                    <input
                                        id="login-phone"
                                        type="tel"
                                        placeholder="010-0000-0000"
                                        value={profile.phone}
                                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                    />
                                </div>
                            )}

                            <label className="flow-consent" style={{ display: "flex", gap: "8px", alignItems: "center", margin: "1rem 0" }}>
                                <input type="checkbox" required defaultChecked />
                                <span>프로필을 이 브라우저에 저장하는 데 동의합니다.</span>
                            </label>

                            <button className="button button--dark flow-button-full" type="submit">
                                {isSignup ? "프로필 만들기" : "로그인"} →
                            </button>

                            <div className="account-auth-links" style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
                                {isSignup ? (
                                    <button
                                        type="button"
                                        className="flow-text-button"
                                        onClick={() => setIsSignup(false)}
                                    >
                                        로그인으로 돌아가기
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="flow-text-button"
                                        onClick={() => setIsSignup(true)}
                                    >
                                        새 프로필 만들기 (회원가입)
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
