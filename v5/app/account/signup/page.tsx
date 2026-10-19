"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { showToast } from "../../../components/Toast";

export default function SignupPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [consent, setConsent] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

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
                phone: phone.trim(),
            };
            localStorage.setItem("sejong-v4:profile", JSON.stringify(newProfile));
            localStorage.setItem("sejong-v4:session", JSON.stringify({ active: true }));
            showToast("회원가입이 완료되었습니다.");
            router.push("/account");
        } catch {
            setErrorMessage("회원가입 처리 중 오류가 발생했습니다.");
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
                        <span aria-current="page">회원가입</span>
                    </nav>
                    <div className="page-title-row">
                        <div>
                            <p className="eyebrow">MY SEJONG</p>
                            <h1>회원가입</h1>
                            <p className="page-description">예술로 채워지는 나의 일상, 나만의 세종.</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="container page-content flow-content">
                <div className="account-auth-layout">
                    <section className="account-auth-intro" aria-labelledby="account-intro-title">
                        <h2 id="account-intro-title">
                            좋아하는 예술로
                            <br />
                            채우는 나의 일상.
                        </h2>
                        <p>관심 가는 프로그램을 모으고, 다음 관람을 준비해 보세요.</p>
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

                    <form className="flow-panel" data-account-auth="signup" onSubmit={handleSubmit} noValidate>
                        <h2>회원가입</h2>
                        <p className="flow-fineprint">
                            세종문화회관 회원 서비스 이용을 위한 기본 정보를 입력해 주세요.
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
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="form-field">
                            <label htmlFor="flow-phone">
                                연락처 <span className="flow-optional">(선택)</span>
                            </label>
                            <input
                                id="flow-phone"
                                name="phone"
                                autoComplete="tel"
                                type="tel"
                                placeholder="010-0000-0000"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
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
                            가입하기
                            <svg className="material-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </button>

                        <div className="account-auth-links">
                            <Link href="/account/login">로그인으로 돌아가기</Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
