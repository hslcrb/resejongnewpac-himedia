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
            setErrorMessage("체험 프로필 저장에 동의해 주세요.");
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
            showToast("현재 세션에서 사용할 체험 프로필을 만들었습니다.");
            router.push("/account");
        } catch {
            setErrorMessage("가입 처리 중 오류가 발생했습니다.");
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

                {/* 가입 레이아웃 (v4 표준 account-auth-layout) */}
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
                        <h2>체험 프로필 만들기</h2>
                        <p className="flow-fineprint">
                            이 브라우저에서만 사용하는 체험 프로필입니다. 실제 회원 인증과 연결되지 않으며 비밀번호는 입력하지 않습니다.
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
                                체험 프로필을 이 브라우저에 저장하는 데 동의합니다. <strong>(필수)</strong>
                            </span>
                        </label>

                        <button className="button button--dark flow-button-full" type="submit">
                            프로필 만들기
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
