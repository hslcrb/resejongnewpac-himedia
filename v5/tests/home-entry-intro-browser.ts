/**
 * Real static-build intro acceptance: loaded font pixels, complete handwriting, lifecycle and accessibility.
 * cd v5 && BASE_URL=http://127.0.0.1:3000/v5/ node tests/home-entry-intro-browser.ts
 * CHROMIUM_EXECUTABLE_PATH overrides /usr/bin/chromium; INTRO_REPORT_DIR selects screenshots and JSON.
 * Public catalog reads use the checked-in snapshot. External requests and other writes are blocked.
 * Does not build, send email, mutate accounts or write generated product files.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { Page } from "playwright";

const v5Root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = new URL(process.argv.find(value => /^https?:/.test(value)) || process.env.BASE_URL || "http://127.0.0.1:3000/v5/");
if (target.pathname === "/") target.pathname = "/v5/";
const base = target.href.replace(/\/?$/, "/");
const directory = resolve(process.env.INTRO_REPORT_DIR || resolve(v5Root, "../work/home-entry-intro"));
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const copy = "2026 화이팅!", introSelector = "[data-v5-entry-intro]";
const fontPath = "/v5/assets/fonts/Yeongwol-Regular.woff2", scenePath = "/v5/assets/intro/scenartmv.svg";
const catalog = JSON.parse(readFileSync(resolve(v5Root, "src/generated/catalog-snapshot.json"), "utf8"));
const checks: Record<string, unknown>[] = [];
const network = { catalogReads: 0, blockedExternal: new Set<string>(), blockedWrites: [] as string[] };
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });

async function check(name: string, run: (page: Page) => Promise<unknown>, options: Parameters<typeof browser.newContext>[0] = {}) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference", serviceWorkers: "block", ...options });
    await context.route("**/*", async route => {
        const request = route.request(), url = new URL(request.url());
        if (/(?:^|\.)supabase\.(co|in)$/.test(url.hostname) || /^\/(rest|auth)\/v1\//.test(url.pathname)) {
            const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
            if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
            if (url.pathname === "/rest/v1/rpc/sejong_catalog_snapshot" && ["GET", "POST"].includes(request.method())) { network.catalogReads++; return route.fulfill({ json: catalog, headers }); }
            if (request.method() === "GET") return route.fulfill({ json: url.pathname === "/auth/v1/settings" ? { external: { google: false } } : [], headers });
            network.blockedWrites.push(`${request.method()} ${url.origin}${url.pathname}`);
            return route.fulfill({ status: 403, json: { message: "Intro fixture blocks remote mutations and email" }, headers });
        }
        if (url.origin !== target.origin && /^https?:$/.test(url.protocol)) { network.blockedExternal.add(`${request.resourceType()} ${url.origin}${url.pathname}`); return route.abort("blockedbyclient"); }
        if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) { network.blockedWrites.push(`${request.method()} ${url.origin}${url.pathname}`); return route.fulfill({ status: 403, json: { message: "Intro fixture permits local reads only" } }); }
        return route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(10_000);
    const errors: string[] = [], assets: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (new URL(response.url()).origin === target.origin && response.status() >= 400 && !response.request().isNavigationRequest()) assets.push(`${response.status()} ${response.url()}`); });
    const result: Record<string, unknown> = { name, status: "running", viewport: options.viewport, startedAt: new Date().toISOString() };
    try {
        result.detail = await run(page);
        assert.deepEqual(errors, [], "Intro must not raise browser runtime errors"); assert.deepEqual(assets, [], "Intro must not request missing local assets");
        result.status = "passed"; console.log(`PASS ${name}`);
    } catch (error) {
        result.status = "failed"; result.error = error instanceof Error ? error.stack : String(error); result.runtimeErrors = errors; result.assetErrors = assets;
        const screenshot = `${name.replace(/[^a-zA-Z0-9_-]/g, "-")}-failure.png`;
        await page.screenshot({ path: resolve(directory, screenshot) }).then(() => { result.screenshot = screenshot; }).catch(() => {});
        console.error(`FAIL ${name}: ${error instanceof Error ? error.message : error}`);
    } finally {
        checks.push(result); await context.close();
        writeFileSync(resolve(directory, "report.json"), JSON.stringify({ base, expectedCopy: copy, network: { mode: "mocked public catalog; external requests and all writes blocked", ...network, blockedExternal: [...network.blockedExternal] }, checks }, null, 2) + "\n");
    }
}

