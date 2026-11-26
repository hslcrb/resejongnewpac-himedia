import assert from "node:assert/strict";
import test from "node:test";
import { publicVisualPath, readPublishedVisual } from "../src/cms/studio-public-client.ts";
import { emptyVisualDocument, visualDocumentChecksum } from "../src/cms/visual-document.ts";

const origin = "https://fixture.supabase.co";
const key = "sb_publishable_public-fixture";
const document = emptyVisualDocument("/visit");
const snapshot = { path: "/visit", publishedRevision: 12, checksum: visualDocumentChecksum(document), document };
const signal = () => new AbortController().signal;
const json = (value: unknown) => Response.json(value);

test("only top-level public canonical page routes are eligible", () => {
    assert.equal(publicVisualPath("/", true), "/");
    assert.equal(publicVisualPath("/visit/", true), "/visit");
    for (const path of ["/outside.png", "/Account/space/", "/booking/", "/admin/", "/login/", "/api/", "/design-rules/", "/Visit/", "//visit/", "/classes/test.png"]) {
        assert.equal(publicVisualPath(path, true), null, path);
    }
    assert.equal(publicVisualPath("/visit/", false), null);
});

test("browser uses only public RPC and never forwards the user session", async () => {
    const result = await readPublishedVisual({ origin, key, path: "/visit", signal: signal(), fetcher: async (url, init) => {
        assert.equal(url, origin + "/rest/v1/rpc/sejong_cms_read_public_visual");
        assert.equal(init?.method, "POST");
        assert.equal(init?.credentials, "omit");
        assert.equal(init?.redirect, "error");
        assert.deepEqual(JSON.parse(String(init?.body)), { p_path: "/visit" });
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("apikey"), key);
        assert.equal(headers.has("authorization"), false);
        return json({ ...snapshot, note: "not projected", actor: "not projected" });
    } });
    assert.deepEqual(result, snapshot);
});

test("bad config, disabled paths and cancellation do not contact API", async () => {
    const banned = async () => { assert.fail("Unexpected network access"); };
    const common = { origin, key, path: "/visit", signal: signal(), fetcher: banned };
    for (const override of [
        { origin: "https://example.com" }, { origin: origin + "/untrusted" }, { origin: "http://fixture.supabase.co" },
        { key: "sb_secret_forbidden" }, { key: "something" }, { path: "/admin" }, { path: "/api" },
        { signal: AbortSignal.abort() },
    ]) assert.equal(await readPublishedVisual({ ...common, ...override }), null);
});

test("missing, invalid, failed, and oversized responses preserve the original", async () => {
    for (const fetcher of [
        async () => json(null),
        async () => json({ ...snapshot, path: "/programs" }),
        async () => json({ ...snapshot, checksum: "0".repeat(64) }),
        async () => new Response("{}", { status: 503 }),
        async () => new Response("{", { headers: { "content-type": "application/json" } }),
        async () => json({ ...snapshot, extra: "a".repeat(1_048_576) }),
        async () => { throw new Error("Offline"); },
    ]) assert.equal(await readPublishedVisual({ origin, key, path: "/visit", signal: signal(), fetcher }), null);
});

test("legacy anon JWT is accepted; service-role JWT cannot be used", async () => {
    const jwt = (role: string) => "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({role})).toString("base64url") + ".c2ln";
    const request = { origin, path: "/visit", signal: signal(), fetcher: async (_url: string, init?: RequestInit) => {
        assert.equal(new Headers(init?.headers).get("apikey"), jwt("anon"));
        assert.equal(new Headers(init?.headers).get("authorization"), null);
        return json(snapshot);
    } };
    assert.deepEqual(await readPublishedVisual({ ...request, key: jwt("anon") }), snapshot);
    assert.equal(await readPublishedVisual({ ...request, key: jwt("service_role") }), null);
});

test("navigation cancels a pending request and drops a late prior-page result", async () => {
    const ctrl = new AbortController();
    let requestSignal: AbortSignal | null | undefined;
    let complete: (value: Response) => void = () => {};
    const pending = readPublishedVisual({ origin, key, path: "/visit", signal: ctrl.signal, fetcher: (_url, init) => {
        requestSignal = init?.signal;
        return new Promise(resolve => { complete = resolve; });
    } });
    ctrl.abort();
    assert.equal(requestSignal?.aborted, true);
    complete(json(snapshot));
    assert.equal(await pending, null);
});
