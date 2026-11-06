import assert from "node:assert/strict";
import { chromium } from "playwright";

// 기존 제품 서버를 먼저 실행합니다. 별도 배포·DB 변경은 수행하지 않습니다.
const base = (process.env.BOOKING_BASE_URL || "http://127.0.0.1:3000/v5").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const results: { width: number; completed: boolean; overflow: boolean; bookingRpcCalls: number }[] = [];
try {
    for (const width of [320, 390, 768, 1024, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
        const errors: string[] = [], calls: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        page.on("request", request => { if (/\/rpc\/(?:get_session_seats|hold_seats|confirm_reservation|cancel_reservation)(?:\?|$)/.test(request.url())) calls.push(request.url()); });
        await page.goto(`${base}/booking/experience/`, { waitUntil: "networkidle" });
        const root = page.locator('[data-component-id="booking-experience"]');
        await root.getByLabel("관람 날짜", { exact: false }).selectOption({ index: 1 });
        await root.getByLabel("프로그램", { exact: false }).selectOption("experience-concert");
        await root.getByLabel("관람 회차", { exact: false }).selectOption({ index: 1 });
        await root.getByLabel("관람 인원", { exact: true }).selectOption("2");
        await root.getByRole("button", { name: "좌석 선택으로", exact: true }).click();
        await root.getByRole("button", { name: /^A1,/ }).click();
        await root.getByRole("button", { name: /^A2,/ }).click();
        assert.equal(await root.getByRole("button", { name: /^A4,/ }).isDisabled(), true);
        assert.equal(await root.locator('button[aria-pressed="true"]').count(), 2);
        await root.getByRole("button", { name: "선택 내용 확인", exact: true }).click();
        await root.getByRole("heading", { name: "내용 확인", exact: true }).waitFor();
        assert.equal(await page.evaluate(() => document.activeElement?.textContent), "내용 확인");
        await root.getByRole("checkbox").check();
        await root.getByRole("button", { name: "체험 완료하기", exact: true }).click();
        await root.getByRole("heading", { name: "관람예약 체험 완료", exact: true }).waitFor();
        assert.ok((await root.textContent())?.includes("실제 예약·결제·발권은 생성되지 않았습니다."));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        assert.equal(overflow, false, `horizontal overflow at ${width}px`);
        assert.equal(calls.length, 0, "experience must not call booking RPCs");
        await root.getByRole("button", { name: "다시 체험하기", exact: true }).click();
        await root.getByRole("heading", { name: "일정과 인원", exact: true }).waitFor();
        assert.equal(await root.getByLabel("관람 날짜", { exact: false }).inputValue(), "");
        assert.deepEqual(errors, [], "browser errors");
        results.push({ width, completed: true, overflow, bookingRpcCalls: calls.length });
        await page.close();
    }
    console.log(JSON.stringify({ results }, null, 2));
} finally { await browser.close(); }
