/**
 * GSAP product and API examples against an already built STATIC site.
 * BASE_URL=http://127.0.0.1:3004/ node tests/gsap-examples-browser.ts
 * GSAP_CHECK_FILTER narrows a recheck; GSAP_REPORT_DIR preserves its own original report.
 * Public catalog reads use the checked-in snapshot. Real local HTTP assets are cached;
 * external requests and writes are blocked. This does not validate deployed backend permissions.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, request as apiRequest } from "playwright";
import type { BrowserContext, Locator, Page } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = new URL(process.argv.find(value => /^https?:/.test(value)) || process.env.BASE_URL || "http://127.0.0.1:3004/");
if (target.pathname === "/") target.pathname = "/";
const base = target.href.replace(/\/?$/, "/");
const directory = resolve(process.env.GSAP_REPORT_DIR || resolve(root, "../work/gsap-examples-browser"));
const filter = process.env.GSAP_CHECK_FILTER ? new RegExp(process.env.GSAP_CHECK_FILTER) : null;
const catalog = JSON.parse(readFileSync(resolve(root, "src/generated/catalog-snapshot.json"), "utf8"));
const checks: Record<string, unknown>[] = [];
const network = { catalogReads: 0, anonymousReads: 0, blockedWrites: [] as string[], blockedExternal: new Set<string>() };
const assets = new Map<string, Promise<{ status: number; headers: Record<string, string>; body: Buffer }>>();
const assetClient = await apiRequest.newContext();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined) });
mkdirSync(directory, { recursive: true });
const evidence = { harness: createHash("sha256").update(readFileSync(fileURLToPath(import.meta.url))).digest("hex"), release: "" };
type Motion = { opacity: number; x: number; y: number; scaleX: number; scaleY: number; transform: string; clip: string; dash: string; dashOffset: string; path: string; text: string; top: number; left: number; time: number };
type TextState = { tag: string; text: string; opacity: number; effectiveOpacity: number; x: number; y: number; scaleX: number; scaleY: number; documentTop: number; clip: string };
const staticTextSelector = 'main h1, main h2, main .completed-timeline > li, main .catalog-timeline > li, main [data-component-id="introduction"] [data-text="label"], main [data-component-id="introduction"] p';

/** Observe from document start, before GSAP layout effects can hide or offset text. */
async function traceStaticText(page: Page) {
    await page.addInitScript(selector => {
        const trace = { frames: 0, samples: 0, mediaSamples: 0, running: true, violations: [] as TextState[], mediaViolations: [] as Record<string, unknown>[] };
        Object.assign(window, { __gsapStaticText: trace });
        const deadline = performance.now() + 15_000;
        const tick = () => {
            for (const element of document.querySelectorAll<HTMLElement>(selector)) {
                if (element.closest('[hidden],[aria-hidden="true"],form,table,dialog,.sr-only,.visually-hidden,.completed-sr-only') || !element.getClientRects().length) continue;
                const style = getComputedStyle(element); if (style.display === "none" || style.visibility === "hidden") continue;
                let effectiveOpacity = Number(style.opacity);
                for (let parent = element.parentElement; parent; parent = parent.parentElement) { effectiveOpacity *= Number(getComputedStyle(parent).opacity); if (parent.tagName === "MAIN") break; }
                const matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
                trace.samples++;
                if (effectiveOpacity < .999 || Math.abs(matrix.m41) > .01 || Math.abs(matrix.m42) > .01 || Math.abs(matrix.a - 1) > .0005 || Math.abs(matrix.d - 1) > .0005) {
                    if (trace.violations.length < 100) trace.violations.push({ tag: element.tagName, text: element.textContent?.trim().slice(0, 100) || "", opacity: Number(style.opacity), effectiveOpacity, x: matrix.m41, y: matrix.m42, scaleX: matrix.a, scaleY: matrix.d, documentTop: element.getBoundingClientRect().top + scrollY, clip: style.clipPath });
                }
            }
            for (const image of document.querySelectorAll<HTMLImageElement>('main .completed-hero-image img,main .completed-image img,main .completed-list-image > img,main .intro-cover > img,main .intro-editorial img')) {
                const style = getComputedStyle(image);
                if (!image.getClientRects().length || style.display === "none" || style.objectFit !== "cover") continue;
                const expectedOpacity = image.closest(".intro-cover") ? .42 : 1;
                const matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
                trace.mediaSamples++;
                if (Math.abs(Number(style.opacity) - expectedOpacity) > .002 || Math.abs(matrix.m41) > .01 || Math.abs(matrix.m42) > .01 || style.clipPath !== "none") {
                    if (trace.mediaViolations.length < 100) trace.mediaViolations.push({ source: image.getAttribute("src"), opacity: Number(style.opacity), expectedOpacity, x: matrix.m41, y: matrix.m42, clip: style.clipPath });
                }
            }
            trace.frames++;
            if (trace.running && performance.now() < deadline) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, staticTextSelector);
}

async function textState(page: Page): Promise<TextState[]> {
    return page.evaluate(selector => [...document.querySelectorAll<HTMLElement>(selector)].filter(element => !element.closest('[hidden],[aria-hidden="true"],form,table,dialog,.sr-only,.visually-hidden,.completed-sr-only') && element.getClientRects().length).map(element => {
        const style = getComputedStyle(element), matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
        let effectiveOpacity = Number(style.opacity);
        for (let parent = element.parentElement; parent; parent = parent.parentElement) { effectiveOpacity *= Number(getComputedStyle(parent).opacity); if (parent.tagName === "MAIN") break; }
        return { tag: element.tagName, text: element.textContent?.trim().slice(0, 100) || "", opacity: Number(style.opacity), effectiveOpacity, x: matrix.m41, y: matrix.m42, scaleX: matrix.a, scaleY: matrix.d, documentTop: element.getBoundingClientRect().top + scrollY, clip: style.clipPath };
    }), staticTextSelector);
}

function assertStaticText(values: TextState[]) {
    assert.ok(values.length > 0, "Real headings and reading copy must exist");
    assert.ok(values.every(value => value.effectiveOpacity >= .999 && Math.abs(value.x) < .01 && Math.abs(value.y) < .01 && Math.abs(value.scaleX - 1) < .0005 && Math.abs(value.scaleY - 1) < .0005), `Reading text must remain fully visible at its resting transform: ${JSON.stringify(values.filter(value => value.effectiveOpacity < .999 || Math.abs(value.x) >= .01 || Math.abs(value.y) >= .01 || Math.abs(value.scaleX - 1) >= .0005 || Math.abs(value.scaleY - 1) >= .0005))}`);
}

async function stopTextTrace(page: Page) {
    const trace = await page.evaluate(() => { const trace = (window as Window & { __gsapStaticText?: { frames: number; samples: number; mediaSamples: number; running: boolean; violations: TextState[]; mediaViolations: Record<string, unknown>[] } }).__gsapStaticText!; trace.running = false; return trace; });
    assert.ok(trace.frames > 1 && trace.samples > 0, "The initial rendering trace must have sampled real text");
    assert.deepEqual(trace.violations, [], "Text must never fade or rise into view, including the first rendered frames");
    assert.deepEqual(trace.mediaViolations, [], "Photos must not fade, rise or reveal through a clip in initial frames"); return trace;
}

async function fixture(context: BrowserContext) {
    await context.route("**/*", async route => {
        const request = route.request(), url = new URL(request.url());
        if (/(?:^|\.)supabase\.(co|in)$/.test(url.hostname) || /^\/(rest|auth)\/v1\//.test(url.pathname)) {
            const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
            if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
            if (url.pathname === "/rest/v1/rpc/sejong_catalog_snapshot" && ["GET", "POST"].includes(request.method())) { network.catalogReads++; return route.fulfill({ json: catalog, headers }); }
            if (request.method() === "GET") { network.anonymousReads++; return route.fulfill({ json: url.pathname === "/auth/v1/settings" ? { external: { google: false } } : [], headers }); }
            network.blockedWrites.push(`${request.method()} ${url.origin}${url.pathname}`);
            return route.fulfill({ status: 403, json: { message: "GSAP fixture blocks remote mutations and email" }, headers });
        }
        if (url.origin !== target.origin && /^https?:$/.test(url.protocol)) { network.blockedExternal.add(`${request.resourceType()} ${url.origin}${url.pathname}`); return route.abort("blockedbyclient"); }
        if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) { network.blockedWrites.push(`${request.method()} ${url.origin}${url.pathname}`); return route.fulfill({ status: 403, json: { message: "GSAP fixture permits local reads only" } }); }
        if (url.origin === target.origin && /\.(?:js|css|woff2?|svg|png|jpe?g|webp|avif|gif|ico)$/i.test(url.pathname)) {
            if (!assets.has(url.href)) assets.set(url.href, assetClient.get(url.href, { timeout: 15_000 }).then(async response => {
                const headers = { ...response.headers() }; delete headers["content-length"]; delete headers["content-encoding"];
                return { status: response.status(), headers, body: await response.body() };
            }).catch(error => { assets.delete(url.href); throw error; }));
            return route.fulfill(await assets.get(url.href)!);
        }
        return route.continue();
    });
}

function save() {
    writeFileSync(resolve(directory, "report.json"), JSON.stringify({ base, evidence, checkFilter: process.env.GSAP_CHECK_FILTER || null, network: { mode: "mocked public catalog; genuine local HTTP assets; external requests and all writes blocked", ...network, blockedExternal: [...network.blockedExternal] }, checks }, null, 2) + "\n");
}

async function check(name: string, run: (page: Page) => Promise<unknown>, options: Parameters<typeof browser.newContext>[0] = {}) {
    if (filter && !filter.test(name)) return;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference", serviceWorkers: "block", ...options });
    await fixture(context);
    const page = await context.newPage(); page.setDefaultTimeout(10_000);
    const runtimeErrors: string[] = [], assetErrors: string[] = [], gsapWarnings: string[] = [];
    page.on("pageerror", error => runtimeErrors.push(error.message));
    page.on("console", message => { if (["warning", "error"].includes(message.type()) && /(?:GSAP|gsap|resetTo|not eligible|Invalid property|Invalid scope|Missing plugin|target .*not found|scope.*not.*valid)/i.test(message.text())) gsapWarnings.push(message.text()); });
    page.on("response", response => { if (new URL(response.url()).origin === target.origin && response.status() >= 400 && !response.request().isNavigationRequest()) assetErrors.push(`${response.status()} ${response.url()}`); });
    const result: Record<string, unknown> = { name, status: "running", viewport: options.viewport || { width: 1440, height: 1000 }, startedAt: new Date().toISOString() };
    try {
        result.detail = await run(page);
        assert.deepEqual(runtimeErrors, [], "No browser runtime errors");
        assert.deepEqual(assetErrors, [], "No missing local assets");
        assert.deepEqual(gsapWarnings, [], "GSAP must not report invalid/resetTo/target/scope properties");
        result.status = "passed"; console.log(`PASS ${name}`);
    } catch (error) {
        result.status = "failed"; result.error = error instanceof Error ? error.stack : String(error);
        result.runtimeErrors = runtimeErrors; result.assetErrors = assetErrors; result.gsapWarnings = gsapWarnings;
        result.location = page.url();
        result.staticTextTrace = await page.evaluate(() => (window as Window & { __gsapStaticText?: unknown }).__gsapStaticText || null).catch(() => null);
        const screenshot = `${name.replace(/[^a-zA-Z0-9_-]/g, "-")}-failure.png`;
        await page.screenshot({ path: resolve(directory, screenshot) }).then(() => { result.screenshot = screenshot; }).catch(() => {});
        console.error(`FAIL ${name}: ${error instanceof Error ? error.message : error}`);
    } finally { checks.push(result); save(); await context.close(); }
}

async function settled(page: Page) {
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>(resolve => {
            let quiet: ReturnType<typeof setTimeout>;
            const observer = new MutationObserver(() => { clearTimeout(quiet); quiet = setTimeout(finish, 350); });
            const finish = () => { clearTimeout(quiet); clearTimeout(deadline); observer.disconnect(); resolve(); };
            const deadline = setTimeout(finish, 4000);
            observer.observe(document.querySelector("main") || document.body, { childList: true, characterData: true, subtree: true });
            quiet = setTimeout(finish, 350);
        });
    });
}

