/**
 * Export-wide responsive acceptance against a running STATIC build; never builds or writes product files.
 * cd v5 && BASE_URL=http://127.0.0.1:3000/v5/ node tests/responsive-site-browser.ts
 * RESPONSIVE_WIDTHS=320,390 RESPONSIVE_WORKERS=4 RESPONSIVE_ROUTE_FILTER='^programs/' can narrow a recheck.
 * OUT_DIR selects the export inventory; RESPONSIVE_REPORT_DIR selects evidence (default: repository work/).
 * --self-test verifies that genuine overflow, clipped text and small type fail, while scroll containers pass.
 * Public Supabase catalog reads use src/generated/catalog-snapshot.json. Other remote traffic is blocked.
 * This verifies rendered frontend behavior, not deployed backend permissions or third-party integrations.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { BrowserContext, Page } from "playwright";

const v5Root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const suppliedBase = process.argv.find(value => /^https?:/.test(value)) || process.env.BASE_URL || "http://127.0.0.1:3000/v5/";
const baseURL = new URL(suppliedBase);
if (baseURL.pathname === "/") baseURL.pathname = "/v5/";
const base = baseURL.href.replace(/\/?$/, "/");
const out = resolve(process.env.OUT_DIR || resolve(v5Root, "out"));
const directory = resolve(process.env.RESPONSIVE_REPORT_DIR || resolve(v5Root, "../work/responsive-site"));
const widths = [...new Set((process.env.RESPONSIVE_WIDTHS || "320,390,768,1024,1440").split(",").map(Number))];
assert.ok(widths.length && widths.every(width => Number.isInteger(width) && width >= 240), "RESPONSIVE_WIDTHS must contain integer CSS widths of at least 240px");
const workers = Number(process.env.RESPONSIVE_WORKERS || 4);
assert.ok(Number.isInteger(workers) && workers >= 1 && workers <= 8, "RESPONSIVE_WORKERS must be between 1 and 8");
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const catalog = JSON.parse(readFileSync(resolve(v5Root, "src/generated/catalog-snapshot.json"), "utf8"));
type Issue = { kind: string; message: string; details?: unknown };
type Result = { route: string; width: number; height: number; durationMs: number; status: string; issues: Issue[]; metrics?: unknown; screenshot?: string };
const results: Result[] = [];
const localResponses = new Map<string, Promise<{ status: number; headers: Record<string, string>; body: Buffer }>>();
const interactions: Record<string, unknown>[] = [];
const fixture = { catalogReads: 0, anonymousReads: 0, blockedWrites: [] as string[], blockedExternal: new Set<string>() };
mkdirSync(directory, { recursive: true });

function exportedHTML(directoryPath: string): string[] {
    return readdirSync(directoryPath, { withFileTypes: true }).flatMap(entry => {
        const path = resolve(directoryPath, entry.name);
        return entry.isDirectory() ? exportedHTML(path) : entry.name.endsWith(".html") ? [path] : [];
    });
}

/** The same DOM audit runs against both the real export and deliberately broken self-test fixtures. */
function inspectDocument() {
    const tolerance = 1;
    const viewport = { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth };
    const selector = (element: Element) => {
        if (element.id) return `#${CSS.escape(element.id)}`;
        const parts: string[] = [];
        for (let item: Element | null = element; item && parts.length < 4; item = item.parentElement) {
            const siblings = item.parentElement ? [...item.parentElement.children].filter(sibling => sibling.tagName === item!.tagName) : [];
            parts.unshift(item.tagName.toLowerCase() + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(item) + 1})` : ""));
        }
        return parts.join(" > ");
    };
    const hidden = (element: Element) => {
        if (element.closest('script,style,noscript,svg,[aria-hidden="true"],[hidden],.sr-only,.visually-hidden')) return true;
        for (let item: Element | null = element; item; item = item.parentElement) {
            const style = getComputedStyle(item);
            if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 || style.contentVisibility === "hidden") return true;
            if (style.clipPath === "inset(50%)" || /^rect\(0px,? 0px,? 0px,? 0px\)$/.test(style.clip)) return true;
        }
        return false;
    };
    const inHorizontalScroller = (element: Element) => {
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
            if (/^(auto|scroll)$/.test(getComputedStyle(parent).overflowX) && parent.scrollWidth > parent.clientWidth + tolerance) return true;
        }
        return false;
    };
    const visibleHorizontalPart = (element: Element, rect: DOMRect) => {
        let left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
            if (/^(hidden|clip|auto|scroll)$/.test(getComputedStyle(parent).overflowX)) {
                const clip = parent.getBoundingClientRect();
                left = Math.max(left, clip.left); right = Math.min(right, clip.right);
            }
        }
        return right - left;
    };
    const undersizedText: unknown[] = [], clippedText: unknown[] = [], overflowElements: unknown[] = [];
    const seenSmall = new Set<Element>(), seenClipped = new Set<Element>();
    let visibleCharacters = 0, mainCharacters = 0;
    const main = document.querySelector<HTMLElement>('main,[role="main"]');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
        const text = (node.textContent || "").replace(/\s+/g, " ").trim();
        const element = node.parentElement;
        if (!text || !element || hidden(element)) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        const rectangles = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0 && visibleHorizontalPart(element, rect) > 0);
        if (!rectangles.length) continue;
        visibleCharacters += text.length;
        if (main?.contains(element)) mainCharacters += text.length;
        const style = getComputedStyle(element), fontSize = parseFloat(style.fontSize);
        if (fontSize < 15.9 && !seenSmall.has(element)) {
            seenSmall.add(element);
            undersizedText.push({ selector: selector(element), text: text.slice(0, 120), fontSize, role: element.closest("[data-text]")?.getAttribute("data-text") });
        }
        if (!inHorizontalScroller(element) && !seenClipped.has(element) && style.textOverflow !== "ellipsis") {
            for (const rect of rectangles) {
                // Range geometry detects usable text masked by a root overflow:hidden rule as well as real scrolling overflow.
                if (rect.left < -tolerance || rect.right > innerWidth + tolerance) {
                    seenClipped.add(element);
                    clippedText.push({ selector: selector(element), text: text.slice(0, 120), left: rect.left, right: rect.right });
                    break;
                }
            }
        }
    }
    for (const element of document.querySelectorAll<HTMLElement>("body *")) {
        if (hidden(element) || inHorizontalScroller(element)) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width && rect.height && visibleHorizontalPart(element, rect) > 0 && (rect.left < -tolerance || rect.right > innerWidth + tolerance)) {
            if (element.matches("a,button,input,select,textarea,h1,h2,h3,p,label,[data-text]") && (element.textContent?.trim() || element.matches("input,select,textarea"))) {
                overflowElements.push({ selector: selector(element), tag: element.tagName, text: element.textContent?.trim().slice(0, 100), left: rect.left, right: rect.right, width: rect.width });
            }
        }
    }
    const assets = new Set<string>();
    const add = (value: string | null) => {
        if (!value || /^(data:|blob:|#)/.test(value)) return;
        try { const url = new URL(value, location.href); if (url.origin === location.origin) assets.add(url.href); } catch { /* Report network errors separately. */ }
    };
    for (const element of document.querySelectorAll("img,script[src],link[rel='stylesheet'],link[rel='preload'],source,video,audio,object")) {
        add(element.getAttribute("src")); add(element.getAttribute("poster")); add(element.getAttribute("data"));
        if (element.tagName === "LINK") add(element.getAttribute("href"));
        if (element instanceof HTMLImageElement) { add(element.currentSrc); for (const part of (element.getAttribute("srcset") || "").split(",")) add(part.trim().split(/\s+/)[0]); }
    }
    for (const element of document.querySelectorAll<HTMLElement>("body *")) {
        if (hidden(element)) continue;
        const style = getComputedStyle(element);
        for (const value of [style.backgroundImage, style.maskImage, getComputedStyle(element, "::before").backgroundImage, getComputedStyle(element, "::after").backgroundImage]) {
            for (const match of value.matchAll(/url\(["']?([^"')]+)["']?\)/g)) add(match[1]);
        }
    }
    for (const resource of performance.getEntriesByType("resource")) add(resource.name);
    const brokenImages = [...document.images].filter(image => image.src && new URL(image.src, location.href).origin === location.origin && (!image.complete || !image.naturalWidth)).map(image => ({ source: image.currentSrc || image.src, complete: image.complete }));
    const mainRect = main?.getBoundingClientRect();
    return { viewport, main: { exists: !!main, visible: !!main && !hidden(main) && !!mainRect?.width && !!mainRect?.height, characters: mainCharacters }, visibleCharacters, undersizedText: undersizedText.slice(0, 80), clippedText: clippedText.slice(0, 50), overflowElements: overflowElements.slice(0, 50), assets: [...assets], brokenImages };
}

function issuesFor(metrics: ReturnType<typeof inspectDocument>): Issue[] {
    const issues: Issue[] = [];
    if (metrics.viewport.documentWidth > metrics.viewport.width + 1) issues.push({ kind: "document-overflow", message: `${metrics.viewport.documentWidth}px document exceeds ${metrics.viewport.width}px viewport`, details: metrics.overflowElements });
    if (!metrics.main.exists || !metrics.main.visible || metrics.main.characters < 20) issues.push({ kind: "main-content", message: "The main region must contain at least 20 visible text characters", details: metrics.main });
    if (metrics.undersizedText.length) issues.push({ kind: "small-text", message: "Visible UI text falls below the shared 16px minimum", details: metrics.undersizedText });
    if (metrics.clippedText.length) issues.push({ kind: "clipped-text", message: "Meaningful text crosses the viewport outside an intentional horizontal scroll container", details: metrics.clippedText });
    if (metrics.brokenImages.length) issues.push({ kind: "broken-image", message: "Local images failed to decode", details: metrics.brokenImages });
    return issues;
}

async function deterministicNetwork(context: BrowserContext) {
    await context.route("**/*", async route => {
        const request = route.request(), url = new URL(request.url());
        const backend = /(?:^|\.)supabase\.(co|in)$/.test(url.hostname) || /^\/(rest|auth)\/v1\//.test(url.pathname);
        if (backend) {
            const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
            if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
            if (url.pathname === "/rest/v1/rpc/sejong_catalog_snapshot" && ["GET", "POST"].includes(request.method())) {
                fixture.catalogReads++; return route.fulfill({ json: catalog, headers });
            }
            if (request.method() === "GET") {
                fixture.anonymousReads++;
                if (url.pathname === "/auth/v1/settings") return route.fulfill({ json: { external: { google: false } }, headers });
                if (url.pathname === "/auth/v1/user") return route.fulfill({ status: 401, json: { message: "Anonymous browser fixture" }, headers });
                return route.fulfill({ json: [], headers });
            }
            fixture.blockedWrites.push(`${request.method()} ${url.origin}${url.pathname}`);
            return route.fulfill({ status: 403, json: { message: "Responsive fixture blocks remote writes and email delivery" }, headers });
        }
        if (url.origin !== baseURL.origin && /^https?:$/.test(url.protocol)) {
            fixture.blockedExternal.add(`${request.resourceType()} ${url.origin}${url.pathname}`);
            return route.abort("blockedbyclient");
        }
        if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
            fixture.blockedWrites.push(`${request.method()} ${url.origin}${url.pathname}`);
            return route.fulfill({ status: 403, json: { message: "Responsive fixture permits local read requests only" } });
        }
        if (url.origin === baseURL.origin && /\.(?:js|css|woff2?|svg|png|jpe?g|webp|avif|gif|ico)$/i.test(url.pathname)) {
            // Cache only immutable build assets; HTML and API responses always stay fresh.
            if (!localResponses.has(url.href)) localResponses.set(url.href, route.fetch().then(async response => {
                const headers = { ...response.headers() }; delete headers["content-length"]; delete headers["content-encoding"];
                return { status: response.status(), headers, body: await response.body() };
            }).catch(error => { localResponses.delete(url.href); throw error; }));
            return route.fulfill(await localResponses.get(url.href)!);
        }
        return route.continue();
    });
}

async function settle(page: Page) {
    await page.locator("main,[role='main']").first().waitFor({ state: "attached", timeout: 8_000 }).catch(() => {});
    await page.evaluate(async () => {
        for (const image of document.images) image.loading = "eager";
        await Promise.race([Promise.all([document.fonts.ready, ...[...document.images].map(image => image.complete ? Promise.resolve() : new Promise<void>(done => { image.addEventListener("load", () => done(), { once: true }); image.addEventListener("error", () => done(), { once: true }); }))]), new Promise(done => setTimeout(done, 3_000))]);
        await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        scrollTo(0, 0);
    });
    // Catalog refresh and the blocked third-party search fallback are asynchronous after hydration.
    await page.waitForTimeout(180);
}

const browser = await chromium.launch({ headless: true, executablePath });
const assetChecks = new Map<string, Promise<{ status: number; contentType: string }>>();
try {
    const self = await browser.newPage({ viewport: { width: 320, height: 640 } });
    const samples = [
        { name: "valid", css: "", content: "<p>Readable content fits this small viewport.</p>", kinds: [] },
        { name: "document-overflow", css: "p{width:800px}", content: "<p>A deliberately overflowing site must fail.</p>", kinds: ["document-overflow"] },
        { name: "masked-clipping", css: "html,body{overflow-x:hidden}p{white-space:nowrap;width:800px}", content: "<p>This deliberately long content crosses the viewport and must be reported even if the root hides overflow.</p>", kinds: ["clipped-text"] },
        { name: "small-text", css: "p{font-size:12px}", content: "<p>Small readable-looking text still violates the minimum.</p>", kinds: ["small-text"] },
        { name: "intentional-scroller", css: ".rail{overflow-x:auto} .rail p{width:800px;white-space:nowrap}", content: '<div class="rail"><p>A carousel is allowed to scroll within its bounded container.</p></div>', kinds: [] },
        { name: "hidden-artwork", css: ".art{position:absolute;width:900px;transform:translateX(-50%)} .frame{overflow:hidden;position:relative}", content: '<p>The meaningful main content fits the viewport.</p><div class="frame"><div class="art" aria-hidden="true">Decorative art</div></div>', kinds: [] },
    ];
    for (const sample of samples) {
        await self.setContent(`<style>body{margin:0;font-size:16px}main{min-height:120px}${sample.css}</style><main>${sample.content}</main>`);
        const found = issuesFor(await self.evaluate(inspectDocument)).map(issue => issue.kind);
        for (const kind of sample.kinds) assert.ok(found.includes(kind), `Audit self-test ${sample.name} failed to detect ${kind}: ${JSON.stringify(found)}`);
        if (!sample.kinds.length) assert.deepEqual(found, [], `Audit self-test ${sample.name} produced a false positive`);
    }
    await self.close();
    console.log(`PASS audit self-test (${samples.length} valid/broken/scroll/decorative fixtures)`);
    if (process.argv.includes("--self-test")) {
        writeFileSync(resolve(directory, "self-test.json"), JSON.stringify({ passed: true, samples: samples.map(sample => sample.name) }, null, 2) + "\n");
    } else {
        const allRoutes = exportedHTML(out).map(path => relative(out, path).replaceAll("\\", "/")).sort();
        assert.ok(allRoutes.length > 0, `No exported HTML found in ${out}; build the product before running this test`);
        const filter = process.env.RESPONSIVE_ROUTE_FILTER ? new RegExp(process.env.RESPONSIVE_ROUTE_FILTER) : null;
        const routes = allRoutes.filter(route => !filter || filter.test(route));
        assert.ok(routes.length, "RESPONSIVE_ROUTE_FILTER matched no exported routes");
        const exportFingerprint = createHash("sha256").update(readFileSync(resolve(out, "index.html"))).digest("hex");
        const auditFingerprint = createHash("sha256").update(readFileSync(fileURLToPath(import.meta.url))).digest("hex");
        let resumedCount = 0;
        if (process.env.RESPONSIVE_RESUME_REPORT) {
            const previous = JSON.parse(readFileSync(resolve(process.env.RESPONSIVE_RESUME_REPORT), "utf8"));
            assert.equal(previous.exportFingerprint, exportFingerprint, "Resume requires the exact same exported build");
            assert.equal(previous.base, base, "Resume requires the same server base URL");
            assert.equal(previous.auditFingerprint, auditFingerprint, "Resume requires the same audit rules and harness");
            const selected = new Set(routes);
            for (const result of previous.results || []) if (result.status === "passed" && !result.issues?.length && selected.has(result.route) && widths.includes(result.width)) {
                if (!results.some(item => item.route === result.route && item.width === result.width)) results.push(result);
            }
            resumedCount = results.length;
            console.log(`Resuming ${resumedCount} passed route/width audits from this exact build`);
        }
        const allTasks = routes.flatMap(route => widths.map(width => ({ route, width, height: width < 768 ? 844 : 1000 })));
        const tasks = allTasks.filter(task => !results.some(result => result.route === task.route && result.width === task.width));
        let cursor = 0;
        const save = () => writeFileSync(resolve(directory, "report.json"), JSON.stringify({ base, exportFingerprint, auditFingerprint, resumedCount, inventory: { out, totalExportedRoutes: allRoutes.length, selectedRoutes: routes.length, widths, workers, routeFiles: allRoutes }, network: { mode: "mocked public catalog; anonymous read fixtures; external requests and all writes blocked", catalogReads: fixture.catalogReads, anonymousReads: fixture.anonymousReads, blockedWrites: fixture.blockedWrites, blockedExternal: [...fixture.blockedExternal] }, results, interactions }, null, 2) + "\n");
        async function worker() {
            const context = await browser.newContext({ reducedMotion: "reduce", serviceWorkers: "block" });
            await deterministicNetwork(context);
            const page = await context.newPage();
            page.setDefaultTimeout(8_000);
            try {
                while (cursor < tasks.length) {
                    const task = tasks[cursor++], started = Date.now();
                    // A full document navigation still resets application state; reuse the renderer process.
                    page.removeAllListeners("pageerror"); page.removeAllListeners("response"); page.removeAllListeners("requestfailed");
                    await page.setViewportSize({ width: task.width, height: task.height });
                    const issues: Issue[] = [];
                    page.on("pageerror", error => issues.push({ kind: "runtime", message: error.message }));
                    page.on("response", response => { if (new URL(response.url()).origin === baseURL.origin && response.status() >= 400 && !response.request().isNavigationRequest()) issues.push({ kind: "local-response", message: `${response.status()} ${response.url()}` }); });
                    page.on("requestfailed", request => { if (new URL(request.url()).origin === baseURL.origin && request.failure()?.errorText !== "net::ERR_ABORTED") issues.push({ kind: "local-request", message: `${request.url()}: ${request.failure()?.errorText}` }); });
                    const result: Result = { ...task, durationMs: 0, status: "running", issues };
                    try {
                        const path = task.route === "index.html" ? "" : task.route.endsWith("/index.html") ? task.route.slice(0, -10) : task.route;
                        const response = await page.goto(new URL(path, base).href, { waitUntil: "load", timeout: 25_000 });
                        if (!response || response.status() >= 400 && !/(^|\/)(404\.html|_not-found\/index\.html)$/.test(task.route)) issues.push({ kind: "navigation", message: `Export returned ${response?.status() ?? "no response"}` });
                        await settle(page);
                        const metrics = await page.evaluate(inspectDocument);
                        issues.push(...issuesFor(metrics));
                        result.metrics = { ...metrics, assets: metrics.assets.length };
                        for (const asset of metrics.assets) {
                            if (!assetChecks.has(asset)) assetChecks.set(asset, context.request.get(asset, { timeout: 10_000 }).then(response => ({ status: response.status(), contentType: response.headers()["content-type"] || "" })).catch(() => ({ status: 0, contentType: "" })));
                            const checked = await assetChecks.get(asset)!;
                            if (checked.status < 200 || checked.status >= 400 || /text\/html/.test(checked.contentType) && /\.(?:js|css|woff2?|svg|png|jpe?g|webp|gif|avif)(?:\?|$)/i.test(asset)) issues.push({ kind: "missing-local-asset", message: `${checked.status} ${checked.contentType} ${asset}` });
                        }
                        const representative = task.route === "index.html" || task.width === 390 && ["programs/index.html", "visit/plan/index.html", "account/login/index.html", "design-rules/index.html"].includes(task.route);
                        if (issues.length || representative) {
                            const name = `${task.route.replace(/\.html$/, "").replace(/[^a-zA-Z0-9_-]/g, "-")}-${task.width}.png`;
                            await page.screenshot({ path: resolve(directory, name), fullPage: false });
                            result.screenshot = name;
                        }
                    } catch (error) {
                        issues.push({ kind: "harness-or-navigation", message: error instanceof Error ? error.message : String(error) });
                        const name = `failure-${task.route.replace(/[^a-zA-Z0-9_-]/g, "-")}-${task.width}.png`;
                        await page.screenshot({ path: resolve(directory, name) }).then(() => { result.screenshot = name; }).catch(() => {});
                    } finally {
                        result.durationMs = Date.now() - started; result.status = issues.length ? "failed" : "passed";
                        results.push(result);
                        if (results.length % 20 === 0) { console.log(`${results.length}/${allTasks.length} route/width audits; ${results.filter(item => item.status === "failed").length} failed`); save(); }
                    }
                }
            } finally { await context.close(); }
        }
        await Promise.all(Array.from({ length: Math.min(workers, tasks.length) }, () => worker()));

        // Native menu/search dialogs, narrow landscape, and desktop 200% reflow (1280x900 -> 640x450 CSS pixels).
        for (const scenario of [{ name: "narrow", width: 320, height: 844 }, { name: "landscape", width: 844, height: 390 }, { name: "zoom-200-reflow", width: 640, height: 450 }]) {
            const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, reducedMotion: "reduce", serviceWorkers: "block" });
            await deterministicNetwork(context);
            const page = await context.newPage(); page.setDefaultTimeout(8_000);
            const interaction: Record<string, unknown> = { ...scenario, status: "running", zoom: scenario.name === "zoom-200-reflow" ? "Equivalent 200% desktop zoom CSS viewport, not browser chrome zoom" : undefined };
            try {
                await page.goto(base, { waitUntil: "load" }); await settle(page);
                const menuTrigger = page.getByRole("button", { name: "전체 메뉴 열기", exact: true });
                await menuTrigger.click();
                const menu = page.locator("#menu-dialog"); await menu.waitFor({ state: "visible" });
                const menuBox = await menu.boundingBox();
                assert.ok(menuBox && menuBox.x >= -1 && menuBox.y >= -1 && menuBox.x + menuBox.width <= scenario.width + 1 && menuBox.y + menuBox.height <= scenario.height + 1, "Menu panel must stay inside the viewport");
                const disclosure = menu.locator("summary").first();
                if (await disclosure.count()) { await disclosure.click(); assert.ok(await disclosure.evaluate(element => element.parentElement?.hasAttribute("open")), "Narrow menu sections must expand"); }
                const menuLink = menu.locator('a[href="/v5/visit/plan/"]');
                await menuLink.scrollIntoViewIfNeeded(); assert.ok(await menuLink.isVisible(), "Menu content remains reachable by scrolling");
                await page.screenshot({ path: resolve(directory, `${scenario.name}-menu.png`) });
                await page.keyboard.press("Escape"); await menu.waitFor({ state: "hidden" });
                assert.equal(await menuTrigger.evaluate(element => element === document.activeElement), true, "Menu Escape must restore trigger focus");
                const searchTrigger = page.getByRole("button", { name: "통합검색 열기", exact: true });
                await searchTrigger.click();
                const search = page.locator("#search-dialog"); await search.waitFor({ state: "visible" });
                const searchBox = await search.boundingBox();
                assert.ok(searchBox && searchBox.x >= -1 && searchBox.y >= -1 && searchBox.x + searchBox.width <= scenario.width + 1 && searchBox.y + searchBox.height <= scenario.height + 1, "Search dialog must stay inside the viewport");
                const field = search.getByRole("searchbox"); await field.fill("일무");
                await page.keyboard.press("Tab");
                assert.ok(await search.evaluate(element => element.contains(document.activeElement)), "Search Tab must remain in its modal");
                await page.keyboard.press("Escape"); await search.waitFor({ state: "hidden" });
                assert.equal(await searchTrigger.evaluate(element => element === document.activeElement), true, "Search Escape must restore trigger focus");
                await searchTrigger.click(); await search.waitFor({ state: "visible" });
                await search.getByRole("searchbox").fill("일무");
                await Promise.all([page.waitForURL(url => url.pathname.endsWith("/search/") && url.searchParams.get("q") === "일무"), search.getByRole("button", { name: "검색", exact: true }).click()]);
                await settle(page);
                assert.ok((await page.locator("main").innerText()).includes("일무"), "Native fallback must complete a search when the external script is blocked");
                const metrics = await page.evaluate(inspectDocument);
                assert.deepEqual(issuesFor(metrics), [], "Search results must satisfy the same responsive audit");
                await page.screenshot({ path: resolve(directory, `${scenario.name}-search-results.png`) });
                interaction.status = "passed";
            } catch (error) {
                interaction.status = "failed"; interaction.error = error instanceof Error ? error.stack : String(error);
                await page.screenshot({ path: resolve(directory, `${scenario.name}-interaction-failure.png`) }).catch(() => {});
            } finally { interactions.push(interaction); await context.close(); save(); }
        }
        save();
        assert.equal(results.length, allTasks.length, "Every selected route/viewport must have exactly one result");
        const failed = results.filter(item => item.status === "failed").length;
        const interactionFailures = interactions.filter(item => item.status === "failed").length;
        console.log(`${results.length} route/width audits (${routes.length}/${allRoutes.length} exported HTML routes); ${failed} failed; ${interactionFailures} interaction failures. Evidence: ${directory}`);
        if (failed || interactionFailures || fixture.blockedWrites.length) process.exitCode = 1;
    }
} finally { await browser.close(); }
