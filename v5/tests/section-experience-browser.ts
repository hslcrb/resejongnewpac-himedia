/**
 * GSAP section experience acceptance against a real static build.
 * BASE_URL=http://127.0.0.1:3000/v5/ node tests/section-experience-browser.ts
 * SECTION_CHECK_FILTER narrows check names; SECTION_REPORT_DIR selects local evidence.
 * Every public NAV route is checked. Real immutable local HTTP assets are cached between cases.
 * Public catalog reads use the checked-in fixture; external requests, writes and email are blocked.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, request as apiRequest } from "playwright";
import type { BrowserContext, Page } from "playwright";
import { NAV, PAGES } from "../src/data/catalog.ts";

const v5Root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = new URL(process.env.BASE_URL || "http://127.0.0.1:3000/v5/");
if (base.pathname === "/") base.pathname = "/v5/";
if (!base.pathname.endsWith("/")) base.pathname += "/";
const directory = resolve(process.env.SECTION_REPORT_DIR || resolve(v5Root, "../work/section-experience"));
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const snapshot = JSON.parse(readFileSync(resolve(v5Root, "src/generated/catalog-snapshot.json"), "utf8"));
const rootSelector = '[data-component-id="section-experience"]';
const toolbarSelector = ".section-experience__navigator";
const chapterHeadingSelector = "h2:not(.completed-sources h2):not(form h2):not(dialog h2)";
const routes = PAGES.filter(page => NAV.some(group => page.path === group.path || page.path.startsWith(group.path + "/"))).map(page => page.path);
assert.equal(routes.length, 125, "Keep the actual five-group route inventory explicit");
const checks: Record<string, unknown>[] = [];
const network = { publicCatalogReads: 0, blockedWrites: [] as string[], blockedExternal: new Set<string>() };
const assetClient = await apiRequest.newContext();
const assets = new Map<string, Promise<{ status: number; headers: Record<string, string>; body: Buffer }>>();
const browser = await chromium.launch({ headless: true, executablePath });
mkdirSync(directory, { recursive: true });

async function networkFixture(context: BrowserContext) {
    await context.route("**/*", async route => {
        const request = route.request(), url = new URL(request.url());
        if (/(?:^|\.)supabase\.(co|in)$/.test(url.hostname) || /^\/(rest|auth)\/v1\//.test(url.pathname)) {
            const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
            if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
            if (url.pathname === "/rest/v1/rpc/sejong_catalog_snapshot" && ["GET", "POST"].includes(request.method())) { network.publicCatalogReads++; return route.fulfill({ json: snapshot, headers }); }
            if (request.method() === "GET") return route.fulfill({ status: url.pathname === "/auth/v1/user" ? 401 : 200, json: url.pathname === "/auth/v1/settings" ? { external: { google: false } } : [], headers });
            network.blockedWrites.push(`${request.method()} ${url.origin}${url.pathname}`);
            return route.fulfill({ status: 403, json: { message: "Section fixture blocks writes and email" }, headers });
        }
        if (url.origin !== base.origin && /^https?:$/.test(url.protocol)) { network.blockedExternal.add(`${request.resourceType()} ${url.origin}${url.pathname}`); return route.abort("blockedbyclient"); }
        if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) { network.blockedWrites.push(`${request.method()} ${url.origin}${url.pathname}`); return route.fulfill({ status: 403, json: { message: "Read-only fixture" } }); }
        if (url.origin === base.origin && /\.(?:js|css|woff2?|svg|png|jpe?g|webp|avif|gif|ico)$/i.test(url.pathname)) {
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
    writeFileSync(resolve(directory, "report.json"), JSON.stringify({ base: base.href, checkedRoutes: routes, checkFilter: process.env.SECTION_CHECK_FILTER || null, network: { ...network, blockedExternal: [...network.blockedExternal], mode: "Public catalog fixtures; real immutable local asset HTTP bytes; external requests and writes blocked" }, checks }, null, 2) + "\n");
}

