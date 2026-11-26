"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import {
    SystemBadge,
    SystemButton,
    SystemLink,
    SystemNotice,
} from "../../components/SystemPrimitives";
import { SystemControlGroup } from "../../components/SystemControlGroup";
import { SystemSurface } from "../../components/SystemSurface";
import {
    CMS_ADMIN_DESTINATIONS,
    verifySupabaseUserAsAdmin,
} from "../../src/cms/auth.ts";
import { CMS_ADMIN_HANDLE } from "../../src/cms/contracts.ts";
import type {
    CmsAdminRole,
    CmsCapability,
    CmsIdentityDecision,
} from "../../src/cms/contracts.ts";
import {
    getGoogleOAuthAvailability,
    signInWithGoogle,
    supabase,
} from "../../src/lib/supabase.ts";
import "../../styles/cms-dashboard.css";

export default function CmsLoginGatePage() {
    const [googleStatus, setGoogleStatus] = useState<
        "checking" | "enabled" | "disabled" | "unavailable"
    >("checking");
    const [authLoading, setAuthLoading] = useState(true);
    const [oauthPending, setOauthPending] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [decision, setDecision] = useState<CmsIdentityDecision>(() =>
        verifySupabaseUserAsAdmin(null),
    );
    const [membershipSource, setMembershipSource] = useState<
        "unauthenticated" | "db_verified" | "identity_verified"
    >("unauthenticated");

    useEffect(() => {
        let mounted = true;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10_000);

        void getGoogleOAuthAvailability(controller.signal)
            .then((enabled) => {
                if (mounted && !controller.signal.aborted) {
                    setGoogleStatus(enabled ? "enabled" : "disabled");
                }
            })
            .catch(() => {
                if (mounted) setGoogleStatus("unavailable");
            })
            .finally(() => window.clearTimeout(timeout));

        const inspectSession = async () => {
            if (!supabase) {
                if (mounted) {
                    setDecision(verifySupabaseUserAsAdmin(null));
                    setAuthLoading(false);
                }
                return;
            }
            try {
                const { data, error } = await supabase.auth.getUser();
                if (error || !data.user) {
                    if (mounted) {
                        setDecision(verifySupabaseUserAsAdmin(null));
                        setMembershipSource("unauthenticated");
                        setAuthLoading(false);
                    }
                    return;
                }

                let membership: NonNullable<
                    Parameters<typeof verifySupabaseUserAsAdmin>[1]
                >["membership"] = null;
                const { data: memberRow, error: memberError } = await supabase
                    .from("sejong_cms_memberships")
                    .select(
                        "user_id, provider, google_subject, account_handle, verified_email, role, capabilities, active, revoked_at",
                    )
                    .eq("user_id", data.user.id)
                    .maybeSingle();

                if (!memberError && memberRow) {
                    membership = {
                        userId: String(memberRow.user_id),
                        provider: String(memberRow.provider),
                        googleSubject: String(memberRow.google_subject),
                        accountHandle: String(memberRow.account_handle),
                        verifiedEmail: String(memberRow.verified_email),
                        role: memberRow.role as CmsAdminRole,
                        capabilities: Array.isArray(memberRow.capabilities)
                            ? (memberRow.capabilities as CmsCapability[])
                            : [],
                        active: Boolean(memberRow.active),
                        revokedAt: memberRow.revoked_at ? String(memberRow.revoked_at) : null,
                    };
                }

                const verified = verifySupabaseUserAsAdmin(data.user, { membership });
                if (mounted) {
                    setDecision(verified);
                    setMembershipSource(
                        membership
                            ? "db_verified"
                            : verified.isAdmin
                              ? "identity_verified"
                              : "unauthenticated",
                    );
                    setAuthLoading(false);
                }
            } catch {
                if (mounted) {
                    setDecision(verifySupabaseUserAsAdmin(null));
                    setAuthLoading(false);
                }
            }
        };

        void inspectSession();
        return () => {
            mounted = false;
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, []);

    const handleGoogleAdminSignIn = async () => {
        if (googleStatus !== "enabled" || oauthPending) return;
        setErrorMessage("");
        setOauthPending(true);
        try {
            window.sessionStorage.setItem("sejong_post_oauth_route", "/login");
            await signInWithGoogle();
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Google 관리자 인증 요청을 시작하지 못했습니다.",
            );
            setOauthPending(false);
        }
    };

    const handleSignOut = async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        setDecision(verifySupabaseUserAsAdmin(null));
        setMembershipSource("unauthenticated");
    };

    return (
        <div className="cms-dashboard-page" data-cms-auth-gate="login">
            <div className="cms-dashboard-shell">
                <SystemSurface
                    as="header"
                    variant="panel"
                    padding="md"
                    className="cms-topbar"
                    id="page-heading"
                >
                    <div className="cms-topbar-title-group">
                        <nav className="breadcrumbs" aria-label="현재 위치">
                            <Link data-text="action" href="/">
                                홈
                            </Link>
                            <span data-text="body" aria-hidden="true">
                                /
                            </span>
                            <span data-text="body" aria-current="page">
                                로그인 · 관리자 보안 게이트 대시보드
                            </span>
                        </nav>
                        <div className="cms-topbar-meta">
                            <SystemBadge tone={decision.isAdmin ? "highlight" : "neutral"}>
                                {decision.isAdmin
                                    ? `검증된 Google 관리자 (${CMS_ADMIN_HANDLE})`
                                    : `HTTP ${decision.statusCode} · ${decision.reasonCode}`}
                            </SystemBadge>
                            <SystemBadge tone="info">
                                Google OAuth 상태: {googleStatus.toUpperCase()}
                            </SystemBadge>
                        </div>
                        <h1 data-text="title">Google 관리자 인증 · 목적지 선택 대시보드</h1>
                        <p data-text="body">
                            검증된 Google {CMS_ADMIN_HANDLE} 신원과 서버 멤버십 바인딩을 대조하고,
                            사용자 페이지(/account), 관리자 CMS 워크스페이스(/admin), 로그인 보안
                            게이트(/admin?panel=lock-login) 중 목적지를 선택합니다.
                        </p>
                    </div>
                    <div className="cms-topbar-actions">
                        <SystemLink variant="secondary" context="flow" href="/admin">
                            CMS 대시보드(/admin) 열기
                        </SystemLink>
                        <SystemLink variant="quiet" context="flow" href="/account">
                            사용자 마이페이지(/account)
                        </SystemLink>
                    </div>
                </SystemSurface>

                <section className="cms-kpi-grid" aria-label="관리자 인증 핵심 지표">
                    <SystemSurface as="article" variant="panel" padding="md" className="cms-kpi-card">
                        <div className="cms-kpi-header">
                            <span data-text="meta">1. OAuth 공급자</span>
                            <SystemBadge tone={googleStatus === "enabled" ? "highlight" : "neutral"}>
                                {googleStatus.toUpperCase()}
                            </SystemBadge>
                        </div>
                        <p data-text="heading" className="cms-kpi-value">
                            Google PKCE
                        </p>
                        <p data-text="caption">
                            고정 콜백(/account/callback/) 및 이메일 소유 검증 필수
                        </p>
                    </SystemSurface>

                    <SystemSurface as="article" variant="panel" padding="md" className="cms-kpi-card">
                        <div className="cms-kpi-header">
                            <span data-text="meta">2. 관리자 핸들 대조</span>
                            <SystemBadge tone={decision.isAdmin ? "highlight" : "neutral"}>
                                {decision.isAdmin ? "VERIFIED" : "UNVERIFIED"}
                            </SystemBadge>
                        </div>
                        <p data-text="heading" className="cms-kpi-value">
                            {decision.accountHandle || CMS_ADMIN_HANDLE}
                        </p>
                        <p data-text="caption">
                            {decision.verifiedEmail || "로그인 후 검증 이메일이 표시됩니다"}
                        </p>
                    </SystemSurface>

                    <SystemSurface as="article" variant="panel" padding="md" className="cms-kpi-card">
                        <div className="cms-kpi-header">
                            <span data-text="meta">3. 서버 역할 · 권한</span>
                            <SystemBadge tone="info">{decision.role.toUpperCase()}</SystemBadge>
                        </div>
                        <p data-text="heading" className="cms-kpi-value">
                            권한 {decision.capabilities.length}개 활성
                        </p>
                        <p data-text="caption">
                            {membershipSource === "db_verified"
                                ? "Supabase RLS 멤버십 + Google OAuth 검증됨"
                                : decision.isAdmin
                                  ? "Google OAuth 신원 검증 완료"
                                  : "게스트 / 일반 관람객 세션"}
                        </p>
                    </SystemSurface>

                    <SystemSurface as="article" variant="panel" padding="md" className="cms-kpi-card">
                        <div className="cms-kpi-header">
                            <span data-text="meta">4. 응답 코드 · 보호</span>
                            <SystemBadge tone={decision.statusCode === 200 ? "highlight" : "neutral"}>
                                HTTP {decision.statusCode}
                            </SystemBadge>
                        </div>
                        <p data-text="heading" className="cms-kpi-value">
                            {decision.reasonCode}
                        </p>
                        <p data-text="caption">
                            display_name · URL · localStorage 권한 위조 원천 차단
                        </p>
                    </SystemSurface>
                </section>

                <div className="cms-split-workspace">
                    <SystemSurface
                        as="section"
                        variant="panel"
                        padding="md"
                        className="cms-block-stack"
                        aria-labelledby="cms-login-gate-heading"
                    >
                        <div className="cms-block-header">
                            <h2 data-text="heading" id="cms-login-gate-heading">
                                {decision.isAdmin
                                    ? "관리자 신원 확인 완료 - 이동할 워크스페이스를 선택하세요"
                                    : "Google OAuth 관리자 로그인 및 목적지 포털"}
                            </h2>
                            <SystemBadge tone={decision.isAdmin ? "highlight" : "neutral"}>
                                {decision.isAdmin ? "3대 목적지 활성" : "인증 대기"}
                            </SystemBadge>
                        </div>

                        {errorMessage && (
                            <SystemNotice data-text="body" error variant="flow">
                                {errorMessage}
                            </SystemNotice>
                        )}

                        <SystemNotice
                            data-text="body"
                            error={decision.isAuthenticated && !decision.isAdmin}
                            variant="flow"
                            title={
                                decision.isAdmin
                                    ? `Google 관리자 세션 활성 (${decision.verifiedEmail})`
                                    : "관리자 신원 검증 상태 안내"
                            }
                        >
                            {authLoading
                                ? "Supabase Auth 세션과 Google OAuth 신원 정보를 확인하고 있습니다..."
                                : decision.message}
                        </SystemNotice>

                        {decision.isAdmin ? (
                            <div className="cms-block-stack" data-cms-destination-selector="verified">
                                <div className="cms-card-grid-3">
                                    {CMS_ADMIN_DESTINATIONS.map((dest) => (
                                        <SystemSurface
                                            key={dest.id}
                                            as="article"
                                            variant="subtle"
                                            padding="md"
                                            className="cms-kpi-card"
                                        >
                                            <div className="cms-kpi-header">
                                                <SystemBadge
                                                    tone={
                                                        dest.id === "admin_cms"
                                                            ? "highlight"
                                                            : "neutral"
                                                    }
                                                >
                                                    {dest.badge}
                                                </SystemBadge>
                                                <span data-text="meta">{dest.href}</span>
                                            </div>
                                            <h3 data-text="item-title">{dest.label}</h3>
                                            <p data-text="body">{dest.description}</p>
                                            <SystemLink
                                                variant={
                                                    dest.id === "admin_cms" ? "primary" : "secondary"
                                                }
                                                context="flow"
                                                href={dest.href}
                                            >
                                                {dest.label}
                                                <Icon name="arrow" size={20} />
                                            </SystemLink>
                                        </SystemSurface>
                                    ))}
                                </div>
                                <div className="cms-toolbar-row" aria-label="세션 관리 작업">
                                    <SystemButton
                                        variant="quiet"
                                        context="flow"
                                        onClick={() => void handleSignOut()}
                                    >
                                        현재 Google 세션 로그아웃
                                    </SystemButton>
                                </div>
                            </div>
                        ) : (
                            <div className="cms-block-stack" data-cms-destination-selector="unverified">
                                <p data-text="body">
                                    관리자 권한은 URL 파라미터, localStorage, 표시 이름(display_name),
                                    미검증 이메일로 부여되지 않습니다. Google OAuth 인증과 서버 측{" "}
                                    <code data-text="meta">sejong_cms_memberships</code> 대조가 통과된{" "}
                                    <strong data-text="item-title">{CMS_ADMIN_HANDLE}</strong> 계정에만
                                    CMS·에이전트·PR 생성 권한이 열립니다.
                                </p>
                                <SystemControlGroup aria-label="로그인 및 이동 선택">
                                    <SystemButton
                                        variant="primary"
                                        context="flow"
                                        disabled={googleStatus !== "enabled" || oauthPending}
                                        onClick={() => void handleGoogleAdminSignIn()}
                                    >
                                        <Icon name="user" size={20} />
                                        {oauthPending
                                            ? "Google 인증 페이지로 이동 중..."
                                            : `Google (${CMS_ADMIN_HANDLE}) 계정으로 로그인`}
                                    </SystemButton>
                                    <SystemLink
                                        variant="secondary"
                                        context="flow"
                                        href="/account/login"
                                    >
                                        일반 관람객 로그인 화면으로 이동
                                    </SystemLink>
                                    <SystemLink variant="quiet" context="flow" href="/account">
                                        사용자 마이페이지(/account) 확인
                                    </SystemLink>
                                    <SystemLink variant="quiet" context="flow" href="/admin">
                                        관리자 CMS 대시보드(/admin) 열기
                                    </SystemLink>
                                </SystemControlGroup>
                                {decision.isAuthenticated && (
                                    <div className="cms-toolbar-row" aria-label="계정 전환">
                                        <SystemButton
                                            variant="quiet"
                                            context="flow"
                                            onClick={() => void handleSignOut()}
                                        >
                                            현재 일반 계정 로그아웃 후 관리자 계정으로 다시 로그인
                                        </SystemButton>
                                    </div>
                                )}
                            </div>
                        )}
                    </SystemSurface>

                    <SystemSurface
                        as="aside"
                        variant="panel"
                        padding="md"
                        className="cms-block-stack"
                        aria-label="관리자 신원 검증 보안 매트릭스"
                    >
                        <div className="cms-block-header">
                            <h2 data-text="item-title">신원 · 권한 바인딩 보안 인스펙터</h2>
                            <SystemBadge tone="info">RLS + OAuth</SystemBadge>
                        </div>
                        <div className="cms-probe-list">
                            <div className="cms-probe-row">
                                <span data-text="label">허용 Google 핸들</span>
                                <SystemBadge tone="highlight">{CMS_ADMIN_HANDLE}</SystemBadge>
                            </div>
                            <div className="cms-probe-row">
                                <span data-text="label">OAuth 공급자 고정</span>
                                <span data-text="meta">provider = google (email_verified 필수)</span>
                            </div>
                            <div className="cms-probe-row">
                                <span data-text="label">서버 멤버십 테이블</span>
                                <code data-text="meta">public.sejong_cms_memberships</code>
                            </div>
                            <div className="cms-probe-row">
                                <span data-text="label">클라이언트 위조 방지</span>
                                <span data-text="meta">display_name · URL · storage 무시</span>
                            </div>
                            <div className="cms-probe-row">
                                <span data-text="label">운영 반영 정책</span>
                                <SystemBadge tone="highlight">PR-ONLY (main 직접 반영 차단)</SystemBadge>
                            </div>
                        </div>
                        <div className="cms-card-grid-3">
                            {CMS_ADMIN_DESTINATIONS.map((dest) => (
                                <SystemSurface
                                    key={`preview-${dest.id}`}
                                    as="article"
                                    variant="subtle"
                                    padding="sm"
                                    className="cms-kpi-card"
                                >
                                    <SystemBadge tone="neutral">{dest.badge}</SystemBadge>
                                    <h3 data-text="label">{dest.label}</h3>
                                    <p data-text="caption">{dest.href}</p>
                                </SystemSurface>
                            ))}
                        </div>
                    </SystemSurface>
                </div>
            </div>
        </div>
    );
}
