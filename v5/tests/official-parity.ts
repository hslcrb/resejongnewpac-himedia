import { chromium } from "playwright";
import type { Page } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { PAGES, PROGRAMS } from "../src/data/catalog.ts";

// [실제 정적 경로와 상호작용 검증 / Browser checks for exported routes and interactions]
// 실행: node tests/official-parity.ts http://localhost:4173/v5 --all
// Run after the production export; --all audits every registered route.
const base = (process.argv[2] || "http://localhost:3000/v5").replace(/\/$/, "");
const all = process.argv.includes("--all");
const widthArgument = process.argv.find((argument) => argument.startsWith("--width="));
const width = widthArgument ? Number(widthArgument.split("=")[1]) : process.argv.includes("--mobile") ? 390 : 1440;
const viewport = { width, height: width < 700 ? 844 : 1000 };
const device = width < 700 ? "mobile" : "desktop";
const browser = await chromium.launch({ headless: true });
const issues: { path: string; problem: string }[] = [];
const checks: { path: string; title: string; status: number | undefined }[] = [];
const selected = all ? PAGES.map((item) => item.path) : ["/programs/day-ticket", "/programs/noon-ticket", "/services", "/rental/classrooms", "/visit/support/faq", "/rental/apply", "/programs/performance", "/news/goods/vendor"];
const registry = new Set(PAGES.map((item) => item.path));
let interactionStage = "route audit";

async function open(page: Page, path: string) {
    const response = await page.goto(base + path + (path === "/" ? "" : "/"), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => {
        const main = document.querySelector("main");
        return main && (main.textContent || "").trim().length > 80 && !(main.textContent || "").includes("안내를 준비하고 있습니다.");
    }, undefined, { timeout: 15000 });
    return response;
}