async function check(name: string, run: (page: Page) => Promise<unknown>, options: Parameters<typeof browser.newContext>[0] = {}, reuse?: Page) {
    if (process.env.SECTION_CHECK_FILTER && !new RegExp(process.env.SECTION_CHECK_FILTER).test(name)) return;
    const context = reuse ? null : await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", serviceWorkers: "block", ...options });
    if (context) await networkFixture(context);
    const page = reuse || await context!.newPage(); page.setDefaultTimeout(15_000); page.setDefaultNavigationTimeout(30_000);
    const runtimeErrors: string[] = [], missingAssets: string[] = [];
    const onError = (error: Error) => runtimeErrors.push(error.message);
    const onResponse = (response: import("playwright").Response) => { if (new URL(response.url()).origin === base.origin && response.status() >= 400 && !response.request().isNavigationRequest()) missingAssets.push(`${response.status()} ${response.url()}`); };
    page.on("pageerror", onError); page.on("response", onResponse);
    const result: Record<string, unknown> = { name, status: "running", startedAt: new Date().toISOString(), viewport: options.viewport };
    try {
        result.detail = await run(page);
        assert.deepEqual(runtimeErrors, [], "No browser runtime errors"); assert.deepEqual(missingAssets, [], "No missing local assets");
        result.status = "passed"; console.log(`PASS ${name}`);
    } catch (error) {
        result.status = "failed"; result.error = error instanceof Error ? error.stack : String(error); result.runtimeErrors = runtimeErrors; result.missingAssets = missingAssets;
        result.pageState = await page.evaluate(({ rootSelector, toolbarSelector }) => ({ url: location.pathname + location.hash, scrollY, viewport: { width: innerWidth, height: innerHeight }, toolbar: document.querySelector(toolbarSelector)?.textContent, toolbarBounds: document.querySelector(toolbarSelector)?.getBoundingClientRect().toJSON(), testTrace: (window as Window & { __sectionTestTrace?: unknown }).__sectionTestTrace, imageState: [...document.querySelectorAll(`${rootSelector} .completed-list-image > img`)].map(image => ({ transform: getComputedStyle(image).transform, ownerHovered: image.closest("a")?.matches(":hover"), fine: matchMedia("(hover: hover) and (pointer: fine)").matches, motion: matchMedia("(prefers-reduced-motion: no-preference)").matches })), focus: { tag: document.activeElement?.tagName, id: document.activeElement?.id, text: document.activeElement?.textContent?.slice(0, 160) }, headings: [...document.querySelectorAll(`${rootSelector} h2`)].map(heading => ({ id: heading.id, text: heading.textContent, top: heading.getBoundingClientRect().top })) }), { rootSelector, toolbarSelector }).catch(() => null);
        const screenshot = name.replace(/[^a-zA-Z0-9_-]/g, "-") + "-failure.png";
        await page.screenshot({ path: resolve(directory, screenshot) }).then(() => { result.screenshot = screenshot; }).catch(() => {});
        console.error(`FAIL ${name}: ${error instanceof Error ? error.message : error}`);
    } finally {
        page.off("pageerror", onError); page.off("response", onResponse); checks.push(result); save();
        if (context) await context.close();
    }
}

