import assert from "node:assert/strict";
import test from "node:test";
import { studioMoveRoots, captureStudioDrag, previewStudioDrag, restoreStudioDrag } from "../src/cms/studio-group-drag.ts";
import { emptyVisualDocument, createVisualHistory, pushVisualHistory, undoVisualHistory } from "../src/cms/visual-document.ts";
import { nudgeStudioLayers } from "../src/cms/studio-batch.ts";

const a = "body > main:nth-of-type(1) > section:nth-of-type(1)";
const child = a + " > h2:nth-of-type(1)";
const b = "body > main:nth-of-type(1) > section:nth-of-type(2)";

function fakeElement(inline = "", priority = "") {
    let value = inline;
    let important = priority;
    return {
        isConnected: true,
        style: {
            getPropertyValue: () => value,
            getPropertyPriority: () => important,
            setProperty: (_name: string, next: string, nextPriority = "") => { value = next; important = nextPriority; },
            removeProperty: () => { value = ""; important = ""; },
        },
    } as unknown as HTMLElement;
}

test("moving an inner hit on a selection keeps the batch and removes descendants from the move roots", () => {
    type Layer = { parentElement: Layer | null };
    const first: Layer = { parentElement: null };
    const second: Layer = { parentElement: null };
    const nested: Layer = { parentElement: first };
    const hit: Layer = { parentElement: nested };
    assert.deepEqual(studioMoveRoots(hit, [first, nested, second]), [first, second]);
    assert.deepEqual(studioMoveRoots(hit, [second]), [hit]);
});

test("group drag preview restores captured inline values and keeps one undo for the final edit", () => {
    const first = fakeElement("4px 2px", "important");
    const second = fakeElement();
    const group = [
        captureStudioDrag(first, a, "4px 2px"), captureStudioDrag(second, b, "none"),
    ];
    assert.equal(previewStudioDrag(group, 2, 0), false);
    assert.equal(previewStudioDrag(group, 12, -6), true);
    assert.equal(first.style.getPropertyValue("translate"), "16px -4px");
    assert.equal(first.style.getPropertyPriority("translate"), "important");
    assert.equal(second.style.getPropertyValue("translate"), "12px -6px");
    restoreStudioDrag(group);
    assert.equal(first.style.getPropertyValue("translate"), "4px 2px");
    assert.equal(first.style.getPropertyPriority("translate"), "important");
    assert.equal(second.style.getPropertyValue("translate"), "");

    const draft = emptyVisualDocument("/visit");
    const next = nudgeStudioLayers(draft, group, 12, -6)!;
    assert.equal(next.patches.length, 2);
    assert.deepEqual(undoVisualHistory(pushVisualHistory(createVisualHistory(draft), next)).present, draft);
});

test("invalid peer cancels the preview for every member", () => {
    const first = fakeElement("1px 1px");
    const second = fakeElement();
    const group = [captureStudioDrag(first, a, "1px 1px"), captureStudioDrag(second, child, "10% 0px")];
    assert.equal(previewStudioDrag(group, 8, 0), false);
    assert.equal(first.style.getPropertyValue("translate"), "1px 1px");
    assert.equal(second.style.getPropertyValue("translate"), "");
});
