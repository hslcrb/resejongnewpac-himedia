import assert from "node:assert/strict";
import { chromium, expect } from "playwright/test";

// [홈 방문 안내 정렬과 동작 / Home visit section alignment and interactions]
const base = (process.argv[2] || "http://127.0.0.1:3000/").replace(/\/?$/, "/");
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${base}?mode=cms-scm#plan-your-visit`, { waitUntil: "networkidle" });
        const geometry = await page.locator("#plan-your-visit").evaluate(element => {
            const section = element.getBoundingClientRect();
            const heading = element.querySelector("#visit-heading")!.getBoundingClientRect();
            return { sectionLeft: section.left, headingLeft: heading.left, scrollWidth: document.documentElement.scrollWidth, width: document.documentElement.clientWidth };
        });
        assert.ok(Math.abs(geometry.sectionLeft - geometry.headingLeft) < 1, `${width}px: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.scrollWidth <= geometry.width + 1, `${width}px: horizontal overflow`);
        for (const [id, destination] of [["directions", "/visit/directions"], ["spaces", "/visit/spaces"], ["accessibility", "/visit/accessibility"], ["etiquette", "/visit/etiquette"]]) {
            const link = page.locator(`#home-visit-${id}`);
            assert.match((await link.getAttribute("href")) || "", new RegExp(`${destination}/?$`));
            await link.focus();
            await expect(page.locator(`[data-visit-image="${id}"]`)).toHaveAttribute("aria-hidden", "false");
        }
        if (width === 1440) {
            await page.locator("#home-visit-directions").hover();
            await expect(page.locator('[data-visit-image="directions"]')).toHaveAttribute("aria-hidden", "false");
            await expect(page.locator('[data-visit-hover-image="directions"]')).toHaveClass(/is-active/);
        }
        if (width === 390 || width === 1440) await page.screenshot({ path: `.local-reports/visit-after-${width}.png` });
        console.log(`PASS 방문 안내 정렬과 링크 ${width}px`);
    }
    assert.deepEqual(errors, []);
} finally { await browser.close(); }
