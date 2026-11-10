import assert from "node:assert/strict";
import test from "node:test";
import { resolveCmsRouteAuth } from "../src/cms/route-auth.ts";

function headersOf(record: Record<string, string>) {
    return { get: (name: string) => record[name.toLowerCase()] ?? null };
}

test("MCP 서비스 토큰은 상수 시간 비교로 관리자 세션을 만든다", async () => {
    const result = await resolveCmsRouteAuth(headersOf({ authorization: "Bearer service-token-1234" }), {
        mcpAccessToken: "service-token-1234",
    });
    assert.equal(result.source, "mcp_token");
    assert.equal(result.identity?.isAdmin, true);
    assert.deepEqual(result.mcp?.capabilities, ["cms:read", "cms:write_draft", "cms:run_agent", "cms:create_pr", "cms:reconcile_release"]);

    const mismatch = await resolveCmsRouteAuth(headersOf({ authorization: "Bearer service-token-9999" }), {
        mcpAccessToken: "service-token-1234",
    });
    assert.equal(mismatch.identity, null);
});

test("Supabase 세션은 사용자 토큰으로 멤버십을 조회하고 관리자 판정을 만든다", async () => {
    const calls: { url: string; authorization: string | null }[] = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const headers = new Headers(init?.headers as HeadersInit);
        calls.push({ url, authorization: headers.get("authorization") });
        if (url.endsWith("/auth/v1/user")) {
            return new Response(
                JSON.stringify({
                    id: "user-uuid",
                    email: "admin@example.com",
                    email_confirmed_at: "2026-01-01T00:00:00Z",
                    app_metadata: { provider: "google" },
                    identities: [{ provider: "google", identity_data: { email: "admin@example.com", email_verified: true, sub: "google-sub-1" } }],
                    user_metadata: {},
                }),
                { status: 200 },
            );
        }
        return new Response(
            JSON.stringify([
                {
                    user_id: "user-uuid",
                    provider: "google",
                    google_subject: "google-sub-1",
                    account_handle: "admin",
                    verified_email: "admin@example.com",
                    role: "super_admin",
                    capabilities: ["cms:read", "cms:write_draft", "cms:create_pr", "cms:reconcile_release"],
                    active: true,
                    revoked_at: null,
                },
            ]),
            { status: 200 },
        );
    }) as typeof fetch;

    const result = await resolveCmsRouteAuth(headersOf({ authorization: "Bearer user-access-token" }), {
        supabaseUrl: "https://project.supabase.co",
        anonKey: "anon-key",
        fetcher,
    });
    assert.equal(result.source, "supabase_session");
    assert.equal(result.identity?.isAdmin, true);
    assert.equal(result.mcp?.handle, "admin");
    assert.equal(calls.length, 2);
    // 멤버십 조회도 사용자 토큰으로 수행되어 RLS(authenticated) 정책을 통과해야 한다.
    assert.ok(calls.every((call) => call.authorization === "Bearer user-access-token"));
});

test("멤버십이 없으면 관리자 권한을 주지 않는다", async () => {
    const fetcher = (async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/auth/v1/user")) {
            return new Response(JSON.stringify({ id: "user-uuid", email: "other@gmail.com", email_confirmed_at: "2026-01-01T00:00:00Z" }), {
                status: 200,
            });
        }
        return new Response(JSON.stringify([]), { status: 200 });
    }) as typeof fetch;

    const result = await resolveCmsRouteAuth(headersOf({ authorization: "Bearer user-access-token" }), {
        supabaseUrl: "https://project.supabase.co",
        anonKey: "anon-key",
        fetcher,
    });
    assert.equal(result.identity?.isAdmin, false);
    assert.equal(result.mcp, null);
});