async function visit(page: Page, path: string, expectExperience = true) {
    const url = new URL(path.replace(/^\//, "").replace(/\/?$/, "/"), base);
    const response = await page.goto(url.href, { waitUntil: "domcontentloaded" }); assert.equal(response?.status(), 200);
    await page.locator("#main").waitFor({ state: "visible" });
    await page.waitForFunction(() => {
        const button = document.querySelector("#header button");
        return button && Object.keys(button).some(key => key.startsWith("__reactProps$"));
    });
    if (expectExperience) await page.locator(rootSelector).waitFor({ state: "visible" });
}

async function pageMetrics(page: Page) {
    return page.evaluate(({ rootSelector, toolbarSelector, chapterHeadingSelector }) => {
        const root = document.querySelector<HTMLElement>(rootSelector)!, toolbar = root.querySelector<HTMLElement>(toolbarSelector);
        const h1 = root.querySelector("h1"), headings = [...root.querySelectorAll<HTMLElement>(chapterHeadingSelector)].filter(node => node.getBoundingClientRect().width > 0);
        const box = toolbar?.getBoundingClientRect();
        return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, mainTextLength: root.innerText.trim().length, h1: h1?.textContent?.trim(), headingCount: headings.length, toolbarCount: root.querySelectorAll(toolbarSelector).length, toolbarLabel: toolbar?.getAttribute("aria-label"), toolbarBounds: box ? { left: box.left, right: box.right, width: box.width } : null,
            headings: headings.map(node => { const style = getComputedStyle(node), r = node.getBoundingClientRect(); return { text: node.innerText, opacity: Number(style.opacity), size: Number.parseFloat(style.fontSize), left: r.left, right: r.right }; }) };
    }, { rootSelector, toolbarSelector, chapterHeadingSelector });
}

async function assertPage(page: Page) {
    assert.equal(await page.locator(rootSelector).count(), 1, "Exactly one experience per supported page");
    const headingCount = await page.locator(`${rootSelector} ${chapterHeadingSelector}`).count();
    if (headingCount >= 2) await page.locator(toolbarSelector).waitFor({ state: "visible" });
    const metrics = await pageMetrics(page);
    assert.ok(metrics.h1); assert.ok(metrics.mainTextLength > 30); assert.ok(metrics.documentWidth <= metrics.width + 1, "No horizontal overflow");
    if (metrics.headingCount >= 2) { assert.equal(metrics.toolbarCount, 1); assert.equal(metrics.toolbarLabel, "페이지 빠른 탐색"); }
    else assert.equal(await page.locator(toolbarSelector).isVisible(), false, "Single-section pages need no visible empty navigator");
    if (metrics.toolbarBounds) assert.ok(metrics.toolbarBounds.left >= -1 && metrics.toolbarBounds.right <= metrics.width + 1, "Navigator stays inside viewport");
    for (const heading of metrics.headings) { assert.ok(heading.size >= 16); assert.ok(heading.opacity > 0); assert.ok(heading.left >= -1 && heading.right <= metrics.width + 1, `Readable heading: ${heading.text}`); }
    return metrics;
}

async function focusedHeading(page: Page) {
    await page.waitForFunction(rootSelector => { const root = document.querySelector(rootSelector); return !!root?.contains(document.activeElement) && document.activeElement?.tagName === "H2"; }, rootSelector);
    return page.evaluate(() => ({ text: (document.activeElement as HTMLElement).innerText, top: document.activeElement!.getBoundingClientRect().top }));
}

async function progress(page: Page) {
    return page.locator("[data-section-progress]").evaluate(element => { const transform = getComputedStyle(element).transform; return transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a; });
}

try {
    const inventoryContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
    await networkFixture(inventoryContext); const inventoryPage = await inventoryContext.newPage();
    try { for (const path of routes) await check(`route-${path}`, async page => { await visit(page, path); return assertPage(page); }, {}, inventoryPage); }
    finally { await inventoryContext.close(); }

    for (const width of [320, 390, 768, 1024, 1440]) for (const group of NAV) await check(`viewport-${group.id}-${width}`, async page => {
        await visit(page, group.path); const metrics = await assertPage(page);
        const screenshot = `${group.id}-${width}.png`; await page.screenshot({ path: resolve(directory, screenshot) }); return { ...metrics, screenshot };
    }, { viewport: { width, height: width < 768 ? 844 : 1000 } });

    await check("section-navigation-and-progress", async page => {
        await visit(page, "/about"); await assertPage(page);
        const nav = page.locator(toolbarSelector), labels = await page.locator(`${rootSelector} ${chapterHeadingSelector}`).allTextContents();
        await nav.evaluate(nav => { (window as Window & { __sectionTestTrace?: unknown }).__sectionTestTrace = { before: { toolbar: nav.textContent, bounds: nav.getBoundingClientRect().toJSON(), offset: getComputedStyle(document.querySelector("#completed-section-title-1")!).scrollMarginTop } }; });
        const before = await progress(page); await nav.getByRole("button", { name: "다음 섹션", exact: true }).click();
        const focused = await focusedHeading(page); assert.equal(focused.text.trim(), labels[1].trim(), "Next targets exactly the second content heading");
        await nav.evaluate(nav => { Object.assign((window as Window & { __sectionTestTrace?: object }).__sectionTestTrace!, { afterFocus: { toolbar: nav.textContent, bounds: nav.getBoundingClientRect().toJSON(), offset: getComputedStyle(document.activeElement!).scrollMarginTop } }); });
        await page.waitForFunction(({ rootSelector, toolbarSelector, title }) => document.querySelector(rootSelector)?.querySelector(toolbarSelector)?.textContent?.includes(title), { rootSelector, toolbarSelector, title: focused.text });
        await page.waitForFunction(before => { const element = document.querySelector("[data-section-progress]"); return !!element && new DOMMatrixReadOnly(getComputedStyle(element).transform).a > before + .001; }, before);
        await nav.getByRole("button", { name: "이전 섹션", exact: true }).click(); const previous = await focusedHeading(page); assert.equal(previous.text.trim(), labels[0].trim());
        return { before, focused, previous, after: await progress(page) };
    }, { viewport: { width: 390, height: 844 } });

    await check("keyboard-navigation-focus", async page => {
        await visit(page, "/about"); await assertPage(page); const button = page.locator(toolbarSelector).getByRole("button", { name: "다음 섹션", exact: true });
        await button.focus(); await page.keyboard.press("Enter"); const focused = await focusedHeading(page); assert.ok(focused.top >= -1 && focused.top < 844);
        await page.keyboard.press("Tab"); assert.ok(await page.locator(rootSelector).evaluate(root => root.contains(document.activeElement)), "Keyboard can continue into readable page content"); return focused;
    }, { viewport: { width: 390, height: 844 } });

    await check("dynamic-headings-keep-unique-targets-and-current-text", async page => {
        await visit(page, "/about/introduction"); await assertPage(page);
        const previous = await page.locator(`${rootSelector} ${chapterHeadingSelector}`).evaluateAll(headings => headings.map(heading => ({ id: heading.id, text: heading.textContent?.trim() })));
        await page.locator(`${rootSelector} ${chapterHeadingSelector}`).first().evaluate(first => {
            const heading = document.createElement("h2"); heading.textContent = "추가된 안내"; heading.dataset.testInserted = "true"; first.before(heading);
        });
        await page.waitForFunction(toolbarSelector => document.querySelector(toolbarSelector)?.textContent?.includes("추가된 안내"), toolbarSelector);
        const ids = await page.locator(`${rootSelector} ${chapterHeadingSelector}`).evaluateAll(headings => headings.map(heading => heading.id));
        assert.ok(ids.every(Boolean)); assert.equal(new Set(ids).size, ids.length, "Prepending a heading must not reuse an existing generated target ID");
        for (const item of previous) assert.ok(ids.includes(item.id), "Existing heading targets stay stable across DOM additions");
        await page.locator(toolbarSelector).getByRole("button", { name: "다음 섹션", exact: true }).click();
        const focused = await focusedHeading(page); assert.equal(focused.text.trim(), previous[0].text, "Next selects the unique existing first heading after insertion");
        const currentId = await page.evaluate(() => document.activeElement!.id);
        await page.evaluate(() => { const heading = document.activeElement!; if (heading.firstChild?.nodeType !== Node.TEXT_NODE) throw new Error("Expected a real heading text node"); heading.firstChild.nodeValue = "변경된 현재 안내"; });
        await page.waitForFunction(toolbarSelector => document.querySelector(toolbarSelector)?.textContent?.includes("변경된 현재 안내"), toolbarSelector);
        assert.equal(await page.evaluate(() => document.activeElement!.id), currentId, "Updating a text node must preserve the focused heading and target ID");
        return { previous, ids, focused, currentId, characterDataUpdateObserved: true };
    });

    await check("native-outline-anchor-clears-header-and-navigator", async page => {
        await visit(page, "/about"); await assertPage(page);
        const anchor = page.locator(`${rootSelector} .completed-outline a[href^="#"]`).nth(1);
        const href = await anchor.getAttribute("href"); assert.ok(href?.startsWith("#"));
        await anchor.click();
        await page.waitForFunction(({ id, toolbarSelector }) => {
            const target = document.getElementById(id), toolbar = document.querySelector(toolbarSelector), header = document.getElementById("header");
            if (!target || !toolbar) return false;
            const top = target.getBoundingClientRect().top;
            const safeTop = Math.max(0, toolbar.getBoundingClientRect().bottom, header?.getBoundingClientRect().bottom || 0);
            return top >= safeTop - 1 && top < innerHeight;
        }, { id: decodeURIComponent(href!.slice(1)), toolbarSelector });
        return page.evaluate(({ id, toolbarSelector }) => ({ targetTop: document.getElementById(id)!.getBoundingClientRect().top, toolbarBottom: document.querySelector(toolbarSelector)!.getBoundingClientRect().bottom, hash: location.hash }), { id: decodeURIComponent(href!.slice(1)), toolbarSelector });
    }, { viewport: { width: 390, height: 844 } });

    await check("dynamic-program-filter-preserves-input", async page => {
        await visit(page, "/programs"); const search = page.locator("#program-query"); await search.fill("일무");
        await page.waitForFunction(() => document.querySelectorAll(".program-card").length === 1);
        assert.equal(await search.inputValue(), "일무"); assert.equal(await search.evaluate(element => element === document.activeElement), true);
        await search.fill("not-an-existing-program-123"); await page.getByRole("status").filter({ hasText: "검색 결과가 없습니다" }).waitFor();
        await search.fill(""); await page.waitForFunction(() => document.querySelectorAll(".program-card").length > 1);
        assert.equal(await page.locator(rootSelector).count(), 1); return assertPage(page);
    });

    await check("editorial-image-pointer-and-keyboard-feedback", async page => {
        await visit(page, "/programs/history"); await assertPage(page);
        // Filter away and remount the actual archive media card before exercising its GSAP handlers.
        const search = page.locator(`${rootSelector} .completed-list-tools input[type="search"]`);
        await search.fill("2024"); await page.waitForFunction(rootSelector => !document.querySelector(`${rootSelector} .completed-list-image`), rootSelector);
        await search.fill(""); await page.locator(`${rootSelector} .completed-list-image`).waitFor();
        await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
        const owner = page.locator(`${rootSelector} a.completed-list-entry:has(.completed-list-image)`).first();
        const image = owner.locator(".completed-list-image > img");
        await owner.evaluate(owner => { const trace = { enters: 0, leaves: 0, transforms: [] as string[] }; (window as Window & { __sectionTestTrace?: unknown }).__sectionTestTrace = trace; owner.addEventListener("pointerenter", () => trace.enters++); owner.addEventListener("pointerleave", () => trace.leaves++); });
        await image.scrollIntoViewIfNeeded(); await owner.hover();
        await page.waitForFunction(selector => { const image = document.querySelector(selector)!; return new DOMMatrixReadOnly(getComputedStyle(image).transform).a > 1.005; }, `${rootSelector} a.completed-list-entry .completed-list-image > img`);
        const pointerScale = await image.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).a);
        assert.ok(pointerScale <= 1.03, "Image feedback remains subtle and bounded");
        await page.mouse.move(1, 1);
        await page.waitForFunction(selector => { const transform = getComputedStyle(document.querySelector(selector)!).transform; return transform === "none" || Math.abs(new DOMMatrixReadOnly(transform).a - 1) < .002; }, `${rootSelector} a.completed-list-entry .completed-list-image > img`);
        await owner.focus();
        await page.waitForFunction(selector => new DOMMatrixReadOnly(getComputedStyle(document.querySelector(selector)!).transform).a > 1.005, `${rootSelector} a.completed-list-entry .completed-list-image > img`);
        assert.equal(await owner.evaluate(element => element === document.activeElement), true, "Image feedback never steals the link focus");
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.waitForFunction(selector => { const transform = getComputedStyle(document.querySelector(selector)!).transform; return transform === "none" || Math.abs(new DOMMatrixReadOnly(transform).a - 1) < .002; }, `${rootSelector} a.completed-list-entry .completed-list-image > img`);
        return { pointerScale, keyboardFocusPreserved: true, reducedMotionRestoredScale: true };
    }, { reducedMotion: "no-preference" });

    await check("runtime-reduced-motion-settles", async page => {
        await visit(page, "/about/introduction"); await page.locator(toolbarSelector).waitFor({ state: "visible" });
        // Keep a later heading offscreen: normal one-shot playback cannot make this test pass.
        await page.waitForFunction(rootSelector => {
            const heading = document.querySelector(`${rootSelector} #intro-space h2`);
            return !!heading && heading.getBoundingClientRect().top > innerHeight && Number(getComputedStyle(heading).opacity) < .99;
        }, rootSelector);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.waitForFunction(rootSelector => [...document.querySelectorAll<HTMLElement>(`${rootSelector} h1,${rootSelector} h2`)].every(element => {
            const style = getComputedStyle(element); return Number(style.opacity) >= .99 && (style.transform === "none" || Math.abs(new DOMMatrixReadOnly(style.transform).m42) < .1);
        }), rootSelector);
        const nav = page.locator(toolbarSelector); await nav.getByRole("button", { name: "다음 섹션", exact: true }).click(); const focused = await focusedHeading(page);
        assert.ok(focused.top >= -1 && focused.top < 900); return { focused, metrics: await assertPage(page) };
    }, { reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });

    await check("offscreen-reveal-is-bounded-and-runs-once", async page => {
        await visit(page, "/about/introduction"); await page.locator(toolbarSelector).waitFor({ state: "visible" });
        const selector = `${rootSelector} #intro-space h2`;
        await page.waitForFunction(selector => { const heading = document.querySelector(selector)!; return heading.getBoundingClientRect().top > innerHeight && Number(getComputedStyle(heading).opacity) < .99; }, selector);
        const initial = await page.locator(selector).evaluate(heading => { const style = getComputedStyle(heading); return { opacity: Number(style.opacity), y: new DOMMatrixReadOnly(style.transform).m42 }; });
        assert.ok(initial.opacity >= .45 && initial.opacity < 1, "Reveal starts readable"); assert.ok(initial.y >= 0 && initial.y <= 20, "Reveal displacement remains bounded");
        await page.locator(selector).evaluate(heading => heading.scrollIntoView({ behavior: "instant", block: "center" }));
        await page.waitForFunction(selector => { const style = getComputedStyle(document.querySelector(selector)!); return Number(style.opacity) >= .99 && (style.transform === "none" || Math.abs(new DOMMatrixReadOnly(style.transform).m42) < .1); }, selector);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
        const revisit = await page.locator(selector).evaluate(async heading => {
            heading.scrollIntoView({ behavior: "instant", block: "center" });
            let minimumOpacity = 1, maximumY = 0; const end = performance.now() + 700;
            await new Promise<void>(done => {
                const sample = () => { const style = getComputedStyle(heading); minimumOpacity = Math.min(minimumOpacity, Number(style.opacity)); maximumY = Math.max(maximumY, style.transform === "none" ? 0 : Math.abs(new DOMMatrixReadOnly(style.transform).m42)); if (performance.now() < end) requestAnimationFrame(sample); else done(); };
                sample();
            });
            return { minimumOpacity, maximumY };
        });
        assert.ok(revisit.minimumOpacity >= .99 && revisit.maximumY < .1, "Revisiting completed content must not replay its entrance"); return { initial, revisit };
    }, { reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });

    await check("spa-return-has-one-navigator-and-one-step", async page => {
        await visit(page, "/about"); await assertPage(page);
        for (let index = 0; index < 2; index++) {
            await page.locator(`${rootSelector} a[href="/v5/about/introduction/"]`).first().click(); await page.waitForURL(url => url.pathname.endsWith("/about/introduction/")); await assertPage(page);
            await page.goBack({ waitUntil: "domcontentloaded" }); await page.waitForURL(url => url.pathname.endsWith("/about/")); await assertPage(page);
        }
        await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(150);
        const expected = (await page.locator(`${rootSelector} ${chapterHeadingSelector}`).allTextContents())[1];
        await page.locator(toolbarSelector).getByRole("button", { name: "다음 섹션", exact: true }).click();
        const focused = await focusedHeading(page); assert.equal(focused.text.trim(), expected.trim(), "Navigation advances exactly one section after repeated SPA visits"); return focused;
    });

    await check("no-javascript-content-remains-readable", async page => {
        const response = await page.goto(new URL("about/", base).href, { waitUntil: "domcontentloaded" }); assert.equal(response?.status(), 200);
        const headings = page.locator("main h1,main h2"); assert.ok(await headings.count() >= 3);
        for (const heading of await headings.all()) { assert.ok(await heading.isVisible()); assert.ok(await heading.evaluate(element => Number(getComputedStyle(element).opacity) >= .99)); }
        assert.ok((await page.locator("main").innerText()).includes("시민과 함께하는 제작극장"));
        assert.equal(await page.locator(toolbarSelector).isVisible(), false, "Inactive JS navigation stays hidden while SSR content remains readable");
        return { headingCount: await headings.count(), documentWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
    }, { javaScriptEnabled: false, viewport: { width: 320, height: 844 } });

    for (const path of ["/", "/account/login", "/booking/dance", "/design-rules"]) await check(`excluded-${path}`, async page => {
        const href = path === "/" ? new URL("#main", base).href : new URL(path.replace(/^\//, "") + "/", base).href;
        const response = await page.goto(href, { waitUntil: "domcontentloaded" }); assert.equal(response?.status(), 200);
        await page.locator("main").waitFor({ state: "visible" }); assert.equal(await page.locator(rootSelector).count(), 0); assert.equal(await page.locator(toolbarSelector).count(), 0);
        return { path, title: await page.title() };
    });

    assert.deepEqual(network.blockedWrites, [], "Acceptance never attempts writes or email");
    const failed = checks.filter(check => check.status === "failed").length;
    console.log(`${checks.length} section experience checks; ${failed} failed. Evidence: ${directory}`); if (failed) process.exitCode = 1;
} finally { await browser.close(); await assetClient.dispose(); }
