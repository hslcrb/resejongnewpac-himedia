import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8765/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
const active = () => page.locator(".season-slide.is-active");
const centered = () => page.waitForFunction(() => {
    const stage = document.querySelector(".season-stage")?.getBoundingClientRect();
    const card = document.querySelector(".season-slide.is-active")?.getBoundingClientRect();
    return stage && card && Math.abs(card.left + card.width / 2 - stage.left - stage.width / 2) < 1;
});

try {
    for (const feature of ["carmen", "light"]) {
        await page.goto(`${base}#home-feature-${feature}`, { waitUntil: "networkidle" });
        await page.waitForFunction(feature => document.querySelector(".season-slide.is-active")?.id === `home-feature-${feature}`, feature, { timeout: 2500 });
    }
    console.log("PASS initial shared links select non-first works");
    await page.goto(`${base}#home-feature-dance`, { waitUntil: "networkidle" });
    await active().waitFor();
    await page.waitForFunction(() => !document.querySelector("[data-entry-intro]"));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await centered();
    // Catches a gesture handler that excludes links: dragging the artwork's CTA must swipe, not navigate.
    const link = active().locator(".season-actions a").first();
    const box = (await link.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 240, box.y + box.height / 2 + 2, { steps: 18 });
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector(".season-slide.is-active")?.getAttribute("data-feature") === "carmen", undefined, { timeout: 2500 });
    assert.equal(new URL(page.url()).pathname, "/", "a swipe starting on a CTA must not follow the link");
    await centered();
    console.log("PASS CTA drag advances one work without navigation");

    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const feature of ["light", "dance", "carmen", "light", "dance", "carmen", "light"]) {
        await page.locator("#home-feature-next").click();
        await page.waitForFunction(feature => document.querySelector(".season-slide.is-active")?.getAttribute("data-feature") === feature, feature);
        assert.equal(await active().getAttribute("data-feature"), feature);
        assert.match(await page.locator(".season-controls [aria-live]").innerText(), new RegExp(`^${feature === "dance" ? 1 : feature === "carmen" ? 2 : 3} / 3,`), "loop announcements must describe the selected work");
        assert.equal(await active().locator(".season-actions a").last().getAttribute("href"), `/booking/${feature}/`);
        await centered();
        assert.equal(await page.locator(".season-slide[id]").count(), 1, "loop copies must not duplicate anchors");
        assert.equal(await page.locator('.season-slide[aria-hidden="true"] a:not([tabindex="-1"])').count(), 0);
    }
    await page.locator("#home-feature-previous").focus();
    await page.keyboard.press("Enter");
    assert.equal(await active().getAttribute("data-feature"), "carmen");
    assert.equal(await page.locator("#home-feature-previous").evaluate(node => node === document.activeElement), true);
    console.log("PASS repeated wraparound, matching destinations, unique anchors and keyboard focus");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator("#home-feature-next").click();
    const offset = () => active().evaluate(node => {
        const card = node.getBoundingClientRect();
        const stage = document.querySelector(".season-stage")!.getBoundingClientRect();
        return Math.abs(card.left + card.width / 2 - stage.left - stage.width / 2);
    });
    await page.waitForTimeout(100);
    const early = await offset();
    await page.waitForTimeout(180);
    const later = await offset();
    assert.ok(early > later && later > 1, "the banner must interpolate smoothly toward the centre");
    await centered();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#home-feature-previous").click();
    console.log("PASS animated movement interpolates without a jump, including a motion-preference change");

    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await centered();
        await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px horizontal overflow`);
        const geometry = await active().evaluate(node => {
            const frame = node.getBoundingClientRect();
            const actions = node.querySelector(".season-actions")!.getBoundingClientRect();
            return { left: frame.left, right: frame.right, actionsLeft: actions.left, actionsRight: actions.right };
        });
        assert.ok(geometry.left > 0 && geometry.right < width, `${width}px neighbouring peeks`);
        assert.ok(geometry.actionsLeft >= geometry.left && geometry.actionsRight <= geometry.right + 1, `${width}px actions fit`);
    }
    console.log("PASS responsive alignment and actions at six viewport sizes");

    await page.setViewportSize({ width: 1440, height: 1000 });
    await centered();
    await page.evaluate(() => { location.hash = "home-feature-light"; });
    await page.waitForFunction(() => document.querySelector(".season-slide.is-active")?.id === "home-feature-light");
    assert.equal(await page.locator("#home-feature-playback").getAttribute("aria-pressed"), "true");
    await page.waitForTimeout(3700);
    assert.equal(await active().getAttribute("data-feature"), "light", "reduced motion must not autoplay");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator("#home-feature-playback").click();
    await page.mouse.move(2, 2);
    await page.waitForFunction(() => document.querySelector(".season-slide.is-active")?.getAttribute("data-feature") === "dance", undefined, { timeout: 6000 });
    await page.locator("#home-feature-playback").click();
    await page.waitForTimeout(900);
    await centered();
    await page.waitForTimeout(3700);
    assert.equal(await active().getAttribute("data-feature"), "dance", "explicit pause must stop autoplay");
    console.log("PASS shared anchors, reduced motion, explicit play with retained focus, and pause");

    await page.setViewportSize({ width: 1920, height: 1080 });
    await centered();
    await page.locator('[data-preview="next"] .season-peer-title').focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "home-feature-next", "removed preview buttons must transfer keyboard focus to a persistent control");
    await page.locator("#header a").first().focus();
    await page.locator("#home-feature-playback").click();
    await page.mouse.move(2, 2);
    const beforeResume = await active().getAttribute("data-feature");
    await page.waitForFunction(before => document.querySelector(".season-slide.is-active")?.getAttribute("data-feature") !== before, beforeResume, { timeout: 6000 });
    console.log("PASS neighbour selection retains focus and does not trap automatic playback");

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
    mobile.on("pageerror", error => errors.push(error.message));
    await mobile.goto(`${base}#home-feature-dance`, { waitUntil: "networkidle" });
    await mobile.waitForFunction(() => document.querySelector(".season-slide.is-active")?.id === "home-feature-dance");
    const touch = await mobile.context().newCDPSession(mobile);
    async function swipe(from: { x: number; y: number }, to: { x: number; y: number }) {
        await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
        for (let step = 1; step <= 12; step++) {
            await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + (to.x - from.x) * step / 12, y: from.y + (to.y - from.y) * step / 12 }] });
        }
        await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await swipe({ x: 300, y: 250 }, { x: 70, y: 253 });
    await mobile.waitForFunction(() => document.querySelector(".season-slide.is-active")?.getAttribute("data-feature") === "carmen");
    const scrollBefore = await mobile.evaluate(() => scrollY);
    await swipe({ x: 180, y: 400 }, { x: 183, y: 160 });
    await mobile.waitForFunction(before => scrollY > before + 30, scrollBefore);
    assert.equal(await mobile.locator(".season-slide.is-active").getAttribute("data-feature"), "carmen", "vertical scrolling must not select a work");
    await mobile.close();
    console.log("PASS mobile touch swipes and native vertical scrolling");
    assert.deepEqual(errors, []);
    console.log("PASS no browser runtime errors");
} catch (error) {
    console.error(await page.evaluate(() => ({
        fragment: location.hash,
        active: document.querySelector(".season-slide.is-active")?.getAttribute("data-feature"),
        anchor: document.querySelector(".season-slide.is-active")?.id,
        focus: document.activeElement?.id || document.activeElement?.tagName,
    })));
    throw error;
} finally {
    await browser.close();
}
