import assert from "node:assert/strict";
import test from "node:test";
import * as studio from "../src/cms/studio-batch.ts";
import { createVisualHistory, emptyVisualDocument, pushVisualHistory, undoVisualHistory, upsertVisualPatch } from "../src/cms/visual-document.ts";

const left = "body > main:nth-of-type(1) > p:nth-of-type(1)";
const right = "body > main:nth-of-type(1) > p:nth-of-type(2)";
const empty = emptyVisualDocument("/visit");
const targets = [
    { selector: left, translate: "none", left: 12, top: 25, right: 40, bottom: 45 },
    { selector: right, translate: "4px 9px", left: 25, top: 43, right: 85, bottom: 75 },
];

test("align left maintains prior translation and commits one undoable edit", () => {
    const doc = upsertVisualPatch(empty, right, { style: { translate: "4px 9px", color: "red" } });
    const next = studio.alignStudioLayers(doc, targets, "left");
    assert.ok(next);
    assert.equal(next.patches[0].style?.translate, "-9px 9px");
    assert.equal(next.patches[0].style?.color, "red");
    assert.equal(next.patches.length, 1);
    assert.deepEqual(undoVisualHistory(pushVisualHistory(createVisualHistory(doc), next)).present, doc);
});

test("align centers on selection bounding edges, not average layer centers", () => {
    const next = studio.alignStudioLayers(empty, targets, "center-x");
    assert.deepEqual(next?.patches.map(patch => patch.style?.translate), ["22.5px 0px", "-2.5px 9px"]);
    assert.deepEqual(studio.alignStudioLayers(empty, targets, "bottom")?.patches.map(patch => patch.style?.translate), ["0px 30px"]);
});

test("rejects unsupported translations, repeated selectors and unmeasurable boxes without partial writes", () => {
    assert.equal(studio.alignStudioLayers(empty, [{ ...targets[0], translate: "5% 4px" }, targets[1]], "right"), null);
    assert.equal(studio.alignStudioLayers(empty, [targets[0], targets[0]], "bottom"), null);
    assert.equal(studio.alignStudioLayers(empty, [targets[0], { ...targets[1], right: Infinity }], "left"), null);
    assert.equal(studio.alignStudioLayers(empty, [targets[0], { ...targets[1], left: 12 }], "left"), null);
    assert.equal(empty.patches.length, 0);
});
