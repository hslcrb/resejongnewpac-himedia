import test from "node:test";
import assert from "node:assert/strict";
import { isRemovedOfficialLink } from "../src/lib/link-policy.ts";

// [주소 형태와 도메인 경계 / URL forms and exact domain boundaries]
test("official navigation is removed across hosts, URL forms and contact links", () => {
    for (const href of ["https://sejongpac.or.kr/", "http://www.sejongpac.or.kr/portal/main/main.do", "//www.sejongpac.or.kr/a", "https://WWW.SEJONGPAC.OR.KR.:443/a", "mailto:sponsorship@sejongpac.or.kr", "mailto:a@example.com,sponsorship@sejongpac.or.kr?subject=test", { hostname: "www.sejongpac.or.kr", pathname: "/portal" }]) {
        assert.equal(isRemovedOfficialLink(href), true, JSON.stringify(href));
    }
});

test("internal routes, related project hosts and other destinations stay available", () => {
    for (const href of ["/visit/", "#visit-heading", "/assets/sejongpac.or.kr.pdf", "https://renewsejongpac.rhee.life/", "https://sejongpac.or.kr.example.com/", "https://example.com/?source=sejongpac.or.kr", "mailto:person@example.com", "tel:02-399-1000", "", undefined]) {
        assert.equal(isRemovedOfficialLink(href), false, String(href));
    }
});
