import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryCmsStore } from "../src/cms/cms-store.ts";
import { sanitizePageSnapshot } from "../src/cms/page-tree.ts";
import {
    CMS_MCP_TOOLS,
    MCP_PROTOCOL_VERSION,
    createCmsMcpServer,
    handleMcpHttpBody,
} from "../src/mcp/cms-mcp-server.ts";
import type { CmsMcpAuthContext } from "../src/mcp/cms-mcp-server.ts";

const MAIN = "body > main:nth-of-type(1)";
const HEADING = "body > main:nth-of-type(1) > h2:nth-of-type(1)";

const adminAuth: CmsMcpAuthContext = {
    subject: "mcp-service",
    handle: "mcp-service",
    role: "service",
    capabilities: ["cms:read", "cms:write_draft", "cms:create_pr", "cms:reconcile_release"],
    transport: "mcp_token",
};
const readOnlyAuth: CmsMcpAuthContext = {
    subject: "readonly",
    handle: "reviewer",
    role: "reviewer",
    capabilities: ["cms:read"],
    transport: "session",
};

async function buildServer() {
    const store = createMemoryCmsStore();
    const snapshot = sanitizePageSnapshot(
        {
            schemaVersion: 1,
            path: "/programs",
            url: "/programs/",
            viewport: "desktop",
            nodes: [
                {
                    selector: MAIN,
                    tag: "main",
                    label: "프로그램 본문",
                    children: [
                        { selector: HEADING, tag: "h2", text: "프로그램 안내", children: [] },
                        {
                            selector: "body > main:nth-of-type(1) > p:nth-of-type(1)",
                            tag: "p",
                            text: "관람 안내 문단",
                            children: [],
                        },
                    ],
                },
            ],
        },
        "/programs",
    );
    await store.savePageSnapshot({ snapshot, actorId: "seed" });
    return { store, server: createCmsMcpServer({ store }) };
}

async function callTool(
    server: ReturnType<typeof createCmsMcpServer>,
    auth: CmsMcpAuthContext,
    name: string,
    args: Record<string, unknown>,
) {
    const response = await server.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, auth);
    assert.ok(response);
    return response!.result as {
        content: { type: string; text: string }[];
        structuredContent?: Record<string, unknown>;
        isError?: boolean;
    };
}

test("MCP initialize와 tools/list가 표준 도구 8종을 노출한다", async () => {
    const { server } = await buildServer();
    const init = await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: MCP_PROTOCOL_VERSION } }, adminAuth);
    const initResult = init!.result as { protocolVersion: string; serverInfo: { name: string }; capabilities: Record<string, unknown> };
    assert.equal(initResult.protocolVersion, "2024-11-05");
    assert.equal(initResult.serverInfo.name, "sejong-cms-visual");
    assert.ok(initResult.capabilities.tools);

    const list = await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" }, adminAuth);
    const tools = (list!.result as { tools: { name: string }[] }).tools;
    assert.deepEqual(
        tools.map((tool) => tool.name),
        [
            "cms_get_page_tree",
            "cms_read_element",
            "cms_patch_element",
            "cms_add_element",
            "cms_delete_element",
            "cms_publish_draft",
            "cms_query_content",
            "cms_mutate_content",
        ],
    );
    assert.equal(CMS_MCP_TOOLS.length, 8);
});

test("초기화 알림은 응답하지 않고, HTTP 계층은 202를 돌려준다", async () => {
    const { server } = await buildServer();
    const notification = await server.handle({ jsonrpc: "2.0", method: "notifications/initialized" }, adminAuth);
    assert.equal(notification, null);
    const http = await handleMcpHttpBody(server, adminAuth, { jsonrpc: "2.0", method: "notifications/initialized" });
    assert.equal(http.status, 202);
    assert.equal(http.payload, null);
});

test("페이지 트리 조회·요소 읽기", async () => {
    const { server } = await buildServer();
    const tree = await callTool(server, adminAuth, "cms_get_page_tree", { path: "/programs" });
    assert.equal(tree.isError, undefined);
    assert.match(tree.content[0].text, /프로그램 안내/);
    assert.equal(tree.structuredContent?.nodeCount, 3);

    const element = await callTool(server, adminAuth, "cms_read_element", { path: "/programs", selector: HEADING });
    const structured = element.structuredContent as { node: { text: string }; effective: { text: string } };
    assert.equal(structured.node.text, "프로그램 안내");
    assert.equal(structured.effective.text, "프로그램 안내");
});

test("요소 수정은 리비전을 올리고 낙관적 잠금을 지킨다", async () => {
    const { server, store } = await buildServer();
    const patched = await callTool(server, adminAuth, "cms_patch_element", {
        path: "/programs",
        selector: HEADING,
        text: "2027 프로그램",
        style: { "font-size": "40px", color: "var(--text-primary)" },
    });
    assert.equal(patched.isError, undefined);
    assert.equal(patched.structuredContent?.revision, 1);
    const record = await store.getVisualDocument("/programs");
    assert.equal(record.ok && record.data?.revision, 1);
    assert.equal(record.ok && record.data?.document.patches[0].style?.["font-size"], "40px");

    const conflict = await callTool(server, adminAuth, "cms_patch_element", {
        path: "/programs",
        selector: HEADING,
        text: "덮어쓰기",
        expectedRevision: 0,
    });
    assert.equal(conflict.isError, true);
    assert.match(conflict.content[0].text, /낙관적 잠금 실패/);

    const after = await store.getVisualDocument("/programs");
    assert.equal(after.ok && after.data?.revision, 1);
    assert.equal(after.ok && after.data?.document.patches[0].text, "2027 프로그램");
});

