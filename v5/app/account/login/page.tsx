"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SystemButton, SystemCheckbox, SystemField, SystemNotice } from "../../../components/SystemPrimitives";
import { useRouter } from "next/navigation";
import { showToast } from "../../../components/Toast";
import { createDemoProfile, getGoogleOAuthAvailability, isSupabaseConfigured, signInWithGoogle } from "../../../src/lib/supabase.ts";

export default function LoginPage() {
    const router = useRouter();
    const [name, setName] = useState("관람객");
    const [email, setEmail] = useState("visitor@example.com");
    const [consent, setConsent] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [googleStatus, setGoogleStatus] = useState<"checking" | "enabled" | "disabled" | "unavailable">("checking");
    const [oauthPending, setOauthPending] = useState(false);

    // [실제 제공자 설정 확인과 Google 로그인 / Runtime provider check and Google sign-in]
    useEffect(() => {
        let mounted = true;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10_000);
        void getGoogleOAuthAvailability(controller.signal)
            .then(enabled => { if (mounted && !controller.signal.aborted) setGoogleStatus(enabled ? "enabled" : "disabled"); })
            .catch(() => { if (mounted) setGoogleStatus("unavailable"); })
            .finally(() => window.clearTimeout(timeout));
        return () => { mounted = false; controller.abort(); window.clearTimeout(timeout); };
    }, []);

    const handleGoogleSignIn = async () => {
        if (googleStatus !== "enabled" || oauthPending) return;
        setErrorMessage("");
        setOauthPending(true);
        try { await signInWithGoogle(); }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Google 로그인 요청을 시작하지 못했습니다. 다시 시도해 주세요.");
            setOauthPending(false);
        }
    };

    useEffect(() => {
        try {
            const rawProfile = localStorage.getItem("sejong-v4:profile");
            if (rawProfile) {
                const parsed = JSON.parse(rawProfile);
                if (typeof parsed?.name === "string") setName(parsed.name);
                if (typeof parsed?.email === "string") setEmail(parsed.email);
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
            localStorage.setItem("sejong-v4:profile", JSON.stringify(createDemoProfile(newProfile, localStorage.getItem("sejong-v4:profile"))));
            localStorage.setItem("sejong-v4:session", JSON.stringify({ active: true }));
            window.dispatchEvent(new CustomEvent("sejong:account-identity", { detail: { action: "demo-sign-in" } }));
            showToast("로그인했습니다.");
            router.push("/account");
        } catch {
            setErrorMessage("로그인 처리 중 오류가 발생했습니다.");
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
                        <span aria-current="page">로그인</span>
                    </nav>
                    <div className="page-title-row">
                        <div>
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            className="account-auth-photo"
                            src="/v5/assets/images/sejong-grand-auditorium.png"
                            width={1160}
                            height={680}
                            alt="세종대극장의 객석"
                        />
                    </section>

                    <form className="flow-panel" data-account-auth="login" onSubmit={handleSubmit} noValidate>
                        <h2>로그인</h2>
                        <p className="flow-fineprint">
                            Google 계정으로 로그인하거나 저장한 프로필을 이용하세요.
                        </p>

                        <SystemButton context="flow" variant="secondary" className="flow-button-full" type="button" onClick={handleGoogleSignIn}
                            disabled={googleStatus !== "enabled" || oauthPending} aria-describedby="google-login-status" aria-busy={oauthPending}>
                            {oauthPending ? "Google로 이동 중…" : "Google로 계속하기"}
                        </SystemButton>
                        <p className="flow-fineprint" id="google-login-status" role="status" aria-live="polite">
                            {googleStatus === "checking" ? "Google 로그인 연결을 확인하고 있습니다."
                                : googleStatus === "enabled" ? "Google에서 본인 확인 후 마이페이지로 돌아옵니다."
                                : googleStatus === "unavailable" ? "로그인 서비스에 연결하지 못했습니다. 잠시 후 다시 접속해 주세요."
                                : isSupabaseConfigured ? "Google 로그인 연결을 사용할 수 없습니다. 아래 프로필로 계속할 수 있습니다."
                                : "현재 Google 로그인 연결을 준비하고 있습니다."}
                        </p>

                        <h3>프로필로 계속하기</h3>
                        <p className="flow-fineprint">입력한 정보와 활동은 이 브라우저에 저장됩니다.</p>

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
                            placeholder="visitor@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
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
                            프로필로 계속하기
                            <svg className="material-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </SystemButton>

                        <div className="account-auth-links">
                            <Link href="/account/signup">프로필 만들기</Link>
                            <Link href="/account/recovery">계정 찾기</Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
