import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { COMPONENT_REGISTRY } from "../src/data/component-registry.ts";

// [실제 화면의 공통 규격 덮어쓰기 검사 / Detect page overrides of shared rendered styles]
// 배치 폭은 제외하고 같은 속성·상태의 독립 컴포넌트와 재질·서체·여백을 비교합니다.
// Compare matching props and states outside page wrappers; layout width remains page-owned.
const base = new URL(process.argv.find(value => /^https?:/.test(value)) || "http://127.0.0.1:8000/v5/");
const widths = (process.env.PARITY_WIDTHS || "320,390,768,1024,1440").split(",").map(Number);
const filter = process.env.PARITY_ROUTE_FILTER ? new RegExp(process.env.PARITY_ROUTE_FILTER) : null;
const directory = path.resolve(process.env.PARITY_REPORT_DIR || ".local-reports/design-system-parity");
const routes = fs.readdirSync("out", { recursive: true }).map(String).filter(file => file.endsWith(".html"))
    .map(file => file.replaceAll("\\", "/").replace(/index\.html$/, "")).filter(route => !filter || filter.test(route));
assert.ok(routes.length && widths.every(width => width >= 320));
fs.mkdirSync(directory, { recursive: true });
const catalog = JSON.parse(fs.readFileSync("src/generated/catalog-snapshot.json", "utf8"));
const browser = await chromium.launch();
const results: { route: string; width: number; checked: number; issues: unknown[] }[] = [];
const errors: string[] = [];

