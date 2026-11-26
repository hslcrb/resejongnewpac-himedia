import { test } from "node:test";
import assert from "node:assert/strict";
import { selectScrollFragment } from "../src/lib/scroll-fragments.ts";

test("scroll position selects the last section past the reading line", () => {
    const sections = [{ id: "one", top: -300 }, { id: "two", top: 110 }, { id: "three", top: 900 }];
    assert.equal(selectScrollFragment(sections, 160, false), "two");
    assert.equal(selectScrollFragment(sections, 160, true), "three");
    assert.equal(selectScrollFragment([], 160, false), null);
});

test("the first section remains selected before reaching its top", () => {
    assert.equal(selectScrollFragment([{ id: "first", top: 300 }, { id: "second", top: 700 }], 100, false), "first");
});
