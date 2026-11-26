import test from "node:test";
import assert from "node:assert/strict";
import { readStore, writeStore } from "../src/lib/core.ts";

test("current storage does not read unrelated historical data", () => {
    const store = new Map([["sejong-v3:version-isolation", JSON.stringify(["carmen"])]]);
    globalThis.localStorage = {
        getItem: key => store.get(key) || null,
        setItem: (key, value) => store.set(key, value),
    };
    assert.deepEqual(readStore("version-isolation", []), []);
    writeStore("version-isolation", ["dance"]);
    assert.deepEqual(JSON.parse(store.get("sejong-v4:version-isolation")), ["dance"]);
    assert.deepEqual(JSON.parse(store.get("sejong-v3:version-isolation")), ["carmen"]);
    delete globalThis.localStorage;
});
