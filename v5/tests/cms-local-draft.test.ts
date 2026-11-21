import assert from "node:assert/strict";
import test from "node:test";
import { emptyVisualDocument } from "../src/cms/visual-document.ts";
import * as draftStorage from "../src/cms/visual-document.ts";

test("navigation and remote load never clobber the target's local draft", () => {
    assert.equal(typeof draftStorage.autosaveVisualDraft, "function");
    const path = "/programs";
    const initial = JSON.stringify({ ...emptyVisualDocument(path), updatedAt: "older-copy" });
    const values = new Map([[draftStorage.visualLocalDraftKey(path), initial]]);
    const storage = { setItem: (key: string, value: string) => { values.set(key, value); } };
    const edits = emptyVisualDocument("/visit");
    draftStorage.autosaveVisualDraft(() => storage, path, edits, true);
    draftStorage.autosaveVisualDraft(() => storage, path, emptyVisualDocument(path), false);
    assert.equal(values.get(draftStorage.visualLocalDraftKey(path)), initial);
});

test("actual changes on the active page are saved and storage errors do not block editing", () => {
    const path = "/visit";
    const draft = { ...emptyVisualDocument(path), updatedAt: "new-edit" };
    const writes: [string, string][] = [];
    draftStorage.autosaveVisualDraft(() => ({ setItem: (key, value) => { writes.push([key, value]); } }),
        path, draft, true);
    assert.deepEqual(writes, [[draftStorage.visualLocalDraftKey(path), JSON.stringify(draft)]]);
    assert.doesNotThrow(() => draftStorage.autosaveVisualDraft(() => ({
        setItem: () => { throw new Error("quota exceeded"); },
    }), path, draft, true));
});
