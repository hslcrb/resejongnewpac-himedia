import assert from "node:assert/strict";
import { test } from "node:test";
import { getSectionGroup } from "../src/lib/section-scope.ts";

test("all five navigation groups and nested routes opt into section interactions", () => {
    for (const group of ["programs", "rental", "visit", "news", "about"]) {
        assert.equal(getSectionGroup(`/${group}`), group);
        assert.equal(getSectionGroup(`/v5/${group}/nested/page/`), group);
    }
});
test("home, account, booking, documentation and similar prefixes retain their existing behavior", () => {
    for (const path of ["/", "/v5/", "/account", "/booking/dance", "/design-rules", "/aboutness", "/newsletter", "/programs-other", "https://example.com/about"]) assert.equal(getSectionGroup(path), null);
});
