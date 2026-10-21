import test from "node:test";
import assert from "node:assert/strict";
import { readStore, writeStore } from "../src/lib/core.ts";

test("shared flow storage observes React writes and another tab clearing values", () => {
    const values = new Map();
    const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    } });
    try {
        assert.equal(writeStore("sync-check", ["dance"]), true);
        values.set("sejong-v4:sync-check", JSON.stringify(["light"]));
        assert.deepEqual(readStore("sync-check", []), ["light"]);
        values.delete("sejong-v4:sync-check");
        assert.deepEqual(readStore("sync-check", []), []);
    } finally {
        if (previous) Object.defineProperty(globalThis, "localStorage", previous);
        else delete globalThis.localStorage;
    }
});