function inspect(uiComponents: readonly string[]) {
    const typography = ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"] as const;
    const surface = ["borderRadius", "backgroundColor", "color", "boxShadow", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"] as const;
    const padding = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const;
    const issues: unknown[] = [];
    let checked = 0;
    const selectors = ".ds-button[data-context], .ds-field, .ds-badge, .system-surface";
    const quietMedia = (root: HTMLElement) => {
        root.querySelectorAll("img,iframe,video,audio,source,script,link").forEach(element => {
            for (const attribute of ["src", "srcset", "poster", "href"]) element.removeAttribute(attribute);
        });
        root.querySelectorAll("svg use").forEach(element => element.removeAttribute("href"));
    };
    for (const element of [...document.querySelectorAll<HTMLElement>(selectors)]) {
        if (!element.getBoundingClientRect().width || element.closest("[hidden],dialog:not([open]),[aria-hidden='true']")) continue;
        const kind = element.matches(".ds-button") ? "control" : element.matches(".ds-field") ? "field" : element.matches(".ds-badge") ? "badge" : "surface";
        const reference = element.cloneNode(true) as HTMLElement;
        reference.removeAttribute("id");
        reference.removeAttribute("style");
        reference.className = [...element.classList].filter(name => kind === "surface" ? name === "system-surface" : name.startsWith("ds-")).join(" ");
        reference.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;transition:none";
        reference.querySelectorAll("[id]").forEach(child => child.removeAttribute("id"));
        quietMedia(reference);
        document.body.append(reference);
        const actual = kind === "field" ? element.querySelector<HTMLElement>("[data-component-part='control']") : element;
        const expected = kind === "field" ? reference.querySelector<HTMLElement>("[data-component-part='control']") : reference;
        if (actual && expected) {
            const css = getComputedStyle(actual), canonical = getComputedStyle(expected);
            const properties = kind === "surface" ? [...surface.filter(key => key !== "color"), ...padding]
                : [...typography, ...surface, ...padding, ...(kind === "badge" ? [] : ["minHeight" as const])];
            const differences = Object.fromEntries(properties.filter(key => css[key] !== canonical[key]).map(key => [key, { actual: css[key], expected: canonical[key] }]));
            checked++;
            if (Object.keys(differences).length) issues.push({ component: element.dataset.componentId, classes: element.className, label: element.textContent?.trim().slice(0, 60), differences });
        }
        reference.remove();
    }
    // [복합 컴포넌트의 텍스트 슬롯 / Text slots owned by registered composite components]
    // 레이아웃 셸을 제외한 최상위 UI의 내부 서체가 페이지나 가이드 래퍼에 바뀌지 않게 합니다.
    // Keep component-owned typography independent from page and documentation wrappers.
    const owners = new Set(uiComponents);
    for (const root of [...document.querySelectorAll<HTMLElement>("[data-component-id]")]) {
        if (!owners.has(root.dataset.componentId || "") || root.matches(selectors) || !root.getBoundingClientRect().width) continue;
        let nested = false;
        for (let parent = root.parentElement; parent; parent = parent.parentElement) {
            if (owners.has(parent.dataset.componentId || "")) { nested = true; break; }
        }
        if (nested || root.closest("[hidden],dialog:not([open]),[aria-hidden='true']")) continue;
        const reference = root.cloneNode(true) as HTMLElement;
        reference.removeAttribute("id");
        reference.querySelectorAll("[id]").forEach(child => child.removeAttribute("id"));
        reference.querySelectorAll("iframe").forEach(child => child.remove());
        quietMedia(reference);
        Object.assign(reference.style, { position: "fixed", visibility: "hidden", pointerEvents: "none", width: `${root.getBoundingClientRect().width}px` });
        document.body.append(reference);
        const slots = (element: HTMLElement) => [...(element.matches("[data-text]") ? [element] : []), ...element.querySelectorAll<HTMLElement>("[data-text]")].filter(element => !element.closest("svg"));
        const originals = slots(root), copies = slots(reference);
        for (const [index, element] of originals.entries()) {
            if (!element.getBoundingClientRect().width || !copies[index] || element.closest("[hidden],dialog:not([open]),[aria-hidden='true']")) continue;
            const actual = getComputedStyle(element), expected = getComputedStyle(copies[index]);
            const differences = Object.fromEntries(typography.filter(key => actual[key] !== expected[key]).map(key => [key, { actual: actual[key], expected: expected[key] }]));
            checked++;
            if (Object.keys(differences).length) issues.push({ component: root.dataset.componentId, classes: element.className, label: element.textContent?.trim().slice(0, 60), differences });
        }
        reference.remove();
    }
    return { checked, issues };
}

try {
    const context = await browser.newContext({ reducedMotion: "reduce", timezoneId: "Asia/Seoul" });
    await context.route(url => url.origin !== base.origin, async route => {
        const url = new URL(route.request().url());
        if (url.pathname === "/rest/v1/rpc/sejong_catalog_snapshot") return route.fulfill({ json: catalog });
        if (url.pathname === "/auth/v1/settings") return route.fulfill({ json: { external: { google: false } } });
        return route.abort();
    });
    const workers = Array.from({ length: 4 }, async (_, worker) => {
        const page = await context.newPage();
        page.on("pageerror", error => errors.push(error.message));
        for (const route of routes.filter((_, index) => index % 4 === worker)) {
            for (const width of widths) {
                await page.setViewportSize({ width, height: 1000 });
                const response = await page.goto(new URL(route, base).href, { waitUntil: "load" });
                assert.ok(response && (response.ok() || route === "404.html" && response.status() === 404));
                await page.evaluate(() => document.fonts.ready);
                await page.waitForTimeout(180);
                results.push({ route, width, ...await page.evaluate(inspect, COMPONENT_REGISTRY.filter(component => component.kind === "ui").map(component => component.id)) });
            }
        }
        await page.close();
    });
    await Promise.all(workers);

    // [가이드도 같은 기준으로 검사 / Apply the same contract to the live guide]
    const guide = await context.newPage();
    for (const width of widths) {
        await guide.setViewportSize({ width, height: 1000 });
        await guide.goto(new URL("design-rules/#components/registry", base).href, { waitUntil: "networkidle" });
        await guide.locator("[data-component-record]").first().waitFor();
        assert.equal(await guide.locator("[data-component-record]").count(), COMPONENT_REGISTRY.length);
        results.push({ route: "design-rules/#components/registry", width, ...await guide.evaluate(inspect, COMPONENT_REGISTRY.filter(component => component.kind === "ui").map(component => component.id)) });
    }
    const summary = { layouts: results.length, checked: results.reduce((count, row) => count + row.checked, 0), mismatches: results.reduce((count, row) => count + row.issues.length, 0), runtimeErrors: errors.length };
    fs.writeFileSync(path.join(directory, "report.json"), JSON.stringify({ base: base.href, widths, summary, results, errors }, null, 2) + "\n");
    console.log(JSON.stringify(summary));
    for (const row of results.filter(row => row.issues.length)) console.error(JSON.stringify(row));
    assert.equal(summary.mismatches, 0, "Page CSS changes a registered component's visual contract.");
    assert.deepEqual(errors, []);
} finally {
    await browser.close();
}
