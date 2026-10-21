"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SystemButton, SystemCheckbox, SystemField, SystemNotice } from "../../../components/SystemPrimitives";
import { useRouter } from "next/navigation";
import { showToast } from "../../../components/Toast";
import { createDemoProfile } from "../../../src/lib/supabase.ts";

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
            localStorage.setItem("sejong-v4:profile", JSON.stringify(createDemoProfile(newProfile)));
            localStorage.setItem("sejong-v4:session", JSON.stringify({ active: true }));
            window.dispatchEvent(new CustomEvent("sejong:account-identity", { detail: { action: "demo-sign-in" } }));
            showToast("이 브라우저의 체험 계정을 만들었습니다.");
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
                            <h1>체험 계정 만들기</h1>
                            <p className="page-description">이 브라우저에서 나의 공간과 관람노트를 만들어 보세요.</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="container page-content flow-content">
                <div className="account-auth-layout">
                    <section className="account-auth-intro" aria-labelledby="account-intro-title">
                        <h2 id="account-intro-title">
                            나만의 공간에서
                            <br />
                            다음 관람을 준비해요.
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
                        <h2>체험 계정 만들기</h2>
                        <p className="flow-fineprint">
                            입력한 정보는 이 브라우저에만 저장됩니다. 실제 회원가입이나 본인 인증이 아니며, 공식 세종문화회관 계정과 연결되지 않습니다.
                        </p>
                        <p className="flow-fineprint">실제 계정 연결은 <Link href="/account/login">Google 로그인</Link>을 이용해 주세요.</p>

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
                            label={<span>입력한 정보를 이 브라우저에 저장하는 데 동의합니다. <strong>(필수)</strong></span>}
                            name="consent"
                            required
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                        />

                        <SystemButton context="flow" className="flow-button-full" type="submit">
                            체험 계정 만들기
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
