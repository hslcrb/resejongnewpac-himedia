import type { User } from "@supabase/supabase-js";
import {
    CMS_ADMIN_HANDLE,
    CMS_ALLOWED_GOOGLE_DOMAINS,
    type CmsAdminRole,
    type CmsCapability,
    type CmsDestinationOption,
    type CmsIdentityDecision,
    type CmsIdentityVerificationInput,
} from "./contracts.ts";

// [관리자 인증 후 이동 선택지 / Post-login destination choices for verified admin]
// 사용자의 원문 요구("사용자 페이지와 로그인 페이지로 갈지")와 CMS 워크스페이스를 모두 보존합니다.
export const CMS_ADMIN_DESTINATIONS: readonly CmsDestinationOption[] = Object.freeze([
    {
        id: "visitor_account",
        label: "사용자 페이지로 이동",
        href: "/account",
        description: "일반 관람객용 마이페이지·예매 내역·관심 공연 화면으로 이동합니다.",
        badge: "관람객 화면",
    },
    {
        id: "admin_cms",
        label: "관리자 CMS 워크스페이스로 이동",
        href: "/admin",
        description: "실제 위지위그 편집기, 대화형 코딩 에이전트, PR 전용 발행 콘솔을 엽니다.",
        badge: "CMS · PR 전용",
    },
    {
        id: "lock_login_gate",
        label: "로그인(Lock-Login) 보안 페이지로 이동",
        href: "/admin?panel=lock-login",
        description: "Google 관리자 관리자 세션 잠금·권한 검증·연동 상태를 관리합니다.",
        badge: "로그인 보안",
    },
]);

export const CMS_DEFAULT_CAPABILITIES: Record<CmsAdminRole, readonly CmsCapability[]> = Object.freeze({
    super_admin: [
        "cms:read",
        "cms:write_draft",
        "cms:run_agent",
        "cms:create_pr",
        "cms:reconcile_release",
    ],
    editor: ["cms:read", "cms:write_draft", "cms:run_agent", "cms:create_pr"],
    reviewer: ["cms:read", "cms:create_pr", "cms:reconcile_release"],
    operator: ["cms:read", "cms:reconcile_release"],
});

function parseVerifiedGoogleEmail(email: string): { localPart: string; domain: string } | null {
    const normalized = email.trim().toLowerCase();
    const match = normalized.match(/^([a-z0-9._+-]+)@([a-z0-9.-]+)$/);
    if (!match) return null;
    const [, localPart, domain] = match;
    if (!(CMS_ALLOWED_GOOGLE_DOMAINS as readonly string[]).includes(domain)) return null;
    return { localPart, domain };
}

