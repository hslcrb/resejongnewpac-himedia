import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, expect } from "playwright/test";
import type { Page } from "playwright";
import { QUICK_MENU_TOKENS } from "../src/data/design-tokens.ts";

// Exercise the rendered contract, including CSS/Canvas fallback and token propagation.
const base = (process.argv[2] || "http://127.0.0.1:4173/").replace(/\/?$/, "/");
const directory = path.resolve(process.env.SEJONG_QUICK_SYSTEM_REPORT_DIR || ".local-reports/quick-menu-system");
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const snapshot = JSON.parse(readFileSync("src/generated/catalog-snapshot.json", "utf8"));
await context.route("**/rest/v1/rpc/sejong_catalog_snapshot", route => route.fulfill({ json: snapshot }));
await context.route("**/auth/v1/settings", route => route.fulfill({ json: { external: { google: false } } }));
const errors: string[] = [];
const results: unknown[] = [];
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => {
    if (new URL(request.url()).hostname === "fonts.googleapis.com") errors.push("Embedded UI requested an external default font");
});
page.on("response", response => {
    if (response.url().startsWith(new URL(base).origin) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});

async function openMenu(page: Page, placement: "hero" | "inline") {
    await page.goto(placement === "hero" ? base : new URL("design-rules/#motion/quick-menu", base).href, { waitUntil: "networkidle" });
    if (placement === "hero") await page.waitForFunction(() => document.querySelector("[data-violet-menu]")?.getAttribute("data-visible") === "true");
    const intro = page.locator("[data-entry-intro]");
    if (!await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches) && await intro.count()) await page.getByRole("button", { name: "인트로 건너뛰기", exact: true }).click();
    await intro.waitFor({ state: "detached" });
    const root = page.locator(`[data-violet-menu][data-placement="${placement}"]`);
    await root.locator("[data-violet-toggle]").scrollIntoViewIfNeeded();
    await expect(root).toHaveAttribute("data-visible", "true");
    await root.locator("[data-violet-toggle]").focus();
    await page.keyboard.press("Enter");
    await expect(root).toHaveAttribute("data-state", "open");
    await root.evaluate(async element => {
        await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})));
    });
    return root;
}

