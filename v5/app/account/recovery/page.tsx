"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SystemButton, SystemField, SystemNotice } from "../../../components/SystemPrimitives";
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
                    setRecoveryResult(`등록된 계정이 확인되었습니다: ${profile.name || "관람객"} (${profile.email})`);
                    showToast("계정 확인 완료");
                    return;
                }
            }
            setRecoveryResult("일치하는 회원 정보를 찾을 수 없습니다.");
        } catch {
            setErrorMessage("조회 중 오류가 발생했습니다.");
        }
    };

    // [계정 공통 조작 / Shared account form controls]
    return (
        <div className="flow-page account-page">
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
                            <p className="page-description">예매 내역과 관심 프로그램을 관리하는 페이지입니다.</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="container page-content flow-content">
                <form className="flow-panel account-narrow" onSubmit={handleSubmit} noValidate>
                    <div className="flow-panel-heading">
                        <h2>등록된 계정 찾기</h2>
                        <p>가입 시 입력했던 이메일을 입력해 주세요.</p>
                    </div>

                    {errorMessage && (
                        <SystemNotice variant="flow" error className="flow-error" id="flow-error" tabIndex={-1}>
                            {errorMessage}
                        </SystemNotice>
                    )}

                    <SystemField
                        variant="flow"
                        outerClassName="form-field"
                        label={<>이메일 <span className="flow-required" aria-hidden="true">*</span>
                            <span className="sr-only">필수</span></>}
                        id="flow-email"
                        name="email"
                        required
                        autoComplete="email"
                        type="email"
                        placeholder="visitor@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <SystemButton context="flow" className="flow-button-full" type="submit">
                        계정 정보 확인
                    </SystemButton>

                    {recoveryResult && (
                        <SystemNotice variant="flow" className="flow-info-box" tabIndex={-1} style={{ marginTop: "1rem" }}>
                            {recoveryResult}
                        </SystemNotice>
                    )}

                    <div className="account-auth-links">
                        <Link href="/account/login">로그인</Link>
                        <Link href="/account/signup">회원가입</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