async function enter(page: Page) {
    const response = await page.goto(base, { waitUntil: "domcontentloaded" }); assert.equal(response?.status(), 200);
    const intro = page.locator(introSelector); await intro.waitFor({ state: "visible", timeout: 8_000 });
    await page.waitForFunction(selector => document.querySelector(selector)?.contains(document.activeElement), introSelector);
    assert.equal(await intro.getAttribute("role"), "dialog"); assert.equal(await intro.getAttribute("aria-modal"), "true");
    return intro;
}

async function assertClean(page: Page) {
    await page.locator(introSelector).waitFor({ state: "detached", timeout: 10_000 });
    const state = await page.evaluate(() => {
        const main = document.querySelector<HTMLElement>("#main,main");
        return { mainExists: !!main, mainInert: !!main?.closest("[inert]"), mainHidden: !!main?.closest('[aria-hidden="true"]'), mainWidth: main?.getBoundingClientRect().width || 0, overflow: getComputedStyle(document.body).overflow, documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, focusInRemovedIntro: !!document.activeElement?.closest("[data-v5-entry-intro]") };
    });
    assert.equal(state.mainExists, true); assert.equal(state.mainInert, false); assert.equal(state.mainHidden, false); assert.ok(state.mainWidth > 0);
    assert.notEqual(state.overflow, "hidden", "Body scrolling must be restored"); assert.equal(state.focusInRemovedIntro, false);
    assert.ok(state.documentWidth <= state.viewportWidth + 1, "Intro exit must leave no horizontal document overflow"); return state;
}