test("허용되지 않은 스타일은 도구 오류로 거부된다", async () => {
    const { server } = await buildServer();
    const invalid = await callTool(server, adminAuth, "cms_patch_element", {
        path: "/programs",
        selector: HEADING,
        style: { position: "fixed" },
    });
    assert.equal(invalid.isError, true);
    assert.match(invalid.content[0].text, /허용되지 않은 스타일/);
});

test("요소 삽입·자식 수정·삭제 사이클", async () => {
    const { server, store } = await buildServer();
    const added = await callTool(server, adminAuth, "cms_add_element", {
        path: "/programs",
        parentSelector: MAIN,
        preset: "card",
        text: "여름 프로그램",
    });
    assert.equal(added.isError, undefined);
    const addedElement = added.structuredContent?.added as { id: string; children: unknown[] };
    assert.ok(addedElement.id);
    assert.equal(addedElement.children.length, 2);

    const childSelector = `[data-cms-added="${addedElement.id}"] > h3:nth-child(1)`;
    const childPatch = await callTool(server, adminAuth, "cms_patch_element", {
        path: "/programs",
        selector: childSelector,
        text: "새 카드 제목",
    });
    assert.equal(childPatch.isError, undefined);
    assert.equal(childPatch.structuredContent?.revision, 2);

    const removed = await callTool(server, adminAuth, "cms_delete_element", {
        path: "/programs",
        selector: `[data-cms-added="${addedElement.id}"]`,
    });
    assert.equal(removed.structuredContent?.mode, "removed");
    const record = await store.getVisualDocument("/programs");
    assert.equal(record.ok && record.data?.document.additions.length, 0);
    assert.equal(record.ok && record.data?.document.patches.length, 0);
});

test("발행은 권한·리비전을 확인하고 발행 리비전을 확정한다", async () => {
    const { server, store } = await buildServer();
    await callTool(server, adminAuth, "cms_patch_element", { path: "/programs", selector: HEADING, text: "발행 대상" });

    const denied = await callTool(server, readOnlyAuth, "cms_publish_draft", { path: "/programs", expectedRevision: 1 });
    assert.equal(denied.isError, true);
    assert.match(denied.content[0].text, /cms:reconcile_release/);

    const published = await callTool(server, adminAuth, "cms_publish_draft", {
        path: "/programs",
        expectedRevision: 1,
        note: "테스트 발행",
    });
    assert.equal(published.isError, undefined);
    assert.equal(published.structuredContent?.publishedRevision, 1);
    const record = await store.getVisualDocument("/programs");
    assert.equal(record.ok && record.data?.publishedRevision, 1);
    const revisions = await store.listVisualRevisions("/programs");
    assert.equal(revisions.ok && revisions.data.length, 1);
});

test("콘텐츠 조회·저장 도구", async () => {
    const { server } = await buildServer();
    const saved = await callTool(server, adminAuth, "cms_mutate_content", {
        collection: "notices",
        slug: "2026-11-notice",
        data: { title: "11월 공지", body: "본문" },
    });
    assert.equal(saved.isError, undefined);
    const queried = await callTool(server, adminAuth, "cms_query_content", { collection: "notices" });
    assert.equal(queried.structuredContent?.count, 1);

    const invalidCollection = await callTool(server, adminAuth, "cms_query_content", { collection: "users" });
    assert.equal(invalidCollection.isError, true);
});

test("리소스: 스키마·페이지 트리·초안", async () => {
    const { server } = await buildServer();
    await callTool(server, adminAuth, "cms_patch_element", { path: "/programs", selector: HEADING, text: "리소스 확인" });

    const schema = await server.handle({ jsonrpc: "2.0", id: 3, method: "resources/read", params: { uri: "cms://schema" } }, adminAuth);
    const schemaContent = (schema!.result as { contents: { text: string }[] }).contents[0];
    const schemaJson = JSON.parse(schemaContent.text) as { presets: { id: string }[]; tools: string[] };
    assert.equal(schemaJson.presets.length, 8);
    assert.equal(schemaJson.tools.length, 8);

    const page = await server.handle({ jsonrpc: "2.0", id: 4, method: "resources/read", params: { uri: "cms://pages/programs" } }, adminAuth);
    const pageContent = JSON.parse((page!.result as { contents: { text: string }[] }).contents[0].text) as { path: string; nodeCount: number };
    assert.equal(pageContent.path, "/programs");
    assert.equal(pageContent.nodeCount, 3);

    const draft = await server.handle(
        { jsonrpc: "2.0", id: 5, method: "resources/read", params: { uri: `cms://drafts/${encodeURIComponent("/programs")}@r1` } },
        adminAuth,
    );
    const draftContent = JSON.parse((draft!.result as { contents: { text: string }[] }).contents[0].text) as { revision: number; document: { patches: unknown[] } };
    assert.equal(draftContent.revision, 1);
    assert.equal(draftContent.document.patches.length, 1);
});

test("권한이 없는 도구 호출은 오류로 응답한다", async () => {
    const { server } = await buildServer();
    const denied = await callTool(server, readOnlyAuth, "cms_patch_element", { path: "/programs", selector: HEADING, text: "무단" });
    assert.equal(denied.isError, true);
    assert.match(denied.content[0].text, /cms:write_draft/);

    const unknown = await server.handle({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "cms_drop_table", arguments: {} } }, adminAuth);
    assert.equal((unknown!.error as { code: number }).code, -32601);
});

test("잘못된 JSON-RPC 요청은 -32600으로 응답한다", async () => {
    const { server } = await buildServer();
    const bad = await server.handle({ id: 1, method: "tools/list" }, adminAuth);
    assert.equal((bad!.error as { code: number }).code, -32600);
    const notObject = await server.handle("hello", adminAuth);
    assert.equal((notObject!.error as { code: number }).code, -32600);
});
