import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

// [홈의 실제 탐색과 예매 연결 / Real home navigation and booking continuity]
const base = (process.argv[2] || "http://localhost:3000/v5").replace(/\/$/, "");
const output = ".local-reports/home-glass";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
const checks: string[] = [];

try {
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.locator(".stage-feature-image img").waitFor();
    for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Home overflow at ${width}`);
        const missing = await page.locator("main img").evaluateAll((images) => images.filter((image) => {
            const element = image as HTMLImageElement;
            const bounds = element.getBoundingClientRect();
            return bounds.top < innerHeight && bounds.bottom > 0 && element.complete && !element.naturalWidth;
        }).map((image) => (image as HTMLImageElement).src));
        assert.deepEqual(missing, [], `Visible images at ${width}`);
        await page.screenshot({ path: `${output}/home-${width}.png` });
        checks.push(`home layout ${width}`);
    }

    await page.locator("#home-feature-next").click();
    await page.locator("#home-feature-enemy").waitFor();
    assert.match(await page.locator(".stage-feature-image").getAttribute("href") || "", /performIdx=37669/);
    await page.locator("#home-feature-next").press("ArrowLeft");
    await page.locator("#home-feature-gagok").waitFor();
    await page.locator(".stage-feature-image").focus();
    await page.keyboard.press("ArrowRight");
    await page.locator("#home-feature-enemy").waitFor();
    assert.equal(await page.locator(".stage-feature-image").evaluate(element => document.activeElement === element), true, "Arrow selection preserves the focused link");
    checks.push("hero manual and keyboard selection, official destination");

    await page.locator("#experience-tab-backstage").focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator("#experience-tab-history").getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#experience-panel a").getAttribute("href"), "/v5/programs/history/");
    await page.keyboard.press("End");
    assert.equal(await page.locator("#experience-tab-everyone").getAttribute("aria-selected"), "true");
    checks.push("experience tabs use keyboard and real destinations");

    await page.goto(base + "/#home-booking-date-2026-10-23", { waitUntil: "networkidle" });
    await page.locator("#home-booking-date-2026-10-23[aria-pressed=true]").waitFor();
    await page.locator("#home-booking-program-dance").click();
    await page.locator("#quick-time").selectOption("19:30");
    await page.locator("#quick-participants").selectOption("2");
    const booking = page.locator("#home-booking-action a");
    assert.match(await booking.getAttribute("href") || "", /participants=2/);
    await booking.click();
    await page.locator("#booking-date").waitFor();
    assert.equal(await page.locator("#booking-date").inputValue(), "2026-10-23");
    assert.equal(await page.locator('input[name="time"]:checked').inputValue(), "19:30");
    checks.push("home date, time and party transfer to full booking flow");

    await page.goto(base + "/#home-feature-boheme", { waitUntil: "networkidle" });
    await page.locator("#home-feature-boheme").waitFor();
    const first = await page.locator(".stage-feature").getAttribute("data-feature");
    await page.waitForTimeout(7000);
    assert.equal(await page.locator(".stage-feature").getAttribute("data-feature"), first);
    checks.push("direct feature anchor and reduced-motion playback pause");

    await page.locator("#home-feature-playback").click();
    assert.equal(await page.locator("#home-feature-playback").getAttribute("aria-label"), "자동 재생 일시정지");
    await page.locator(".stage-feature-image").focus();
    await page.mouse.move(5, 800);
    await page.waitForTimeout(6800);
    assert.equal(await page.locator(".stage-feature").getAttribute("data-feature"), first, "Keyboard focus keeps playback paused after mouse leaves");
    checks.push("explicit playback works with reduced motion and preserves focus pause");

    await page.locator(".stage-primary").focus();
    await page.waitForFunction(previous => document.querySelector(".stage-feature")?.getAttribute("data-feature") !== previous, first, { timeout: 9000 });
    checks.push("playback resumes when the programme loses focus");

    await page.goto(base + "/programs/", { waitUntil: "networkidle" });
    await page.locator(".discovery-results .program-card--glass .favorite-button").first().click();
    await page.locator("#toast.visible").waitFor();
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("#toast")!).opacity) > .99);
    assert.equal(await page.locator("#toast").evaluate(element => getComputedStyle(element).opacity), "1");
    checks.push("favorite confirmation is visibly displayed");
    assert.deepEqual(errors, []);
    fs.writeFileSync(`${output}/report.json`, JSON.stringify({ base, checks, errors }, null, 2));
    console.log(`PASS ${checks.length} home checks`);
} finally {
    await browser.close();
}
