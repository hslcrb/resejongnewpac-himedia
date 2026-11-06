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
        <div className="flow-page account-page" data-cms-auth-gate="login">
            <section className="page-heading" id="page-heading">
                <div className="container">
                    <nav className="breadcrumbs" aria-label="현재 위치">
                        <Link data-text="action" href="/">
                            홈
                        </Link>
                        <span data-text="body" aria-hidden="true">
                            /
                        </span>
                        <span data-text="body" aria-current="page">
                            로그인 · 관리자 게이트
                        </span>
                    </nav>
                    <div className="page-title-row">
                        <div>
                            <h1 data-text="title">Google 관리자 인증 및 이동 선택 게이트</h1>
                            <p data-text="body" className="page-description">
                                검증된 Google {CMS_ADMIN_HANDLE} 관리자 신원을 확인하고 사용자 페이지,
                                관리자 CMS 워크스페이스, 록로그인 보안 페이지 중 목적지를 선택합니다.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="container page-content flow-content">
                <SystemSurface
                    as="section"
                    variant="panel"
                    padding="lg"
                    aria-labelledby="cms-login-gate-heading"
                >
                    <div className="account-panel-header">
                        <div>
                            <SystemBadge tone={decision.isAdmin ? "highlight" : "neutral"}>
                                {decision.isAdmin
                                    ? `검증된 Google 관리자 (${CMS_ADMIN_HANDLE})`
                                    : `HTTP ${decision.statusCode} · ${decision.reasonCode}`}
                            </SystemBadge>
                            <h2 data-text="heading" id="cms-login-gate-heading">
                                {decision.isAdmin
                                    ? "인증 완료 - 이동할 페이지를 선택해 주세요"
                                    : "Google OAuth + 서버 멤버십 기반 관리자 검증"}
                            </h2>
                        </div>
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
                                ? `Google 계정 검증 성공 (${decision.verifiedEmail})`
                                : "관리자 신원 검증 상태 안내"
                        }
                    >
                        {authLoading
                            ? "Supabase Auth 세션과 Google OAuth 신원 정보를 확인하고 있습니다..."
                            : decision.message}
                    </SystemNotice>

                    {decision.isAdmin ? (
                        <div data-cms-destination-selector="verified">
                            <p data-text="body">
                                확인된 관리자 핸들:{" "}
                                <strong data-text="item-title">{decision.accountHandle}</strong> ·
                                역할: <strong data-text="item-title">{decision.role}</strong> · 검증
                                경로:{" "}
                                <strong data-text="item-title">
                                    {membershipSource === "db_verified"
                                        ? "Supabase RLS 멤버십 + Google OAuth"
                                        : "Google OAuth 검증 신원"}
                                </strong>
                            </p>
                            <div className="account-dashboard-grid">
                                {CMS_ADMIN_DESTINATIONS.map((dest) => (
                                    <SystemSurface
                                        key={dest.id}
                                        as="article"
                                        variant="subtle"
                                        padding="md"
                                    >
                                        <SystemBadge tone="neutral">{dest.badge}</SystemBadge>
                                        <h3 data-text="item-title">{dest.label}</h3>
                                        <p data-text="body">{dest.description}</p>
                                        <SystemLink
                                            variant={dest.id === "admin_cms" ? "primary" : "secondary"}
                                            context="flow"
                                            href={dest.href}
                                        >
                                            {dest.label}
                                            <Icon name="arrow" size={20} />
                                        </SystemLink>
                                    </SystemSurface>
                                ))}
                            </div>
                            <SystemControlGroup aria-label="세션 관리 작업">
                                <SystemButton
                                    variant="quiet"
                                    context="flow"
                                    onClick={() => void handleSignOut()}
                                >
                                    현재 Google 세션 로그아웃
                                </SystemButton>
                            </SystemControlGroup>
                        </div>
                    ) : (
                        <div data-cms-destination-selector="unverified">
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
                                    관리자 CMS 워크스페이스(/admin) 상태 확인
                                </SystemLink>
                            </SystemControlGroup>
                            {decision.isAuthenticated && (
                                <SystemControlGroup aria-label="계정 전환">
                                    <SystemButton
                                        variant="quiet"
                                        context="flow"
                                        onClick={() => void handleSignOut()}
                                    >
                                        현재 일반 계정 로그아웃 후 관리자 계정으로 다시 로그인
                                    </SystemButton>
                                </SystemControlGroup>
                            )}
                        </div>
                    )}
                </SystemSurface>
            </div>
        </div>
    );
}