// [Google provider identity와 서버 멤버십을 결합한 관리자 검증 / Admin verification binding Google provider identity and server membership]
// 표시 이름, 이메일 접두사(admin.fake@...), user_metadata, URL 쿼리나 localStorage 플래그는 절대 관리자 근거로 인정하지 않습니다.
export function verifyAdminIdentity(input: CmsIdentityVerificationInput | null | undefined): CmsIdentityDecision {
    const denied = (
        statusCode: 401 | 403 | 423,
        reasonCode: CmsIdentityDecision["reasonCode"],
        message: string,
    ): CmsIdentityDecision => ({
        isAuthenticated: statusCode !== 401,
        isAdmin: false,
        statusCode,
        reasonCode,
        accountHandle: "",
        verifiedEmail: "",
        googleSubject: "",
        role: "visitor",
        capabilities: [],
        destinations: [],
        message,
    });

    if (!input || typeof input.userId !== "string" || !input.userId.trim()) {
        return denied(401, "UNAUTHENTICATED", "Google 관리자 계정 로그인이 필요합니다.");
    }

    const googleIdentity = (input.identities || []).find(
        (identity) => identity && identity.provider === "google",
    );
    const appProvider = (input.appProvider || "").trim().toLowerCase();
    if (!googleIdentity || (appProvider && appProvider !== "google")) {
        return denied(
            403,
            "NON_GOOGLE_PROVIDER",
            "관리자 CMS는 Google OAuth로 직접 인증된 세션만 허용합니다.",
        );
    }

    const identityData = googleIdentity.identity_data || {};
    const rawEmail =
        typeof identityData.email === "string"
            ? identityData.email
            : typeof input.email === "string"
              ? input.email
              : "";
    const emailVerified =
        identityData.email_verified === true ||
        identityData.verified_email === true ||
        (identityData.email_verified === undefined && input.emailVerified === true);

    if (!emailVerified) {
        return denied(
            403,
            "UNVERIFIED_GOOGLE_EMAIL",
            "이메일 소유가 확인된 Google 계정만 관리자 권한을 검증할 수 있습니다.",
        );
    }

    const parsedEmail = parseVerifiedGoogleEmail(rawEmail);
    if (!parsedEmail || parsedEmail.localPart !== CMS_ADMIN_HANDLE) {
        return denied(
            403,
            "HANDLE_MISMATCH",
            "요청한 Google 관리자 계정(admin)이 아니므로 일반 관람객 권한으로만 이용할 수 있습니다.",
        );
    }

    const googleSubject = String(
        identityData.sub || identityData.provider_id || googleIdentity.id || "",
    ).trim();
    if (!googleSubject) {
        return denied(
            403,
            "SUBJECT_MISMATCH",
            "Google 고유 주체(subject) 식별자를 확인하지 못했습니다.",
        );
    }

    if (input.membership) {
        if (!input.membership.active || input.membership.revokedAt) {
            return denied(
                403,
                "MEMBERSHIP_REVOKED",
                "회수되었거나 비활성화된 관리자 권한입니다.",
            );
        }
        if (
            input.membership.userId !== input.userId ||
            input.membership.provider !== "google" ||
            input.membership.googleSubject !== googleSubject ||
            input.membership.accountHandle !== CMS_ADMIN_HANDLE ||
            input.membership.verifiedEmail.trim().toLowerCase() !== rawEmail.trim().toLowerCase()
        ) {
            return denied(
                403,
                "SUBJECT_MISMATCH",
                "서버에 등록된 Google 관리자 바인딩 정보와 일치하지 않습니다.",
            );
        }
    }

    if (input.sessionLocked) {
        return {
            isAuthenticated: true,
            isAdmin: true,
            statusCode: 423,
            reasonCode: "SESSION_LOCKED",
            accountHandle: CMS_ADMIN_HANDLE,
            verifiedEmail: rawEmail.trim().toLowerCase(),
            googleSubject,
            role: input.membership?.role || "super_admin",
            capabilities: [],
            destinations: CMS_ADMIN_DESTINATIONS,
            message: "로그인(Lock-Login) 보안 잠금이 활성화되어 있습니다. 잠금 해제 후 편집·PR 도구를 사용할 수 있습니다.",
        };
    }

    const role: CmsAdminRole = input.membership?.role || "super_admin";
    const capabilities = input.membership?.capabilities?.length
        ? input.membership.capabilities
        : CMS_DEFAULT_CAPABILITIES[role];

    return {
        isAuthenticated: true,
        isAdmin: true,
        statusCode: 200,
        reasonCode: "VERIFIED_GOOGLE_ADMIN",
        accountHandle: CMS_ADMIN_HANDLE,
        verifiedEmail: rawEmail.trim().toLowerCase(),
        googleSubject,
        role,
        capabilities,
        destinations: CMS_ADMIN_DESTINATIONS,
        message: "Google 관리자 관리자 계정이 확인되었습니다. 이동할 페이지를 선택하세요.",
    };
}

export function verifySupabaseUserAsAdmin(
    user: User | null | undefined,
    options: {
        membership?: CmsIdentityVerificationInput["membership"];
        sessionLocked?: boolean;
    } = {},
): CmsIdentityDecision {
    if (!user) return verifyAdminIdentity(null);
    const appMetadata = (user.app_metadata || {}) as Record<string, unknown>;
    const identities = Array.isArray(user.identities)
        ? user.identities.map((identity) => ({
              provider: String(identity.provider || ""),
              id: identity.id,
              user_id: identity.user_id,
              identity_data: (identity.identity_data || null) as Record<string, unknown> | null,
          }))
        : [];
    return verifyAdminIdentity({
        userId: user.id,
        email: user.email,
        emailVerified: Boolean(user.email_confirmed_at || user.confirmed_at),
        appProvider: typeof appMetadata.provider === "string" ? appMetadata.provider : null,
        identities,
        userMetadata: (user.user_metadata || null) as Record<string, unknown> | null,
        membership: options.membership || null,
        sessionLocked: options.sessionLocked,
    });
}

export function sanitizeInternalDestination(target: string, fallback = "/account"): string {
    if (typeof target !== "string" || !target.trim()) return fallback;
    const trimmed = target.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//") || /[\r\n\\]/.test(trimmed)) {
        return fallback;
    }
    try {
        const parsed = new URL(trimmed, "https://renewsejongpac.local");
        if (parsed.origin !== "https://renewsejongpac.local") return fallback;
        return `${parsed.pathname}${parsed.search}`;
    } catch {
        return fallback;
    }
}
