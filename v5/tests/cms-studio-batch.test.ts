import assert from "node:assert/strict";
import test from "node:test";
import { toggleStudioSelection, setStudioLayersHidden, nudgeStudioLayers } from "../src/cms/studio-batch.ts";
import { createVisualHistory, emptyVisualDocument, pushVisualHistory, undoVisualHistory, upsertVisualPatch } from "../src/cms/visual-document.ts";

const parent = "body > main:nth-of-type(1) > section:nth-of-type(1)";
const child = parent + " > h2:nth-of-type(1)";
const other = "body > main:nth-of-type(1) > p:nth-of-type(1)";
const root = emptyVisualDocument("/visit");

test("toggle retains selection order and replaces with a normal click", () => {
    assert.deepEqual(toggleStudioSelection([parent], other, true), [parent, other]);
    assert.deepEqual(toggleStudioSelection([parent, other], parent, true), [other]);
    assert.deepEqual(toggleStudioSelection([parent, other], child, false), [child]);
    assert.deepEqual(toggleStudioSelection([parent], "script, iframe", true), [parent]);
});

test("hide and restore disparate layers are single undoable edits", () => {
    const hidden = setStudioLayersHidden(root, [parent, other, parent], true);
    assert.deepEqual(hidden?.patches, [{ selector: parent, hidden: true }, { selector: other, hidden: true }]);
    const history = pushVisualHistory(createVisualHistory(root), hidden!);
    assert.deepEqual(undoVisualHistory(history).present, root);
    assert.deepEqual(setStudioLayersHidden(hidden!, [parent, other], false)?.patches.map(p => p.hidden), [false, false]);
});

test("moves by document pixels together without double-moving descendants", () => {
    const draft = upsertVisualPatch(root, other, { style: { translate: "4.5px 3px" } });
    const moved = nudgeStudioLayers(draft, [
        { selector: parent, translate: "none" },
        { selector: child, translate: "none", coveredByAncestor: true },
        { selector: other, translate: "4.5px 3px" },
    ], -8, 0);
    assert.equal(moved?.patches.find(p => p.selector === parent)?.style?.translate, "-8px 0px");
    assert.equal(moved?.patches.find(p => p.selector === other)?.style?.translate, "-3.5px 3px");
    assert.equal(moved?.patches.some(p => p.selector === child), false);
});

test("the entire operation is rejected for an invalid or unsupported target", () => {
    assert.equal(setStudioLayersHidden(root, [parent, "[data-cms-added=\"absent\"]"], true), null);
    assert.equal(nudgeStudioLayers(root, [{ selector: parent, translate: "" }, { selector: other, translate: "30% 0px" }], 1, 0), null);
    assert.equal(nudgeStudioLayers(root, [{ selector: parent, translate: "" }], 100000, 0), null);
    assert.equal(nudgeStudioLayers(root, [{ selector: parent, translate: "" }], 0, 0), null);
});

test("repeated movement respects the newest draft before the page repaints", () => {
    const add = (doc: typeof root) => nudgeStudioLayers(doc, [{ selector: parent, translate: "none" }], 8, 0)!;
    assert.equal(add(add(root)).patches[0].style?.translate, "16px 0px");
});

test("capacity overflow does not apply only the first part of an operation", () => {
    const full = { ...root, patches: Array.from({ length: 899 }, (_, i) => ({
        selector: "body > div:nth-of-type(" + (i + 1) + ")",
        hidden: true,
    })) };
    assert.equal(setStudioLayersHidden(full, [parent, other], true), null);
    assert.equal(full.patches.length, 899);
});