async function enter(page: Page, path: string, options: { hydrate?: boolean; quiet?: boolean } = {}) {
    const response = await page.goto(new URL(path, base).href, { waitUntil: "domcontentloaded", timeout: 25_000 }); assert.equal(response?.status(), 200);
    if (!evidence.release) evidence.release = await page.locator("script[src*='_next']").first().getAttribute("src").then(value => value?.match(/\/static\/([^/]+)\//)?.[1] || "unknown");
    if (options.hydrate !== false) await page.waitForFunction(() => {
        const control = document.querySelector("#header button, .ds-app button, button");
        return control && Object.keys(control).some(key => key.startsWith("__reactProps$"));
    });
    if (options.quiet !== false) await settled(page);
}

async function ready(page: Page, timeout = 8000) { await page.locator('main[data-gsap-editorial="ready"]').waitFor({ timeout }); }

async function motion(locator: Locator): Promise<Motion> {
    return locator.evaluate(element => {
        const style = getComputedStyle(element), box = element.getBoundingClientRect(), matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
        return { opacity: Number(style.opacity), x: matrix.m41, y: matrix.m42, scaleX: matrix.a, scaleY: matrix.d, transform: style.transform, clip: style.clipPath, dash: style.strokeDasharray, dashOffset: style.strokeDashoffset, path: element.getAttribute("d") || "", text: element.textContent || "", top: box.top, left: box.left, time: performance.now() };
    });
}

async function sample(page: Page, selector: string, duration = 950): Promise<Motion[]> {
    return page.evaluate(async ({ selector, duration }) => {
        const values: Motion[] = [], end = performance.now() + duration;
        do {
            const element = document.querySelector(selector); if (!element) break;
            const style = getComputedStyle(element), box = element.getBoundingClientRect(), matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
            values.push({ opacity: Number(style.opacity), x: matrix.m41, y: matrix.m42, scaleX: matrix.a, scaleY: matrix.d, transform: style.transform, clip: style.clipPath, dash: style.strokeDasharray, dashOffset: style.strokeDashoffset, path: element.getAttribute("d") || "", text: element.textContent || "", top: box.top, left: box.left, time: performance.now() });
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        } while (performance.now() < end);
        return values;
    }, { selector, duration });
}

async function offscreenHeading(page: Page) {
    const found = await page.evaluate(() => {
        const headings = [...document.querySelectorAll<HTMLElement>("main h2")].filter(element => !element.closest('form,table,dialog,[hidden],[aria-hidden="true"],.completed-sources,[data-component-id="introduction"]') && element.getBoundingClientRect().top > innerHeight + 40);
        const heading = headings[0]; if (!heading) return null;
        heading.setAttribute("data-gsap-test-target", "heading");
        return { text: heading.textContent?.trim(), initialOpacity: Number(getComputedStyle(heading).opacity), top: heading.getBoundingClientRect().top };
    });
    assert.ok(found, "The real page must contain an eligible offscreen heading"); return found;
}

async function assertReadable(page: Page) {
    const state = await page.evaluate(() => {
        const main = document.querySelector<HTMLElement>("main")!, heading = main.querySelector<HTMLElement>("h1")!;
        return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, text: main.textContent?.trim().length || 0, heading: heading.textContent?.trim(), fontSize: parseFloat(getComputedStyle(heading).fontSize), opacity: Number(getComputedStyle(heading).opacity), hidden: !!main.closest('[hidden],[aria-hidden="true"],[inert]') };
    });
    assert.ok(state.text >= 20); assert.ok(state.fontSize >= 16); assert.ok(state.documentWidth <= state.width + 1, JSON.stringify(state)); assert.equal(state.hidden, false); return state;
}

async function seek(page: Page, value: number, verifyRange = true) {
    const input = page.getByRole("slider", { name: "예제 진행률", exact: true });
    await input.evaluate((element, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, String(value));
        element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    await page.waitForTimeout(80);
    if (verifyRange) assert.ok(Math.abs(Number(await input.inputValue()) - value) <= 1, "The real stage and range must agree within native scroll rounding");
}

async function labSnapshot(page: Page) {
    return page.locator("[data-gsap-stage]").evaluate(stage => {
        const box = stage.getBoundingClientRect();
        const actors = [...stage.querySelectorAll<HTMLElement | SVGElement>("[data-lab-target],[data-lab-path],[data-lab-text],[data-lab-tile],[data-lab-text] *")].map(element => {
            const style = getComputedStyle(element), rect = element.getBoundingClientRect();
            const matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
            return { tag: element.tagName, opacity: Number(style.opacity), x: matrix.m41, y: matrix.m42, scaleX: matrix.a, scaleY: matrix.d, rotation: Math.atan2(matrix.b, matrix.a), left: Math.round((rect.left - box.left) * 10) / 10, top: Math.round((rect.top - box.top) * 10) / 10, path: element.getAttribute("d"), dash: style.strokeDasharray, dashOffset: style.strokeDashoffset, text: element.textContent || "" };
        });
        return { actors, scrollTop: stage.querySelector("[data-lab-scroller]")?.scrollTop || 0 };
    });
}

async function lab(page: Page, id = "timeline") {
    await enter(page, "design-rules/#motion/gsap");
    await page.locator("[data-gsap-playground]").waitFor();
    await page.getByRole("combobox", { name: "GSAP 예제", exact: true }).selectOption(id);
    await page.locator(`[data-gsap-example="${id}"]`).waitFor(); await page.waitForTimeout(120);
}

function distinctActors(before: Awaited<ReturnType<typeof labSnapshot>>, after: Awaited<ReturnType<typeof labSnapshot>>) { return JSON.stringify(before) !== JSON.stringify(after); }

try {
    await check("editorial route contract", async page => { await enter(page, "about/"); await ready(page, 1800); return assertReadable(page); });

    for (const path of ["programs", "rental", "visit", "news", "about"]) for (const width of [320, 390, 768, 1024, 1440]) {
        await check(`editorial ${path} ${width}`, async page => {
            await enter(page, `${path}/`); await ready(page);
            assert.equal(await page.locator("main").getAttribute("data-gsap-editorial-motion"), "reduced");
            assert.equal(await page.locator('[data-component-id="section-experience"]').count(), 0, "The retired fixed section navigator must not return");
            return assertReadable(page);
        }, { viewport: { width, height: width < 768 ? 844 : 1000 }, reducedMotion: "reduce" });
    }

    await check("editorial text is static from first frame through native scroll", async page => {
        await traceStaticText(page); await enter(page, "about/"); await ready(page); const initial = await offscreenHeading(page);
        assert.ok(initial.initialOpacity >= .999, "An offscreen heading must be fully readable before reaching the viewport");
        const before = await textState(page); assertStaticText(before);
        await page.locator('[data-gsap-test-target="heading"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
        const after = await textState(page); assertStaticText(after);
        assert.deepEqual(after.map(value => value.text), before.map(value => value.text));
        assert.ok(after.every((value, index) => Math.abs(value.documentTop - before[index].documentTop) < 1), "Native scrolling must not lift or reposition reading copy");
        const frames = await sample(page, '[data-gsap-test-target="heading"]', 400);
        assert.ok(frames.every(value => value.opacity >= .999 && Math.abs(value.x) < .01 && Math.abs(value.y) < .01));
        return { initial, before, after, trace: await stopTextTrace(page) };
    });

    await check("editorial focus and reduced motion keep text unchanged", async page => {
        await enter(page, "about/"); await ready(page); await offscreenHeading(page);
        const heading = page.locator('[data-gsap-test-target="heading"]');
        const before = await motion(heading); assert.ok(before.opacity >= .999 && Math.abs(before.x) < .01 && Math.abs(before.y) < .01);
        await heading.evaluate(element => { (element as HTMLElement).tabIndex = -1; (element as HTMLElement).focus({ preventScroll: true }); });
        const focused = await motion(heading); assert.ok(focused.opacity > .99 && Math.abs(focused.y) < .5, "Keyboard focus must not move or fade an already visible heading");
        assert.equal(await heading.evaluate(element => element === document.activeElement), true);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.waitForFunction(() => document.querySelector("main")?.getAttribute("data-gsap-editorial-motion") === "reduced");
        const reduced = await motion(heading); assert.ok(reduced.opacity > .99 && Math.abs(reduced.y) < .5);
        await page.emulateMedia({ reducedMotion: "no-preference" }); await page.waitForFunction(() => document.querySelector("main")?.getAttribute("data-gsap-editorial-motion") === "full");
        return { before, focused, reduced };
    });

    await check("editorial descendant and excluded route cleanup", async page => {
        await enter(page, "about/introduction/history/"); await ready(page);
        const history = await assertReadable(page); const link = page.locator('#header a[href*="account"]').first();
        assert.ok(await link.count(), "Existing account link must support a real client transition"); await link.click();
        await page.waitForURL(/\/account\/?/); await settled(page);
        assert.equal(await page.locator("main[data-gsap-editorial]").count(), 0);
        const excluded = await assertReadable(page); await page.goBack({ waitUntil: "domcontentloaded" }); await ready(page); return { history, excluded };
    });

    await check("editorial no JavaScript remains readable", async page => { await enter(page, "about/", { hydrate: false, quiet: false }); await page.waitForTimeout(300); assert.equal(await page.locator("main[data-gsap-editorial]").count(), 0); const state = await assertReadable(page); assert.ok(state.opacity > .99); return state; }, { javaScriptEnabled: false });

    for (const viewport of [{ width: 844, height: 390 }, { width: 640, height: 450 }]) await check(`editorial short viewport ${viewport.width}x${viewport.height}`, async page => { await enter(page, "about/"); await ready(page); await page.locator("main h2").last().scrollIntoViewIfNeeded(); return assertReadable(page); }, { viewport, reducedMotion: "reduce" });

    await check("editorial image pointer keyboard and reduced restoration", async page => {
        await enter(page, "programs/history/"); await ready(page);
        const image = page.locator(".completed-list-image > img").first(), owner = image.locator("xpath=ancestor::li[1]"), link = owner.locator("a").first();
        assert.equal(await image.count(), 1); assert.equal(await owner.count(), 1); assert.equal(await link.count(), 1); await owner.scrollIntoViewIfNeeded(); await page.waitForTimeout(1000);
        await owner.hover(); await page.waitForTimeout(420); const hovered = await motion(image);
        assert.ok(hovered.scaleX > 1.015 && hovered.scaleX <= 1.03 && Math.abs(hovered.scaleX - hovered.scaleY) < .002, "Pointer feedback must scale both actual image axes together");
        await page.mouse.move(0, 0); await page.waitForTimeout(420); const resting = await motion(image); assert.ok(Math.abs(resting.scaleX - 1) < .002 && Math.abs(resting.scaleY - 1) < .002);
        await link.focus(); await page.waitForTimeout(420); const focused = await motion(image); assert.ok(focused.scaleX > 1.015 && Math.abs(focused.scaleX - focused.scaleY) < .002);
        await page.emulateMedia({ reducedMotion: "reduce" }); await page.waitForTimeout(150); const reduced = await motion(image); assert.ok(Math.abs(reduced.scaleX - 1) < .002 && Math.abs(reduced.scaleY - 1) < .002);
        return { hovered, resting, focused, reduced };
    });

    await check("editorial new content rebuild and detached target cleanup", async page => {
        await enter(page, "about/"); await ready(page);
        await page.evaluate(() => {
            const section = document.createElement("section"); section.id = "gsap-test-dynamic-section";
            const heading = document.createElement("h2"); heading.dataset.text = "heading"; heading.textContent = "동적 카탈로그 제목"; heading.tabIndex = -1; section.append(heading); document.querySelector("main")!.append(section);
        });
        const heading = page.locator("#gsap-test-dynamic-section h2"); const frames = await sample(page, "#gsap-test-dynamic-section h2", 450); assert.ok(frames.length && frames.every(value => value.opacity >= .999 && Math.abs(value.x) < .01 && Math.abs(value.y) < .01), "New reading copy must be visible immediately without a reveal");
        const before = await motion(heading); await heading.focus(); const focused = await motion(heading); assert.ok(focused.opacity > .99 && Math.abs(focused.y) < .5);
        await page.evaluate(() => { const section = document.getElementById("gsap-test-dynamic-section")!; Object.assign(window, { __detachedGsapHeading: section.querySelector("h2") }); section.remove(); }); await page.waitForTimeout(150);
        const detached = await page.evaluate(() => { const element = (window as Window & { __detachedGsapHeading?: HTMLElement }).__detachedGsapHeading!; return { connected: element.isConnected, transform: element.style.transform, opacity: element.style.opacity }; });
        assert.equal(detached.connected, false); assert.ok(!detached.transform && !detached.opacity, "Rebuilding must remove owned styles from detached content"); return { before, focused, detached };
    });

    await check("editorial visibility suspension and resume", async page => {
        await enter(page, "about/"); await ready(page); await offscreenHeading(page);
        await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
        await page.waitForFunction(() => document.querySelector("main")?.getAttribute("data-gsap-editorial") === "suspended");
        const hidden = await motion(page.locator('[data-gsap-test-target="heading"]')); assert.ok(hidden.opacity > .99 && Math.abs(hidden.y) < .5, "Suspension must restore content to the resting style");
        await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); }); await ready(page);
        return { syntheticLifecycleEvent: true, hidden, resumed: await page.locator("main").getAttribute("data-gsap-editorial") };
    });

    await check("Flip category keeps actual surviving cards and settles", async page => {
        await enter(page, "programs/"); await ready(page);
        const survivor = page.locator('[data-flip-id="program-autumn"]'); assert.equal(await survivor.count(), 1);
        const start = await motion(survivor), frames = sample(page, '[data-flip-id="program-autumn"]', 1100);
        await page.getByRole("button", { name: "공연", exact: true }).click(); const values = await frames;
        assert.ok(values.some(value => Math.abs(value.x) > .5 || Math.abs(value.y) > .5), "A surviving card must undergo a real Flip position tween");
        await page.locator('.programs-page[data-gsap-flip="ready"]').waitFor();
        const final = await motion(survivor); assert.ok(Math.abs(final.x) < .5 && Math.abs(final.y) < .5);
        assert.notEqual(start.left + start.top, final.left + final.top, "The selected category must change the card's actual layout position");
        assert.equal(await page.locator(".programs-page-grid [data-program-flip]").count(), catalog.programs.filter((program: { category: string }) => program.category === "공연").length);
        return { start, end: final, maximumX: Math.max(...values.map(value => Math.abs(value.x))), maximumY: Math.max(...values.map(value => Math.abs(value.y))) };
    });

    await check("Flip rapid input empty results and restored focus", async page => {
        await enter(page, "programs/"); const query = page.locator("#program-query");
        await query.fill("일"); await query.fill("일무"); await query.fill("없는 프로그램_형태_8291");
        assert.equal(await page.locator(".programs-page-grid [data-program-flip]").count(), 0); await page.getByRole("status").filter({ hasText: "검색 결과가 없습니다" }).waitFor();
        assert.equal(await query.evaluate(element => element === document.activeElement), true);
        await query.fill(""); await page.locator('.programs-page[data-gsap-flip="ready"]').waitFor();
        assert.equal(await page.locator(".programs-page-grid [data-program-flip]").count(), catalog.programs.length);
        const remaining = await page.locator(".programs-page-grid [data-program-flip]").evaluateAll(elements => elements.map(element => { const style = getComputedStyle(element), matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform); return { x: matrix.m41, y: matrix.m42, scaleX: matrix.a, scaleY: matrix.d, opacity: Number(style.opacity) }; }));
        assert.ok(remaining.every(value => Math.abs(value.x) < .5 && Math.abs(value.y) < .5 && Math.abs(value.scaleX - 1) < .002 && Math.abs(value.scaleY - 1) < .002 && value.opacity > .99), "Rapid changes must leave no stale Flip displacement, scale or opacity");
        assert.equal(await query.evaluate(element => element === document.activeElement), true); return { restored: remaining.length, queryFocused: true };
    });

    await check("Flip runtime reduced motion resolves active work", async page => {
        await enter(page, "programs/"); await page.getByRole("button", { name: "공연", exact: true }).click(); await page.emulateMedia({ reducedMotion: "reduce" });
        await page.locator('.programs-page[data-gsap-flip="ready"]').waitFor();
        const reduced = await motion(page.locator('[data-flip-id="program-autumn"]')); assert.ok(Math.abs(reduced.x) < .5 && Math.abs(reduced.y) < .5);
        await page.getByRole("button", { name: "전체", exact: true }).click();
        const frames = sample(page, '[data-flip-id="program-autumn"]', 400);
        await page.getByRole("button", { name: "공연", exact: true }).click(); const values = await frames;
        assert.ok(values.every(value => Math.abs(value.x) < .5 && Math.abs(value.y) < .5), "Reduced motion must update the real collection without a new Flip tween"); return { reduced, samples: values.length };
    });

    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) await check(`introduction fixed text and native scroll photo ${viewport.width}x${viewport.height}`, async page => {
        await traceStaticText(page); await enter(page, "about/introduction/"); await ready(page);
        const textBefore = await textState(page); assertStaticText(textBefore);
        assert.equal(await page.locator("[data-intro-journey],[data-intro-stroke],[data-intro-traveller]").count(), 0, "The decorative wave and moving dot must be removed");
        assert.equal(await page.locator("img[data-intro-media]").count(), 3, "Only the three existing photos own the native scroll motion");
        const frameState = async () => page.locator(".intro-editorial .intro-media-frame").evaluateAll(frames => frames.map(frame => {
            const style = getComputedStyle(frame), box = frame.getBoundingClientRect(), caption = frame.closest("figure")?.querySelector("figcaption");
            const captionStyle = caption && getComputedStyle(caption), captionBox = caption?.getBoundingClientRect(), matrix = new DOMMatrixReadOnly(!captionStyle || captionStyle.transform === "none" ? undefined : captionStyle.transform);
            return { radius: parseFloat(style.borderTopLeftRadius), overflowX: style.overflowX, overflowY: style.overflowY, width: box.width, height: box.height, documentTop: box.top + scrollY, captionOutside: !!caption && !frame.contains(caption), captionDocumentTop: captionBox ? captionBox.top + scrollY : null, captionGap: captionBox ? captionBox.top - box.bottom : null, captionX: matrix.m41, captionY: matrix.m42, captionScaleX: matrix.a, captionScaleY: matrix.d };
        }));
        const framesBefore = await frameState(); assert.equal(framesBefore.length, 2);
        assert.ok(framesBefore.every(frame => frame.radius >= 19 && frame.overflowX === "hidden" && frame.overflowY === "hidden" && frame.captionOutside && frame.captionGap !== null && frame.captionGap >= -1 && Math.abs(frame.captionX) < .01 && Math.abs(frame.captionY) < .01 && Math.abs(frame.captionScaleX - 1) < .0005 && Math.abs(frame.captionScaleY - 1) < .0005), `Scaled photos require the real rounded clipping frame and an unmoved caption outside it: ${JSON.stringify(framesBefore)}`);
        const image = page.locator(".intro-cover > img[data-intro-media]");
        await image.waitFor(); await page.waitForFunction(() => { const image = document.querySelector<HTMLImageElement>(".intro-cover > img[data-intro-media]"); return image?.complete && image.naturalWidth > 0; });
        const geometry = await page.locator("#intro-opening").evaluate(element => ({ top: element.getBoundingClientRect().top + scrollY, height: element.getBoundingClientRect().height, viewport: innerHeight, maximum: document.documentElement.scrollHeight - innerHeight }));
        const expectedScale = (scroll: number) => 1.035 - .035 * Math.max(0, Math.min(1, (scroll - (geometry.top - geometry.viewport)) / (geometry.height + geometry.viewport)));
        const scrollTo = async (top: number) => { await page.evaluate(top => window.scrollTo({ top, behavior: "instant" }), top); await page.waitForTimeout(120); return page.evaluate(() => scrollY); };
        const assertPhoto = (value: Motion, scroll: number, reduced = false) => {
            assert.ok(Math.abs(value.opacity - .42) < .002 && Math.abs(value.x) < .01 && Math.abs(value.y) < .01 && value.clip === "none", `A photo may scale but must not fade, rise or clip: ${JSON.stringify(value)}`);
            assert.ok(value.scaleX >= .999 && value.scaleX <= 1.036 && Math.abs(value.scaleX - value.scaleY) < .0005);
            assert.ok(Math.abs(value.scaleX - (reduced ? 1 : expectedScale(scroll))) < .002, `Photo scale must match native scroll progress, not elapsed time: ${JSON.stringify({ value, scroll, expected: reduced ? 1 : expectedScale(scroll) })}`);
        };
        const initialY = await scrollTo(0), initial = await motion(image); assertPhoto(initial, initialY);
        const middleY = await scrollTo(Math.min(geometry.maximum, geometry.top + geometry.height * .25)), middle = await motion(image); assertPhoto(middle, middleY);
        assert.ok(initial.scaleX - middle.scaleX > .003, "Changing native scroll position must change the actual photo scale");
        const stopped = await sample(page, ".intro-cover > img[data-intro-media]", 350); assert.ok(stopped.every(value => Math.abs(value.scaleX - middle.scaleX) < .0005), "When scrolling stops, the photo must stop immediately");
        await page.locator("#intro-title-opening").evaluate(element => (element as HTMLElement).focus({ preventScroll: true })); await page.waitForTimeout(100);
        const focused = await motion(image); assert.ok(Math.abs(focused.scaleX - middle.scaleX) < .0005, "Focusing a title must not force a photo animation to its end");
        const endY = await scrollTo(Math.min(geometry.maximum, geometry.top + geometry.height + 20)), end = await motion(image); assertPhoto(end, endY);
        await scrollTo(middleY); const reversed = await motion(image); assertPhoto(reversed, middleY);
        const framesAfter = await frameState();
        assert.ok(framesAfter.every((frame, index) => Math.abs(frame.width - framesBefore[index].width) < 1 && Math.abs(frame.height - framesBefore[index].height) < 1 && Math.abs(frame.documentTop - framesBefore[index].documentTop) < 1 && frame.captionDocumentTop !== null && framesBefore[index].captionDocumentTop !== null && Math.abs(frame.captionDocumentTop - framesBefore[index].captionDocumentTop!) < 1), "Photo scale must not shift the clipping frame or caption layout");
        const textAfter = await textState(page); assertStaticText(textAfter); assert.deepEqual(textAfter.map(value => value.text), textBefore.map(value => value.text));
        assert.ok(textAfter.every((value, index) => Math.abs(value.documentTop - textBefore[index].documentTop) < 1), "All scene text must stay at its original document position while photos respond to scroll");
        await page.emulateMedia({ reducedMotion: "reduce" }); await page.waitForTimeout(150); const reduced = await motion(image); assertPhoto(reduced, middleY, true); assertStaticText(await textState(page));
        await page.emulateMedia({ reducedMotion: "no-preference" }); await page.waitForTimeout(150); const resumed = await motion(image); assertPhoto(resumed, middleY);
        await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
        await page.waitForTimeout(150); const hidden = await motion(image); assertPhoto(hidden, middleY, true);
        await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
        await ready(page); await page.waitForTimeout(150); const restored = await motion(image); assertPhoto(restored, middleY);
        const trace = await stopTextTrace(page); assert.ok(trace.mediaSamples > 0);
        await scrollTo(0); const screenshot = `intro-stable-${viewport.width}.png`; await page.screenshot({ path: resolve(directory, screenshot) });
        return { geometry, framesBefore, framesAfter, initial, middle, focused, end, reversed, reduced, resumed, hidden, restored, trace, screenshot };
    }, { viewport });

    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }, { width: 1440, height: 1400 }, { width: 844, height: 390 }, { width: 640, height: 450 }]) await check(`introduction scene keyboard ${viewport.width}x${viewport.height}`, async page => {
        await enter(page, "about/introduction/"); const button = page.locator(".intro-scenes").getByRole("button", { name: "서울시예술단", exact: true });
        await button.focus(); await page.keyboard.press("Enter");
        const title = page.locator("#intro-title-pulse"); await page.waitForFunction(() => document.activeElement?.id === "intro-title-pulse");
        await page.waitForFunction(() => { const title = document.getElementById("intro-title-pulse"); if (!title) return false; const box = title.getBoundingClientRect(), header = document.getElementById("header")?.getBoundingClientRect(); return box.top >= (header?.bottom || 0) - 1 && box.bottom <= innerHeight + 1; });
        assert.equal(await button.getAttribute("aria-current"), "step"); const state = await motion(title); assert.ok(state.opacity > .99 && Math.abs(state.y) < .5);
        const moreScenes: unknown[] = [];
        for (const [id, name] of [["space", "공연장과 전시장"], ["together", "관람 안내"]]) {
            const control = page.locator(".intro-scenes").getByRole("button", { name, exact: true }); await control.click();
            await page.waitForFunction(id => document.activeElement?.id === `intro-title-${id}`, id);
            await page.waitForFunction(name => [...document.querySelectorAll(".intro-scenes button")].some(button => button.textContent?.trim() === name && button.getAttribute("aria-current") === "step"), name);
            moreScenes.push({ id, current: await control.getAttribute("aria-current"), focused: await page.evaluate(() => document.activeElement?.id) });
        }
        await page.locator(".intro-scenes").getByRole("button", { name: "세종문화회관", exact: true }).click(); await page.waitForFunction(() => document.activeElement?.id === "intro-title-opening");
        return { title: state, moreScenes, focusAfterReturn: await page.evaluate(() => document.activeElement?.id), noOverflow: await assertReadable(page) };
    }, { viewport, reducedMotion: "reduce" });

    await check("introduction no JavaScript has all four readable scenes", async page => { await enter(page, "about/introduction/", { hydrate: false, quiet: false }); await page.waitForTimeout(300); assert.equal(await page.locator(".intro-panel h1,.intro-panel h2").count(), 4); return assertReadable(page); }, { javaScriptEnabled: false });

    for (const id of ["timeline", "easing", "scroll", "flip", "draw", "motion-path", "morph", "split", "scramble", "physics"]) await check(`lab actual API ${id}`, async page => {
        await lab(page, id); await seek(page, 0); const before = await labSnapshot(page);
        await seek(page, 55); const middle = await labSnapshot(page); await seek(page, 100); const end = await labSnapshot(page);
        assert.ok(distinctActors(before, middle) || distinctActors(before, end), `${id} must change real stage properties through its real API`);
        if (id === "draw") assert.notDeepEqual(before.actors.map(value => [value.dash, value.dashOffset]), middle.actors.map(value => [value.dash, value.dashOffset]), "DrawSVG must change a stroke range");
        if (id === "morph") assert.notDeepEqual(before.actors.map(value => value.path), middle.actors.map(value => value.path), "MorphSVG must change actual path geometry");
        if (id === "scroll") assert.ok(middle.scrollTop > 0, "ScrollTrigger example must use its own real scroller");
        if (["timeline", "easing", "motion-path", "physics"].includes(id)) assert.ok(middle.actors.some(value => Math.abs(value.x) > .5 || Math.abs(value.y) > .5 || Math.abs(value.rotation) > .01 || Math.abs(value.scaleX - 1) > .01), `${id} must change a visual numeric property`);
        return { before, middle, end };
    });

    await check("lab timeline play pause restart and rapid example cleanup", async page => {
        await lab(page); await seek(page, 0); const before = await labSnapshot(page);
        await page.getByRole("button", { name: "재생", exact: true }).click(); await page.waitForTimeout(180);
        await page.getByRole("button", { name: "일시정지", exact: true }).click(); const paused = await labSnapshot(page); assert.ok(distinctActors(before, paused));
        await page.waitForTimeout(180); const still = await labSnapshot(page); assert.deepEqual(still, paused, "Pause must stop the underlying timeline");
        await page.getByRole("button", { name: "다시 시작", exact: true }).click(); await page.waitForTimeout(90);
        for (const id of ["split", "morph", "draw", "motion-path", "drag", "observer", "timeline"]) await page.getByRole("combobox", { name: "GSAP 예제", exact: true }).selectOption(id);
        await page.waitForTimeout(160); assert.equal(await page.locator("[data-gsap-stage]").count(), 1); await seek(page, 0);
        return { before, paused, still, final: await labSnapshot(page) };
    });

    await check("lab native scroller then play continues from its actual position", async page => {
        await lab(page, "scroll"); const scroller = page.locator("[data-lab-scroller]");
        const manual = await scroller.evaluate(element => { element.scrollTop = (element.scrollHeight - element.clientHeight) * .8; return { top: element.scrollTop, maximum: element.scrollHeight - element.clientHeight }; });
        assert.ok(manual.maximum > 0 && manual.top > 0);
        await page.waitForFunction(() => Math.abs(Number((document.querySelector('[aria-label="예제 진행률"]') as HTMLInputElement)?.value) - 80) <= 1);
        await page.getByRole("button", { name: "재생", exact: true }).click(); await page.waitForTimeout(100);
        const playing = await scroller.evaluate(element => element.scrollTop); assert.ok(playing >= manual.top - 2, `Playback must continue near the manual 80% position rather than jumping backward (${manual.top}→${playing})`);
        await page.getByRole("button", { name: "일시정지", exact: true }).click(); const paused = await scroller.evaluate(element => element.scrollTop); await page.waitForTimeout(150);
        assert.ok(Math.abs(await scroller.evaluate(element => element.scrollTop) - paused) <= 1); return { manual, playing, paused };
    });

    await check("lab first native scroll then 55 percent seek has no lazy start jump", async page => {
        await lab(page, "scroll"); const scroller = page.locator("[data-lab-scroller]");
        const manual = await scroller.evaluate(element => { element.scrollTop = (element.scrollHeight - element.clientHeight) * .5; return { top: element.scrollTop, maximum: element.scrollHeight - element.clientHeight }; });
        await page.waitForFunction(() => Math.abs(Number((document.querySelector('[aria-label="예제 진행률"]') as HTMLInputElement)?.value) - 50) <= 1);
        // This is intentionally the first range interaction: a prior seek(0) would mask lazy start capture.
        await seek(page, 55, false);
        const after = await scroller.evaluate(element => ({ top: element.scrollTop, maximum: element.scrollHeight - element.clientHeight, ratio: element.scrollTop / (element.scrollHeight - element.clientHeight) }));
        assert.ok(Math.abs(after.ratio - .55) <= .015, `The first 55% seek must mean 55%, not a tween starting from the manual 50% position: ${JSON.stringify({ manual, after })}`);
        assert.ok(Math.abs(Number(await page.getByRole("slider", { name: "예제 진행률", exact: true }).inputValue()) - 55) <= 1);
        return { priorRangeInteractions: 0, manual, after };
    });

    await check("lab first pointer drag release keeps its actual position", async page => {
        await lab(page, "drag"); const handle = page.getByRole("slider", { name: "드래그 위치", exact: true });
        const start = await handle.boundingBox(), stage = await page.locator("[data-gsap-stage]").boundingBox(); assert.ok(start && stage);
        const distance = Math.min(110, (stage.width - start.width) * .4), pointer = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
        // No Home/End/seek comes before this gesture: those would initialize the old .to() start state.
        await page.mouse.move(pointer.x, pointer.y); await page.mouse.down(); await page.mouse.move(pointer.x + distance, pointer.y, { steps: 10 });
        const beforeRelease = await handle.boundingBox(); assert.ok(beforeRelease && beforeRelease.x - start.x > distance * .75, "The first real pointer gesture must move the handle");
        await page.mouse.up(); await page.waitForTimeout(180); const afterRelease = await handle.boundingBox(); assert.ok(afterRelease);
        assert.ok(Math.abs(afterRelease.x - beforeRelease.x) <= 2, `Release must retain the pointer position rather than applying a newly captured tween start (${beforeRelease.x}→${afterRelease.x})`);
        return { priorRangeAndKeyboardInteractions: 0, start, beforeRelease, afterRelease };
    });

    await check("lab Draggable pointer bounds and keyboard equivalent", async page => {
        await lab(page, "drag"); const handle = page.getByRole("slider", { name: "드래그 위치", exact: true });
        await handle.focus(); await page.keyboard.press("End"); const high = Number(await handle.getAttribute("aria-valuenow"));
        await page.keyboard.press("Home"); const low = Number(await handle.getAttribute("aria-valuenow")); assert.ok(high > low);
        await page.keyboard.press("ArrowRight"); const stepped = Number(await handle.getAttribute("aria-valuenow")); assert.ok(stepped > low && stepped < high);
        const stage = await page.locator("[data-gsap-stage]").boundingBox(), box = await handle.boundingBox(); assert.ok(stage && box);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(stage.x + stage.width + 180, box.y + box.height / 2, { steps: 12 }); await page.mouse.up();
        const dragged = await handle.boundingBox(); assert.ok(dragged && dragged.x >= stage.x - 1 && dragged.x + dragged.width <= stage.x + stage.width + 1, "Dragging must remain within the real stage bounds");
        return { low, high, stepped, dragged, ariaNow: await handle.getAttribute("aria-valuenow") };
    });

    await check("lab Observer local gestures and keyboard preserve page scroll", async page => {
        await lab(page, "observer"); const before = await labSnapshot(page);
        await page.getByRole("button", { name: "다음 반응", exact: true }).click(); await page.waitForTimeout(450); const next = await labSnapshot(page); assert.ok(distinctActors(before, next));
        await page.getByRole("group", { name: "제스처 반응 영역", exact: true }).focus(); await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(450); const keyboard = await labSnapshot(page); assert.ok(distinctActors(next, keyboard));
        const top = await page.evaluate(() => scrollY); await page.mouse.move(20, 200); await page.mouse.wheel(0, 250); await page.waitForTimeout(250); const moved = await page.evaluate(() => scrollY);
        assert.ok(moved !== top || await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), "Observer must not capture global page wheel scrolling"); return { before, next, keyboard, scrollBefore: top, scrollAfter: moved };
    });

    await check("lab runtime reduced motion keeps manual progress and accessible text", async page => {
        await lab(page, "split"); await page.getByRole("button", { name: "재생", exact: true }).click(); await page.emulateMedia({ reducedMotion: "reduce" });
        await page.waitForFunction(() => (document.querySelector('[data-gsap-playground] button') || null) !== null); await page.waitForTimeout(160);
        assert.equal(await page.getByRole("button", { name: "재생", exact: true }).isDisabled(), true);
        assert.equal(await page.getByRole("button", { name: "다시 시작", exact: true }).isDisabled(), true);
        await seek(page, 100); const readable = await labSnapshot(page); assert.ok(readable.actors.some(value => value.text.trim().length > 0));
        await page.emulateMedia({ reducedMotion: "no-preference" }); await page.waitForTimeout(160); assert.equal(await page.getByRole("button", { name: "재생", exact: true }).isEnabled(), true);
        return { readable };
    });

    for (const width of [320, 390, 768, 1024, 1440]) await check(`lab responsive controls ${width}`, async page => {
        await lab(page, "timeline"); await seek(page, 55);
        const state = await page.locator("[data-gsap-playground]").evaluate(element => {
            const controls = [...element.querySelectorAll<HTMLElement>("button,select,input")].filter(control => control.getClientRects().length);
            return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, controls: controls.map(control => { const box = control.getBoundingClientRect(); return { text: control.getAttribute("aria-label") || control.textContent, left: box.left, right: box.right, fontSize: parseFloat(getComputedStyle(control).fontSize), width: box.width }; }) };
        });
        assert.ok(state.documentWidth <= state.viewport + 1); assert.ok(state.controls.every(control => control.left >= -1 && control.right <= width + 1 && control.fontSize >= 16 && control.width > 0));
        if (width === 390 || width === 1440) { const name = `lab-${width}.png`; await page.screenshot({ path: resolve(directory, name) }); return { ...state, screenshot: name }; } return state;
    }, { viewport: { width, height: 900 } });
} finally {
    await browser.close(); await assetClient.dispose(); save();
}
const failed = checks.filter(check => check.status !== "passed");
console.log(`${checks.length} GSAP browser checks; ${failed.length} failed. Evidence: ${directory}`);
if (failed.length) process.exitCode = 1;
