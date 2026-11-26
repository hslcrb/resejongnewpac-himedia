import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryCmsStore } from "../src/cms/cms-store.ts";
import {
    edgeCacheUrls,
    mirrorPublishedRevision,
    publishDraftToEdge,
    publishedDocumentKey,
    purgeCloudflareCache,
    readPublishedRevision,
} from "../src/cms/cloudflare-edge-adapter.ts";
import { handleDesignerApiRequest } from "../src/cms/designer-api.ts";
import type { CmsIdentityDecision } from "../src/cms/contracts.ts";
import type { CmsVisualRevisionRecord } from "../src/cms/cms-store.ts";

const MAIN = "body > main:nth-of-type(1)";
const HEADING = "body > main:nth-of-type(1) > h2:nth-of-type(1)";

const admin: CmsIdentityDecision = {
    isAuthenticated: true,
    isAdmin: true,
    statusCode: 200,
    reasonCode: "VERIFIED_GOOGLE_ADMIN",
    accountHandle: "admin",
    verifiedEmail: "admin@example.com",
    googleSubject: "google-subject",
    role: "super_admin",
    capabilities: ["cms:read", "cms:write_draft", "cms:create_run_agent" as never, "cms:create_pr", "cms:reconcile_release"],
    destinations: [],
    message: "ok",
};

function document() {
    return {
        schemaVersion: 2,
        path: "/programs",
        patches: [{ selector: HEADING, text: "프로그램", style: { "font-size": "32px" } }],
        additions: [],
    };
}

test("디자이너 API: 인증·CSRF·Origin 방어", async () => {
    const store = createMemoryCmsStore();
    const unauth = await handleDesignerApiRequest(
        { method: "GET", pathname: "/api/cms/designer", search: "?path=/programs", identity: null },
        { store },
    );
    assert.equal(unauth.status, 401);

    const noCsrf = await handleDesignerApiRequest(
        { method: "POST", pathname: "/api/cms/designer", identity: admin, body: { action: "save_draft", path: "/programs" } },
        { store, requireCsrf: true },
    );
    assert.equal(noCsrf.status, 403);

    const badOrigin = await handleDesignerApiRequest(
        { method: "GET", pathname: "/api/cms/designer", search: "?path=/programs", origin: "https://evil.example", identity: admin },
        { store, allowedOrigin: "https://renewsejongpac.rhee.life" },
    );
    assert.equal(badOrigin.status, 403);

    const protectedPath = await handleDesignerApiRequest(
        { method: "GET", pathname: "/api/cms/designer", search: "?path=/admin", identity: admin },
        { store },
    );
    assert.equal(protectedPath.status, 400);
});

test("디자이너 API: 저장 → 트리 캡처 → 조회 → 발행 흐름", async () => {
    const store = createMemoryCmsStore();
    const save = await handleDesignerApiRequest(
        {
            method: "POST",
            pathname: "/api/cms/designer",
            identity: admin,
            body: { action: "save_draft", path: "/programs", document: document(), expectedRevision: 0 },
        },
        { store },
    );
    assert.equal(save.status, 200);
    assert.equal(save.body.revision, 1);

    const capture = await handleDesignerApiRequest(
        {
            method: "POST",
            pathname: "/api/cms/designer",
            identity: admin,
            body: {
                action: "capture_tree",
                path: "/programs",
                snapshot: {
                    path: "/programs",
                    viewport: "desktop",
                    nodes: [{ selector: MAIN, tag: "main", label: "본문", children: [{ selector: HEADING, tag: "h2", text: "프로그램", children: [] }] }],
                },
            },
        },
        { store },
    );
    assert.equal(capture.status, 200);
    assert.equal(capture.body.nodeCount, 2);

    const read = await handleDesignerApiRequest(
        { method: "GET", pathname: "/api/cms/designer", search: "?path=/programs", identity: admin },
        { store },
    );
    assert.equal(read.status, 200);
    assert.equal(read.body.revision, 1);
    assert.equal((read.body.tree as { path: string }).path, "/programs");

    const publish = await handleDesignerApiRequest(
        {
            method: "POST",
            pathname: "/api/cms/designer",
            identity: admin,
            body: { action: "publish_draft", path: "/programs", expectedRevision: 1, note: "테스트" },
        },
        { store },
    );
    assert.equal(publish.status, 200);
    assert.equal(publish.body.publishedRevision, 1);
    assert.deepEqual((publish.body.edge as { steps: unknown[] }).steps, []);

    const stale = await handleDesignerApiRequest(
        {
            method: "POST",
            pathname: "/api/cms/designer",
            identity: admin,
            body: { action: "save_draft", path: "/programs", document: document(), expectedRevision: 0 },
        },
        { store },
    );
    assert.equal(stale.status, 409);
    assert.equal(stale.body.currentRevision, 1);
});