try {
    const queue = [...selected];
    await Promise.all(Array.from({ length: all ? 4 : 1 }, async () => {
        const page = await browser.newPage({ viewport });
        let current = "";
        page.on("pageerror", (error) => issues.push({ path: current, problem: "pageerror: " + error.message }));
        while (queue.length) {
            const path = queue.shift()!;
            current = path;
            try {
                const response = await open(page, path);
                if (response?.status() !== 200) issues.push({ path, problem: "HTTP " + response?.status() });
                const result = await page.evaluate(() => {
                    const main = document.querySelector("main")!;
                    const text = main.textContent || "";
                    const badImages = Array.from(main.querySelectorAll("img")).filter((img) => {
                        const bounds = img.getBoundingClientRect();
                        return bounds.top < innerHeight && bounds.bottom > 0 && img.complete && img.naturalWidth === 0;
                    }).map((img) => img.getAttribute("src"));
                    return { title: main.querySelector("h1")?.textContent || "", text, badImages,
                        links: Array.from(main.querySelectorAll<HTMLAnchorElement>("a[href]")).map((link) => link.getAttribute("href") || ""),
                        overflow: document.documentElement.scrollWidth > innerWidth + 1 };
                });
                checks.push({ path, title: result.title, status: response?.status() });
                if (checks.length % 25 === 0) console.log(`${device}: checked ${checks.length}/${selected.length} routes`);
                if (!result.title) issues.push({ path, problem: "missing h1" });
                if (/세종문화회관의 서비스와 공간을 페이지별로 정리한 안내입니다|페이지를 불러오지 못|프로그램을 찾을 수 없습니다/.test(result.text)) issues.push({ path, problem: "placeholder or error content" });
                if (result.overflow) issues.push({ path, problem: device + " overflow" });
                for (const image of result.badImages) issues.push({ path, problem: "broken visible image: " + image });
                for (const link of result.links) {
                    const local = link.startsWith("/v5/") ? link.slice(3) : link.startsWith("#/") ? link.slice(1) : "";
                    if (!local) continue;
                    const route = local.split(/[?#]/)[0].replace(/\/$/, "") || "/";
                    if (!registry.has(route) && !/^\/booking\//.test(route) && route !== "/login") issues.push({ path, problem: "unregistered local link: " + route });
                }
            } catch (error) { issues.push({ path, problem: String(error) }); }
        }
        await page.close();
    }));

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    interactionStage = "day-ticket eligibility";
    await open(page, "/programs/day-ticket");
    await page.locator("#ticket-birth-year").fill("2005");
    await page.locator("[data-day-ticket-check] button").click();
    if (!(await page.locator("[data-day-ticket-result]").innerText()).includes("청소년 데이티켓 대상")) throw new Error("Day ticket eligibility failed");
    await page.locator('.official-related a[href="/v5/programs/noon-ticket"]').click();
    await page.waitForURL((url) => url.pathname.replace(/\/$/, "").endsWith("/programs/noon-ticket"), { waitUntil: "commit" });
    await page.locator(".official-clock").waitFor();
    interactionStage = "service directory filters";
    await open(page, "/services");
    await page.locator("#service-query").fill("데이티켓");
    if (await page.locator(".official-directory-list > a").count() !== 1) throw new Error("Service search did not filter");
    await page.locator("#service-group").selectOption("rental");
    if (await page.locator(".official-directory-list > a").count() !== 0) throw new Error("Service group did not filter");
    interactionStage = "service directory reset";
    await page.locator('[data-service-search] button[type="reset"]').click();
    await page.waitForFunction(() => document.querySelectorAll(".official-directory-list > a").length > 20);
    interactionStage = "classroom selection";
    await open(page, "/rental/classrooms");
    await page.locator('[data-classroom="open"]').click();
    if (!(await page.locator("[data-classroom-result]").innerText()).includes("80명")) throw new Error("Classroom selection failed");
    for (const path of ["/services", "/programs/day-ticket", "/visit/seating", "/rental/classrooms"]) {
        await open(page, path);
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) issues.push({ path, problem: "mobile overflow" });
    }
    // 실제 결제 없이, 프로그램별 가격과 선택 조건이 체험 기록까지 이어지는지 확인합니다.
    // Verify program price and selected details persist into the local demo receipt.
    interactionStage = "booking prefill";
    const performance = PROGRAMS.find((item) => item.category === "공연" && item.price > 0)!;
    const bookingDate = performance.start;
    const bookingTime = performance.times?.[0] || "19:30";
    await page.goto(`${base}/booking/${performance.id}/?date=${bookingDate}&time=${encodeURIComponent(bookingTime)}&participants=2`, { waitUntil: "domcontentloaded" });
    await page.locator("#booking-date").waitFor();
    if (await page.locator("#booking-date").inputValue() !== bookingDate) throw new Error("Booking date prefill failed");
    interactionStage = "booking seats and discount";
    await page.locator('[data-booking-date] button[type="submit"]').click();
    await page.locator('[data-seat="A1"]').click();
    await page.locator('[data-seat="A2"]').click();
    await page.locator("[data-booking-next]").click();
    await page.locator('[name="discount"]').selectOption("youth");
    const expected = Math.round(performance.price * 2 * .8);
    const displayed = Number((await page.locator("[data-review-total]").innerText()).replace(/\D/g, ""));
    if (displayed !== expected) throw new Error(`Booking price mismatch: ${displayed} / ${expected}`);
    interactionStage = "booking confirmation and receipt";
    await page.locator("#flow-name").fill("검증용 관람객");
    await page.locator("#flow-email").fill("sejong-test@example.com");
    await page.locator("#flow-phone").fill("010-1234-5678");
    await page.locator('[name="consent"]').check();
    await page.locator('[data-booking-review] button[type="submit"]').click();
    await page.locator(".flow-receipt").waitFor();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sejong-v4:bookings") || "[]").at(-1));
    if (saved?.total !== expected || saved?.date !== bookingDate || saved?.seats?.join(",") !== "A1,A2") throw new Error("Booking receipt did not match selected details");
    interactionStage = "saved booking and reload";
    await page.locator('.flow-receipt a[href="/v5/account/bookings"]').click();
    await page.waitForURL((url) => url.pathname.replace(/\/$/, "").endsWith("/account/bookings"), { waitUntil: "commit" });
    await page.locator(".account-booking").waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".account-booking").waitFor();
    await page.close();
} catch (error) { issues.push({ path: "interaction-checks: " + interactionStage, problem: error instanceof Error ? error.stack || error.message : String(error) }); }
finally { await browser.close(); }

const report = { base, all, viewport, checked: checks.length, issues, checks };
await mkdir(new URL("../docs/verification/", import.meta.url), { recursive: true });
await writeFile(new URL(`../docs/verification/official-parity-${all ? "all" : "smoke"}-${device}.json`, import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ checked: checks.length, issues }, null, 2));
if (issues.length) process.exitCode = 1;
