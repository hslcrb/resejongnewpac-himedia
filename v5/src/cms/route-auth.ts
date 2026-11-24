// [CMS API 인증 해석 / CMS API authentication resolution]
// 두 가지 경로만 허용합니다.
//  1) MCP 서비스 토큰(CMS_MCP_ACCESS_TOKEN) - 코딩 에이전트용, 서버 환경 변수에만 존재
//  2) Supabase Google 세션 + 활성 관리자 멤버십 - 사람 관리자용
// 토큰·이메일은 로그로 남기지 않으며, 판정 결과만 반환합니다.
import type { CmsAdminRole, CmsCapability, CmsIdentityDecision, CmsIdentityVerificationInput } from "./contracts.ts";
import { verifyAdminIdentity } from "./auth.ts";
import type { CmsMcpAuthContext } from "../mcp/cms-mcp-server.ts";

const ALL_CAPABILITIES: readonly CmsCapability[] = [
    "cms:read",
    "cms:write_draft",
    "cms:run_agent",
    "cms:create_pr",
    "cms:reconcile_release",
];

export interface CmsRouteAuthOptions {
    supabaseUrl?: string;
    anonKey?: string;
    mcpAccessToken?: string;
    fetcher?: typeof fetch;
}

export interface CmsRouteAuthResult {
    identity: CmsIdentityDecision | null;
    mcp: CmsMcpAuthContext | null;
    source: "mcp_token" | "supabase_session" | "none";
    bearer: string | null;
}

function constantTimeEqual(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return mismatch === 0;
}

function serviceIdentity(): CmsIdentityDecision {
    return {
        isAuthenticated: true,
        isAdmin: true,
        statusCode: 200,
        reasonCode: "VERIFIED_GOOGLE_ADMIN",
        accountHandle: "mcp-service",
        verifiedEmail: "",
        googleSubject: "mcp-service",
        role: "operator",
        capabilities: ALL_CAPABILITIES,
        destinations: [],
        message: "MCP 서비스 토큰으로 인증된 자동화 세션입니다.",
    };
}

export function mcpAuthFromIdentity(identity: CmsIdentityDecision): CmsMcpAuthContext {
    return {
        subject: identity.googleSubject || identity.accountHandle,
        handle: identity.accountHandle || identity.googleSubject,
        role: identity.role as CmsAdminRole | "service",
        capabilities: identity.capabilities as CmsMcpAuthContext["capabilities"],
        transport: identity.accountHandle === "mcp-service" ? "mcp_token" : "session",
    };
}

async function fetchMembership(
    user: { id: string; email?: string | null; email_confirmed_at?: string | null; app_metadata?: { provider?: string }; identities?: CmsIdentityVerificationInput["identities"]; user_metadata?: Record<string, unknown> },
    options: CmsRouteAuthOptions,
    fetcher: typeof fetch,
    bearer: string,
): Promise<CmsIdentityDecision> {
    const base = (options.supabaseUrl || "").replace(/\/$/, "");
    const key = options.anonKey || "";
    let membership: CmsIdentityVerificationInput["membership"] = null;
    try {
        const response = await fetcher(
            `${base}/rest/v1/sejong_cms_memberships?select=*&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
            {
                // RLS 정책은 authenticated 역할에만 열려 있으므로 사용자 토큰으로 멤버십을 조회합니다.
                headers: { apikey: key, Authorization: `Bearer ${bearer}`, Accept: "application/json" },
                cache: "no-store",
            },
        );
        if (response.ok) {
            const rows = (await response.json()) as Record<string, unknown>[];
            const row = Array.isArray(rows) ? rows[0] : null;
            if (row) {
                membership = {
                    userId: String(row.user_id),
                    provider: String(row.provider),
                    googleSubject: String(row.google_subject),
                    accountHandle: String(row.account_handle),
                    verifiedEmail: String(row.verified_email),
                    role: row.role as CmsAdminRole,
                    capabilities: Array.isArray(row.capabilities) ? (row.capabilities as CmsCapability[]) : [],
                    active: row.active === true,
                    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
                };
            }
        }
    } catch {
        membership = null;
    }
    return verifyAdminIdentity({
        userId: user.id,
        email: user.email || null,
        emailVerified: Boolean(user.email_confirmed_at),
        appProvider: user.app_metadata?.provider || null,
        identities: user.identities || [],
        userMetadata: user.user_metadata || null,
        membership,
    });
}

// [요청 인증 해석 / Request authentication] Authorization: Bearer 토큰을 검증합니다.
export async function resolveCmsRouteAuth(
    headers: { get(name: string): string | null },
    options: CmsRouteAuthOptions,
): Promise<CmsRouteAuthResult> {
    const authorization = headers.get("authorization") || "";
    const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!bearer) return { identity: null, mcp: null, source: "none", bearer: null };

    if (options.mcpAccessToken && constantTimeEqual(bearer, options.mcpAccessToken)) {
        const identity = serviceIdentity();
        return { identity, mcp: mcpAuthFromIdentity(identity), source: "mcp_token", bearer };
    }

    const base = (options.supabaseUrl || "").replace(/\/$/, "");
    const key = options.anonKey || "";
    if (!base || !key) return { identity: null, mcp: null, source: "none", bearer };

    const fetcher = options.fetcher || fetch;
    try {
        const response = await fetcher(`${base}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${bearer}`, apikey: key },
            cache: "no-store",
        });
        if (!response.ok) return { identity: null, mcp: null, source: "none" as const, bearer };
        const user = (await response.json()) as {
            id?: string;
            email?: string | null;
            email_confirmed_at?: string | null;
            app_metadata?: { provider?: string };
            identities?: CmsIdentityVerificationInput["identities"];
            user_metadata?: Record<string, unknown>;
        };
        if (!user?.id) return { identity: null, mcp: null, source: "none" as const, bearer };
        const identity = await fetchMembership({ ...user, id: user.id }, options, fetcher, bearer);
        return {
            identity,
            mcp: identity.isAdmin ? mcpAuthFromIdentity(identity) : null,
            source: "supabase_session",
            bearer,
        };
    } catch {
        return { identity: null, mcp: null, source: "none", bearer };
    }
}