test("디자이너 API: patch_element는 안전한 스타일만 반영한다", async () => {
    const store = createMemoryCmsStore();
    await handleDesignerApiRequest(
        {
            method: "POST",
            pathname: "/api/cms/designer",
            identity: admin,
            body: { action: "save_draft", path: "/programs", document: document(), expectedRevision: 0 },
        },
        { store },
    );
    const patched = await handleDesignerApiRequest(
        {
            method: "POST",
            pathname: "/api/cms/designer",
            identity: admin,
            body: {
                action: "patch_element",
                path: "/programs",
                selector: HEADING,
                change: { text: "수정", style: { color: "var(--text-primary)", position: "fixed" } },
            },
        },
        { store },
    );
    assert.equal(patched.status, 200);
    const patch = patched.body.patch as { text: string; style: Record<string, string> };
    assert.equal(patch.text, "수정");
    assert.deepEqual(patch.style, { "font-size": "32px", color: "var(--text-primary)" });
});

test("에지 어댑터: KV 미러·캐시 URL·R2 아카이브", async () => {
    const revision: CmsVisualRevisionRecord = {
        path: "/programs",
        revision: 3,
        publishedRevision: 2,
        document: { schemaVersion: 2, path: "/programs", patches: [], additions: [] },
        checksum: "a".repeat(64),
        publishedAt: "2026-11-11T00:00:00.000Z",
        publishedBy: "admin",
        note: "발행",
    };
    assert.equal(publishedDocumentKey("/programs"), "cms/visual/programs.json");
    assert.deepEqual(edgeCacheUrls("https://renewsejongpac.rhee.life/", "/programs"), [
        "https://renewsejongpac.rhee.life/programs/",
        "https://renewsejongpac.rhee.life/",
    ]);

    const kv = new Map<string, string>();
    const r2 = new Map<string, string>();
    const steps = await mirrorPublishedRevision({
        revision,
        bindings: {
            CMS_CMS_KV: {
                get: async (key) => kv.get(key) ?? null,
                put: async (key, value) => {
                    kv.set(key, value);
                },
                delete: async (key) => {
                    kv.delete(key);
                },
            },
            CMS_CMS_R2: {
                put: async (key, value) => {
                    r2.set(key, String(value));
                },
            },
        },
    });
    assert.deepEqual(steps.map((step) => step.status), ["done", "done"]);
    const stored = await readPublishedRevision(
        {
            CMS_CMS_KV: {
                get: async (key) => kv.get(key) ?? null,
                put: async () => undefined,
                delete: async () => undefined,
            },
        },
        "/programs",
    );
    assert.equal(stored?.publishedRevision, 2);
    assert.ok(r2.has("cms/visual/programs/r2.json"));
});

test("에지 어댑터: 캐시 무효화는 설정·응답을 정직하게 보고한다", async () => {
    const skipped = await purgeCloudflareCache({ baseUrl: "https://example.com" }, ["https://example.com/"]);
    assert.equal(skipped.status, "skipped");

    const ok = await purgeCloudflareCache(
        {
            baseUrl: "https://example.com",
            zoneId: "zone-1",
            apiToken: "token",
            fetchImpl: (async () => new Response(JSON.stringify({ success: true }), { status: 200 })) as typeof fetch,
        },
        ["https://example.com/"],
    );
    assert.equal(ok.status, "done");

    const failed = await purgeCloudflareCache(
        {
            baseUrl: "https://example.com",
            zoneId: "zone-1",
            apiToken: "token",
            fetchImpl: (async () =>
                new Response(JSON.stringify({ success: false, errors: [{ message: "invalid token" }] }), {
                    status: 403,
                })) as typeof fetch,
        },
        ["https://example.com/"],
    );
    assert.equal(failed.status, "failed");
    assert.match(failed.detail, /invalid token/);
});

test("발행 파이프라인: 저장 실패 시 에지 반영을 하지 않고 207로 부분 실패를 알린다", async () => {
    const store = createMemoryCmsStore();
    const missing = await publishDraftToEdge({ store, path: "/programs", expectedRevision: 0, actorId: "tester" });
    assert.equal(missing.ok, false);
    assert.equal(missing.published, null);

    await store.saveVisualDraft({
        path: "/programs",
        document: { schemaVersion: 2, path: "/programs", patches: [], additions: [] },
        expectedRevision: 0,
        actorId: "tester",
    });
    let purged = false;
    const partial = await publishDraftToEdge({
        store,
        path: "/programs",
        expectedRevision: 1,
        actorId: "tester",
        config: {
            baseUrl: "https://renewsejongpac.rhee.life",
            zoneId: "zone-1",
            apiToken: "token",
            fetchImpl: (async () => {
                purged = true;
                return new Response(JSON.stringify({ success: false, errors: [{ message: "quota" }] }), { status: 429 });
            }) as typeof fetch,
        },
    });
    assert.equal(purged, true);
    assert.equal(partial.published?.publishedRevision, 1);
    assert.equal(partial.ok, false);
    assert.equal(partial.edge?.steps.find((step) => step.step === "cache_purge")?.status, "failed");
});
