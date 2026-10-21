import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PROGRAMS } from "../src/data/catalog.ts";

// [탐색·일정·관심 프로그램 회귀 검증 / Discovery, calendar and favorites regression checks]
const base = process.env.SEJONG_TEST_URL || "http://127.0.0.1:3000/v5/";
const target = new URL("programs/", base).href;
const directory = path.resolve(".local-reports/programs-glass");
fs.mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors: string[] = [];
const results: { name: string; passed: boolean; error?: string }[] = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(7000);

async function check(name: string, run: () => Promise<void>) {
    if (process.env.SEJONG_TEST_MATCH && !new RegExp(process.env.SEJONG_TEST_MATCH).test(name)) return;
    try {
        await run();
        results.push({ name, passed: true });
        console.log(`PASS ${name}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ name, passed: false, error: message });
        console.error(`FAIL ${name}: ${message}`);
    }
}

const cards = () => page.locator(".discovery-results .program-card--glass");
async function waitForCount(expected: number) {
    try {
        await page.waitForFunction(count => document.querySelectorAll(".discovery-results .program-card--glass").length === count, expected);
    } catch (error) {
        const state = await page.evaluate(() => ({
            url: location.href,
            search: document.querySelector<HTMLInputElement>(".discovery-search input")?.value,
            category: document.querySelector(".discovery-categories [aria-pressed='true']")?.textContent,
            actual: document.querySelectorAll(".discovery-results .program-card--glass").length,
        }));
        throw new Error(`Expected ${expected} programs; observed ${JSON.stringify(state)}. ${error instanceof Error ? error.message : String(error)}`);
    }
}

await check("category, trimmed search, empty result and reset", async () => {
    await page.goto(target, { waitUntil: "networkidle" });
    assert.equal(await cards().count(), PROGRAMS.length);
    await page.getByRole("button", { name: "전시", exact: true }).click();
    await waitForCount(PROGRAMS.filter(program => program.category === "전시").length);
    await page.getByRole("button", { name: "전체", exact: true }).click();
    await page.getByRole("searchbox", { name: "공연명, 장르, 공연장 검색" }).fill("  HYPNOSIS  ");
    await waitForCount(1);
    assert.equal(await cards().first().locator("h3").textContent(), "HYPNOSIS THERAPY");
    await page.getByRole("searchbox").fill("존재하지않는공연검색어");
    await waitForCount(0);
    assert.equal(await page.locator(".discovery-empty").isVisible(), true);
    await page.getByRole("button", { name: "검색 조건 지우기" }).click();
    await waitForCount(PROGRAMS.length);
});

await check("combined venue, month and free filters", async () => {
    await page.goto(target, { waitUntil: "networkidle" });
    await page.getByLabel("공간", { exact: true }).selectOption("세종미술관");
    await page.getByLabel("기간", { exact: true }).selectOption("2026-10");
    await page.getByRole("checkbox", { name: "무료 프로그램" }).check();
    await waitForCount(1);
    assert.equal(await cards().first().locator("h3").textContent(), "서울아트굿즈페스티벌");
    assert.equal(new URL(page.url()).searchParams.get("free"), "true");
    await page.reload({ waitUntil: "networkidle" });
    await waitForCount(1);
    assert.equal(await page.getByRole("checkbox", { name: "무료 프로그램" }).isChecked(), true);
    await page.getByRole("button", { name: "조건 초기화" }).click();
    await waitForCount(PROGRAMS.length);
});

await check("list view, sorting and direct search URL", async () => {
    await page.goto(target, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "목록", exact: true }).click();
    assert.equal(await page.locator(".program-card--list").count(), PROGRAMS.length);
    await page.getByLabel("프로그램 정렬").selectOption("title");
    const expected = [...PROGRAMS].sort((a, b) => a.title.localeCompare(b.title, "ko")).map(program => program.title);
    assert.deepEqual(await cards().locator("h3").allTextContents(), expected);
    await page.goto(`${target}?view=list&category=${encodeURIComponent("공연")}&q=${encodeURIComponent("일무")}`, { waitUntil: "networkidle" });
    await waitForCount(1);
    assert.equal(await cards().first().locator("h3").textContent(), "일무");
    assert.equal(await page.getByRole("button", { name: "목록", exact: true }).getAttribute("aria-pressed"), "true");
});

await check("month calendar, selected day and navigation", async () => {
    await page.goto(`${target}?view=calendar&month=2026-10`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".discovery-calendar-day").count(), 31);
    const day = "2026-10-21";
    const expected = PROGRAMS.filter(program => program.start && program.start <= day && (program.end || program.start) >= day);
    await page.getByRole("button", { name: new RegExp(`10월 21일, 프로그램 ${expected.length}개`) }).click();
    await waitForCount(expected.length);
    assert.deepEqual(await cards().locator("h3").allTextContents(), expected.map(program => program.title));
    await page.getByRole("button", { name: "다음 달", exact: true }).click();
    assert.equal(await page.locator(".discovery-calendar-day").count(), 30);
    assert.equal(new URL(page.url()).searchParams.get("month"), "2026-11");
    await page.getByRole("button", { name: "이전 달", exact: true }).click();
    assert.equal(await page.locator(".discovery-calendar-day").count(), 31);
    await page.screenshot({ path: path.join(directory, "calendar-1440.png"), fullPage: false });
});

await check("browser back restores URL-derived controls", async () => {
    await page.goto(`${target}?category=${encodeURIComponent("전시")}`, { waitUntil: "networkidle" });
    await page.goto(`${target}?category=${encodeURIComponent("교육")}`, { waitUntil: "networkidle" });
    await page.goBack({ waitUntil: "networkidle" });
    await waitForCount(PROGRAMS.filter(program => program.category === "전시").length);
    assert.equal(await page.getByRole("button", { name: "전시", exact: true }).getAttribute("aria-pressed"), "true");
});

await check("favorites persist and synchronize across browser tabs", async () => {
    await page.goto(target, { waitUntil: "networkidle" });
    await page.evaluate(() => { localStorage.removeItem("sejong-v4:favorites"); window.dispatchEvent(new Event("sejong:favorites-changed")); });
    const second = await context.newPage();
    await second.goto(target, { waitUntil: "networkidle" });
    const firstCard = cards().first();
    const secondFavorite = second.locator(".discovery-results .favorite-button").first();
    await firstCard.hover();
    await firstCard.locator(".favorite-button").click();
    await second.waitForFunction(() => document.querySelector(".discovery-results .favorite-button")?.getAttribute("aria-pressed") === "true");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await cards().first().locator(".favorite-button").getAttribute("aria-pressed"), "true");
    await second.locator(".discovery-results .program-card--glass").first().hover();
    await secondFavorite.click();
    await page.waitForFunction(() => document.querySelector(".discovery-results .favorite-button")?.getAttribute("aria-pressed") === "false");
    await second.close();
});

// [뷰포트별 가독성과 포스터 안정성 / Readability and stable poster behavior across viewports]
for (const width of [320, 390, 768, 1024, 1440]) {
    await check(`responsive layouts and readable text at ${width}px`, async () => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(target, { waitUntil: "networkidle" });
        const inspect = () => page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth,
            smallText: [...document.querySelectorAll(".programs-discovery :is(p,h1,h2,h3,button,select,input,a,span)")].filter(element => {
                const style = getComputedStyle(element);
                return element.getBoundingClientRect().width > 1 && style.display !== "none" && style.visibility !== "hidden" && parseFloat(style.fontSize) < 16;
            }).map(element => `${element.tagName}: ${element.textContent?.trim().slice(0, 25)}`),
            brokenPosters: [...document.querySelectorAll<HTMLImageElement>(".discovery-results img")].filter(image => image.complete && !image.naturalWidth).length,
        }));
        let state = await inspect();
        assert.equal(state.overflow, false, "poster view overflows the viewport");
        assert.deepEqual(state.smallText, []);
        assert.equal(state.brokenPosters, 0);
        await page.screenshot({ path: path.join(directory, `programs-${width}.png`), fullPage: false });
        await page.getByRole("button", { name: "목록", exact: true }).click();
        state = await inspect();
        assert.equal(state.overflow, false, "list view overflows the viewport");
        assert.deepEqual(state.smallText, []);
        await page.getByRole("button", { name: "달력", exact: true }).click();
        state = await inspect();
        assert.equal(state.overflow, false, "calendar view overflows the viewport");
        assert.deepEqual(state.smallText, []);
    });
}

await check("poster hover stays in place and keyboard focus is visible", async () => {
    await page.goto(target, { waitUntil: "networkidle" });
    const card = cards().first();
    await card.scrollIntoViewIfNeeded();
    const before = await card.boundingBox();
    await card.hover();
    const after = await card.boundingBox();
    assert.equal(before?.y, after?.y);
    await card.locator(".favorite-button").focus();
    assert.equal(await card.locator(".favorite-button").evaluate(element => getComputedStyle(element).outlineWidth), "3px");
});

// [동작 감소 설정의 직접 관심 조작 / Direct favorite action with reduced motion]
await check("reduced motion favorite accepts a direct pointer click", async () => {
    const reducedPage = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    reducedPage.on("pageerror", error => errors.push(error.message));
    try {
        await reducedPage.goto(target, { waitUntil: "networkidle" });
        const favorite = reducedPage.locator(".discovery-results .program-card--glass .favorite-button").first();
        assert.equal(await favorite.evaluate(element => getComputedStyle(element).opacity), "1");
        await favorite.click({ timeout: 7000 });
        assert.equal(await favorite.getAttribute("aria-pressed"), "true");
        assert.equal(new URL(reducedPage.url()).pathname, new URL(target).pathname);
    } finally { await reducedPage.close(); }
});

// [작품 상세와 예매 상태 전달 / Program detail and booking state continuity]
for (const width of [320, 390, 768, 1440]) {
    await check(`program detail readability and layout at ${width}px`, async () => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(new URL("programs/dance/", base).href, { waitUntil: "networkidle" });
        const result = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth,
            smallText: [...document.querySelectorAll(".program-detail-glass :is(p,h1,h2,h3,dt,dd,button,select,input,a,span,summary)")].filter(element => {
                const style = getComputedStyle(element);
                return element.getBoundingClientRect().width > 1 && style.display !== "none" && style.visibility !== "hidden" && parseFloat(style.fontSize) < 16;
            }).map(element => `${element.tagName}: ${element.textContent?.trim().slice(0, 25)}`),
        }));
        assert.equal(result.overflow, false);
        assert.deepEqual(result.smallText, []);
        await page.screenshot({ path: path.join(directory, `detail-${width}.png`), fullPage: false });
    });
}

await check("detail favorite, disclosures and selected booking session", async () => {
    const detailFavorite = page.locator(".detail-poster-actions [aria-pressed]");
    const original = await detailFavorite.getAttribute("aria-pressed");
    await detailFavorite.click();
    assert.notEqual(await detailFavorite.getAttribute("aria-pressed"), original);
    await page.reload({ waitUntil: "networkidle" });
    assert.notEqual(await detailFavorite.getAttribute("aria-pressed"), original);
    await detailFavorite.click();
    const accessibility = page.locator(".detail-guidance details").nth(1);
    await accessibility.locator("summary").click();
    assert.equal(await accessibility.getAttribute("open"), "");
    await page.getByLabel("날짜", { exact: true }).fill("2026-10-22");
    await page.getByLabel("시간", { exact: true }).selectOption("19:30");
    await page.getByRole("button", { name: "예매하기", exact: true }).click();
    await page.waitForURL(/\/booking\/dance\//);
    const url = new URL(page.url());
    assert.equal(url.searchParams.get("date"), "2026-10-22");
    assert.equal(url.searchParams.get("time"), "19:30");
});

await check("no browser runtime errors", async () => assert.deepEqual(errors, []));
await browser.close();
fs.writeFileSync(path.join(directory, "results.json"), JSON.stringify({ target, results, errors }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