async function renderedHandwriting(page: Page) {
    const info = await page.evaluate(async ({ copy, fontPath }) => {
        const element = document.querySelector<HTMLElement>("[data-intro-handwriting]")!, style = getComputedStyle(element);
        await document.fonts.load(`${style.fontWeight} 64px ${style.fontFamily}`, copy);
        const families = [...document.fonts].filter(face => /Yeongwol/i.test(face.family)).map(face => ({ family: face.family, status: face.status, weight: face.weight }));
        const glyphs = [...element.querySelectorAll<HTMLElement>("[data-intro-glyph]")].map(glyph => {
            const rect = glyph.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(glyph);
            const textRects = [...range.getClientRects()].map(box => ({ left: box.left, right: box.right, top: box.top, bottom: box.bottom }));
            const clippedBy: string[] = [];
            for (let parent = glyph.parentElement; parent; parent = parent.parentElement) {
                const parentStyle = getComputedStyle(parent), box = parent.getBoundingClientRect();
                if (/^(hidden|clip|scroll|auto)$/.test(parentStyle.overflowX) && (rect.left < box.left - 1 || rect.right > box.right + 1)) clippedBy.push(`${parent.tagName}:x`);
                if (/^(hidden|clip|scroll|auto)$/.test(parentStyle.overflowY) && (rect.top < box.top - 1 || rect.bottom > box.bottom + 1)) clippedBy.push(`${parent.tagName}:y`);
            }
            return { text: glyph.textContent?.replaceAll("\u00a0", " "), written: glyph.getAttribute("data-written"), opacity: Number(getComputedStyle(glyph).opacity), clipPath: getComputedStyle(glyph).clipPath, rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }, textRects, clippedBy };
        });
        const draw = (font: string) => {
            const canvas = document.createElement("canvas"); canvas.width = 800; canvas.height = 160;
            const pen = canvas.getContext("2d")!; pen.font = `400 64px ${font}`; pen.fillText(copy, 20, 100);
            const pixels = pen.getImageData(0, 0, canvas.width, canvas.height).data;
            let hash = 2166136261, ink = 0;
            for (let index = 3; index < pixels.length; index += 4) { hash = Math.imul(hash ^ pixels[index], 16777619); if (pixels[index]) ink++; }
            return { width: pen.measureText(copy).width, hash: hash >>> 0, ink };
        };
        return { text: element.textContent?.replaceAll("\u00a0", " "), fontFamily: style.fontFamily, fontWeight: style.fontWeight, fontSize: Number.parseFloat(style.fontSize), fontCheck: document.fonts.check(`${style.fontWeight} 64px ${style.fontFamily}`, copy), families, fontRequested: performance.getEntriesByType("resource").some(entry => new URL(entry.name).pathname === fontPath), custom: draw(style.fontFamily), fallback: draw("monospace"), glyphs, viewport: { width: innerWidth, height: innerHeight }, phase: element.closest("[data-v5-entry-intro]")?.getAttribute("data-phase") };
    }, { copy, fontPath });
    assert.equal(info.text, copy, "The final phrase must be exactly 2026 화이팅!"); assert.equal(info.phase, "copy");
    assert.match(info.fontFamily, /Yeongwol/i, "The handwriting must actually use the local Yeongwol family"); assert.equal(info.fontWeight, "400"); assert.ok(info.fontSize >= 16);
    assert.equal(info.fontCheck, true); assert.ok(info.families.some(face => face.status === "loaded"), "The font face must finish loading");
    assert.equal(info.fontRequested, true, "The browser must request the local woff2"); assert.ok(info.custom.ink > 100);
    assert.notEqual(info.custom.hash, info.fallback.hash, "Actual canvas glyph pixels must differ from fallback pixels");
    assert.equal(info.glyphs.length, [...copy].length);
    for (const glyph of info.glyphs) {
        assert.equal(glyph.written, "true", `Glyph ${glyph.text} must be written`); assert.ok(glyph.opacity >= .95, `Glyph ${glyph.text} must finish its ink animation`);
        assert.ok(glyph.rect.width > 0 && glyph.rect.height > 0); assert.deepEqual(glyph.clippedBy, [], `Glyph ${glyph.text} must not be clipped by a stage ancestor`);
        for (const rect of [glyph.rect, ...glyph.textRects]) assert.ok(rect.left >= -1 && rect.right <= info.viewport.width + 1 && rect.top >= -1 && rect.bottom <= info.viewport.height + 1, `Glyph ${glyph.text} must fit ${info.viewport.width}x${info.viewport.height}: ${JSON.stringify(rect)}`);
    }
    return info;
}

