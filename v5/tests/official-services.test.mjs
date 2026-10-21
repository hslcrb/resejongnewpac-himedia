import test from "node:test";
import assert from "node:assert/strict";
import { PAGES } from "../src/data/catalog.ts";
import { OFFICIAL_SERVICES } from "../src/data/official.ts";
import { OFFICIAL_MENU_MAP } from "../src/data/official-navigation.ts";
import { renderOfficialPage, serviceDirectoryEntries, getDayTicketEligibility, bindOfficialPage } from "../src/features/official.ts";
import { renderPrograms } from "../src/features/programs.ts";
import { renderPages } from "../src/features/pages.ts";

test("every audited official menu has a registered local destination and a real source URL", () => {
    const paths = new Set(PAGES.map((page) => page.path));
    for (const item of OFFICIAL_MENU_MAP) {
        assert.ok(paths.has(item.path.split("?")[0]), item.path);
        assert.match(item.source, /^https:\/\/www\.sejong(?:pac|story)\.(?:or\.kr)/);
    }
    assert.ok(OFFICIAL_MENU_MAP.length >= 90);
});

test("new official services render through the existing program and information entry points", () => {
    for (const service of OFFICIAL_SERVICES) {
        const html = service.path.startsWith("/programs/") ? renderPrograms(service.path) : renderPages(service.path);
        assert.ok(html.includes(`<h1>${service.title}</h1>`), service.path);
        assert.ok(html.includes(service.source.replaceAll("&", "&amp;")), service.path);
        assert.ok(!html.includes("undefined"), service.path);
        assert.ok(!html.includes("프로그램을 찾을 수 없습니다"), service.path);
    }
});

test("directory search combines terms and groups, and safely escapes hostile input", () => {
    assert.equal(serviceDirectoryEntries("데이티켓", "programs")[0].path, "/programs/day-ticket");
    assert.equal(serviceDirectoryEntries("데이티켓", "rental").length, 0);
    assert.equal(serviceDirectoryEntries("zz-no-service-matches").length, 0);
    const html = renderOfficialPage("/services", new URLSearchParams({ q: '\"><script>alert(1)</script>' }));
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
});

test("day-ticket eligibility follows the official 2026 birth-year boundaries", () => {
    assert.equal(getDayTicketEligibility(2002), "youth");
    assert.equal(getDayTicketEligibility(2019), "youth");
    assert.equal(getDayTicketEligibility(1961), "senior");
    for (const year of [1962, 2001, 2020]) assert.equal(getDayTicketEligibility(year), "other");
    for (const year of [0, 1899, 2027, 2001.5, NaN]) assert.equal(getDayTicketEligibility(year), "invalid");
});

test("service reset clears both fields before calculating the restored results", () => {
    const listeners = {};
    const search = { value: "데이티켓" };
    const group = { value: "rental" };
    const results = { innerHTML: "no-results" };
    const form = {
        addEventListener: (name, handler) => { listeners[name] = handler; },
        querySelector: (selector) => selector.startsWith("input") ? search : group,
    };
    const root = {
        querySelector: (selector) => selector === "[data-service-search]" ? form : selector === "[data-service-results]" ? results : null,
        querySelectorAll: () => [],
    };
    const NativeFormData = globalThis.FormData;
    globalThis.FormData = class {
        get(name) { return name === "q" ? search.value : group.value; }
    };
    try {
        bindOfficialPage(root);
        let defaultPrevented = false;
        listeners.reset({ preventDefault() { defaultPrevented = true; } });
        assert.ok(defaultPrevented);
        assert.equal(search.value, "");
        assert.equal(group.value, "");
        assert.ok((results.innerHTML.match(/<h2>/g) || []).length > 100);
    } finally {
        globalThis.FormData = NativeFormData;
    }
});
