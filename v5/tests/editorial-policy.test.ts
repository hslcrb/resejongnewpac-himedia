import test from "node:test";
import assert from "node:assert/strict";
import { editorialGroup } from "../src/lib/editorial-policy.ts";

test("editorial motion includes the five exact route groups and descendants", () => {
    for (const group of ["programs", "rental", "visit", "news", "about"]) {
        for (const route of [`/${group}`, `/${group}/`, `/v5/${group}/`, `/${group}/nested/page`]) {
            assert.equal(editorialGroup(route), group, route);
        }
    }
});

test("editorial motion preserves home, account, booking, guide and similar prefixes", () => {
    for (const route of ["/", "/v5/", "/account", "/booking/program", "/design-rules", "/aboutness", "/newsroom", "/v50/about", "/programs-archive"]) {
        assert.equal(editorialGroup(route), null, route);
    }
});
