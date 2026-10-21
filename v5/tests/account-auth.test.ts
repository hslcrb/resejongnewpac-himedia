import test from "node:test";
import assert from "node:assert/strict";
import * as auth from "../src/lib/supabase.ts";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import * as account from "../components/useAccountIdentity.ts";

// [공개 키와 고정 콜백 경계 / Public key and fixed callback boundaries]
// A server credential or attacker-controlled return URL must never enter browser auth.
test("browser auth accepts publishable and anon keys while rejecting privileged credentials", () => {
    assert.equal(typeof auth.isPublicSupabaseKey, "function");
    const jwt = (role: string) => `e30.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
    assert.equal(auth.isPublicSupabaseKey("sb_publishable_example"), true);
    assert.equal(auth.isPublicSupabaseKey(jwt("anon")), true);
    for (const credential of ["", "sb_secret_example", jwt("service_role"), "not-a-key"]) {
        assert.equal(auth.isPublicSupabaseKey(credential), false);
    }
});

test("OAuth callback remains on the initiating origin with a fixed static route", () => {
    assert.equal(typeof auth.getAccountCallbackUrl, "function");
    assert.equal(auth.getAccountCallbackUrl("https://renewsejongpac.rhee.life"), "https://renewsejongpac.rhee.life/v5/account/callback/");
    assert.equal(auth.getAccountCallbackUrl("http://localhost:3000"), "http://localhost:3000/v5/account/callback/");
    for (const origin of ["javascript:alert(1)", "//evil.example", "http://evil.example", "https://user:password@evil.example", "https://good.example/?next=https://evil.example"]) {
        assert.throws(() => auth.getAccountCallbackUrl(origin));
    }
});

test("an unavailable or malformed provider is never offered as enabled", () => {
    assert.equal(typeof auth.isGoogleOAuthEnabled, "function");
    assert.equal(auth.isGoogleOAuthEnabled({ external: { google: true } }), true);
    for (const settings of [null, {}, { external: { google: false } }, { external: { google: "true" } }]) {
        assert.equal(auth.isGoogleOAuthEnabled(settings), false);
    }
});

// [실제 세션과 체험 데이터의 분리 / Real session and demo data separation]
const storage = (values: Record<string, unknown>) => ({ getItem: (key: string) => key in values ? JSON.stringify(values[key]) : null });

test("an SDK identity overrides a saved demo profile without changing its storage", () => {
    assert.equal(typeof auth.resolveAccountIdentity, "function");
    const saved = storage({ "sejong-v4:session": { active: true }, "sejong-v4:profile": { name: "체험", email: "demo@example.com", phone: "" } });
    const user = { id: "real-user-123", email: "real@example.com", user_metadata: { full_name: "실제 회원", phone: "01012345678" } } as User;
    assert.deepEqual(auth.resolveAccountIdentity(user, saved), {
        profile: { name: "실제 회원", email: "real@example.com", phone: "01012345678" },
        identityId: "real-user-123", isLoggedIn: true, mode: "oauth", ready: true,
    });
    assert.equal(JSON.parse(saved.getItem("sejong-v4:profile")!).email, "demo@example.com");
});

test("a local demo session retains its identity and is never labeled OAuth", () => {
    assert.equal(typeof auth.resolveAccountIdentity, "function");
    assert.deepEqual(auth.resolveAccountIdentity(null, storage({ "sejong-v4:session": { active: true }, "sejong-v4:profile": { name: "관람객", email: "visitor@example.com", phone: "" } })), {
        profile: { name: "관람객", email: "visitor@example.com", phone: "" },
        identityId: "demo:visitor@example.com", isLoggedIn: true, mode: "demo", ready: true,
    });
});

test("different local profiles have separate space identities with normalized email", () => {
    const identity = (email: string) => auth.resolveAccountIdentity(null, storage({ "sejong-v4:session": { active: true }, "sejong-v4:profile": { name: "관람객", email, phone: "" } })).identityId;
    assert.equal(identity(" First@Example.com "), "demo:first@example.com");
    assert.equal(identity("first@example.com"), "demo:first@example.com");
    assert.notEqual(identity("first@example.com"), identity("second@example.com"));
});

test("demo registration creates a new identity while email edits and repeat sign-in keep it", () => {
    const first = auth.createDemoProfile({name:"첫 계정",email:"first@example.com",phone:""});
    const second = auth.createDemoProfile({name:"다른 계정",email:"first@example.com",phone:""});
    assert.notEqual(first.localId, second.localId);
    const edited = {...first,email:"changed@example.com"};
    const identity = (profile: unknown) => auth.resolveAccountIdentity(null,storage({"sejong-v4:session":{active:true},"sejong-v4:profile":profile})).identityId;
    assert.equal(identity(first), identity(edited));
    assert.equal(auth.createDemoProfile(edited,JSON.stringify(edited)).localId,first.localId);
    assert.equal(auth.createDemoProfile({name:"기존",email:"old@example.com",phone:""},'{"email":"old@example.com"}').localId,"old@example.com");
});

// [차단된 저장소의 로그아웃과 SDK 변경 순서 / Logout with blocked storage and SDK mutation ordering]
test("blocked logout persistence still keeps every mounted or remounted reader signed out", () => {
    assert.equal(typeof account.clearDemoSession, "function");
    const saved = { ...storage({ "sejong-v4:session": { active: true }, "sejong-v4:profile": { name: "체험", email: "demo@example.com", phone: "" } }), setItem() { throw new Error("writes blocked"); } };
    assert.equal(account.activateDemoSession(saved), true);
    assert.equal(account.readAccountIdentity(null, saved).mode, "demo");
    assert.equal(account.clearDemoSession(saved), false);
    assert.equal(account.readAccountIdentity(null, saved).mode, "guest");
    assert.equal(account.readAccountIdentity(null, { getItem: saved.getItem }).mode, "guest");
    assert.equal(account.activateDemoSession(saved), true);
    assert.equal(account.readAccountIdentity(null, saved).mode, "demo");
});

test("a queued SDK profile response cannot restore a session after successful queued logout", async () => {
    assert.equal(typeof account.queueAccountMutation, "function");
    const now = Math.floor(Date.now() / 1000);
    const user = { id: "fixture-user-a", aud: "authenticated", role: "authenticated", email: "fixture@example.com", app_metadata: { provider: "google" }, user_metadata: { name: "before" }, created_at: new Date().toISOString() };
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: now + 3600, iat: now })}.fixture`;
    const values = new Map([["sb-fixture-auth-token", JSON.stringify({ access_token: token, refresh_token: "fixture-refresh", expires_at: now + 3600, expires_in: 3600, token_type: "bearer", user })]]);
    let releaseUpdate: () => void;
    let markRequested: () => void;
    const requested = new Promise<void>(resolve => { markRequested = resolve; });
    const deferred = new Promise<void>(resolve => { releaseUpdate = resolve; });
    const client = createClient("https://fixture.supabase.co", "sb_publishable_fixture", {
        auth: { autoRefreshToken: false, detectSessionInUrl: false, storage: { getItem: key => values.get(key) || null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } } },
        global: { fetch: async (url, options) => {
            if (options?.method === "PUT") { markRequested!(); await deferred; return new Response(JSON.stringify({ ...user, user_metadata: { name: "after" } }), { status: 200, headers: { "content-type": "application/json" } }); }
            if (String(url).includes("logout")) return new Response(null, { status: 204 });
            return new Response(JSON.stringify(user), { status: 200, headers: { "content-type": "application/json" } });
        } },
    });
    await client.auth.initialize();
    const profile = account.queueAccountMutation(() => client.auth.updateUser({ data: { name: "after" } }));
    await requested;
    const logout = account.queueAccountMutation(() => client.auth.signOut());
    releaseUpdate!();
    await Promise.all([profile, logout]);
    assert.equal((await client.auth.getSession()).data.session, null);
    assert.equal(values.has("sb-fixture-auth-token"), false);
    await client.auth.stopAutoRefresh();
});

test("missing, inactive, or malformed local sessions remain guests", () => {
    assert.equal(typeof auth.resolveAccountIdentity, "function");
    for (const saved of [null, storage({}), storage({ "sejong-v4:session": { active: "true" } }), { getItem() { throw Error("storage unavailable"); } }, { getItem() { return "not-json"; } }]) {
        const result = auth.resolveAccountIdentity(null, saved);
        assert.equal(result.mode, "guest");
        assert.equal(result.isLoggedIn, false);
        assert.equal(result.identityId, "guest");
    }
});
