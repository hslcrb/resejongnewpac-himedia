import { chromium, expect } from "playwright/test";
import assert from "node:assert/strict";

const origin = process.env.SEJONG_TEST_ORIGIN || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
try {
    for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 850 } });
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(`${origin}/?mode=cms-scm#home-booking-options`, { waitUntil: "networkidle" });
        await page.waitForTimeout(300);
        assert.equal(new URL(page.url()).hash, "#home-booking-options");
        const historyLength = await page.evaluate(() => history.length);
        await page.locator("#quick-booking").evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 130));
        await page.mouse.move(width - 30, 400);
        await page.mouse.wheel(0, 90);
        await expect.poll(() => new URL(page.url()).hash).toBe("#quick-booking");
        assert.equal(new URL(page.url()).search, "?mode=cms-scm");
        assert.equal(await page.evaluate(() => history.length), historyLength);
        await page.reload({ waitUntil: "networkidle" });
        await expect(page.locator("#quick-booking")).toBeInViewport();
        await page.locator("#home-feature-next").focus();
        await page.keyboard.press("End");
        await expect.poll(() => new URL(page.url()).hash).toBe("#footer");
        await page.getByRole("button", { name: "맨 위로 이동" }).click();
        await expect.poll(() => new URL(page.url()).hash).toBe("#featured-season");

        await page.goto(`${origin}/design-rules/#typography/family`, { waitUntil: "networkidle" });
        await page.waitForTimeout(600);
        assert.equal(new URL(page.url()).hash, "#typography/family");
        await page.locator("#typography-scale").evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 130));
        await page.mouse.wheel(0, 90);
        await expect.poll(() => new URL(page.url()).hash).toBe("#typography/scale");

        await page.goto(`${origin}/about/esg/`, { waitUntil: "networkidle" });
        const target = page.locator("main section[id]").first();
        assert.ok(await target.count(), "일반 페이지에도 공유할 구간이 있어야 합니다");
        const id = await target.getAttribute("id");
        await target.evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 130));
        await page.mouse.wheel(0, 90);
        await expect.poll(() => new URL(page.url()).hash).toBe(`#${id}`);
        await page.reload({ waitUntil: "networkidle" });
        await expect(target).toBeInViewport();
        await page.goto(`${origin}/account/login/#account-login-form`, { waitUntil: "networkidle" });
        await expect(page.locator("#account-login-form")).toBeInViewport();
        await page.goto(`${origin}/about/introduction/`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "서울시예술단", exact: true }).click();
        assert.equal(new URL(page.url()).hash, "#intro-pulse");
        await page.goto(`${origin}/account/#account-panel-favorites`, { waitUntil: "networkidle" });
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(250);
        assert.equal(new URL(page.url()).hash, "#account-panel-favorites");
        assert.deepEqual(errors, []);
        await page.close();
        console.log(`스크롤 위치·상세 링크·계정 탭 확인: ${width}px`);
    }
} finally { await browser.close(); }
