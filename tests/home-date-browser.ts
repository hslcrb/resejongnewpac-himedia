/**
 * Static-export regression: future visits, Seoul midnight and explicit calendar selections.
 * BASE_URL=http://127.0.0.1:3000/ node tests/home-date-browser.ts
 * HOME_DATE_REPORT_DIR chooses evidence; CHROMIUM_EXECUTABLE_PATH overrides system Chromium.
 * Public catalog reads are mocked. External requests, account writes and email are blocked.
 * Date-only mocking is used for the future visit; running timer mocks advance the midnight interval.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { Page } from "playwright";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = new URL(process.env.BASE_URL || "http://127.0.0.1:3000/");
if (target.pathname === "/") target.pathname = "/";
const base = target.href.replace(/\/?$/, "/");
const directory = resolve(process.env.HOME_DATE_REPORT_DIR || resolve(projectRoot, "../work/home-date"));
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const catalog = JSON.parse(readFileSync(resolve(projectRoot, "src/generated/catalog-snapshot.json"), "utf8"));
const results: Record<string, unknown>[] = [];
const blockedWrites: string[] = [];
const dateSelector = '#home-booking-calendar input[type="date"]';
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });

async function until(read: () => Promise<string>, expected: string, message: string) {
    const deadline = Date.now() + 5_000;
    let actual = await read();
    while (actual !== expected && Date.now() < deadline) { await new Promise(done => setTimeout(done, 50)); actual = await read(); }
    assert.equal(actual, expected, message);
}

async function enter(page: Page, expectedDate: string) {
    const response = await page.goto(base, { waitUntil: "load" });
    assert.equal(response?.status(), 200);
    await page.locator("#home-booking-calendar").waitFor({ state: "visible" });
    await until(() => page.locator(dateSelector).inputValue(), expectedDate, "A future visit must select the actual Seoul date after hydration");
    await page.locator("[data-entry-intro]").waitFor({ state: "detached" });
}

async function check(name: string, run: (page: Page) => Promise<unknown>) {
    // The registered month and Today controls are desktop UI; narrow layouts replace them with a native date field.
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", serviceWorkers: "block" });
    await context.route("**/*", route => {
        const request = route.request(), url = new URL(request.url());
        if (/(?:^|\.)supabase\.(co|in)$/.test(url.hostname) || /^\/(rest|auth)\/v1\//.test(url.pathname)) {
            const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
            if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
            if (url.pathname === "/rest/v1/rpc/sejong_catalog_snapshot" && ["GET", "POST"].includes(request.method())) return route.fulfill({ json: catalog, headers });
            if (request.method() === "GET") return route.fulfill({ json: url.pathname === "/auth/v1/settings" ? { external: { google: false } } : [], headers });
            blockedWrites.push(`${request.method()} ${url.origin}${url.pathname}`);
            return route.fulfill({ status: 403, json: { message: "Date regression fixture blocks remote mutations" }, headers });
        }
        if (url.origin !== target.origin && /^https?:$/.test(url.protocol)) return route.abort("blockedbyclient");
        if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) { blockedWrites.push(`${request.method()} ${url.origin}${url.pathname}`); return route.fulfill({ status: 403, json: {} }); }
        return route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(8_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const result: Record<string, unknown> = { name, status: "running", runtimeErrors: errors };
    try {
        result.detail = await run(page);
        assert.deepEqual(errors, [], "A static build must hydrate without errors on arbitrary future dates");
        result.status = "passed"; console.log(`PASS ${name}`);
    } catch (error) {
        result.status = "failed"; result.error = error instanceof Error ? error.stack : String(error);
        await page.screenshot({ path: resolve(directory, `${name}.png`) }).catch(() => {});
        console.error(`FAIL ${name}: ${error instanceof Error ? error.message : error}`);
    } finally {
        results.push(result); await context.close();
        writeFileSync(resolve(directory, "report.json"), JSON.stringify({ base, fixture: "Mocked public catalog; no external writes or email", blockedWrites, results }, null, 2) + "\n");
    }
}

try {
    await check("future-static-entry", async page => {
        // setFixedTime changes Date only: hydration, CSS, animation and real timers continue normally.
        await page.clock.setFixedTime(new Date("2032-05-06T03:00:00Z"));
        await enter(page, "2032-05-06");
        assert.equal(await page.locator("#quick-month").innerText(), "2032. 05");
        assert.equal(await page.locator('#home-booking-calendar [aria-current="date"]').getAttribute("id"), "home-booking-date-2032-05-06");
        return { clock: "Date only", injectedUTC: "2032-05-06T03:00:00Z", selectedDate: await page.locator(dateSelector).inputValue() };
    });

    await check("seoul-midnight-default-follows-today", async page => {
        await page.clock.install({ time: new Date("2031-12-31T14:59:30Z") });
        await enter(page, "2031-12-31");
        await page.clock.fastForward(61_000); // Runs the sixty-second subscriber across Seoul midnight without a real wait.
        await until(() => page.locator(dateSelector).inputValue(), "2032-01-01", "The untouched default date must follow Seoul midnight");
        await until(() => page.locator("#quick-month").innerText(), "2032. 01", "The default calendar must follow a new month and year");
        assert.equal(await page.locator('#home-booking-calendar [aria-current="date"]').getAttribute("id"), "home-booking-date-2032-01-01");
        return { fromUTC: "2031-12-31T14:59:30Z", advancedMs: 61_000, selectedDate: await page.locator(dateSelector).inputValue() };
    });

    await check("seoul-midnight-preserves-user-selection", async page => {
        await page.clock.install({ time: new Date("2031-12-31T14:59:30Z") });
        await enter(page, "2031-12-31");
        for (let month = 0; month < 3; month++) await page.locator("#home-booking-next-month").click();
        await page.locator("#home-booking-date-2032-03-12").click();
        await until(() => page.locator("#quick-month").innerText(), "2032. 03", "A user date choice must navigate the calendar");
        await page.clock.fastForward(61_000);
        assert.equal(await page.locator(dateSelector).inputValue(), "2032-03-12", "Crossing midnight must preserve an explicit user choice");
        assert.equal(await page.locator("#quick-month").innerText(), "2032. 03");
        await page.locator("#home-booking-today").click();
        await until(() => page.locator(dateSelector).inputValue(), "2032-01-01", "The Today action must use the updated Seoul date");
        return { explicitDate: "2032-03-12", advancedMs: 61_000, afterTodayAction: await page.locator(dateSelector).inputValue() };
    });
    await check("seoul-midnight-preserves-month-navigation", async page => {
        await page.clock.install({ time: new Date("2031-12-31T14:59:30Z") });
        await enter(page, "2031-12-31");
        await page.locator("#home-booking-next-month").click();
        await page.locator("#home-booking-next-month").click();
        await until(() => page.locator("#quick-month").innerText(), "2032. 02", "Manual month navigation must open February");
        await page.clock.fastForward(61_000);
        await until(() => page.locator(dateSelector).inputValue(), "2032-01-01", "An untouched date still follows midnight after month navigation");
        assert.equal(await page.locator("#quick-month").innerText(), "2032. 02", "Midnight must preserve the user's independently chosen calendar month");
        return { explicitMonth: "2032. 02", selectedDate: await page.locator(dateSelector).inputValue(), advancedMs: 61_000 };
    });
    assert.deepEqual(blockedWrites, []);
    const failed = results.filter(result => result.status === "failed").length;
    console.log(`${results.length} home date checks; ${failed} failed. Evidence: ${directory}`);
    if (failed) process.exitCode = 1;
} finally { await browser.close(); }
