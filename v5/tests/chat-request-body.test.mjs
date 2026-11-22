import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { readBody } from "../chat-service/request-body.mjs";

test("Korean and emoji survive arbitrary request chunk boundaries", async () => {
    const original = { messages: [{ role: "user", content: "세종문화회관 🎭" }] };
    const bytes = Buffer.from(JSON.stringify(original));
    const chunks = Array.from(bytes, (_, index) => bytes.subarray(index, index + 1));
    assert.deepEqual(await readBody(Readable.from(chunks)), original);
});

test("oversized bodies stop at the request boundary; malformed JSON is a client error", async () => {
    await assert.rejects(readBody(Readable.from([Buffer.alloc(180_001)])), { message: "SIZE" });
    await assert.rejects(readBody(Readable.from([Buffer.from("{invalid")])), {
        message: "INVALID_JSON",
    });
});

test("invalid UTF-8 is rejected and the original character limit is preserved", async () => {
    await assert.rejects(readBody(Readable.from([Buffer.from([0xc0])])), {
        message: "INVALID_JSON",
    });
    const oversized = Buffer.from(JSON.stringify("가".repeat(60_000)));
    await assert.rejects(readBody(Readable.from([oversized])), { message: "SIZE" });
    const valid = Buffer.from(JSON.stringify("가".repeat(59_998)));
    assert.equal((await readBody(Readable.from([valid]))).length, 59_998);
});
