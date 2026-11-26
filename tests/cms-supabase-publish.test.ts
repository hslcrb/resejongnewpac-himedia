import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseCmsStore, type CmsSupabaseLike } from "../src/cms/supabase-cms-adapter.ts";

const input = { path: "/visit", expectedRevision: 7, actorId: "not-a-supabase-uid", note: "reviewed" };
const noTable = () => assert.fail("Publishing must not fall back to nontransactional table writes");

test("a missing RPC cannot mark a draft as published", async () => {
    for (const rpc of [undefined, async () => ({ data: null, error: { code: "PGRST202", message: "schema cache miss" } })]) {
        const result = await createSupabaseCmsStore({ from: noTable, rpc }).publishVisualDraft(input);
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.reason, "unavailable");
    }
});

test("the RPC uses the authenticated database actor and returns a matching receipt", async () => {
    const client: CmsSupabaseLike = {
        from: noTable,
        async rpc(name, args) {
            assert.equal(name, "sejong_cms_publish_visual_draft");
            assert.deepEqual(args, { p_path: "/visit", p_expected_revision: 7, p_note: "reviewed" });
            return { error: null, data: { target_path: "/visit", revision: 7, published_revision: 2,
                checksum: "a".repeat(64), document: { path: "/visit", schemaVersion: 2, patches: [], additions: [] } } };
        },
    };
    const result = await createSupabaseCmsStore(client).publishVisualDraft(input);
    assert.equal(result.ok && result.data.publishedRevision, 2);
});

test("wrong revision or incomplete RPC result is not a publication receipt", async () => {
    for (const row of [{ revision: 8, published_revision: 2 }, { revision: 7, published_revision: 0 }]) {
        const result = await createSupabaseCmsStore({ from: noTable, async rpc() {
            return { data: { ...row, target_path: "/visit" }, error: null };
        } }).publishVisualDraft(input);
        assert.equal(result.ok, false);
    }
});
