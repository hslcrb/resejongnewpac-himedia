import assert from "node:assert/strict";
import test from "node:test";
import { decodePublicVisualSnapshot } from "../src/cms/studio-public-snapshot.ts";
import { emptyVisualDocument, upsertVisualPatch, visualDocumentChecksum } from "../src/cms/visual-document.ts";

const document = upsertVisualPatch(emptyVisualDocument("/visit"), "body > h1:nth-of-type(1)", { text: "발행 제목" });
const snapshot = { path: "/visit", publishedRevision: 1, checksum: visualDocumentChecksum(document), document };

test("public reader projects a valid matching published revision only", () => {
    assert.deepEqual(decodePublicVisualSnapshot({ ...snapshot, note: "audit", publishedBy: "private" }, "/visit/"), snapshot);
    assert.equal(decodePublicVisualSnapshot(snapshot, "/visit/directions"), null);
    assert.equal(decodePublicVisualSnapshot(snapshot, "/admin/"), null);
    assert.equal(decodePublicVisualSnapshot({ ...snapshot, publishedRevision: 0 }, "/visit"), null);
    assert.equal(decodePublicVisualSnapshot({ ...snapshot, checksum: "e".repeat(64) }, "/visit"), null);
});
