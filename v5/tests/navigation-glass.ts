import assert from "node:assert/strict";
import { chromium } from "playwright";

// [실제 브라우저의 공통 내비게이션 검증 / Shared navigation in a real browser]
// 개발·정적 빌드 모두 같은 키보드, 경로 이동, 모바일 배치를 검사합니다.
// Verify keyboard behavior, real navigation, and responsive layout in dev or export.
const base = process.env.SEJONG_TEST_URL || "http://127.0.0.1:3000/v5/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
    await page.goto(new URL("programs/", base).href, { waitUntil: "networkidle" });
    const searchButton = page.locator(".glass-header-actions button").first();
    const menuButton = page.locator(".glass-menu-button");
    const dismiss = async () => {
        await page.keyboard.press("Escape");
        await page.waitForSelector("dialog[open]", { state: "detached" });
    };

    // [검색 초점·제안·복원 / Search focus, suggestions, and restoration]
    await searchButton.click();
    await page.waitForSelector("dialog[open]");
    assert.equal(await page.locator("#global-query").evaluate((element) => document.activeElement === element), true);
    assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
    await page.locator("#global-query").fill("주차");
    assert.ok(await page.locator(".glass-search-suggestions a").count() > 1);
    await dismiss();
    assert.equal(await searchButton.evaluate((element) => document.activeElement === element), true);
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");

    // [모달의 순환 초점과 전체 메뉴 / Modal focus wrapping and complete menu]
    await menuButton.click();
    await page.waitForSelector("dialog[open]");
    await page.locator(".glass-dialog-close").focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "English guide");
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(".glass-dialog-close").evaluate((element) => document.activeElement === element), true);
    assert.ok(await page.locator(".glass-menu-columns a").count() > 30);
    await page.locator("dialog").evaluate((element) => { element.scrollTop = 0; });
    await page.screenshot({ path: ".local-reports/navigation-desktop.png", animations: "disabled" });
    await dismiss();

    // [좁은 화면과 확대 화면 / Narrow and enlarged layouts]
    for (const width of [320, 390, 768, 1024]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.locator("#header").evaluate((element) => element.getBoundingClientRect().right > innerWidth), false, `Header fits ${width}px`);
        await menuButton.click();
        await page.waitForSelector("dialog[open]");
        assert.equal(await page.locator("dialog").evaluate((element) => element.scrollTop), 0, "Reopening starts at the menu heading");
        assert.equal(await page.locator("dialog").evaluate((element) => element.scrollWidth > element.clientWidth), false, `Menu fits ${width}px`);
        await page.screenshot({ path: `.local-reports/navigation-${width}.png`, animations: "disabled" });
        await dismiss();
    }

    // [검색과 메뉴의 실제 경로 이동 / Real search and menu navigation]
    await searchButton.click();
    await page.locator("#global-query").fill("주차");
    await page.locator(".glass-search-form button").click();
    await page.waitForURL("**/search/?q=*");
    await page.waitForSelector("dialog[open]", { state: "detached" });
    assert.equal(new URL(page.url()).searchParams.get("q"), "주차");
    await page.waitForLoadState("networkidle");
    await menuButton.click();
    await page.waitForSelector("dialog[open]");
    await page.locator('.glass-menu-quick a[href*="view=calendar"]').click();
    await page.waitForURL("**/programs/?view=calendar");
    await page.waitForSelector("dialog[open]", { state: "detached" });
    await page.waitForLoadState("networkidle");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.screenshot({ path: ".local-reports/navigation-footer.png", animations: "disabled" });
    assert.deepEqual(errors, []);
    console.log("PASS navigation: search, live suggestions, focus trap/restore, scroll lock, real routes, 320/390/768/1024 layouts");
} finally {
    await browser.close();
}
