import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";
import { loadPublishedCatalog } from "../src/catalog/snapshot.ts";

// [인접 작품과 넓은 지면의 실제 동작 / Real neighbour navigation and wide-layout behaviour]
const base = (process.argv[2] || "http://127.0.0.1:3000/").replace(/\/?$/, "/");
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: "reduce" });
const page = await context.newPage();
const directory = ".local-reports/hero-layout";
fs.mkdirSync(directory, { recursive: true });
const results: { name: string; passed: boolean; error?: string }[] = [];
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(10000);
page.setDefaultNavigationTimeout(60000);
const active = () => page.locator(".season-slide.is-active").getAttribute("data-feature");
const go = (route = "") => page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
const settleViewport = async () => {
    // [컨테이너 쿼리의 실제 재배치 완료 확인 / Wait for actual container-query reflow]
    await page.waitForFunction(() => {
        const stage = document.querySelector(".season-stage")?.getBoundingClientRect();
        const card = document.querySelector(".season-slide.is-active")?.getBoundingClientRect();
        if (!stage || !card) return true;
        return card.width <= stage.width && card.left >= stage.left - 1 && card.right <= stage.right + 1
            && Math.abs(card.left + card.width / 2 - stage.left - stage.width / 2) < 1;
    }, undefined, { timeout: 2000 });
};
const tokenColor = (token: string) => page.evaluate(token => {
    const sample = document.createElement("span");
    sample.style.color = `var(${token})`;
    document.body.append(sample);
    const color = getComputedStyle(sample).color;
    sample.remove();
    return color;
}, token);
async function check(name: string, run: () => Promise<void>) {
    try { await run(); results.push({ name, passed: true }); console.log("PASS", name); }
    catch (error) { results.push({ name, passed: false, error: String(error) }); console.error("FAIL", name, String(error)); await page.screenshot({ path: `${directory}/failure-${results.length}.png` }); }
}
try {
    await go();
    await check("both neighbouring works remain visible with readable program titles", async () => {
        assert.equal(await active(), "dance");
        assert.equal(await page.locator('[data-preview="previous"] .season-peer-title strong').innerText(), "빛이 머무는 자리");
        assert.equal(await page.locator('[data-preview="next"] .season-peer-title strong').innerText(), "카르멘");
        const metrics = await page.evaluate(() => {
            const main = document.querySelector(".season-slide.is-active")!.getBoundingClientRect();
            const stage = document.querySelector(".season-stage")!.getBoundingClientRect();
            return { main: { left: main.left, right: main.right, width: main.width }, stage: { width: stage.width }, peers: [...document.querySelectorAll<HTMLElement>(".season-peer-title")].map(element => {
                const rect = element.getBoundingClientRect();
                return { left: rect.left, right: rect.right, color: getComputedStyle(element).color, font: parseFloat(getComputedStyle(element.querySelector("strong")!).fontSize) };
            }) };
        });
        assert.ok(metrics.main.left > 100 && metrics.main.right < metrics.stage.width - 100);
        assert.ok(metrics.main.width >= 1400 && metrics.main.width <= 1441);
        const white = await tokenColor("--color-white");
        for (const peer of metrics.peers) {
            assert.ok(peer.left >= 0 && peer.right <= metrics.stage.width + 1, JSON.stringify(peer));
            assert.equal(peer.color, white);
            assert.ok(peer.font >= 16);
        }
        await page.screenshot({ path: `${directory}/verified-hero-1920.png` });
    });
    await check("peer clicks, keyboard activation and wraparound keep names, images and destinations together", async () => {
        await page.locator('[data-preview="next"] .season-peer-title').click();
        assert.equal(await active(), "carmen");
        assert.equal(await page.locator('.season-slide.is-active .season-actions a').last().getAttribute("href"), "/booking/carmen/");
        const previous = page.locator('[data-preview="previous"] .season-peer-title');
        await previous.focus(); await page.keyboard.press("Enter");
        assert.equal(await active(), "dance");
        await page.getByRole("button", { name: "이전 프로그램", exact: true }).click();
        assert.equal(await active(), "light");
        assert.equal(await page.locator('[data-preview="next"] .season-peer-title strong').innerText(), "일무");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    });
    await check("phone peeks keep both titles in reachable navigation and both primary actions inside the card", async () => {
        await page.setViewportSize({ width: 320, height: 1000 });
        await settleViewport();
        assert.equal(await page.locator(".hero-neighbor-navigation button:visible").count(), 2);
        assert.equal(await page.locator(".season-peer-title:visible").count(), 0);
        const geometry = await page.locator(".season-slide.is-active").evaluate(element => {
            const frame = element.getBoundingClientRect();
            const actions = element.querySelector(".season-actions")!.getBoundingClientRect();
            return { frame: { left: frame.left, right: frame.right }, actions: { left: actions.left, right: actions.right } };
        });
        assert.ok(geometry.frame.left >= 19 && geometry.frame.right <= 301, JSON.stringify(geometry));
        assert.ok(geometry.actions.left >= geometry.frame.left && geometry.actions.right <= geometry.frame.right + 1);
        await page.locator(".hero-neighbor-navigation button").last().click();
        assert.equal(await active(), "dance");
        await page.screenshot({ path: `${directory}/verified-hero-320.png` });
    });
    await check("horizontal dragging advances exactly one work and cancelled gestures return without navigation", async () => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await settleViewport();
        await page.getByRole("button", { name: "자동 재생 일시정지", exact: true }).click();
        const frame = (await page.locator(".season-slide.is-active").boundingBox())!;
        const x = frame.x + frame.width * 0.55;
        const y = frame.y + 140;
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 220, y + 3, { steps: 12 }); await page.mouse.up();
        await page.waitForFunction(() => document.querySelector(".season-slide.is-active")?.getAttribute("data-feature") === "carmen");
        const current = (await page.locator(".season-slide.is-active").boundingBox())!;
        await page.mouse.move(current.x + current.width * 0.5, y); await page.mouse.down(); await page.mouse.move(current.x + current.width * 0.5 + 25, y, { steps: 3 });
        await page.locator(".season-stage").dispatchEvent("pointercancel", { pointerId: 1, clientX: current.x + current.width * 0.5 + 25, clientY: y });
        await page.mouse.up();
        await settleViewport();
        assert.equal(await active(), "carmen");
        assert.equal(new URL(page.url()).pathname, "/");
        const center = (await page.locator(".season-slide.is-active").boundingBox())!;
        assert.ok(Math.abs(center.x - (await page.locator(".season-stage").evaluate(element => element.clientWidth) - center.width) / 2) < 1);
    });
    await check("explicit playback resumes while the play button retains keyboard focus", async () => {
        await go();
        const playback = page.locator("#home-feature-playback");
        if (await playback.getAttribute("aria-pressed") === "false") await playback.click();
        const before = await active();
        await playback.click();
        await page.mouse.move(5, 5);
        assert.equal(await playback.evaluate(element => element === document.activeElement), true);
        await page.waitForFunction(before => document.querySelector(".season-slide.is-active")?.getAttribute("data-feature") !== before, before, { timeout: 6500 });
        await playback.click();
    });
    await check("releasing a gesture outside the stage before capture does not block playback", async () => {
        await go();
        const playback = page.locator("#home-feature-playback");
        if (await playback.getAttribute("aria-pressed") === "false") await playback.click();
        await playback.evaluate(element => (element as HTMLElement).blur());
        const stage = (await page.locator(".season-stage").boundingBox())!;
        const x = stage.x + stage.width / 2;
        await page.mouse.move(x, stage.y + stage.height - 2);
        await page.mouse.down();
        await page.mouse.move(x, stage.y + stage.height + 24);
        await page.mouse.up();
        const before = await active();
        await playback.click();
        await playback.evaluate(element => (element as HTMLElement).blur());
        await page.mouse.move(5, 5);
        await page.waitForFunction(before => document.querySelector(".season-slide.is-active")?.getAttribute("data-feature") !== before, before, { timeout: 6500 });
        await playback.click();
        await page.emulateMedia({ reducedMotion: "reduce" });
    });
    await check("registered inverse-quiet example matches the actual photo-overlay controls", async () => {
        await go();
        const actual = await page.locator('[data-preview="next"] .season-peer-title').evaluate(element => {
            const css = getComputedStyle(element);
            return { color: css.color, radius: css.borderRadius, minHeight: css.minHeight };
        });
        await go("design-rules/#components/buttons");
        const sample = page.locator(".ds-overlay-controls .ds-button-inverse-quiet");
        await sample.waitFor();
        const style = await sample.evaluate(element => { const css = getComputedStyle(element); return { color: css.color, radius: css.borderRadius, minHeight: css.minHeight }; });
        assert.deepEqual(style, actual);
        const radius = await sample.evaluate(element => {
            const probe = document.createElement("span");
            probe.style.borderRadius = "var(--radius-control)";
            element.append(probe);
            const value = getComputedStyle(probe).borderRadius;
            probe.remove();
            return value;
        });
        assert.equal(style.radius, radius);
        assert.equal(style.color, await tokenColor("--color-white"));
        assert.equal(style.minHeight, "48px");
    });
    for (const route of ["", "programs/", "programs/dance/", "booking/dance/", "visit/directions/", "news/notices/", "account/", "account/login/", "design-rules/"]) {
        await check(`intrinsic layout, readable type and neutral copy across seven widths: ${route || "home"}`, async () => {
            await go(route);
            for (const width of [320, 390, 768, 1024, 1440, 1920, 2560]) {
                await page.setViewportSize({ width, height: 1080 });
                // [뷰포트 변경 뒤 컨테이너 쿼리 확정 / Settle container queries after viewport changes]
                await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                const metrics = await page.evaluate(() => {
                    const visible = (element: Element) => { const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return rect.width > 2 && rect.height > 2 && style.visibility !== "hidden"; };
                    return { scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth, frame: document.querySelector(".masthead.container")?.getBoundingClientRect().width, small: [...document.querySelectorAll("main p,main a,main button,main label,main input,main select,main textarea,main time")].filter(element => visible(element) && parseFloat(getComputedStyle(element).fontSize) < 15.9).map(element => ({ tag: element.tagName, text: element.textContent?.slice(0,50), size: getComputedStyle(element).fontSize })) };
                });
                assert.ok(metrics.scroll <= metrics.width + 1, `${route} ${width}px: ${JSON.stringify(metrics)}`);
                assert.deepEqual(metrics.small, [], `${route} ${width}px`);
                if (width >= 1920 && route !== "design-rules/") assert.ok(metrics.frame && Math.abs(metrics.frame - 1728) < 1, JSON.stringify(metrics));
                if ([390, 1920].includes(width)) await page.screenshot({ path: `${directory}/route-${route.replaceAll("/", "-") || "home"}-${width}.png` });
            }
            assert.doesNotMatch(await page.locator("body").innerText(), /체험\s?(계정|예매|프로필)|리뉴얼\s*시연|공식\s*사이트가\s*아닙|비공식|UNOFFICIAL/i);
        });
    }
    await check("mobile seats retain their spatial controls and guests must log in before saving", async () => {
        const catalog = structuredClone(loadPublishedCatalog());
        const program = catalog.programs.find(item => item.id === "winter");
        assert.ok(program, "The fixture program must be published in the export.");
        const sessionId = "test-winter-verified";
        catalog.sessions.push({ id: sessionId, programId: program.id, venueId: "m-theater", startsAt: `${program.start}T19:30:00+09:00`, bookingEnabled: true, sourceState: "verified" });
        const seats = Array.from({ length: 8 }, (_, index) => ({ id: `fixture-a${index + 1}`, label: `A${index + 1}`, row: "A", number: index + 1, price: 1000, available: true }));
        for (const width of [320, 390]) {
            const fixture = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
            let inventoryReads = 0;
            let reservationWrites = 0;
            try {
                await fixture.route("**/rest/v1/rpc/**", async route => {
                    const name = new URL(route.request().url()).pathname.split("/").pop();
                    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };
                    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
                    if (name === "sejong_catalog_snapshot") return route.fulfill({ json: catalog, headers });
                    if (name === "get_session_seats") {
                        inventoryReads++;
                        return route.fulfill({ json: { kind: "inventory", sessionId, bookingEnabled: true, serverNow: new Date().toISOString(), seats }, headers });
                    }
                    reservationWrites++;
                    return route.fulfill({ status: 403, json: { error: "unexpected fixture RPC" }, headers });
                });
                const booking = await fixture.newPage();
                await booking.goto(new URL("booking/winter/", base).href, { waitUntil: "networkidle" });
                await booking.locator("#booking-session").selectOption(sessionId);
                await booking.locator("#booking-participants").selectOption("4");
                const region = booking.getByRole("region", { name: "좌석 목록" });
                const first = booking.getByRole("button", { name: "A1 · 1,000원", exact: true });
                await first.waitFor();
                assert.ok(inventoryReads > 0, "The fixture must be used for the server inventory.");
                assert.equal(await region.getAttribute("tabindex"), "0");
                const initial = await region.evaluate(element => {
                    const frame = element.getBoundingClientRect();
                    const seat = element.querySelector("button")!.getBoundingClientRect();
                    return { left: frame.left, right: frame.right, seatLeft: seat.left, seatRight: seat.right, scrollLeft: element.scrollLeft, scrollWidth: element.scrollWidth, width: element.clientWidth };
                });
                assert.equal(initial.scrollLeft, 0);
                assert.ok(initial.scrollWidth > initial.width, JSON.stringify(initial));
                assert.ok(initial.seatLeft >= initial.left && initial.seatRight <= initial.right, `First seat must be reachable at the starting position: ${JSON.stringify(initial)}`);
                const size = await first.boundingBox();
                assert.ok(size && size.width >= 48 && size.height >= 48);
                await first.click();
                const last = booking.getByRole("button", { name: "A8 · 1,000원", exact: true });
                await last.click();
                assert.equal(await last.getAttribute("aria-pressed"), "true");
                assert.ok(await region.evaluate(element => element.scrollLeft > 0), "The last seat must be reachable by scrolling.");
                for (const seat of ["A2", "A3", "A4"]) await booking.getByRole("button", { name: `${seat} · 1,000원`, exact: true }).click();
                assert.equal(await region.locator('button[aria-pressed="true"]').count(), 4);
                assert.equal(await booking.getByRole("button", { name: "A4 · 1,000원", exact: true }).getAttribute("aria-pressed"), "false");
                assert.ok(await booking.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
                await booking.getByRole("button", { name: /4석 보류하기/ }).click();
                assert.match(await booking.locator('.ds-notice[role="alert"]').innerText(), /로그인한 뒤 예약해 주세요/);
                assert.equal(reservationWrites, 0, "Guests must not issue a reservation RPC.");
            } finally { await fixture.close(); }
        }
    });
    await check("content reflows with 200 percent text without a page-wide horizontal scroll", async () => {
        await page.setViewportSize({ width: 390, height: 1000 });
        for (const route of ["", "programs/", "programs/dance/", "booking/dance/", "account/"]) {
            await go(route);
            await page.evaluate(async () => {
                document.documentElement.style.fontSize = "200%";
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), route || "home");
        }
    });
    await check("no browser runtime errors", async () => assert.deepEqual(errors, []));
} finally {
    fs.writeFileSync(`${directory}/report.json`, JSON.stringify({ base, verifiedAt: new Date().toISOString(), results, errors }, null, 2));
    await context.close(); await browser.close();
}
if (results.some(result => !result.passed)) process.exitCode = 1;
