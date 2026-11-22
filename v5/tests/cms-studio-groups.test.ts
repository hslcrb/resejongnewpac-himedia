import assert from "node:assert/strict";
import test from "node:test";
import * as docs from "../src/cms/visual-document.ts";
import { chooseStudioDraft } from "../src/cms/studio-recovery.ts";
import { createMemoryCmsStore } from "../src/cms/cms-store.ts";
import { decodePublicVisualSnapshot } from "../src/cms/studio-public-snapshot.ts";
import * as batch from "../src/cms/studio-batch.ts";

const left = "body > main:nth-of-type(1) > p:nth-of-type(1)";
const right = "body > main:nth-of-type(1) > p:nth-of-type(2)";
const empty = docs.emptyVisualDocument("/visit");
const members = [left, right];

test("groups persist across sanitize and draft-store round trips without changing the public render checksum", async () => {
    const draft = batch.groupStudioLayers(empty, members, "group-test");
    assert.ok(draft);
    assert.deepEqual(docs.sanitizeVisualDocument(JSON.parse(JSON.stringify(draft)), "/visit").groups, [{ id: "group-test", selectors: members }]);
    assert.equal(docs.visualDocumentChecksum(draft), docs.visualDocumentChecksum(empty));
    assert.equal(chooseStudioDraft(empty, 4, { document: draft, revision: 4 }).state, "recover");
    assert.equal(chooseStudioDraft(empty, 5, { document: draft, revision: 4 }).state, "conflict");
    const store = createMemoryCmsStore();
    const saved = await store.saveVisualDraft({ path: "/visit", expectedRevision: 0, actorId: "editor", document: draft });
    assert.ok(saved.ok);
    const retrieved = await store.getVisualDocument("/visit");
    assert.ok(retrieved.ok);
    assert.deepEqual(retrieved.data?.document.groups, draft.groups);
    assert.notEqual(docs.visualDraftChecksum(draft), docs.visualDraftChecksum(empty));
});

test("public decoding does not surface editor groups even when rendering checksum matches", () => {
    const document = { ...empty, groups: [{ id: "group-test", selectors: members }] };
    assert.equal(decodePublicVisualSnapshot({ path: "/visit", publishedRevision: 1,
        checksum: docs.visualDocumentChecksum(empty), document }, "/visit")?.document.groups, undefined);
});

test("ungroup participates in undo; incomplete or overlapping group edits are rejected", () => {
    const grouped = batch.groupStudioLayers(empty, members, "group-test");
    assert.ok(grouped);
    assert.equal(batch.groupStudioLayers(grouped, [right, "body > h2:nth-of-type(1)"], "group-next"), null);
    assert.equal(batch.groupStudioLayers(empty, [left, left], "group-next"), null);
    assert.equal(batch.groupStudioLayers(empty, [left, '[data-cms-added="absent"]'], "group-next"), null);
    assert.equal(batch.groupStudioLayers(empty, [left, left + " > strong:nth-of-type(1)"], "group-next"), null);
    const ungrouped = batch.ungroupStudioLayers(grouped, "group-test");
    assert.deepEqual(ungrouped, empty);
    assert.deepEqual(docs.undoVisualHistory(docs.pushVisualHistory(docs.createVisualHistory(grouped), ungrouped!)).present, grouped);
});

test("deleting a member added in the CMS dissolves a group if only one member remains", () => {
    const result = docs.addVisualElement(empty, { parent: "body > main:nth-of-type(1)", preset: "text", text: "Added" });
    assert.ok(result.added);
    const selector = '[data-cms-added="' + result.added.id + '"]';
    const grouped = batch.groupStudioLayers(result.document, [left, selector], "group-test");
    assert.ok(grouped);
    assert.equal(docs.removeVisualElement(grouped, selector).groups, undefined);
});
