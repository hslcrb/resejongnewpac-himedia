import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parse } from "parse5";
import { chromium } from "playwright";
import { isRemovedOfficialLink } from "../src/lib/link-policy.ts";

// [정적 HTML과 새로 고친 DB 콘텐츠의 실제 링크 / Real links in exports and refreshed DB content]
// 원본 자료의 출처 문자열과 실제 이동 수단을 구분해 모든 공개 경로를 검사합니다.
// Inspect navigation on every exported route, including links supplied by a catalog refresh.
const base = new URL(process.argv.find(argument => /^https?:/.test(argument)) || "http://127.0.0.1:8001/v5/");
const directory = path.resolve(process.env.OFFICIAL_LINK_REPORT_DIR || ".local-reports/official-links");
const files = fs.readdirSync("out", { recursive: true }).map(String).filter(file => file.endsWith(".html"));
const failures: { route: string; tag: string; href: string }[] = [];
let navigationCount = 0;
for (const file of files) {
    const inspect = (node: any) => {
        for (const attribute of node.attrs || []) {
            if (!(attribute.name === "href" && ["a", "area"].includes(node.tagName) || attribute.name === "action" && node.tagName === "form")) continue;
            navigationCount++;
            if (isRemovedOfficialLink(attribute.value)) failures.push({ route: file, tag: node.tagName, href: attribute.value });
        }
        for (const child of node.childNodes || []) inspect(child);
    };
    inspect(parse(fs.readFileSync(path.join("out", file), "utf8")));
}
assert.deepEqual(failures, [], "The static export contains an official-site navigation link.");

const browser = await chromium.launch();
const results: { route: string; links: number }[] = [];
const errors: string[] = [];
let catalogReads = 0;
try {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
    const catalog = JSON.parse(fs.readFileSync("src/generated/catalog-snapshot.json", "utf8"));
    await context.route(url => url.origin !== base.origin, async route => {
        if (new URL(route.request().url()).pathname === "/rest/v1/rpc/sejong_catalog_snapshot") {
            catalogReads++;
            return route.fulfill({ json: catalog });
        }
        return route.abort();
    });
    const routes = files.map(file => file.replaceAll("\\", "/").replace(/index\.html$/, ""));
    routes.push("design-rules/#components/registry", "design-rules/#resources/references");
    await Promise.all(Array.from({ length: 2 }, async (_, worker) => {
        const page = await context.newPage();
        page.on("pageerror", error => errors.push(error.message));
        for (const route of routes.filter((_, index) => index % 2 === worker)) {
            const response = await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
            assert.ok(response && response.ok() || route === "404.html");
            const links = await page.locator("a[href],area[href],form[action]").evaluateAll(elements => elements.map(element => ({ tag: element.tagName, href: element.getAttribute(element.tagName === "FORM" ? "action" : "href") || "" })));
            for (const link of links) if (isRemovedOfficialLink(link.href)) failures.push({ route, ...link });
            results.push({ route, links: links.length });
        }
        await page.close();
    }));
    assert.ok(catalogReads > 0, "Catalog refresh must be exercised.");
    const summary = { exportedPages: files.length, staticNavigationCount: navigationCount, renderedPages: results.length, catalogReads, officialLinks: failures.length, runtimeErrors: errors.length };
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "report.json"), JSON.stringify({ base: base.href, summary, results, failures, errors }, null, 2) + "\n");
    console.log(JSON.stringify(summary));
    assert.deepEqual(failures, []);
    assert.deepEqual(errors, []);
} finally {
    await browser.close();
}
