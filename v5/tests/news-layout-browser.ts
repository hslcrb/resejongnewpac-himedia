/**
 * News page heading parity and real client navigation against the static export.
 * node tests/news-layout-browser.ts [http://127.0.0.1:8001/v5/]
 * REPORT_DIR selects screenshots and JSON. Public catalog requests use the snapshot;
 * external requests and remote writes are blocked.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "playwright/test";
import type { Page } from "playwright";
import type { CatalogSnapshot } from "../src/catalog/types.ts";

// [뉴스 형제 경로와 고정된 공개 자료 / News sibling routes and deterministic public data]
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = new URL(process.argv.find(argument => /^https?:/.test(argument)) || "http://127.0.0.1:8001/v5/");
const base = target.href.replace(/\/?$/, "/");
const directory = resolve(process.env.REPORT_DIR || resolve(projectRoot, ".local-reports/news-layout"));
const fixture = JSON.parse(readFileSync(resolve(projectRoot, "src/generated/catalog-snapshot.json"), "utf8")) as CatalogSnapshot;
const routes = ["notices", "events", "newsletter", "membership", "goods"] as const;
const widths = [390, 768, 1024, 1440, 1920];
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const results: { name: string; passed: boolean; detail?: unknown; error?: string }[] = [];
const layouts: Record<string, Record<string, HeadingMetrics>> = {};
const blockedWrites: string[] = [];
const browserErrors: string[] = [];
const network = { catalogReads: 0, blockedExternal: 0 };
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });

type Rect = { x: number; y: number; width: number; height: number; bottom: number };
type TextMetrics = Rect & { fontSize: string; fontWeight: string; lineHeight: string; fontFamily: string; role: string | null };
type HeadingMetrics = {
    breadcrumb: TextMetrics; title: TextMetrics; summary: TextMetrics; navigation: Rect;
    controls: Rect[]; breadcrumbToTitle: number; titleToSummary: number; summaryToNavigation: number;
    pageOverflow: number; h1Count: number; current: string[];
};

function save() {
    writeFileSync(resolve(directory, "report.json"), JSON.stringify({ base, widths, fixture: "Mocked snapshot RPC; external requests and remote writes blocked", network, blockedWrites, browserErrors, layouts, results }, null, 2) + "\n");
}

async function check(name: string, run: () => Promise<unknown>, page?: Page) {
    try { const detail = await run(); results.push({ name, passed: true, detail }); console.log(`PASS ${name}`); }
    catch (error) {
        results.push({ name, passed: false, error: error instanceof Error ? error.stack : String(error) });
        if (page) await page.screenshot({ path: resolve(directory, `${name.replace(/[^a-z0-9-]/gi, "-")}-failure.png`) }).catch(() => {});
        console.error(`FAIL ${name}: ${error instanceof Error ? error.message : error}`);
    }
    save();
}

function near(actual: number, expected: number, label: string) {
    assert.ok(Math.abs(actual - expected) <= 1, `${label}: ${actual} vs ${expected}`);
}

async function settle(page: Page, route: typeof routes[number]) {
    const record = fixture.pages.find(item => item.path === `/news/${route}`) as (CatalogSnapshot["pages"][number] & { completion?: { title: string } }) | undefined;
    await expect(page.locator("main h1")).toHaveText(record?.completion?.title || record?.title || "");
    await expect(page.locator('main nav[aria-label="소식과 혜택 메뉴"]')).toBeVisible();
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
    await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
}

async function go(page: Page, route: typeof routes[number]) {
    const response = await page.goto(new URL(`news/${route}/`, base).href, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${route} direct load`);
    await settle(page, route);
}

// [문구 길이를 존중하는 실제 위치와 간격 / Actual geometry and spacing that respect copy length]
async function measure(page: Page): Promise<HeadingMetrics> {
    return page.locator("main").evaluate(main => {
        const breadcrumb = main.querySelector('nav[aria-label="현재 위치"]')!;
        const title = main.querySelector("h1")!;
        const summary = title.parentElement!.querySelector(":scope > p")!;
        const navigation = main.querySelector('nav[aria-label="소식과 혜택 메뉴"]')!;
        const rect = (element: Element) => {
            const bounds = element.getBoundingClientRect();
            return { x: bounds.x + window.scrollX, y: bounds.y + window.scrollY, width: bounds.width, height: bounds.height, bottom: bounds.bottom + window.scrollY };
        };
        const text = (element: Element) => {
            const style = getComputedStyle(element);
            return { ...rect(element), fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, fontFamily: style.fontFamily, role: element.getAttribute("data-text") };
        };
        const metrics = { breadcrumb: text(breadcrumb), title: text(title), summary: text(summary), navigation: rect(navigation) };
        return {
            ...metrics, controls: Array.from(navigation.querySelectorAll("a")).map(rect),
            breadcrumbToTitle: metrics.title.y - metrics.breadcrumb.bottom,
            titleToSummary: metrics.summary.y - metrics.title.bottom,
            summaryToNavigation: metrics.navigation.y - metrics.summary.bottom,
            pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
            h1Count: main.querySelectorAll("h1").length,
            current: Array.from(navigation.querySelectorAll('[aria-current="page"]')).map(element => element.getAttribute("href") || ""),
        };
    });
}

function headingParity(actual: HeadingMetrics, reference: HeadingMetrics, label: string) {
    near(actual.breadcrumb.x, reference.breadcrumb.x, `${label}: breadcrumb x`);
    near(actual.breadcrumb.y, reference.breadcrumb.y, `${label}: breadcrumb y`);
    near(actual.title.x, reference.title.x, `${label}: title x`);
    near(actual.title.y, reference.title.y, `${label}: title y`);
    near(actual.summary.x, reference.summary.x, `${label}: summary x`);
    // Equal title height permits a direct summary coordinate comparison; wrapping keeps its natural height.
    if (Math.abs(actual.title.height - reference.title.height) <= 1) near(actual.summary.y, reference.summary.y, `${label}: summary y`);
    near(actual.breadcrumbToTitle, reference.breadcrumbToTitle, `${label}: breadcrumb/title gap`);
    near(actual.titleToSummary, reference.titleToSummary, `${label}: title/summary gap`);
    near(actual.summaryToNavigation, reference.summaryToNavigation, `${label}: summary/navigation gap`);
    near(actual.navigation.x, reference.navigation.x, `${label}: navigation x`);
    near(actual.navigation.width, reference.navigation.width, `${label}: navigation width`);
    if (Math.abs(actual.summary.height - reference.summary.height) <= 1 && Math.abs(actual.title.height - reference.title.height) <= 1) near(actual.navigation.y, reference.navigation.y, `${label}: navigation y for equal wrapping`);
    for (const part of ["title", "summary"] as const) {
        for (const property of ["fontSize", "fontWeight", "lineHeight", "fontFamily"] as const) assert.equal(actual[part][property], reference[part][property], `${label}: ${part} ${property}`);
    }
    assert.equal(actual.summary.role, "lead", `${label}: summary uses the shared lead text role`);
    assert.equal(actual.controls.length, reference.controls.length, `${label}: navigation count`);
    actual.controls.forEach((control, index) => {
        near(control.x, reference.controls[index].x, `${label}: control ${index} x`);
        near(control.width, reference.controls[index].width, `${label}: control ${index} width`);
        near(control.y - actual.navigation.y, reference.controls[index].y - reference.navigation.y, `${label}: control ${index} relative y`);
    });
}

async function noticeLinks(page: Page) {
    const links = page.locator('main a[href*="/news/notices/"]');
    const destinations = new Set(fixture.notices.map(notice => `/v5/news/notices/${notice.id}`));
    const actual = (await links.evaluateAll(elements => elements.map(element => ({ href: (element as HTMLAnchorElement).pathname.replace(/\/$/, ""), title: element.textContent?.trim() || "" })))).filter(link => destinations.has(link.href));
    assert.equal(actual.length, fixture.notices.length, "The complete published notice list remains present");
    for (const notice of fixture.notices) assert.ok(actual.some(link => link.href === `/v5/news/notices/${notice.id}` && link.title === notice.title), `Notice ${notice.id} keeps its title and destination`);
    return actual;
}

try {
    for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 1100 }, reducedMotion: "reduce", timezoneId: "Asia/Seoul", serviceWorkers: "block" });
        await context.route("**/*", route => {
            const request = route.request(), url = new URL(request.url());
            if (/(?:^|\.)supabase\.(co|in)$/.test(url.hostname) || /^\/(rest|auth)\/v1\//.test(url.pathname)) {
                const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
                if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
                if (url.pathname === "/rest/v1/rpc/sejong_catalog_snapshot" && ["GET", "POST"].includes(request.method())) { network.catalogReads++; return route.fulfill({ json: fixture, headers }); }
                if (request.method() === "GET") return route.fulfill({ json: url.pathname === "/auth/v1/settings" ? { external: { google: false } } : [], headers });
                blockedWrites.push(`${request.method()} ${url.origin}${url.pathname}`);
                return route.fulfill({ status: 403, json: {}, headers });
            }
            if (url.origin !== target.origin && /^https?:$/.test(url.protocol)) { network.blockedExternal++; return route.abort("blockedbyclient"); }
            if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) { blockedWrites.push(`${request.method()} ${url.origin}${url.pathname}`); return route.fulfill({ status: 403, json: {} }); }
            return route.continue();
        });
        const page = await context.newPage(); page.setDefaultTimeout(10000);
        page.on("pageerror", error => browserErrors.push(`${width}: ${error.message}`));
        const measured: Record<string, HeadingMetrics> = {}; layouts[width] = measured;
        for (const route of routes) await check(`direct-${route}-${width}`, async () => {
            await go(page, route); const metrics = await measure(page); measured[route] = metrics;
            assert.equal(metrics.h1Count, 1, "Exactly one main heading");
            assert.ok(metrics.pageOverflow <= 1, `No horizontal overflow: ${metrics.pageOverflow}px`);
            assert.deepEqual(metrics.current, [`/v5/news/${route}/`], "Exactly the selected news tab is current");
            if (route === "notices") await noticeLinks(page);
            if (route === "notices" || route === "events") await page.screenshot({ path: resolve(directory, `${route}-${width}.png`) });
            return metrics;
        }, page);
        for (const route of routes.filter(route => route !== "events")) await check(`heading-parity-${route}-${width}`, async () => {
            assert.ok(measured[route] && measured.events, "Both sibling pages were measured");
            headingParity(measured[route], measured.events, `${route} at ${width}px`);
        });
        await check(`client-events-notices-events-${width}`, async () => {
            await go(page, "events");
            const token = `news-layout-${width}-${Date.now()}`;
            await page.evaluate(value => { (window as typeof window & { newsLayoutSession?: string }).newsLayoutSession = value; }, token);
            for (const route of ["notices", "events"] as const) {
                await page.locator(`main nav[aria-label="소식과 혜택 메뉴"] a[href="/v5/news/${route}/"]`).click();
                await expect(page).toHaveURL(new URL(`news/${route}/`, base).href);
                await settle(page, route);
                assert.equal(await page.evaluate(() => (window as typeof window & { newsLayoutSession?: string }).newsLayoutSession), token, "News tab navigation preserves the document");
                const metrics = await measure(page);
                assert.equal(metrics.h1Count, 1); assert.ok(metrics.pageOverflow <= 1);
                assert.deepEqual(metrics.current, [`/v5/news/${route}/`]);
                headingParity(metrics, measured[route], `${route} CSR/direct at ${width}px`);
                if (route === "notices") await noticeLinks(page);
            }
            return { documentPreserved: true, transitions: ["events", "notices", "events"] };
        }, page);
        await context.close();
    }
    await check("no-runtime-errors-or-remote-writes", async () => {
        assert.deepEqual(browserErrors, []); assert.deepEqual(blockedWrites, []);
    });
} finally { save(); await browser.close(); }
const failures = results.filter(result => !result.passed);
console.log(JSON.stringify({ passed: results.length - failures.length, failed: failures.length, report: resolve(directory, "report.json") }));
if (failures.length) process.exitCode = 1;
