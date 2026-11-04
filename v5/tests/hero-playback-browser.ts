import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8765/v5/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    await page.goto(`${base}#home-feature-dance`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector(".season-slide.is-active")?.id === "home-feature-dance");
    const playback = page.locator("#home-feature-playback");
    assert.equal(await playback.getAttribute("aria-pressed"), "true", "reduced motion starts with autoplay paused");
    await playback.focus();
    await page.keyboard.press("Enter");
    await page.mouse.move(2, 2);
    assert.equal(await playback.getAttribute("aria-pressed"), "false");
    await page.waitForFunction(() => document.querySelector(".season-slide.is-active")?.getAttribute("data-feature") === "carmen", undefined, { timeout: 5000 });
    assert.ok(await page.locator(".season-track").evaluate(node => parseFloat(getComputedStyle(node).transitionDuration)) < 0.001, "explicit playback retains imperceptible transitions");
    assert.equal(await playback.evaluate(node => node === document.activeElement), true, "starting playback keeps keyboard focus");
    await page.keyboard.press("Enter");
    const stopped = await page.locator(".season-slide.is-active").getAttribute("data-feature");
    await page.waitForTimeout(3700);
    assert.equal(await page.locator(".season-slide.is-active").getAttribute("data-feature"), stopped, "the pause control stops the actual carousel");
    console.log("PASS reduced-motion defaults, explicit motion-free playback, retained keyboard focus and pause");
} finally {
    await browser.close();
}
