import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import type { Locator } from "playwright";

// [원본 아이콘·작은 화살표 들여쓰기·재배치 / Original icons, modest arrow inset and reflow]
const base = new URL(process.argv[2] || "http://127.0.0.1:8001/v5/");
const directory = path.resolve(process.env.PATHWAYS_REPORT_DIR || ".local-reports/home-pathways");
fs.mkdirSync(directory, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ reducedMotion: "reduce" });
const errors: string[] = [];
const results: unknown[] = [];
page.on("pageerror", error => errors.push(error.message));
const catalog = JSON.parse(fs.readFileSync("src/generated/catalog-snapshot.json", "utf8"));
await page.route(url => url.origin !== base.origin, route => new URL(route.request().url()).pathname === "/rest/v1/rpc/sejong_catalog_snapshot" ? route.fulfill({ json: catalog }) : route.abort());

async function geometry(root: Locator) {
    await root.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const values = await root.locator(".home-pathway-link").evaluateAll(links => links.map(link => {
        const box = (element: Element) => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }; };
        const icon = link.querySelector<SVGSVGElement>(".home-pathway-symbol")!;
        const copy = link.querySelector(".home-pathway-copy")!;
        const arrow = link.querySelector(".home-pathway-arrow")!;
        const title = copy.querySelector("strong")!, description = copy.querySelector(".home-pathway-description")!;
        const inkRight = Math.max(...[title, description].map(element => { const range = document.createRange(); range.selectNodeContents(element); return range.getBoundingClientRect().right; }));
        const glyph = icon.getBBox();
        return {
            href: link.getAttribute("href"), link: box(link), icon: box(icon), copy: box(copy), arrow: box(arrow), inkRight,
            glyph: { x: glyph.x, y: glyph.y, width: glyph.width, height: glyph.height },
            symbol: icon.querySelector("use")!.getAttribute("href"),
            titleSize: parseFloat(getComputedStyle(title).fontSize), descriptionSize: parseFloat(getComputedStyle(description).fontSize),
            clips: [...copy.children].some(element => element.scrollWidth > element.clientWidth + 1),
            grouped: link.querySelector(".home-pathway-content")!.contains(arrow) && link.querySelector(".home-pathway-content")!.contains(icon),
        };
    }));
    assert.equal(values.length, 3);
    for (const value of values) {
        assert.ok(value.grouped);
        assert.equal(value.icon.width, 32);
        assert.equal(value.icon.height, 32);
        assert.ok(value.glyph.width > 0 && value.glyph.height > 0);
        assert.ok(value.glyph.x >= -0.1 && value.glyph.x + value.glyph.width <= 24.1);
        assert.ok(value.glyph.y >= -0.1 && value.glyph.y + value.glyph.height <= 24.1);
        assert.ok(value.arrow.x >= value.copy.right - 1);
        assert.ok(Math.abs(value.link.right - value.arrow.right - 16 * value.descriptionSize / 16) <= 1);
        assert.ok(value.copy.x >= value.icon.right - 1);
        assert.ok(value.titleSize >= 20 && value.descriptionSize >= 16);
        assert.ok(!value.clips);
        assert.ok(value.link.height >= 48);
    }
    return values;
}

try {
    await page.goto(base.href, { waitUntil: "networkidle" });
    for (const width of [320, 390, 600, 768, 1024, 1440, 1794]) {
        await page.setViewportSize({ width, height: 1000 });
        const root = page.locator("#home-pathways");
        const values = await geometry(root);
        const rows = new Set(values.map(value => Math.round(value.link.y)));
        assert.equal(rows.size, width >= 1024 ? 1 : 3);
        assert.deepEqual(values.map(value => value.symbol?.split("#").at(-1)), ["calendar_month", "confirmation_number", "location_on"]);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        if ([320, 390, 1024, 1794].includes(width)) await root.screenshot({ path: path.join(directory, `pathways-${width}.png`) });
        results.push({ width, values });
        console.log(`PASS original icons, 16px arrow inset and grouped reflow ${width}px`);
    }
    const first = page.locator("#home-pathway-programs");
    const resting = await first.boundingBox();
    await first.hover();
    assert.deepEqual(await first.boundingBox(), resting);
    await page.keyboard.press("Tab"); await first.focus();
    assert.ok(await first.evaluate(element => element.matches(":focus-visible") && parseFloat(getComputedStyle(element).outlineOffset) < 0));
    assert.deepEqual(await first.boundingBox(), resting);

    await page.goto(new URL("design-rules/#components/navigation", base).href, { waitUntil: "networkidle" });
    const guide = page.locator("#demo-home-pathways");
    await guide.waitFor();
    await guide.evaluate(element => { (element as HTMLElement).style.inlineSize = "320px"; });
    assert.equal(new Set((await geometry(guide)).map(value => Math.round(value.link.y))).size, 3);
    await guide.screenshot({ path: path.join(directory, "guide-narrow-container.png") });
    await page.goto(base.href, { waitUntil: "networkidle" });
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const enlarged = await geometry(page.locator("#home-pathways"));
    assert.ok(enlarged.every(value => value.titleSize >= 40 && value.descriptionSize >= 32), JSON.stringify(enlarged));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    results.push({ textScale: "200%", values: enlarged });
    for (const [id, destination] of [["programs", "programs/"], ["group", "visit/group/"], ["rental", "rental/"]]) {
        await page.goto(base.href, { waitUntil: "networkidle" });
        const arrow = page.locator(`#home-pathway-${id} .home-pathway-arrow`);
        await arrow.scrollIntoViewIfNeeded();
        const rect = await arrow.boundingBox(); assert.ok(rect);
        await Promise.all([page.waitForURL(new URL(destination, base).href), page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2)]);
    }
    assert.deepEqual(errors, []);
    console.log("PASS shared guide, enlarged text, stable hover/focus and navigation through all three arrows");
    fs.writeFileSync(path.join(directory, "report.json"), JSON.stringify({ base: base.href, results, errors }, null, 2) + "\n");
} finally {
    await browser.close();
}
