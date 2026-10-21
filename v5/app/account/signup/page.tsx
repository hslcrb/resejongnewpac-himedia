"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SystemButton, SystemCheckbox, SystemField, SystemNotice } from "../../../components/SystemPrimitives";
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
                        <span aria-current="page">회원가입</span>
                    </nav>
                    <div className="page-title-row">
                        <div>
                            <p className="eyebrow">MY SEJONG</p>
                            <h1>회원가입</h1>
                            <p className="page-description">예매 내역과 관심 프로그램을 관리하는 페이지입니다.</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="container page-content flow-content">
                <div className="account-auth-layout">
                    <section className="account-auth-intro" aria-labelledby="account-intro-title">
                        <h2 id="account-intro-title">
                            회원으로 가입하면
                            <br />
                            예매가 더 편해집니다.
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
                        <span className="account-auth-caption">세종대극장 객석. 공연장 정보는 방문 안내에 정리되어 있습니다.</span>
                    </section>

                    <form className="flow-panel" data-account-auth="signup" onSubmit={handleSubmit} noValidate>
                        <h2>회원가입</h2>
                        <p className="flow-fineprint">
                            세종문화회관 회원 서비스 이용을 위한 기본 정보를 입력해 주세요.
                        </p>

                        {errorMessage && (
                            <SystemNotice variant="flow" error className="flow-error" id="flow-error" tabIndex={-1}>
                                {errorMessage}
                            </SystemNotice>
                        )}

                        <SystemField
                            variant="flow"
                            outerClassName="form-field"
                            label={<>이름 <span className="flow-required" aria-hidden="true">*</span>
                                <span className="sr-only">필수</span></>}
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
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <SystemField
                            variant="flow"
                            outerClassName="form-field"
                            label={<>연락처 <span className="flow-optional">(선택)</span></>}
                            id="flow-phone"
                            name="phone"
                            autoComplete="tel"
                            type="tel"
                            placeholder="010-0000-0000"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />

                        <SystemCheckbox
                            className="flow-consent"
                            label={<span>개인정보 수집 및 이용에 동의합니다. <strong>(필수)</strong></span>}
                            name="consent"
                            required
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                        />

                        <SystemButton context="flow" className="flow-button-full" type="submit">
                            가입하기
                            <svg className="material-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </SystemButton>

                        <div className="account-auth-links">
                            <Link href="/account/login">로그인으로 돌아가기</Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
