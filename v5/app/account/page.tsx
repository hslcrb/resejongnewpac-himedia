"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { showToast } from "../../components/Toast";
import { signInWithOAuthProvider, signOut } from "../../src/lib/supabase.js";
import { UserProfile, BookingRecord } from "../../types/sejong";

export default function AccountPage() {
    const [profile, setProfile] = useState<UserProfile>({ name: "", email: "", phone: "" });
    const [bookings, setBookings] = useState<BookingRecord[]>([]);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

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
        } catch {}
    }, []);

    const handleProfileSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        try {
            localStorage.setItem("sejong-v4:profile", JSON.stringify(profile));
            localStorage.setItem("sejong-v4:session", JSON.stringify({ active: true }));
            setIsLoggedIn(true);
            showToast("프로필이 저장되었습니다.");
        } catch {
            showToast("프로필 저장에 실패했습니다.");
        }
    };

    const handleGuestLogin = () => {
        const guest: UserProfile = {
            name: "세종 관람객",
            email: "guest@sejongpac.or.kr",
            phone: "010-1234-5678",
        };
        setProfile(guest);
        try {
            localStorage.setItem("sejong-v4:profile", JSON.stringify(guest));
            localStorage.setItem("sejong-v4:session", JSON.stringify({ active: true }));
            setIsLoggedIn(true);
            showToast("게스트 계정으로 로그인되었습니다. 모든 기능을 체험하실 수 있습니다.");
        } catch {
            showToast("로그인 처리에 실패했습니다.");
        }
    };

    const handleSocialLogin = async (provider: "google" | "kakao" | "github") => {
        setLoadingProvider(provider);
        try {
            const callbackUrl = window.location.origin + "/v5/account/";
            await signInWithOAuthProvider(provider, callbackUrl);
        } catch (err: any) {
            console.error("Social login error:", err);
            showToast(err.message || `${provider} 로그인 오류: Supabase 콘솔에서 Provider 활성화가 필요합니다.`);
        } finally {
            setLoadingProvider(null);
        }
    };

    const handleLogout = async () => {
        try {
            localStorage.setItem("sejong-v4:session", JSON.stringify({ active: false }));
            await signOut();
            setIsLoggedIn(false);
            showToast("로그아웃되었습니다.");
        } catch {
            showToast("로그아웃 처리 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="container" style={{ padding: "3rem 1.5rem 6rem", maxWidth: "800px", margin: "0 auto" }}>
            <nav className="breadcrumbs" aria-label="현재 위치" style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>홈</Link>
                <span>/</span>
                <span aria-current="page" style={{ fontWeight: 600, color: "var(--text-primary)" }}>마이페이지 (MY SEJONG)</span>
            </nav>

            <header style={{ marginBottom: "2.5rem" }}>
                <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 0.5rem 0", letterSpacing: "-0.03em" }}>
                    마이페이지 & 인증 센터
                </h1>
                <p style={{ fontSize: "1rem", color: "var(--text-secondary)", margin: 0 }}>
                    세종문화회관 예매 내역 확인 및 Google·소셜 계정 연동을 관리합니다.
                </p>
            </header>

            {/* 로그인 상태 패널 */}
            <div style={{ background: "var(--surface-default)", border: "1px solid var(--border-default)", borderRadius: "12px", padding: "2rem", marginBottom: "2.5rem" }}>
                {isLoggedIn ? (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                            <div>
                                <span style={{ fontSize: "0.8rem", padding: "3px 10px", background: "var(--surface-subtle)", color: "var(--text-primary)", border: "1px solid var(--border-strong)", borderRadius: "9999px", fontWeight: 700 }}>
                                    ● 로그인 상태
                                </span>
                                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)", margin: "0.75rem 0 0.25rem 0" }}>
                                    {profile.name || "예술을 사랑하는 관람객"}님, 환영합니다!
                                </h2>
                                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>
                                    {profile.email || "visitor@example.com"}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="button button--outline"
                                style={{
                                    padding: "0.5rem 1rem",
                                    fontSize: "0.875rem",
                                    border: "1px solid var(--border-strong)",
                                    background: "var(--surface-default)",
                                    color: "var(--text-primary)",
                                    cursor: "pointer",
                                }}
                            >
                                로그아웃
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 0.5rem 0" }}>
                            간편 로그인 & 체험 프로필
                        </h2>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: "0 0 1.5rem 0" }}>
                            Supabase Auth 연동 또는 1초 게스트 간편 시작으로 모든 예매 서비스를 체험할 수 있습니다.
                        </p>

                        {/* 1초 게스트 간편 시작 버튼 */}
                        <div style={{ marginBottom: "1.5rem", padding: "1.25rem", background: "var(--surface-subtle)", border: "1px solid var(--border-default)", borderRadius: "8px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                                <div>
                                    <strong style={{ display: "block", color: "var(--text-primary)", fontSize: "0.95rem" }}>설정 없이 바로 체험하기</strong>
                                    <span style={{ fontSize: "0.825rem", color: "var(--text-secondary)" }}>별도 소셜 인증 없이 1초 만에 테스트 세션으로 로그인합니다.</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleGuestLogin}
                                    style={{
                                        padding: "0.65rem 1.25rem",
                                        background: "var(--action-primary)",
                                        color: "var(--text-inverse)",
                                        border: "none",
                                        borderRadius: "6px",
                                        fontWeight: 700,
                                        fontSize: "0.9rem",
                                        cursor: "pointer",
                                    }}
                                >
                                    게스트로 즉시 시작 →
                                </button>
                            </div>
                        </div>

                        {/* 안내 문구 */}
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1rem", lineHeight: 1.5 }}>
                            ※ Google/카카오 로그인은 연동된 Supabase 프로젝트 대시보드(Authentication &gt; Providers)에서 해당 Provider 활성화가 필요합니다. 미설정 시 상단의 게스트 시작을 권장합니다.
                        </div>

                        {/* 소셜 로그인 버튼 그룹 */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.75rem" }}>
                            <button
                                type="button"
                                onClick={() => handleSocialLogin("google")}
                                disabled={loadingProvider !== null}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "0.6rem",
                                    padding: "0.75rem 1rem",
                                    background: "var(--surface-default)",
                                    color: "var(--text-primary)",
                                    border: "1px solid var(--border-default)",
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                    fontSize: "0.925rem",
                                    cursor: "pointer",
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                </svg>
                                {loadingProvider === "google" ? "연결 중..." : "Google 계정으로 계속하기"}
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSocialLogin("kakao")}
                                disabled={loadingProvider !== null}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "0.6rem",
                                    padding: "0.75rem 1rem",
                                    background: "var(--accent-highlight)",
                                    color: "var(--text-on-brand)",
                                    border: "1px solid var(--border-default)",
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                    fontSize: "0.925rem",
                                    cursor: "pointer",
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.708 4.8 4.27 6.054l-1.085 3.98a.5.5 0 0 0 .73.538l4.743-3.14c.112.01.226.018.342.018 4.97 0 9-3.185 9-7.115S16.97 3 12 3z" />
                                </svg>
                                카카오 계정으로 계속하기
                            </button>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", margin: "1.5rem 0", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                            <span style={{ flex: 1, height: "1px", background: "var(--border-default)" }} />
                            <span style={{ padding: "0 0.75rem" }}>또는 직접 체험 프로필 작성</span>
                            <span style={{ flex: 1, height: "1px", background: "var(--border-default)" }} />
                        </div>

                        {/* 직접 프로필 입력 폼 */}
                        <form onSubmit={handleProfileSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>이름</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="홍길동"
                                    value={profile.name}
                                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                    style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border-strong)", borderRadius: "6px", background: "var(--surface-default)", color: "var(--text-primary)" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>이메일</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="visitor@example.com"
                                    value={profile.email}
                                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                    style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border-strong)", borderRadius: "6px", background: "var(--surface-default)", color: "var(--text-primary)" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>휴대전화 (선택)</label>
                                <input
                                    type="tel"
                                    placeholder="010-0000-0000"
                                    value={profile.phone}
                                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                    style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border-strong)", borderRadius: "6px", background: "var(--surface-default)", color: "var(--text-primary)" }}
                                />
                            </div>
                            <button
                                type="submit"
                                style={{
                                    marginTop: "0.5rem",
                                    padding: "0.75rem 1.5rem",
                                    background: "var(--action-primary)",
                                    color: "var(--text-inverse)",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontWeight: 700,
                                    fontSize: "0.95rem",
                                    cursor: "pointer",
                                }}
                            >
                                직접 입력 프로필로 시작하기 →
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* 나의 예매 내역 */}
            <section style={{ background: "var(--surface-default)", border: "1px solid var(--border-default)", borderRadius: "12px", padding: "2rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 1rem 0" }}>
                    나의 예매 내역 ({bookings.length}건)
                </h3>
                {bookings.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {bookings.map((b) => (
                            <div
                                key={b.id}
                                style={{
                                    border: "1px solid var(--border-default)",
                                    borderRadius: "8px",
                                    padding: "1rem",
                                    background: "var(--surface-subtle)",
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                                    <strong style={{ fontSize: "1.05rem", color: "var(--text-primary)" }}>{b.title}</strong>
                                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700 }}>{b.id}</span>
                                </div>
                                <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                    일시: {b.date} {b.time} | 장소: {b.venue} | 좌석: {b.seats.join(", ")}
                                </div>
                                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.4rem" }}>
                                    결제 금액: {b.total.toLocaleString()}원
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-secondary)" }}>
                        예매된 내역이 없습니다.
                        <div style={{ marginTop: "1rem" }}>
                            <Link
                                href="/programs"
                                style={{
                                    display: "inline-block",
                                    padding: "0.5rem 1rem",
                                    border: "1px solid var(--border-strong)",
                                    borderRadius: "6px",
                                    color: "var(--text-primary)",
                                    textDecoration: "none",
                                    fontSize: "0.875rem",
                                    fontWeight: 600,
                                }}
                            >
                                프로그램 둘러보기
                            </Link>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