try {
    await check("static scene and font assets", async page => {
        const asset = await page.request.get(new URL(scenePath, base).href); assert.equal(asset.status(), 200); assert.match(asset.headers()["content-type"] || "", /svg/);
        const source = await asset.text(); assert.match(source, /<animate/); await page.goto(base + "#main", { waitUntil: "domcontentloaded" });
        const opaqueCanvasRects = await page.evaluate(source => {
            const svg = new DOMParser().parseFromString(source, "image/svg+xml");
            const viewBox = svg.documentElement.getAttribute("viewBox")?.split(/[\s,]+/).map(Number) || [0, 0, 1560, 1040];
            return [...svg.querySelectorAll("rect")].filter(rect => !rect.closest("defs,clipPath,mask,pattern") && Number(rect.getAttribute("width")) >= viewBox[2] * .98 && Number(rect.getAttribute("height")) >= viewBox[3] * .98 && !/^(none|transparent)$/.test(rect.getAttribute("fill") || "") && rect.getAttribute("opacity") !== "0").map(rect => rect.outerHTML.slice(0, 250));
        }, source);
        assert.deepEqual(opaqueCanvasRects, [], "The retained scene must not paint a full-canvas background rectangle");
        const font = await page.request.get(new URL(fontPath, base).href); assert.equal(font.status(), 200); const bytes = await font.body();
        assert.equal(bytes.subarray(0, 4).toString(), "wOF2", "Font URL must return a real WOFF2"); return { scenePath, sceneBytes: source.length, fontPath, fontBytes: bytes.length, opaqueCanvasRects };
    });

    const viewports = [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }, { width: 844, height: 320 }];
    for (let index = 0; index < viewports.length; index += 3) await Promise.all(viewports.slice(index, index + 3).map(viewport => check(`natural-${viewport.width}x${viewport.height}`, async page => {
        const intro = await enter(page); assert.equal(await intro.getAttribute("data-phase"), "artwork"); assert.equal(await intro.locator(`img[src="${scenePath}"]`).count(), 1);
        assert.equal(await page.locator("#main").evaluate(element => !!element.closest("[inert]")), true, "Background must be inert during intro");
        await page.evaluate(selector => {
            const element = document.querySelector(selector)!, phases = [element.getAttribute("data-phase")];
            new MutationObserver(() => { const phase = element.getAttribute("data-phase"); if (phases.at(-1) !== phase) phases.push(phase); }).observe(element, { attributes: true, attributeFilter: ["data-phase"] });
            Object.assign(window, { __entryIntroPhases: phases });
        }, introSelector);
        await page.waitForFunction(() => {
            const glyphs = [...document.querySelectorAll<HTMLElement>("[data-intro-glyph]")];
            return glyphs.length === 9 && glyphs.every(glyph => glyph.getAttribute("data-written") === "true" && Number(getComputedStyle(glyph).opacity) >= .99 && !glyph.getAnimations().some(animation => animation.playState === "running"));
        }, undefined, { timeout: 7_000 });
        const handwriting = await renderedHandwriting(page), skipBox = await page.getByRole("button", { name: "인트로 건너뛰기", exact: true }).boundingBox();
        assert.ok(skipBox && skipBox.x >= 0 && skipBox.y >= 0 && skipBox.x + skipBox.width <= viewport.width + 1 && skipBox.y + skipBox.height <= viewport.height + 1, "Skip must fit short landscape");
        await page.screenshot({ path: resolve(directory, `copy-${viewport.width}x${viewport.height}.png`) });
        await intro.waitFor({ state: "detached", timeout: 6_000 });
        const phases = await page.evaluate(() => (window as Window & { __entryIntroPhases?: string[] }).__entryIntroPhases);
        assert.deepEqual(phases, ["artwork", "copy", "exit"]);
        const elapsed = await page.evaluate(() => performance.now()); assert.ok(elapsed >= 6_000 && elapsed <= 11_000, `Expected roughly seven seconds, received ${elapsed}ms from navigation`);
        return { handwriting, phases, elapsedMs: elapsed, cleanup: await assertClean(page), screenshot: `copy-${viewport.width}x${viewport.height}.png` };
    }, { viewport })));

    await check("keyboard trap and Escape cleanup", async page => {
        await enter(page); const skip = page.getByRole("button", { name: "인트로 건너뛰기", exact: true }); assert.equal(await skip.evaluate(element => element === document.activeElement), true);
        for (const key of ["Tab", "Tab", "Shift+Tab"]) { await page.keyboard.press(key); assert.equal(await skip.evaluate(element => element === document.activeElement), true, `${key} must stay inside intro`); }
        await page.keyboard.press("Escape"); const clean = await assertClean(page);
        await page.getByRole("button", { name: "통합검색 열기", exact: true }).click(); await page.locator("#search-dialog").waitFor({ state: "visible" }); return clean;
    });
    await check("skip cleanup and internal navigation", async page => {
        await enter(page); await page.getByRole("button", { name: "인트로 건너뛰기", exact: true }).click(); const clean = await assertClean(page);
        await page.locator(".desktop-nav a").first().click(); await page.waitForURL(url => url.pathname !== target.pathname);
        assert.equal(await page.locator(introSelector).count(), 0, "Internal navigation must not replay intro");
        await page.goto(new URL("programs/", base).href, { waitUntil: "domcontentloaded" }); assert.equal(await page.locator(introSelector).count(), 0); return clean;
    }, { viewport: { width: 1440, height: 900 } });
    for (const suffix of ["#main", "?mode=cms-scm"]) await check(`bypass ${suffix}`, async page => {
        await page.goto(base + suffix, { waitUntil: "domcontentloaded" }); await page.locator(introSelector).waitFor({ state: "detached", timeout: 4_000 }); return assertClean(page);
    });
    await check("initial reduced motion", async page => {
        await page.goto(base, { waitUntil: "domcontentloaded" }); await page.locator(introSelector).waitFor({ state: "detached", timeout: 4_000 }); return assertClean(page);
    }, { reducedMotion: "reduce" });
    await check("runtime reduced motion change", async page => { await enter(page); await page.emulateMedia({ reducedMotion: "reduce" }); return assertClean(page); });
    await check("runtime hash navigation", async page => { await enter(page); await page.evaluate(() => { location.hash = "main"; }); const clean = await assertClean(page); assert.equal(new URL(page.url()).hash, "#main"); return clean; });
    await check("pagehide cleanup", async page => { await enter(page); await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }))); return assertClean(page); });
    await check("hidden document cleanup", async page => {
        await enter(page);
        // Explicit lifecycle event: headless tabs do not reliably become backgrounded.
        await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); }); return assertClean(page);
    });
    await check("font and scene failure still finishes", async page => {
        const blocked: string[] = [];
        await page.route(url => [fontPath, scenePath].includes(url.pathname), route => { blocked.push(new URL(route.request().url()).pathname); return route.abort("failed"); });
        await enter(page); assert.equal(await page.getByRole("button", { name: "인트로 건너뛰기", exact: true }).isEnabled(), true);
        const cleanup = await assertClean(page); assert.ok(blocked.includes(fontPath) && blocked.includes(scenePath), "Fault fixture must actually block both assets"); return { blocked, cleanup };
    });
    await check("no JavaScript fail open", async page => {
        await page.goto(base, { waitUntil: "load" });
        await page.waitForFunction(() => { const intro = document.querySelector<HTMLElement>("[data-v5-entry-intro]"); return !intro || getComputedStyle(intro).display === "none" || getComputedStyle(intro).visibility === "hidden"; }, undefined, { timeout: 12_000 });
        const state = await page.evaluate(() => {
            const main = document.querySelector<HTMLElement>("main")!;
            return { mainText: main.innerText.trim().length, inert: !!main.closest("[inert]"), hidden: !!main.closest('[aria-hidden="true"]'), scrollable: getComputedStyle(document.body).overflow !== "hidden" };
        });
        assert.ok(state.mainText > 20); assert.equal(state.inert, false); assert.equal(state.hidden, false); assert.equal(state.scrollable, true);
        const link = page.locator("main a[href]").first(); await link.scrollIntoViewIfNeeded(); await link.click({ noWaitAfter: true }); await page.waitForURL(url => url.href !== base, { timeout: 8_000 });
        await page.screenshot({ path: resolve(directory, "no-javascript-fail-open.png") }); return state;
    }, { javaScriptEnabled: false });

    assert.deepEqual(network.blockedWrites, [], "Acceptance must never attempt a remote write or email");
    const failures = checks.filter(check => check.status === "failed"); console.log(`${checks.length} entry intro checks; ${failures.length} failed. Evidence: ${directory}`); if (failures.length) process.exitCode = 1;
} finally { await browser.close(); }
