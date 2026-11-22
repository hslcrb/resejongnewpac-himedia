import assert from "node:assert/strict";
import test from "node:test";
import { chooseStudioDraft, readStudioDraft, writeStudioDraft } from "../src/cms/studio-recovery.ts";
import { emptyVisualDocument, upsertVisualPatch } from "../src/cms/visual-document.ts";

const path = "/visit";
const remote = emptyVisualDocument(path);
const local = upsertVisualPatch(remote, "body > p:nth-of-type(1)", { text: "미저장" });

test("정확히 같은 서버 리비전 위의 변경만 자동 복구한다", () => {
    assert.equal(chooseStudioDraft(remote, 2, { document: local, revision: 2 }).state, "recover");
    assert.equal(chooseStudioDraft(remote, 3, { document: local, revision: 2 }).state, "conflict");
    assert.equal(chooseStudioDraft(remote, 3, { document: local, revision: null }).state, "conflict");
    assert.equal(chooseStudioDraft(remote, 3, { document: remote, revision: 2 }).state, "remote");
    assert.equal(chooseStudioDraft(null, 0, { document: local, revision: null }).state, "recover");
    assert.equal(chooseStudioDraft(null, 0, { document: local, revision: 3 }).state, "conflict");
});

test("사용자, 경로, 리비전의 각 저장 원본을 보존한다", () => {
    const entries = new Map<string,string>();
    const storage = { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string,v: string) => { entries.set(k,v); } };
    assert.equal(writeStudioDraft(storage, "admin-A", path, 2, local), true);
    assert.equal(writeStudioDraft(storage, "admin-A", path, 3, remote), true);
    assert.equal(readStudioDraft(storage, "admin-A", path, 2)?.document.patches[0]?.text, "미저장");
    assert.equal(readStudioDraft(storage, "admin-A", path)?.revision, 3);
    assert.equal(readStudioDraft(storage, "admin-B", path), null);
    assert.equal(readStudioDraft(storage, "admin-A", "/programs"), null);
    assert.equal(writeStudioDraft(storage, "admin-A", "/programs", 3, local), false);
});
