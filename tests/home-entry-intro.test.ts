import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    HOME_ENTRY_COPY,
    HOME_ENTRY_TIMING,
    homeEntryTimeline,
    isHomeEntry,
} from "../src/lib/home-entry-intro.ts";

test("홈 첫 진입만 인트로 대상으로 삼는다", () => {
    assert.equal(isHomeEntry("/"), true);
    assert.equal(isHomeEntry("/"), true);
    assert.equal(isHomeEntry("/"), true);
    assert.equal(isHomeEntry("/about"), false);
    assert.equal(isHomeEntry("/programs/"), false);
    assert.equal(isHomeEntry(null), false);
});

test("포트폴리오에 준하는 일정한 러닝타임과 실패 해제 상한", () => {
    const { typedAt, exitAt, finishAt } = homeEntryTimeline();
    assert.equal(typedAt, HOME_ENTRY_TIMING.copyStart + HOME_ENTRY_COPY.length * HOME_ENTRY_TIMING.typeCharacter + HOME_ENTRY_TIMING.glyphReveal);
    assert.equal(exitAt, typedAt + HOME_ENTRY_TIMING.copyHold);
    assert.equal(finishAt, exitAt + HOME_ENTRY_TIMING.exit);
    assert.ok(finishAt >= 6_500 && finishAt <= 8_000);
    assert.ok(finishAt < HOME_ENTRY_TIMING.watchdog);
    assert.ok(HOME_ENTRY_TIMING.artwork < HOME_ENTRY_TIMING.copyStart);
});

test("인트로 SVG는 투명 배경과 안전한 원본 로고 모션을 유지한다", () => {
    const svg = readFileSync(new URL("../public/assets/intro/scenartmv.svg", import.meta.url));
    const text = svg.toString("utf8");
    assert.match(text, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(text, /<animate/);
    assert.match(text, /id="asciiArtwork"/);
    assert.doesNotMatch(text, /<rect\b[^>]*width="1560"[^>]*height="1040"/);
    assert.doesNotMatch(text, /<script\b|<foreignObject\b|\bonload\s*=|javascript:/i);
});

test("응원 문구를 영월체로 끝까지 쓴 뒤 충분히 읽을 시간을 둔다", () => {
    assert.equal(HOME_ENTRY_COPY, "2026 화이팅!");
    assert.ok(HOME_ENTRY_TIMING.copyHold >= 1_800);
    assert.ok(homeEntryTimeline().typedAt < homeEntryTimeline().exitAt);
});

test("인트로는 홈 셸을 가리지 않고 같은 렌더 트리에 추가한다", () => {
    const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    assert.match(layout, /<CatalogProvider><HomeEntryIntro\s*\/><SiteShell>/);
    assert.match(layout, /rel="preconnect"/);
    const css = readFileSync(new URL("../components/HomeEntryIntro.module.css", import.meta.url), "utf8");
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /siteEntryFailOpen/);
});