try {
    for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const appearances = [];
        for (const placement of ["hero", "inline"] as const) {
            const root = await openMenu(page, placement);
            const appearance = await root.evaluate((element, tokens) => {
                const wheel = element.querySelector<HTMLElement>("[data-violet-wheel]")!;
                const current = element.querySelector<HTMLElement>("[data-violet-current]")!;
                const label = element.querySelector<HTMLElement>("[data-violet-link] [data-text]")!;
                const style = getComputedStyle(element);
                const canvas = element.querySelector<HTMLCanvasElement>('[data-quick-fluid="expanded"]')!;
                const pixel = Array.from(canvas.getContext("2d")!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data);
                return {
                    surface: getComputedStyle(wheel).backgroundColor,
                    action: getComputedStyle(current).backgroundColor,
                    ink: getComputedStyle(current).color,
                    labelSize: getComputedStyle(label).fontSize,
                    labelWeight: getComputedStyle(label).fontWeight,
                    font: getComputedStyle(label).fontFamily,
                    radius: getComputedStyle(current).borderRadius,
                    tokens: Object.fromEntries(tokens.map(token => [token, style.getPropertyValue(token).trim()])),
                    pixel,
                };
            }, Object.keys(QUICK_MENU_TOKENS));
            assert.equal(appearance.surface, "rgb(255, 254, 250)");
            assert.equal(appearance.action, "rgb(33, 31, 28)");
            assert.equal(appearance.ink, "rgb(255, 254, 250)");
            assert.equal(appearance.labelSize, "16px");
            assert.equal(appearance.labelWeight, "600");
            assert.ok(appearance.pixel[0] > 230 && Math.max(...appearance.pixel.slice(0, 3)) - Math.min(...appearance.pixel.slice(0, 3)) < 16, "Canvas material must use the same neutral palette");
            appearances.push(appearance);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${placement} must fit ${width}px`);
            if (placement === "inline") {
                const rows = await page.locator("[data-quick-menu-contract] tbody tr").evaluateAll(rows => rows.map(row => Array.from(row.children).map(cell => cell.textContent)));
                assert.deepEqual(rows, Object.entries(QUICK_MENU_TOKENS), "Guide values must come from the actual contract");
            }
            if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(directory, `${placement}-${width}.png`) });
            await page.keyboard.press("Escape");
            await expect(root).toHaveAttribute("data-state", "closed");
            await expect(root.locator("[data-violet-toggle]")).toBeFocused();
        }
        // The animated Canvas phase can differ; the design contract cannot.
        const withoutPixel = ({ pixel: _pixel, ...appearance }: typeof appearances[number]) => appearance;
        assert.deepEqual(withoutPixel(appearances[0]), withoutPixel(appearances[1]), `Home/guide parity at ${width}px`);
        results.push({ width, parity: true, home: appearances[0], guide: appearances[1] });
        console.log(`PASS home/guide contract and neutral Canvas at ${width}px`);
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const placement of ["hero", "inline"] as const) {
        const root = await openMenu(page, placement);
        await page.evaluate(() => {
            const style = document.documentElement.style;
            style.setProperty("--quick-menu-center-size", "104px");
            style.setProperty("--quick-menu-center-size-compact", "104px");
            style.setProperty("--action-primary", "rgb(60 58 54)");
            style.setProperty("--text-quick-action", "18px");
        });
        const propagated = () => root.locator("[data-violet-current]").evaluate(element => ({
            width: getComputedStyle(element).width,
            background: getComputedStyle(element).backgroundColor,
            font: getComputedStyle(element.querySelector("strong")!).fontSize,
        }));
        await expect.poll(propagated).toEqual({ width: "104px", background: "rgb(60, 58, 54)", font: "18px" });
    }
    results.push({ tokenPropagation: true });
    console.log("PASS shared color, size and typography changes propagate to home and guide");

    await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (...args: unknown[]) {
            if (this.closest("[data-violet-menu]")) return null;
            return Reflect.apply(original, this, args);
        } as typeof original;
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const fallback = await openMenu(page, "hero");
    assert.equal(await fallback.locator("[data-violet-link]").count(), 6);
    assert.equal(await fallback.locator("[data-violet-wheel]").evaluate(element => getComputedStyle(element).backgroundColor), "rgb(255, 254, 250)");
    assert.equal(await fallback.evaluate(element => element.getAnimations({ subtree: true }).length), 0);
    await page.emulateMedia({ forcedColors: "active" });
    assert.equal(await fallback.locator("[data-violet-current]").evaluate(element => getComputedStyle(element).forcedColorAdjust), "auto");
    await page.keyboard.press("Escape");
    await expect(fallback.locator("[data-violet-toggle]")).toBeFocused();
    results.push({ canvasFallback: true, reducedMotion: true, forcedColors: true });
    console.log("PASS Canvas fallback, reduced motion, forced colors and keyboard focus");
    await expect.poll(() => page.evaluate(() => Boolean(customElements.get("deep-chat")))).toBe(true);
    assert.equal(await page.locator('script[src*="deep-chat@2.5.1"]').first().getAttribute("type"), "module");
    results.push({ sharedSearchModuleLoaded: true });
    console.log("PASS the real shared search dependency registers without a module syntax error");
    await page.goto(new URL("programs/", base).href, { waitUntil: "networkidle" });
    await page.locator("main .sejong-deep-search-disclosure > summary").click();
    const embedded = page.locator("main deep-chat");
    await expect(embedded.locator("#text-input")).toBeVisible();
    const typography = await embedded.evaluate(element => [...element.shadowRoot!.querySelectorAll<HTMLElement>("p, [contenteditable=true]")]
        .map(node => ({ size: parseFloat(getComputedStyle(node).fontSize), font: getComputedStyle(node).fontFamily })));
    assert.ok(typography.length > 0);
    assert.ok(typography.every(style => style.size >= 16 && style.font.includes("Wanted Sans")), JSON.stringify(typography));
    assert.equal(await page.locator("main .sejong-deep-search-disclosure").getAttribute("data-component-id"), "disclosure");
    results.push({ embeddedTypography: typography, sharedDisclosure: true });
    console.log("PASS embedded search uses the shared disclosure, local font and 16px text floor");
    assert.deepEqual(errors, []);
} finally {
    writeFileSync(path.join(directory, "results.json"), JSON.stringify({ base, results, errors }, null, 2) + "\n");
    await browser.close();
}
