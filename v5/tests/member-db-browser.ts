import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { chromium, expect } from "playwright/test";
import type { BrowserContext, Page, Route } from "playwright";
import { accountToday } from "../src/lib/account-space.ts";
import { PROGRAMS } from "../src/data/catalog.ts";

// [실제 SDK와 모의 회원 DB / Real SDK with a simulated member database]
// 실제 이메일을 보내거나 원격 회원 데이터를 변경하지 않습니다.
// Exercises HTTP integration; this fixture does not prove deployed RLS policies.
const base = (process.argv[2] || "http://127.0.0.1:3000/v5/").replace(/\/?$/, "/");
const environment = fs.readFileSync(".env.local", "utf8");
const backend = environment.match(/^NEXT_PUBLIC_SUPABASE_URL=["']?([^\r\n"']+)/m)?.[1]?.replace(/\/$/, "");
if (!backend) throw new Error("The public Supabase URL is required for the SDK integration fixture.");
const origin = new URL(base).origin;
const backendOrigin = new URL(backend).origin;
const storageKey = `sb-${new URL(backend).hostname.split(".")[0]}-auth-token`;
const directory = ".local-reports/member-db";
fs.mkdirSync(directory, { recursive: true });
const browser = await chromium.launch();
const memberA = "123e4567-e89b-42d3-a456-426614174000";
const memberB = "123e4567-e89b-42d3-a456-426614174001";
const program = PROGRAMS.find(item => item.id === "winter")!;
assert.ok(program, "The winter program is available to the booking fixture.");
type Row = Record<string, any>;
type LoggedRequest = { table: string; method: string; userId: string; body: Row | null; url: string };
const users: Record<string, Row> = Object.fromEntries([memberA, memberB].map((id, index) => [id, {
    id, aud: "authenticated", role: "authenticated", email: `member-${index + 1}@example.com`,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: index ? "두 번째 회원" : "첫 번째 회원", phone: "" },
    identities: [], created_at: new Date().toISOString(),
}]));
const store: Record<string, Row[]> = {
    sejong_profiles: [],
    sejong_spaces: [
        { user_id: memberA, nickname: "서버 공연장", message: "서버에서 읽은 첫 번째 공간", theme: "paper", light_on: true },
        { user_id: memberB, nickname: "두 번째 공간", message: "두 번째 회원의 비공개 한마디", theme: "sun", light_on: false },
    ],
    sejong_favorites: [], sejong_notes: [], sejong_bookings: [],
};
const requests: LoggedRequest[] = [];
const otpRequests: { body: Row; url: string }[] = [];
const protocolErrors: string[] = [];
const runtimeErrors: string[] = [];
const results: { name: string; passed: boolean; error?: string }[] = [];
const legacyWrites = new WeakMap<BrowserContext, string[]>();

// [요청 완료를 직접 제어하는 대기 장치 / Deterministic request completion gates]
function gate() {
    let release!: () => void;
    return { promise: new Promise<void>(resolve => { release = resolve; }), release: () => release() };
}
type Rule = { match: (table: string, method: string, owner: string) => boolean; wait?: ReturnType<typeof gate>; status?: number; commitBeforeFailure?: boolean; used?: boolean };
const rules: Rule[] = [];
function nextRequest(table: string, method: string, options: { hold?: boolean; fail?: boolean; commitBeforeFailure?: boolean; owner?: string } = {}) {
    const wait = options.hold ? gate() : undefined;
    const rule: Rule = { match: (candidate, verb, owner) => candidate === table && verb === method && (!options.owner || options.owner === owner), wait, status: options.fail || options.commitBeforeFailure ? 503 : undefined, commitBeforeFailure: options.commitBeforeFailure };
    rules.push(rule);
    return { rule, release: () => wait?.release() };
}
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
function session(id: string) {
    const now = Math.floor(Date.now() / 1000);
    return { access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now, iss: `${backend}/auth/v1` })}.fixture-signature`, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: `fixture-refresh-${id}`, user: users[id] };
}
function requestOwner(route: Route) {
    try { return JSON.parse(Buffer.from((route.request().headers().authorization || "").replace(/^Bearer /i, "").split(".")[1], "base64url").toString()).sub as string; }
    catch { return ""; }
}
function matches(row: Row, url: URL) {
    return [...url.searchParams].every(([key, value]) => !value.startsWith("eq.") || String(row[key]) === value.slice(3));
}
async function respond(route: Route, rows: Row[], status = 200) {
    const single = route.request().headers().accept?.includes("application/vnd.pgrst.object+json");
    await route.fulfill({ status, json: single ? rows[0] || null : rows });
}

// [인증과 PostgREST 요청 경계 / Auth and PostgREST request boundaries]
async function mockBackend(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (url.pathname === "/auth/v1/settings") return route.fulfill({ json: { external: { google: false } } });
    if (url.pathname === "/auth/v1/otp") {
        otpRequests.push({ body: request.postDataJSON(), url: url.href });
        const rule = rules.find(item => !item.used && item.match("otp", method, ""));
        if (rule) { rule.used = true; await rule.wait?.promise; }
        return route.fulfill(rule?.status ? { status: rule.status, json: { msg: "Unable to send a login link", error_code: "email_rate_limit_exceeded" } } : { json: {} });
    }
    const owner = requestOwner(route);
    if (url.pathname === "/auth/v1/user") {
        if (!users[owner]) return route.fulfill({ status: 401, json: { message: "Invalid session" } });
        if (method === "PUT") users[owner].user_metadata = { ...users[owner].user_metadata, ...request.postDataJSON().data };
        return route.fulfill({ json: users[owner] });
    }
    if (url.pathname === "/auth/v1/logout") return route.fulfill({ status: 204 });
    if (url.pathname === "/auth/v1/token") {
        const id = String(request.postDataJSON().refresh_token || "").endsWith(memberB) ? memberB : memberA;
        return route.fulfill({ json: session(id) });
    }
    const table = url.pathname.replace(/^\/rest\/v1\//, "");
    if (!(table in store)) {
        protocolErrors.push(`Unexpected mocked backend request: ${method} ${url.pathname}`);
        return route.fulfill({ status: 404, json: { message: "Unexpected fixture endpoint" } });
    }
    const body = request.postData() ? request.postDataJSON() : null;
    requests.push({ table, method, userId: owner, body, url: url.href });
    if (!users[owner] || (body && body.user_id && body.user_id !== owner) || (method === "GET" && url.searchParams.get("user_id") !== `eq.${owner}`)) {
        protocolErrors.push(`Missing authenticated owner boundary: ${table}/${method}`);
        return route.fulfill({ status: 403, json: { message: "Fixture owner boundary" } });
    }
    // Capture the old user's payload before holding a response for the race test.
    const captured = store[table].filter(row => row.user_id === owner && matches(row, url)).map(row => ({ ...row }));
    const rule = rules.find(item => !item.used && item.match(table, method, owner));
    if (rule) { rule.used = true; await rule.wait?.promise; }
    if (rule?.status && !rule.commitBeforeFailure) return route.fulfill({ status: rule.status, json: { code: "FIXTURE_UNAVAILABLE", message: "Simulated database failure" } });
    if (method === "GET") return respond(route, captured);
    let changed: Row[] = [];
    if (method === "POST") {
        const incoming = { id: randomUUID(), created_at: new Date().toISOString(), ...(table === "sejong_bookings" ? { status: "confirmed" } : {}), ...body, user_id: owner };
        const keys = table === "sejong_favorites" ? ["user_id", "program_id"] : ["sejong_spaces", "sejong_profiles"].includes(table) ? ["user_id"] : ["id"];
        const existing = store[table].find(row => keys.every(key => row[key] === incoming[key]));
        if (existing) { if (!request.headers().prefer?.includes("resolution=ignore-duplicates")) { Object.assign(existing, incoming); changed = [existing]; } }
        else { store[table].push(incoming); changed = [incoming]; }
    } else if (method === "PATCH") {
        changed = store[table].filter(row => row.user_id === owner && matches(row, url));
        changed.forEach(row => Object.assign(row, body));
    } else if (method === "DELETE") {
        changed = store[table].filter(row => row.user_id === owner && matches(row, url));
        store[table] = store[table].filter(row => !changed.includes(row));
    }
    if (rule?.commitBeforeFailure) return route.fulfill({ status: rule.status!, json: { code: "FIXTURE_RESPONSE_LOST", message: "Committed, but the successful response was lost" } });
    if (request.headers().prefer?.includes("return=representation")) return respond(route, changed, method === "POST" ? 201 : 200);
    return route.fulfill({ status: 204 });
}

// [독립 브라우저와 금지된 로컬 저장 감시 / Fresh contexts and forbidden local persistence]
async function memberContext(id: string | null) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: { cookies: [], origins: id ? [{ origin, localStorage: [{ name: storageKey, value: JSON.stringify(session(id)) }] }] : [] } });
    const attemptedKeys: string[] = [];
    legacyWrites.set(context, attemptedKeys);
    await context.exposeBinding("reportLegacyMemberWrite", (_source, key: string) => attemptedKeys.push(key));
    await context.route(url => url.origin === backendOrigin, mockBackend);
    await context.addInitScript(() => {
        const fixture = window as Window & { memberLegacyWrites?: string[]; reportLegacyMemberWrite?: (key: string) => Promise<void> };
        fixture.memberLegacyWrites = [];
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
            if (/^(?:sejong-v4:(?:profile|session|favorites|bookings)|sejong-v5:(?:space|notes):)/.test(key)) {
                fixture.memberLegacyWrites!.push(key);
                void fixture.reportLegacyMemberWrite?.(key);
            }
            return original.call(this, key, value);
        };
    });
    return context;
}
async function noLegacyWrites(page: Page) {
    assert.deepEqual(legacyWrites.get(page.context()), []);
    assert.deepEqual(await page.evaluate(() => (window as Window & { memberLegacyWrites?: string[] }).memberLegacyWrites || []), []);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(key => /^(?:sejong-v4:(?:profile|session|favorites|bookings)|sejong-v5:(?:space|notes):)/.test(key))), []);
}
const ready = (page: Page) => expect(page.locator('.account-layout[aria-busy="false"]')).toBeVisible();
async function switchMember(page: Page, id: string, event = "SIGNED_IN") {
    await page.evaluate(({ key, next, event }) => {
        localStorage.setItem(key, JSON.stringify(next));
        const channel = new BroadcastChannel(key);
        channel.postMessage({ event, session: next });
        channel.close();
    }, { key: storageKey, next: session(id), event });
}
async function account(page: Page, path = "account/") { await page.goto(new URL(path, base).href); await ready(page); }
async function check(name: string, id: string | null, run: (page: Page, context: BrowserContext) => Promise<void>) {
    const context = await memberContext(id);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(60000);
    page.on("pageerror", error => runtimeErrors.push(error.message));
    try {
        await run(page, context);
        await noLegacyWrites(page);
        results.push({ name, passed: true });
        console.log(`PASS ${name}`);
    } catch (error) {
        results.push({ name, passed: false, error: String(error) });
        console.error(`FAIL ${name}: ${String(error)}`);
        await page.screenshot({ path: `${directory}/failure-${results.length}.png`, fullPage: true }).catch(() => {});
    } finally {
        rules.filter(rule => !rule.used || rule.wait).forEach(rule => rule.wait?.release());
        await context.close();
    }
}

try {
    await check("email forms await OTP and send the correct account-creation policy", null, async page => {
        for (const kind of ["login", "signup", "recovery"] as const) {
            await page.goto(new URL(`account/${kind}/`, base).href);
            const form = page.locator(`[data-account-auth="${kind}"]`);
            await form.locator("#flow-email").fill(`${kind}@example.com`);
            if (kind === "signup") {
                await form.locator("#flow-name").fill("가입 확인");
                await form.locator("#flow-phone").fill("010-1111-2222");
                await form.locator('input[name="consent"]').check();
            } else assert.equal(await form.locator('#flow-name,input[name="consent"]').count(), 0);
            const held = nextRequest("otp", "POST", { hold: true });
            try {
                await form.locator('button[type="submit"]').click();
                await expect.poll(() => held.rule.used).toBe(true);
                await expect(form.locator('button[type="submit"]')).toBeDisabled();
                await expect(page.getByText("이메일로 로그인 링크를 보냈습니다.", { exact: false })).toHaveCount(0);
                const sent = otpRequests.at(-1)!;
                assert.equal(sent.body.email, `${kind}@example.com`);
                assert.equal(sent.body.create_user, kind === "signup");
                assert.equal(new URL(sent.url).searchParams.get("redirect_to"), `${origin}/v5/account/callback/`);
                assert.ok(sent.body.code_challenge);
                if (kind === "signup") assert.deepEqual(sent.body.data, { name: "가입 확인", full_name: "가입 확인", phone: "010-1111-2222" });
            } finally { held.release(); }
            await expect(page.getByText("이메일로 로그인 링크를 보냈습니다.", { exact: false })).toBeVisible();
            nextRequest("otp", "POST", { fail: true });
            await form.locator('button[type="submit"]').click();
            await expect(form.locator('[role="alert"]')).toContainText("보내지 못했습니다");
            await expect(page.getByText("이메일로 로그인 링크를 보냈습니다.", { exact: false })).toHaveCount(0);
            await expect(form.locator('button[type="submit"]')).toBeEnabled();
            assert.ok(page.url().includes(`/account/${kind}/`), "Requesting a link does not create an authenticated session.");
            await noLegacyWrites(page);
        }
    });

    await check("room saves reach the DB before applying and survive two fresh contexts", memberA, async page => {
        await account(page);
        await expect(page.locator(".mini-room-note cite")).toContainText("서버 공연장");
        await page.locator(".mini-room-actions").getByRole("button", { name: "공간 꾸미기", exact: true }).click();
        await page.locator("#account-space-name").fill("DB에서 이어지는 공간");
        await page.locator("#account-space-message").fill("다른 브라우저에서도 이어지는 나의 한마디");
        await page.locator(".account-space-dialog").getByRole("button", { name: "하늘빛", exact: true }).click();
        const held = nextRequest("sejong_spaces", "POST", { hold: true });
        try {
            await page.getByRole("button", { name: "공간에 적용", exact: true }).click();
            await expect.poll(() => held.rule.used).toBe(true);
            await expect(page.locator(".mini-room-note cite")).toContainText("서버 공연장");
            await expect(page.locator(".account-space-dialog")).toBeVisible();
        } finally { held.release(); }
        await expect(page.locator('.account-mini-room[data-theme="sky"]')).toBeVisible();
        await expect(page.locator(".mini-room-note cite")).toContainText("DB에서 이어지는 공간");
        await page.reload(); await ready(page);
        await expect(page.locator(".mini-room-note cite")).toContainText("DB에서 이어지는 공간");
        const fresh = await memberContext(memberA);
        try {
            const other = await fresh.newPage(); await account(other);
            await expect(other.locator(".mini-room-note cite")).toContainText("DB에서 이어지는 공간");
            await expect(other.locator(".mini-room-note p")).toHaveText("다른 브라우저에서도 이어지는 나의 한마디");
            await noLegacyWrites(other);
        } finally { await fresh.close(); }
    });

    await check("notes create and delete through REST and remain escaped after reload", memberA, async page => {
        await account(page, "account/#account-panel-notes");
        await page.locator("#account-note-program").selectOption(program.id);
        await page.locator("#account-note-date").fill(accountToday());
        const body = "<script>실행하지 않는 개인 관람 기록</script>";
        await page.locator("#account-note-body").fill(body);
        await page.getByRole("button", { name: "노트 남기기", exact: true }).click();
        await expect(page.locator(".account-note-list .account-note")).toHaveCount(1);
        assert.equal(store.sejong_notes.filter(row => row.user_id === memberA)[0].body, body);
        await page.reload(); await ready(page);
        await expect(page.locator(".account-note-list")).toContainText(body);
        await expect(page.locator(".account-note-list script")).toHaveCount(0);
        nextRequest("sejong_notes", "DELETE", { fail: true });
        await page.locator(".account-note-list").getByRole("button", { name: /노트 삭제/ }).click();
        await expect(page.locator('[role="status"]').filter({ hasText: "요청을 완료하지 못했습니다" })).toBeVisible();
        await expect(page.locator(".account-note-list .account-note")).toHaveCount(1);
        await page.locator(".account-note-list").getByRole("button", { name: /노트 삭제/ }).click();
        await expect(page.locator(".account-note-list .account-note")).toHaveCount(0);
        await page.reload(); await ready(page);
        await expect(page.locator(".account-note-list .account-note")).toHaveCount(0);
    });

    await check("favorite fill follows the server and failed writes preserve the prior state", memberA, async page => {
        await page.goto(new URL("programs/", base).href);
        const favorite = page.locator(".program-card .favorite-button").first();
        await expect(favorite).toHaveAttribute("aria-pressed", "false");
        await page.locator(".program-card").first().hover();
        const held = nextRequest("sejong_favorites", "POST", { hold: true });
        try {
            await favorite.click();
            await expect.poll(() => held.rule.used).toBe(true);
            await expect(favorite).toHaveAttribute("aria-pressed", "false");
        } finally { held.release(); }
        await expect(favorite).toHaveAttribute("aria-pressed", "true");
        nextRequest("sejong_favorites", "DELETE", { fail: true });
        await favorite.click();
        await expect(page.locator('[role="status"]').filter({ hasText: "관심 프로그램을 저장하지 못했습니다" })).toBeVisible();
        await expect(favorite).toHaveAttribute("aria-pressed", "true");
        await page.reload();
        await expect(favorite).toHaveAttribute("aria-pressed", "true");
    });

    await check("booking inserts are awaited and cancellation persists after reload", memberA, async page => {
        await page.goto(new URL(`booking/${program.id}/`, base).href);
        await page.getByRole("button", { name: /좌석 선택하기/ }).click();
        await page.getByRole("button", { name: "A1 좌석", exact: true }).click();
        await page.getByRole("button", { name: "선택 내용 확인", exact: true }).click();
        const held = nextRequest("sejong_bookings", "POST", { hold: true });
        try {
            await page.getByRole("button", { name: "예매 기록 저장", exact: true }).click();
            await expect.poll(() => held.rule.used).toBe(true);
            await expect(page.locator("#booking-complete-heading")).toHaveCount(0);
            await expect(page.getByRole("button", { name: "저장 중…", exact: true })).toBeDisabled();
            await expect(page.getByRole("button", { name: "좌석 다시 선택", exact: true })).toBeDisabled();
        } finally { held.release(); }
        await expect(page.locator("#booking-complete-heading")).toBeVisible();
        assert.equal(store.sejong_bookings.filter(row => row.user_id === memberA).length, 1);
        await account(page, "account/bookings/");
        await expect(page.locator("#account-panel-bookings .account-ticket")).toHaveCount(1);
        await page.locator("#account-panel-bookings").getByRole("button", { name: "예매 기록 취소", exact: true }).click();
        await page.locator(".account-cancel-dialog").getByRole("button", { name: "예매 기록 취소", exact: true }).click();
        await expect(page.locator('#account-panel-bookings .account-ticket[data-cancelled="true"]')).toBeVisible();
        await page.reload(); await ready(page);
        await expect(page.locator('#account-panel-bookings .account-ticket[data-cancelled="true"]')).toBeVisible();
        assert.equal(store.sejong_bookings[0].status, "cancelled");
    });

    await check("ambiguous booking responses retry without duplicates and edited seats use a new request", memberA, async page => {
        const before = store.sejong_bookings.length;
        await page.goto(new URL(`booking/${program.id}/`, base).href);
        await page.getByRole("button", { name: /좌석 선택하기/ }).click();
        await page.getByRole("button", { name: "B1 좌석", exact: true }).click();
        await page.getByRole("button", { name: "선택 내용 확인", exact: true }).click();
        nextRequest("sejong_bookings", "POST", { commitBeforeFailure: true });
        await page.getByRole("button", { name: "예매 기록 저장", exact: true }).click();
        await expect(page.locator('.ds-notice[role="alert"]')).toBeVisible();
        assert.equal(store.sejong_bookings.length, before + 1);
        await page.getByRole("button", { name: "예매 기록 저장", exact: true }).click();
        await expect(page.locator("#booking-complete-heading")).toBeVisible();
        await expect(page.locator(".booking-page-saved-selection")).toContainText("B1");
        assert.equal(store.sejong_bookings.length, before + 1, "Retrying the same draft reuses the committed row.");
        await page.reload();
        await page.getByRole("button", { name: /좌석 선택하기/ }).click();
        await page.getByRole("button", { name: "C1 좌석", exact: true }).click();
        await page.getByRole("button", { name: "선택 내용 확인", exact: true }).click();
        nextRequest("sejong_bookings", "POST", { commitBeforeFailure: true });
        await page.getByRole("button", { name: "예매 기록 저장", exact: true }).click();
        await expect(page.locator('.ds-notice[role="alert"]')).toBeVisible();
        await page.getByRole("button", { name: "좌석 다시 선택", exact: true }).click();
        await page.getByRole("button", { name: "C1 좌석", exact: true }).click();
        await page.getByRole("button", { name: "C2 좌석", exact: true }).click();
        await page.getByRole("button", { name: "선택 내용 확인", exact: true }).click();
        await page.getByRole("button", { name: "예매 기록 저장", exact: true }).click();
        await expect(page.locator("#booking-complete-heading")).toBeVisible();
        await expect(page.locator(".booking-page-saved-selection")).toContainText("C2");
        const edited = store.sejong_bookings.at(-1)!;
        assert.deepEqual(edited.seats, ["C2"]);
        assert.equal(store.sejong_bookings.length, before + 3);
        assert.notEqual(edited.id, store.sejong_bookings.at(-2)!.id);
        await switchMember(page, memberB);
        await expect(page.locator("#booking-complete-heading")).toHaveCount(0);
        await expect(page.locator("#booking-date-heading")).toBeVisible();
        await page.getByRole("button", { name: /좌석 선택하기/ }).click();
        await expect(page.getByRole("button", { name: "C2 좌석", exact: true })).toHaveAttribute("aria-pressed", "false");
    });

    await check("profile changes persist in the member table without mutating provider metadata", memberA, async page => {
        await account(page, "account/profile/");
        await expect(page.locator("#account-profile-email")).toHaveAttribute("readonly", "");
        await page.locator("#account-profile-name").fill("DB 회원정보");
        await page.locator("#account-profile-phone").fill("010-2222-3333");
        await page.locator(".account-profile-form").getByRole("button", { name: "회원정보 저장", exact: true }).click();
        await expect.poll(() => store.sejong_profiles.find(row => row.user_id === memberA)?.name).toBe("DB 회원정보");
        assert.equal(users[memberA].user_metadata.full_name, "첫 번째 회원");
        await page.reload(); await ready(page);
        await expect(page.locator("#account-profile-name")).toHaveValue("DB 회원정보");
    });

    await check("a late profile read and token refresh cannot overwrite a saved member profile", memberA, async page => {
        const held = nextRequest("sejong_profiles", "GET", { hold: true, owner: memberA });
        const heldPage = nextRequest("sejong_profiles", "GET", { hold: true, owner: memberA });
        const lateReads: Promise<import("playwright").Response>[] = [];
        try {
            await account(page, "account/profile/");
            await expect.poll(() => held.rule.used).toBe(true);
            await expect.poll(() => heldPage.rule.used).toBe(true);
            await page.locator("#account-profile-name").fill("늦은 응답에도 유지할 이름");
            await page.locator(".account-profile-form").getByRole("button", { name: "회원정보 저장", exact: true }).click();
            await expect(page.locator('[role="status"]').filter({ hasText: "회원정보를 저장했어요" })).toBeVisible();
            await expect.poll(() => store.sejong_profiles.find(row => row.user_id === memberA)?.name).toBe("늦은 응답에도 유지할 이름");
            lateReads.push(page.waitForResponse(response => response.url().includes("/sejong_profiles") && response.request().method() === "GET"));
        } finally { held.release(); heldPage.release(); }
        for (const response of lateReads) await (await response).finished();
        await switchMember(page, memberA, "TOKEN_REFRESHED");
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await expect(page.locator("#account-profile-name")).toHaveValue("늦은 응답에도 유지할 이름");
        assert.equal(users[memberA].user_metadata.full_name, "첫 번째 회원");
    });

    await check("an initial favorites read failure can recover through a later click", memberB, async page => {
        const failed = nextRequest("sejong_favorites", "GET", { fail: true, owner: memberB });
        await page.goto(new URL("programs/", base).href);
        await expect.poll(() => failed.rule.used).toBe(true);
        const favorite = page.locator(".program-card .favorite-button").first();
        await page.locator(".program-card").first().hover();
        await favorite.click();
        await expect(favorite).toHaveAttribute("aria-pressed", "true");
        assert.ok(store.sejong_favorites.some(row => row.user_id === memberB));
    });

    await check("queued favorite clicks cannot be reassigned to a newly signed-in member", memberA, async page => {
        store.sejong_favorites = store.sejong_favorites.filter(row => row.user_id !== memberA);
        await page.goto(new URL("programs/", base).href);
        const cards = page.locator(".program-card");
        const first = cards.nth(0).locator(".favorite-button");
        const second = cards.nth(1).locator(".favorite-button");
        await expect(first).toHaveAttribute("aria-pressed", "false");
        const held = nextRequest("sejong_favorites", "POST", { hold: true, owner: memberA });
        const requestStart = requests.length;
        try {
            await cards.nth(0).hover(); await first.click();
            await expect.poll(() => held.rule.used).toBe(true);
            await cards.nth(1).hover(); await second.click();
            await switchMember(page, memberB);
            await expect.poll(() => requests.slice(requestStart).some(request => request.table === "sejong_favorites" && request.method === "GET" && request.userId === memberB)).toBe(true);
        } finally { held.release(); }
        await expect(page.locator('[role="status"]').filter({ hasText: "로그인한 계정이 변경되었습니다" })).toBeVisible();
        assert.equal(requests.slice(requestStart).filter(request => request.table === "sejong_favorites" && request.method !== "GET" && request.userId === memberB).length, 0);
        assert.equal(requests.slice(requestStart).filter(request => request.table === "sejong_favorites" && request.method === "POST" && request.userId === memberA).length, 1);
    });

    await check("logout clears private UI and guests cannot persist favorites or bookings", memberA, async page => {
        await account(page);
        await page.locator(".account-identity").getByRole("button", { name: /로그아웃/ }).click();
        await expect(page.locator("#header").getByRole("link", { name: "로그인", exact: true })).toBeVisible();
        await ready(page);
        await expect(page.locator(".mini-room-note cite")).not.toContainText("DB에서 이어지는 공간");
        await page.getByRole("tab", { name: "관심 프로그램 (0)", exact: true }).click();
        await expect(page.locator("#account-panel-favorites .program-card")).toHaveCount(0);
        const before = requests.filter(request => request.method !== "GET").length;
        await page.goto(new URL("programs/", base).href);
        const favorite = page.locator(".program-card .favorite-button").first();
        await page.locator(".program-card").first().hover();
        await favorite.click();
        await expect(page.locator('[role="status"]').filter({ hasText: /로그인한 뒤/ })).toBeVisible();
        await expect(favorite).toHaveAttribute("aria-pressed", "false");
        await page.goto(new URL(`booking/${program.id}/`, base).href);
        await page.getByRole("button", { name: /좌석 선택하기/ }).click();
        await page.getByRole("button", { name: "A2 좌석", exact: true }).click();
        await page.getByRole("button", { name: "선택 내용 확인", exact: true }).click();
        await page.getByRole("button", { name: "예매 기록 저장", exact: true }).click();
        await expect(page.locator('.ds-notice[role="alert"]')).toContainText("로그인한 뒤");
        await expect(page.locator("#booking-complete-heading")).toHaveCount(0);
        assert.equal(requests.filter(request => request.method !== "GET").length, before);
    });

    await check("late account A data cannot replace account B after an SDK session change", memberA, async page => {
        const held = nextRequest("sejong_spaces", "GET", { hold: true, owner: memberA });
        let lateResponse: Promise<import("playwright").Response> | undefined;
        try {
            await page.goto(new URL("account/", base).href, { waitUntil: "domcontentloaded" });
            await expect.poll(() => held.rule.used).toBe(true);
            const next = session(memberB);
            await page.evaluate(({ key, next }) => {
                localStorage.setItem(key, JSON.stringify(next));
                const channel = new BroadcastChannel(key);
                channel.postMessage({ event: "SIGNED_IN", session: next });
                channel.close();
            }, { key: storageKey, next });
            await ready(page);
            await expect(page.locator(".mini-room-note cite")).toContainText("두 번째 공간");
            lateResponse = page.waitForResponse(response => {
                const url = new URL(response.url());
                return url.pathname.endsWith("/sejong_spaces") && url.searchParams.get("user_id") === `eq.${memberA}`;
            });
        } finally { held.release(); }
        if (lateResponse) await (await lateResponse).finished();
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
        await expect.poll(() => requests.filter(request => request.table === "sejong_spaces" && request.userId === memberB).length).toBeGreaterThan(0);
        await expect(page.locator(".mini-room-note p")).toHaveText("두 번째 회원의 비공개 한마디");
        await expect(page.locator(".account-main")).not.toContainText("다른 브라우저에서도 이어지는 나의 한마디");
    });

    const expectedTables = ["sejong_profiles", "sejong_spaces", "sejong_favorites", "sejong_notes", "sejong_bookings"];
    for (const table of expectedTables) assert.ok(requests.some(request => request.table === table && request.method !== "GET"), `${table} has an exercised write path.`);
    assert.deepEqual(protocolErrors, []);
    assert.deepEqual(runtimeErrors, []);
} finally {
    fs.writeFileSync(`${directory}/report.json`, JSON.stringify({ base, verifiedAt: new Date().toISOString(), mode: "actual Supabase SDK with mocked Auth and PostgREST; not live RLS verification", results, protocolErrors, runtimeErrors, requestCounts: Object.fromEntries(Object.keys(store).map(table => [table, requests.filter(request => request.table === table).length])) }, null, 2));
    await browser.close();
}
if (results.some(result => !result.passed)) process.exitCode = 1;
