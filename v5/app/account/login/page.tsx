"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { showToast } from "../../../components/Toast";

export default function LoginPage() {
    const router = useRouter();
    const [name, setName] = useState("관람객");
    const [email, setEmail] = useState("visitor@example.com");
    const [consent, setConsent] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        try {
            const rawProfile = localStorage.getItem("sejong-v4:profile");
            if (rawProfile) {
                const parsed = JSON.parse(rawProfile);
                if (parsed.name) setName(parsed.name);
                if (parsed.email) setEmail(parsed.email);
            }
        } catch {}
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");

        if (!name.trim()) {
            setErrorMessage("이름을 입력해 주세요.");
            return;
        }
        if (!email.trim() || !email.includes("@")) {
            setErrorMessage("유효한 이메일을 입력해 주세요.");
            return;
        }
        if (!consent) {
            setErrorMessage("개인정보 수집 및 이용에 동의해 주세요.");
            return;
        }

        try {
            const newProfile = {
                name: name.trim(),
                email: email.trim(),
                phone: "",
            };
            localStorage.setItem("sejong-v4:profile", JSON.stringify(newProfile));
            localStorage.setItem("sejong-v4:session", JSON.stringify({ active: true }));
            showToast("로그인되었습니다.");
            router.push("/account");
        } catch {
            setErrorMessage("로그인 처리 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="flow-page account-page">
            <section className="page-heading" id="page-heading">
                <div className="container">
                    <nav className="breadcrumbs" aria-label="현재 위치">
                        <Link href="/">홈</Link>
                        <span aria-hidden="true">/</span>
                        <Link href="/account">마이페이지</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">로그인</span>
                    </nav>
                    <div className="page-title-row">
                        <div>
                            <p className="eyebrow">MY SEJONG</p>
                            <h1>로그인</h1>
                            <p className="page-description">예매 내역과 관심 프로그램을 관리하는 페이지입니다.</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="container page-content flow-content">
                <div className="account-auth-layout">
                    <section className="account-auth-intro" aria-labelledby="account-intro-title">
                        <h2 id="account-intro-title">
                            예매 내역과 관심 프로그램,
                            <br />
                            한곳에서 확인하세요.
                        </h2>
                        <p>내 예매와 관심 프로그램을 한곳에서 확인하세요.</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            className="account-auth-photo"
                            src="/v5/assets/images/sejong-grand-auditorium.png"
                            width={1160}
                            height={680}
                            alt="세종대극장의 객석"
                        />
                        <span className="account-auth-caption">세종대극장 객석. 공연장 정보는 방문 안내에 정리되어 있습니다.</span>
                    </section>

                    <form className="flow-panel" data-account-auth="login" onSubmit={handleSubmit} noValidate>
                        <h2>로그인</h2>
                        <p className="flow-fineprint">
                            세종문화회관 회원 서비스입니다.
                        </p>

                        {errorMessage && (
                            <div className="flow-error" id="flow-error" role="alert" tabIndex={-1}>
                                {errorMessage}
                            </div>
                        )}

                        <div className="form-field">
                            <label htmlFor="flow-name">
                                이름 <span className="flow-required" aria-hidden="true">*</span>
                                <span className="sr-only">필수</span>
                            </label>
                            <input
                                id="flow-name"
                                name="name"
                                required
                                autoComplete="name"
                                maxLength={40}
                                type="text"
                                placeholder="이름을 입력해 주세요"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

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

                        <label className="flow-consent">
                            <input
                                name="consent"
                                type="checkbox"
                                required
                                checked={consent}
                                onChange={(e) => setConsent(e.target.checked)}
                            />
                            <span>
                                개인정보 수집 및 이용에 동의합니다. <strong>(필수)</strong>
                            </span>
                        </label>

                        <button className="button button--dark flow-button-full" type="submit">
                            로그인
                            <svg className="material-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </button>

                        <div className="account-auth-links">
                            <Link href="/account/signup">회원가입</Link>
                            <Link href="/account/recovery">계정 찾기</Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
