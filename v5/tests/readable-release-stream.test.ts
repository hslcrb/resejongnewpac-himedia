import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { calculateReleaseId } from "../scripts/readable-release.ts";

test("hashing a multi-chunk public asset does not allocate the whole file and preserves the release ID", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "release-stream-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const relative = "public/multiple-chunks.bin";
    const file = path.join(root, relative);
    const payload = Buffer.concat([Buffer.alloc(512 * 1024, 0x61), Buffer.from([0, 7, 255])]);
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, payload);
    const expected = createHash("sha256")
        .update("readable-build-v1\0" + process.versions.node + "\0")
        .update(relative + "\0").update(payload).update("\0")
        .digest("hex").slice(0,16);
    const read = fs.readFileSync;
    t.mock.method(fs, "readFileSync", (target: Parameters<typeof read>[0]) => {
        if (target === file) assert.fail("A build asset must not be read into one allocation.");
        return read(target);
    });
    assert.equal(calculateReleaseId(root, {}), "r-" + expected);
});
