import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { COMPONENT_REGISTRY } from "../src/data/component-registry.ts";
import { COMPONENT_COUNTS } from "../src/data/component-usage.ts";

// [제품과 가이드의 동일 구현 검증 / Verify shared implementations in product and guide]
const base = (process.argv[2] || "http://127.0.0.1:3000/v5/").replace(/\/?$/, "/");
const directory = path.resolve(".local-reports/component-unification");
fs.mkdirSync(directory, { recursive: true });
const browser = await chromium.connectOverCDP(process.env.SEJONG_TEST_CDP || "http://127.0.0.1:9223");
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Seoul" });
const page = await context.newPage();
const results: { name: string; passed: boolean; error?: string }[] = [];
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => {
    if (message.type() === "error" && /hydration|uncaught|invalid.*prop|cannot.*contain/i.test(message.text())) errors.push(message.text());
});
page.setDefaultTimeout(10000);
const go = (route = "") => page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
async function metrics(selector: string) {
    return page.locator(selector).first().evaluate(element => {
        const style = getComputedStyle(element);
        return { height: element.getBoundingClientRect().height, minHeight: style.minHeight, radius: style.borderRadius, fontSize: style.fontSize };
    });
}
async function fieldStates(selector: string) {
    return page.locator(selector).evaluate(async (element: HTMLInputElement) => {
        const disabled = element.disabled;
        const invalid = element.getAttribute("aria-invalid");
        const sample = () => {
            const style = getComputedStyle(element);
            return { background: style.backgroundColor, color: style.color, border: style.border, outline: style.outline, offset: style.outlineOffset, shadow: style.boxShadow, radius: style.borderRadius, transition: style.transition };
        };
        const settle = async () => {
            getComputedStyle(element).backgroundColor;
            await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
        };
        element.focus();
        await settle();
        const focused = sample();
        element.setAttribute("aria-invalid", "true");
        await settle();
        const error = sample();
        element.removeAttribute("aria-invalid");
        element.disabled = true;
        await settle();
        const inactive = sample();
        element.disabled = disabled;
        if (invalid != null) element.setAttribute("aria-invalid", invalid);
        await settle();
        return { focused, error, inactive };
    });
}
async function check(name: string, run: () => Promise<void>) {
    try { await run(); results.push({ name, passed: true }); console.log("PASS", name); }
    catch (error) {
        results.push({ name, passed: false, error: String(error) });
        console.error("FAIL", name, String(error));
        await page.screenshot({ path: path.join(directory, `failure-${results.length}.png`) });
    }
}
try {
    await go("design-rules/#components/registry");
    await check("the real registry lists every implementation, computed usage and the missing production patterns", async () => {
        await page.locator("[data-component-record]").first().waitFor();
        assert.equal(await page.locator("[data-component-record]").count(), COMPONENT_REGISTRY.length);
        assert.equal(Number(await page.locator('[data-count="total"]').innerText()), COMPONENT_COUNTS.total);
        assert.equal(Number(await page.locator('[data-count="unused"]').innerText()), 0);
        for (const id of ["hero-companion", "header", "footer", "context-menu", "return-top", "introduction", "booking-invitation"]) {
            assert.match(await page.locator(`[data-component-record="${id}"]`).innerText(), /제품 연결/);
        }
        await page.getByLabel("컴포넌트 검색", { exact: true }).fill("HeroCompanion");
        assert.equal(await page.locator("[data-component-record]").count(), 1);
        await page.getByLabel("컴포넌트 검색", { exact: true }).fill("");
    });

    for (const width of [320, 390, 768, 1024, 1440]) {
        await check(`guide and product share default/flow dimensions and field states at ${width}px`, async () => {
            await page.setViewportSize({ width, height: 1000 });
            await go("design-rules/#components/fields");
            await page.locator("#demo-field-flow").waitFor();
            const standard = await metrics("#demo-field-default");
            const flow = await metrics("#demo-field-flow");
            const flowButton = await metrics('[aria-label="flow 버튼 규격"]');
            const standardStates = await fieldStates("#demo-field-default");
            const states = await fieldStates("#demo-field-flow");
            assert.deepEqual([standard.minHeight, standard.radius, standard.fontSize], ["48px", "8px", "16px"]);
            assert.deepEqual([flow.minHeight, flow.radius, flow.fontSize], ["54px", "9px", "16px"]);
            assert.deepEqual([flowButton.minHeight, flowButton.radius], ["50px", "9px"]);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
            await go("account/signup/");
            assert.deepEqual(await metrics("#flow-name"), flow);
            assert.deepEqual(await fieldStates("#flow-name"), states);
            assert.deepEqual(await metrics('main form button[type="submit"]'), flowButton);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
            if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(directory, `after-signup-${width}.png`) });
            await go("programs/");
            assert.deepEqual(await metrics("#program-query"), standard);
            assert.deepEqual(await fieldStates("#program-query"), standardStates);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
            await page.getByRole("button", { name: "전시", exact: true }).click();
            assert.equal(await page.getByRole("button", { name: "전시", exact: true }).getAttribute("aria-pressed"), "true");
            await page.locator("#program-query").fill("빛");
            assert.ok(await page.locator(".program-card").count() > 0);
        });
    }
    await check("home patterns and the scroll heading are connected without changing wording or anchors", async () => {
        await go();
        assert.equal(await page.locator('[data-component="HeroSlide"]').count(), 5);
        assert.equal(await page.locator('[data-component="BookingCalendar"]').count(), 1);
        assert.equal(await page.locator('[data-component="SeasonBanner"]').count(), 1);
        assert.equal(await page.locator("#quick-booking-heading").getAttribute("aria-label"), "관람 예약");
        assert.equal(await page.locator("#quick-booking-heading .booking-invitation-letter").count(), 4);
        assert.deepEqual((({ minHeight, radius }) => [minHeight, radius])(await metrics("#home-booking-today")), ["48px", "8px"]);
        assert.equal(await page.locator('.hero-time-glass[data-glass-variant="hero"]').count(), 1);
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            await page.evaluate(() => scrollTo(0, 0));
            await page.screenshot({ path: path.join(directory, `after-home-${width}.png`) });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        }
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.waitForFunction(() => document.querySelector("#quick-booking-heading")?.getAnimations({ subtree: true }).length === 0);
        assert.equal(await page.locator("#quick-booking-heading").evaluate(element => element.getAnimations({ subtree: true }).length), 0);
        await page.emulateMedia({ reducedMotion: "no-preference" });
    });
    await check("search uses the shared modal with input focus, Escape return and keyboard containment", async () => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await go();
        const trigger = page.locator("#header").getByRole("button", { name: "통합검색 열기", exact: true });
        await trigger.click();
        const dialog = page.locator('#search-dialog[data-component="dialog"]');
        await dialog.waitFor();
        assert.ok(await dialog.evaluate(element => element.matches(":modal")));
        assert.equal(await dialog.locator('input[type="search"]').evaluate(element => document.activeElement === element), true);
        await page.keyboard.press("Shift+Tab");
        assert.ok(await page.evaluate(() => Boolean(document.activeElement?.closest("#search-dialog"))));
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => document.body.style.overflow === "");
        assert.ok(await trigger.evaluate(element => document.activeElement === element));
    });
    await check("signup validates and persists the same profile through shared fields, consent and actions", async () => {
        await go("account/signup/");
        const submit = page.locator('main form button[type="submit"]');
        await submit.click();
        assert.match(await page.locator('#flow-error[role="alert"]').innerText(), /이름/);
        await page.locator("#flow-name").fill("컴포넌트 검증");
        await page.locator("#flow-email").fill("component@example.com");
        await page.locator('main form input[type="checkbox"]').check();
        await submit.click();
        await page.waitForURL(/\/account\/$/);
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("sejong-v4:profile") || "{}").email), "component@example.com");
    });
    await check("recovery retains its accessible result and flow field", async () => {
        await go("account/recovery/");
        await page.locator("#flow-email").fill("component@example.com");
        await page.locator('main form button[type="submit"]').click();
        await page.locator('[role="status"].flow-info-box').waitFor();
        assert.ok((await page.locator('[role="status"].flow-info-box').innerText()).length > 10);
        assert.equal((await metrics("#flow-email")).minHeight, "54px");
    });
    await check("booking fields retain date/time control and the seat map uses documented spatial controls", async () => {
        await go("booking/winter/");
        await page.locator("#booking-date").fill("2026-11-20");
        const options = await page.locator("#booking-time option").evaluateAll(elements => elements.map(element => (element as HTMLOptionElement).value).filter(Boolean));
        assert.ok(options.length > 0);
        await page.locator("#booking-time").selectOption(options[0]);
        const next = page.getByRole("button", { name: /좌석.*선택/ });
        await next.click();
        const seat = page.locator('button[data-system-part="seat"]:not(:disabled)').first();
        await seat.waitFor();
        await seat.click();
        assert.equal(await seat.getAttribute("aria-pressed"), "true");
    });
    await check("no hydration or runtime errors occurred", async () => assert.deepEqual(errors, []));
} finally {
    fs.writeFileSync(path.join(directory, "report.json"), JSON.stringify({ base, verifiedAt: new Date().toISOString(), components: COMPONENT_COUNTS, widths: [320, 390, 768, 1024, 1440], results, errors }, null, 2));
    await context.close();
    await browser.close();
}
if (results.some(result => !result.passed)) process.exitCode = 1;
