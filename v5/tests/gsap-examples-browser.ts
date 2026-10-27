/**
 * GSAP product and API examples against an already built STATIC site.
 * BASE_URL=http://127.0.0.1:3004/v5/ node tests/gsap-examples-browser.ts
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
const target = new URL(process.argv.find(value => /^https?:/.test(value)) || process.env.BASE_URL || "http://127.0.0.1:3004/v5/");
if (target.pathname === "/") target.pathname = "/v5/";
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
    page.on("console", message => { if (["warning", "error"].includes(message.type()) && /(?:GSAP|gsap|resetTo|not eligible|Invalid property|Missing plugin|target .*not found|scope.*not.*valid)/i.test(message.text())) gsapWarnings.push(message.text()); });
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

async function seek(page: Page, value: number) {
    const input = page.getByRole("slider", { name: "예제 진행률", exact: true });
    await input.evaluate((element, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, String(value));
        element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    await page.waitForTimeout(80); assert.ok(Math.abs(Number(await input.inputValue()) - value) <= 1, "The real stage and range must agree within native scroll rounding");
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

    await check("editorial reveal runs once and settles", async page => {
        await enter(page, "about/"); await ready(page); const initial = await offscreenHeading(page);
        assert.ok(initial.initialOpacity < .99, "An offscreen candidate must actually have a prepared reveal");
        const frames = sample(page, '[data-gsap-test-target="heading"]', 1200);
        await page.locator('[data-gsap-test-target="heading"]').scrollIntoViewIfNeeded(); const values = await frames;
        assert.ok(values.some(value => value.opacity < .95 || value.y > 1), "Must measure an actual GSAP starting state");
        const final = await motion(page.locator('[data-gsap-test-target="heading"]')); assert.ok(final.opacity > .99); assert.ok(Math.abs(final.y) < .5);
        await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await page.waitForTimeout(100);
        const revisitFrames = sample(page, '[data-gsap-test-target="heading"]', 550); await page.locator('[data-gsap-test-target="heading"]').scrollIntoViewIfNeeded(); const revisit = await revisitFrames;
        assert.ok(revisit.every(value => value.opacity > .99 && Math.abs(value.y) < .5), "A completed reveal must not replay on revisit");
        return { initial, first: { minimumOpacity: Math.min(...values.map(value => value.opacity)), maximumY: Math.max(...values.map(value => value.y)) }, final, revisitMinimumOpacity: Math.min(...revisit.map(value => value.opacity)) };
    });

    await check("editorial focus and runtime motion reduction", async page => {
        await enter(page, "about/"); await ready(page); await offscreenHeading(page);
        const heading = page.locator('[data-gsap-test-target="heading"]');
        await heading.evaluate(element => { (element as HTMLElement).tabIndex = -1; (element as HTMLElement).focus({ preventScroll: true }); });
        const focused = await motion(heading); assert.ok(focused.opacity > .99 && Math.abs(focused.y) < .5, "Keyboard focus immediately settles its reveal");
        assert.equal(await heading.evaluate(element => element === document.activeElement), true);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.waitForFunction(() => document.querySelector("main")?.getAttribute("data-gsap-editorial-motion") === "reduced");
        const reduced = await motion(heading); assert.ok(reduced.opacity > .99 && Math.abs(reduced.y) < .5);
        await page.emulateMedia({ reducedMotion: "no-preference" }); await page.waitForFunction(() => document.querySelector("main")?.getAttribute("data-gsap-editorial-motion") === "full");
        return { focused, reduced };
    });

    await check("editorial descendant and excluded route cleanup", async page => {
        await enter(page, "about/introduction/history/"); await ready(page);
        const history = await assertReadable(page); const link = page.locator('#header a[href*="account"]').first();
        assert.ok(await link.count(), "Existing account link must support a real client transition"); await link.click();
        await page.waitForURL(/\/account\/?/); await settled(page);
        assert.equal(await page.locator("main[data-gsap-editorial]").count(), 0);
        const excluded = await assertReadable(page); await page.goBack({ waitUntil: "domcontentloaded" }); await ready(page); return { history, excluded };
    });

    await check("editorial no JavaScript remains readable", async page => { await enter(page, "about/", { hydrate: false }); assert.equal(await page.locator("main[data-gsap-editorial]").count(), 0); const state = await assertReadable(page); assert.ok(state.opacity > .99); return state; }, { javaScriptEnabled: false });

    for (const viewport of [{ width: 844, height: 390 }, { width: 640, height: 450 }]) await check(`editorial short viewport ${viewport.width}x${viewport.height}`, async page => { await enter(page, "about/"); await ready(page); await page.locator("main h2").last().scrollIntoViewIfNeeded(); return assertReadable(page); }, { viewport, reducedMotion: "reduce" });

    await check("editorial image pointer keyboard and reduced restoration", async page => {
        await enter(page, "about/companies/"); await ready(page);
        const image = page.locator(".completed-list-image > img").first(), link = image.locator("xpath=ancestor::a[1]");
        assert.equal(await link.count(), 1); await link.scrollIntoViewIfNeeded(); await page.waitForTimeout(1000);
        await link.hover(); await page.waitForTimeout(420); const hovered = await motion(image);
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
        const heading = page.locator("#gsap-test-dynamic-section h2"); await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("#gsap-test-dynamic-section h2")!).opacity) < .99);
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

    await check("introduction DrawSVG and MotionPath are actual finite animation", async page => {
        await page.addInitScript(() => {
            const frames: { time: number; dash: string; offset: string; transform: string }[] = [];
            Object.assign(window, { __gsapIntroFrames: frames });
            const deadline = performance.now() + 7000;
            const tick = () => {
                const stroke = document.querySelector("[data-intro-stroke]"), traveller = document.querySelector("[data-intro-traveller]");
                if (stroke && traveller) frames.push({ time: performance.now(), dash: getComputedStyle(stroke).strokeDasharray, offset: getComputedStyle(stroke).strokeDashoffset, transform: getComputedStyle(traveller).transform });
                if (performance.now() < deadline) requestAnimationFrame(tick);
            }; requestAnimationFrame(tick);
        });
        await enter(page, "about/introduction/"); await page.locator("[data-intro-journey]").waitFor(); await page.waitForTimeout(1800);
        const frames = await page.evaluate(() => (window as Window & { __gsapIntroFrames?: { time: number; dash: string; offset: string; transform: string }[] }).__gsapIntroFrames || []);
        assert.ok(new Set(frames.map(value => `${value.dash}:${value.offset}`)).size > 2, "The real SVG stroke range must change over time");
        assert.ok(new Set(frames.map(value => value.transform)).size > 2, "The real traveller transform must follow a path");
        const final = await motion(page.locator("[data-intro-traveller]").first()); await page.waitForTimeout(250); const still = await motion(page.locator("[data-intro-traveller]").first());
        assert.ok(Math.abs(final.x - still.x) < .1 && Math.abs(final.y - still.y) < .1, "The introductory path is finite rather than an endless loop");
        return { frames: frames.length, strokeStates: new Set(frames.map(value => `${value.dash}:${value.offset}`)).size, travellerStates: new Set(frames.map(value => value.transform)).size, final, still };
    });

    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }, { width: 844, height: 390 }, { width: 640, height: 450 }]) await check(`introduction scene keyboard ${viewport.width}x${viewport.height}`, async page => {
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

    await check("introduction runtime reduced motion settles all scenes", async page => {
        await enter(page, "about/introduction/"); await page.emulateMedia({ reducedMotion: "reduce" }); await page.waitForTimeout(150);
        const first = await motion(page.locator("[data-intro-traveller]").first()); await page.waitForTimeout(250); const second = await motion(page.locator("[data-intro-traveller]").first());
        assert.equal(first.transform, second.transform, "Motion reduction must stop the decorative path");
        const state = await page.locator(".intro-panel h1,.intro-panel h2").evaluateAll(elements => elements.map(element => ({ text: element.textContent, opacity: Number(getComputedStyle(element).opacity), hidden: !!element.closest('[hidden],[aria-hidden="true"]') })));
        assert.equal(state.length, 4); assert.ok(state.every(value => value.opacity > .99 && !value.hidden)); return { first, second, scenes: state };
    });

    await check("introduction no JavaScript has all four readable scenes", async page => { await enter(page, "about/introduction/", { hydrate: false }); assert.equal(await page.locator(".intro-panel h1,.intro-panel h2").count(), 4); return assertReadable(page); }, { javaScriptEnabled: false });

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
