"use client";

import React, { useState } from "react";
import Link from "next/link";
import { showToast } from "../../../components/Toast";

export default function RecoveryPage() {
    const [email, setEmail] = useState("");
    const [recoveryResult, setRecoveryResult] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");
        setRecoveryResult(null);

        if (!email.trim() || !email.includes("@")) {
            setErrorMessage("유효한 이메일을 입력해 주세요.");
            return;
        }

        try {
            const raw = localStorage.getItem("sejong-v4:profile");
            if (raw) {
                const profile = JSON.parse(raw);
                if (profile.email && profile.email.toLowerCase() === email.trim().toLowerCase()) {
                    setRecoveryResult(`저장된 프로필이 확인되었습니다: ${profile.name || "관람객"} (${profile.email})`);
                    showToast("프로필 확인 완료");
                    return;
                }
            }
            setRecoveryResult("이 브라우저에 일치하는 프로필 정보가 없습니다.");
        } catch {
            setErrorMessage("조회 중 오류가 발생했습니다.");
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
                        <Link href="/account">마이페이지</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">계정 찾기</span>
                    </nav>
                    <div className="page-title-row">
                        <div>
                            <p className="eyebrow">MY SEJONG</p>
                            <h1>계정 찾기</h1>
                            <p className="page-description">예술로 채워지는 나의 일상, 나만의 세종.</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="container page-content flow-content">
                {/* 이용 안내 (v4 표준 flow-demo) */}
                <div className="flow-demo">
                    <svg className="material-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M22 10V6c0-1.11-.9-2-2-2H4c-1.1 0-1.99.89-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-2-1.46c-1.19.69-2 1.99-2 3.46s.81 2.77 2 3.46V18H4v-2.54c1.19-.69 2-1.99 2-3.46 0-1.48-.8-2.77-1.99-3.46L4 6h16v2.54z" />
                    </svg>
                    <p>
                        <strong>이용 안내</strong>
                        <span>현재 브라우저에서 사용하는 체험 서비스입니다. 실제 회원정보나 기관의 예매·신청 내역과 연결되지 않습니다.</span>
                    </p>
                </div>

                <form className="flow-panel account-narrow" onSubmit={handleSubmit} noValidate>
                    <div className="flow-panel-heading">
                        <h2>이 브라우저의 체험 계정 찾기</h2>
                        <p>프로필에 입력했던 이메일을 확인합니다. 비밀번호는 저장되지 않으며 복구 메일도 발송되지 않습니다.</p>
                    </div>

                    {errorMessage && (
                        <div className="flow-error" id="flow-error" role="alert" tabIndex={-1}>
                            {errorMessage}
                        </div>
                    )}

                    <div className="form-field">
                        <label htmlFor="flow-email">
                            이메일 <span className="flow-required" aria-hidden="true">*</span>
                            <span className="sr-only">필수</span>
                        </label>
                        <input
                            id="flow-email"
                            name="email"
                            required
                            autoComplete="email"
                            type="email"
                            placeholder="visitor@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <button className="button button--dark flow-button-full" type="submit">
                        저장된 프로필 확인
                    </button>

                    {recoveryResult && (
                        <div className="flow-info-box" role="status" tabIndex={-1} style={{ marginTop: "1rem" }}>
                            {recoveryResult}
                        </div>
                    )}

                    <div className="account-auth-links">
                        <Link href="/account/login">체험 로그인</Link>
                        <Link href="/account/signup">새 프로필 만들기</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
