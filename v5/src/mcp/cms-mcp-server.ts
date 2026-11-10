// [CMS MCP 서버 / CMS Model Context Protocol server]
// 코딩 에이전트가 JSON-RPC로 사이트 요소와 콘텐츠를 조회·수정·발행합니다.
// 전송 계층(Next.js Route Handler / Node 서버 / Worker)과 분리된 순수 프로토콜 구현입니다.
import type { CmsCapability, CmsAdminRole } from "../cms/contracts.ts";
import type { CmsContentCollection, CmsStore } from "../cms/cms-store.ts";
import { isCmsContentCollection } from "../cms/cms-store.ts";
import { isCmsFailure } from "../cms/cms-store.ts";
import type { CmsEdgeBindings, CmsEdgeConfig } from "../cms/cloudflare-edge-adapter.ts";
import { publishDraftToEdge } from "../cms/cloudflare-edge-adapter.ts";
import type { CmsPageSnapshot } from "../cms/page-tree.ts";
import { findPageNode, pageTreeToOutline } from "../cms/page-tree.ts";
import {
    VISUAL_PRESETS,
    VISUAL_STYLE_FIELDS,
    VISUAL_STYLE_GROUPS,
    addVisualElement,
    countVisualChanges,
    isSafeVisualSelector,
    isSafeVisualUrl,
    normalizeVisualPath,
    removeVisualElement,
    removeVisualStyle,
    sanitizeVisualDocument,
    sanitizeVisualStyle,
    upsertVisualPatch,
    visualDocumentChecksum,
} from "../cms/visual-document.ts";
import type { VisualPresetId, VisualStyleKey } from "../cms/visual-document.ts";

export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const CMS_MCP_SERVER_NAME = "sejong-cms-visual";
export const CMS_MCP_SERVER_VERSION = "1.0.0";
const MAX_BODY_TOKENS = 250_000;

export interface CmsMcpAuthContext {
    subject: string;
    handle: string;
    role: CmsAdminRole | "service";
    capabilities: readonly ("cms:read" | "cms:write_draft" | "cms:create_pr" | "cms:reconcile_release")[];
    transport: "session" | "mcp_token";
}

export interface CmsMcpDeps {
    store: CmsStore;
    edge?: CmsEdgeConfig;
    bindings?: CmsEdgeBindings;
}

export interface McpToolDefinition {
    name: string;
    title: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
}

export interface McpJsonRpcResponse {
    jsonrpc: "2.0";
    id: string | number | null;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
}

export interface McpToolResult {
    content: { type: "text"; text: string }[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
}

class McpToolError extends Error {
    readonly code: number;
    constructor(code: number, message: string) {
        super(message);
        this.code = code;
    }
}

const RESOURCE_SCHEMA_URI = "cms://schema";
const PAGE_TEMPLATE_URI = "cms://pages/{path}";
const DRAFT_TEMPLATE_URI = "cms://drafts/{id}";

const STYLE_KEY_ENUM = VISUAL_STYLE_FIELDS.map((field) => field.key);
const PRESET_ENUM = VISUAL_PRESETS.map((preset) => preset.id);

export const CMS_MCP_TOOLS: readonly McpToolDefinition[] = Object.freeze([
    {
        name: "cms_get_page_tree",
        title: "페이지 트리 조회",
        description:
            "캔버스가 캡처한 실제 페이지의 DOM 트리를 반환합니다. selector·역할·텍스트·주요 스타일을 포함하며, 편집 전 구조 파악에 사용합니다.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "페이지 경로 (예: /, /programs, /about/introduction)" },
                maxDepth: { type: "integer", minimum: 1, maximum: 8, description: "트리 깊이 제한" },
                maxNodes: { type: "integer", minimum: 1, maximum: 900, description: "노드 수 제한" },
                format: { type: "string", enum: ["outline", "json"], description: "outline: 들여쓰기 텍스트, json: 구조화 트리" },
            },
            required: ["path"],
            additionalProperties: false,
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
        name: "cms_read_element",
        title: "요소 읽기",
        description: "선택자(selector)의 페이지 노드 정보와 현재 초안 패치(텍스트·스타일·속성)를 함께 반환합니다.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string" },
                selector: { type: "string", description: "캔버스 선택자 (예: body > main:nth-of-type(1) > section:nth-of-type(2))" },
            },
            required: ["path", "selector"],
            additionalProperties: false,
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
        name: "cms_patch_element",
        title: "요소 수정",
        description:
            "요소의 텍스트·링크·이미지·표시 여부·CSS 스타일을 수정하고 초안 리비전을 올립니다. 허용된 스타일 키만 반영됩니다.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string" },
                selector: { type: "string" },
                text: { type: "string", description: "잎 노드의 텍스트" },
                href: { type: "string", description: "링크 주소(HTTPS 또는 /v5/ 경로)" },
                src: { type: "string", description: "이미지 주소" },
                alt: { type: "string", description: "이미지 대체 텍스트" },
                hidden: { type: "boolean", description: "요소 숨김/다시 표시" },
                style: {
                    type: "object",
                    description: "CSS 스타일 (허용 키: " + STYLE_KEY_ENUM.join(", ") + ")",
                    additionalProperties: { type: "string" },
                },
                removeStyle: { type: "array", items: { type: "string", enum: STYLE_KEY_ENUM }, description: "제거할 스타일 키" },
                expectedRevision: { type: "integer", description: "낙관적 잠금: 현재 서버 리비전" },
            },
            required: ["path", "selector"],
            additionalProperties: false,
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
        name: "cms_add_element",
        title: "요소 삽입",
        description: "부모 선택자 아래에 프리셋 요소(제목·텍스트·버튼·링크·이미지·컨테이너·카드·배너)를 삽입합니다.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string" },
                parentSelector: { type: "string", description: "삽입할 부모 요소 선택자" },
                preset: { type: "string", enum: PRESET_ENUM },
                text: { type: "string" },
                href: { type: "string" },
                src: { type: "string" },
                alt: { type: "string" },
                expectedRevision: { type: "integer" },
            },
            required: ["path", "parentSelector", "preset"],
            additionalProperties: false,
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
        name: "cms_delete_element",
        title: "요소 삭제",
        description: "삽입한 요소는 초안에서 제거하고, 원본 페이지 요소는 숨김 처리합니다(원본 React 코드는 변경하지 않음).",
        inputSchema: {
            type: "object",
            properties: { path: { type: "string" }, selector: { type: "string" }, expectedRevision: { type: "integer" } },
            required: ["path", "selector"],
            additionalProperties: false,
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    {
        name: "cms_publish_draft",
        title: "초안 발행",
        description:
            "현재 초안 리비전을 발행 리비전으로 확정하고 KV/R2 미러와 Cloudflare 캐시 무효화를 수행합니다. 리비전이 다르면 발행하지 않습니다.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string" },
                expectedRevision: { type: "integer" },
                note: { type: "string", description: "발행 메모(감사 로그)" },
            },
            required: ["path", "expectedRevision"],
            additionalProperties: false,
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
        name: "cms_query_content",
        title: "콘텐츠 조회",
        description: "공지·프로그램·페이지·FAQ·배너·미디어 컬렉션의 구조화 콘텐츠를 조회합니다.",
        inputSchema: {
            type: "object",
            properties: {
                collection: { type: "string", enum: ["notices", "programs", "pages", "faq", "banners", "media"] },
                slug: { type: "string" },
                status: { type: "string", enum: ["draft", "published"] },
                limit: { type: "integer", minimum: 1, maximum: 100 },
            },
            required: ["collection"],
            additionalProperties: false,
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
        name: "cms_mutate_content",
        title: "콘텐츠 저장",
        description: "콘텐츠 항목을 생성·수정합니다. mode=patch이면 기존 데이터에 병합합니다.",
        inputSchema: {
            type: "object",
            properties: {
                collection: { type: "string", enum: ["notices", "programs", "pages", "faq", "banners", "media"] },
                slug: { type: "string" },
                data: { type: "object", additionalProperties: true },
                mode: { type: "string", enum: ["upsert", "patch"] },
                status: { type: "string", enum: ["draft", "published"] },
            },
            required: ["collection", "slug", "data"],
            additionalProperties: false,
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
]);

function textResult(payload: Record<string, unknown>, text?: string): McpToolResult {
    return {
        content: [{ type: "text", text: text ?? JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
    };
}

function requireString(args: Record<string, unknown>, key: string): string {
    const value = args[key];
    if (typeof value !== "string" || !value.trim()) throw new McpToolError(-32602, `${key} 문자열 인자가 필요합니다.`);
    return value;
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key];
    return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalInt(args: Record<string, unknown>, key: string): number | undefined {
    const value = args[key];
    if (value === undefined || value === null) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new McpToolError(-32602, `${key}는 정수여야 합니다.`);
    return Math.trunc(parsed);
}

function requirePath(args: Record<string, unknown>): string {
    const path = normalizeVisualPath(requireString(args, "path"));
    if (!path) throw new McpToolError(-32602, "편집 가능한 공개 콘텐츠 경로가 아닙니다.");
    return path;
}

function requireSelector(args: Record<string, unknown>, key = "selector"): string {
    const selector = requireString(args, key);
    if (!isSafeVisualSelector(selector)) throw new McpToolError(-32602, "허용되지 않은 선택자 형식입니다.");
    return selector;
}

function assertCapability(auth: CmsMcpAuthContext, capability: CmsCapability): void {
    if (!auth.capabilities.includes(capability as CmsMcpAuthContext["capabilities"][number])) {
        throw new McpToolError(-32003, `이 도구를 실행하려면 ${capability} 권한이 필요합니다.`);
    }
}

function draftResourceId(path: string, revision: number): string {
    return encodeURIComponent(path) + "@r" + revision;
}

function storeError(message: string, reason: string): never {
    throw new McpToolError(reason === "conflict" ? -32004 : -32005, message);
}

export function createCmsMcpServer(deps: CmsMcpDeps) {
    const loadDraft = async (path: string) => {
        const result = await deps.store.getVisualDocument(path);
        if (isCmsFailure(result)) storeError(result.message, result.reason);
        const base = result.data;
        return {
            record: base,
            document: base?.document || sanitizeVisualDocument({ path }, path),
            revision: base?.revision || 0,
            publishedRevision: base?.publishedRevision || 0,
        };
    };

    const save = async (input: {
        path: string;
        document: Parameters<CmsStore["saveVisualDraft"]>[0]["document"];
        expectedRevision: number | undefined;
        currentRevision: number;
        auth: CmsMcpAuthContext;
    }) => {
        const expectedRevision = input.expectedRevision ?? input.currentRevision;
        if (expectedRevision !== input.currentRevision) {
            throw new McpToolError(
                -32004,
                `낙관적 잠금 실패: 서버 리비전 r${input.currentRevision}, 요청 r${expectedRevision}. 최신 초안을 다시 읽으세요.`,
            );
        }
        const saved = await deps.store.saveVisualDraft({
            path: input.path,
            document: input.document,
            expectedRevision,
            actorId: input.auth.handle || input.auth.subject,
        });
        if (isCmsFailure(saved)) storeError(saved.message, saved.reason);
        return saved.data;
    };

    const tools: Record<string, (args: Record<string, unknown>, auth: CmsMcpAuthContext) => Promise<McpToolResult>> = {
        async cms_get_page_tree(args) {
            const path = requirePath(args);
            const maxDepth = Math.min(Math.max(optionalInt(args, "maxDepth") ?? 4, 1), 8);
            const maxNodes = Math.min(Math.max(optionalInt(args, "maxNodes") ?? 120, 1), 900);
            const snapshot = await deps.store.getPageSnapshot(path);
            if (isCmsFailure(snapshot)) storeError(snapshot.message, snapshot.reason);
            if (!snapshot.data) {
                throw new McpToolError(
                    -32006,
                    `${path} 페이지 트리가 아직 캡처되지 않았습니다. 디자이너의 "트리 동기화"를 한 번 실행하세요.`,
                );
            }
            const changed = await loadDraft(path);
            const outline = pageTreeToOutline(snapshot.data.nodes, { maxDepth, maxNodes });
            const payload = {
                path,
                viewport: snapshot.data.viewport,
                capturedAt: snapshot.data.capturedAt,
                checksum: snapshot.data.checksum,
                nodeCount: snapshot.data.nodeCount,
                revision: changed.revision,
                publishedRevision: changed.publishedRevision,
                changes: countVisualChanges(changed.document),
                outline,
                tree: args.format === "json" ? snapshot.data.nodes : undefined,
            };
            return textResult(payload, `# ${path} 페이지 트리 (${snapshot.data.nodeCount}개 요소, r${changed.revision})\n${outline}`);
        },

        async cms_read_element(args) {
            const path = requirePath(args);
            const selector = requireSelector(args);
            const snapshot = await deps.store.getPageSnapshot(path);
            if (isCmsFailure(snapshot)) storeError(snapshot.message, snapshot.reason);
            const changed = await loadDraft(path);
            const found = snapshot.data ? findPageNode(snapshot.data.nodes, selector) : null;
            const patch = changed.document.patches.find((item) => item.selector === selector) || null;
            if (!found && !patch) {
                throw new McpToolError(-32007, "페이지 트리와 초안에 해당 선택자가 없습니다. cms_get_page_tree로 선택자를 확인하세요.");
            }
            return textResult({
                path,
                selector,
                revision: changed.revision,
                node: found?.node || null,
                depth: found?.depth ?? null,
                patch,
                effective: {
                    text: patch?.text ?? found?.node.text ?? null,
                    style: patch?.style || found?.node.styles || {},
                    hidden: patch?.hidden ?? found?.node.hidden ?? false,
                },
            });
        },

        async cms_patch_element(args, auth) {
            assertCapability(auth, "cms:write_draft");
            const path = requirePath(args);
            const selector = requireSelector(args);
            const changed = await loadDraft(path);
            const change: Parameters<typeof upsertVisualPatch>[2] = {};
            if (typeof args.text === "string") change.text = args.text;
            if (args.href !== undefined) {
                const href = optionalString(args, "href");
                if (href && !isSafeVisualUrl(href)) throw new McpToolError(-32602, "허용되지 않은 링크 주소입니다.");
                if (href) change.href = href;
            }
            if (args.src !== undefined) {
                const src = optionalString(args, "src");
                if (src && !isSafeVisualUrl(src)) throw new McpToolError(-32602, "허용되지 않은 이미지 주소입니다.");
                if (src) change.src = src;
            }
            if (typeof args.alt === "string") change.alt = args.alt;
            if (typeof args.hidden === "boolean") change.hidden = args.hidden;
            if (args.style && typeof args.style === "object" && !Array.isArray(args.style)) {
                const style: Record<string, string> = {};
                for (const [key, value] of Object.entries(args.style as Record<string, unknown>)) {
                    const safe = sanitizeVisualStyle(key, value);
                    if (safe === null) throw new McpToolError(-32602, `허용되지 않은 스타일 값입니다: ${key}=${String(value)}`);
                    style[key] = safe;
                }
                if (Object.keys(style).length) change.style = style as Parameters<typeof upsertVisualPatch>[2]["style"];
            }
            if (Array.isArray(args.removeStyle)) {
                for (const key of args.removeStyle) {
                    if (typeof key !== "string" || !STYLE_KEY_ENUM.includes(key as VisualStyleKey)) continue;
                }
            }
            let document = upsertVisualPatch(changed.document, selector, change);
            if (Array.isArray(args.removeStyle)) {
                for (const key of args.removeStyle) {
                    if (typeof key === "string" && STYLE_KEY_ENUM.includes(key as VisualStyleKey)) {
                        document = removeVisualStyle(document, selector, key as VisualStyleKey);
                    }
                }
            }
            const saved = await save({
                path,
                document,
                expectedRevision: optionalInt(args, "expectedRevision"),
                currentRevision: changed.revision,
                auth,
            });
            const patch = saved.document.patches.find((item) => item.selector === selector) || null;
            return textResult({
                path,
                selector,
                revision: saved.revision,
                checksum: saved.checksum,
                patch,
                message: `${path}의 요소를 수정하고 초안 r${saved.revision}을 저장했습니다.`,
            });
        },

        async cms_add_element(args, auth) {
            assertCapability(auth, "cms:write_draft");
            const path = requirePath(args);
            const parentSelector = requireSelector(args, "parentSelector");
            const preset = requireString(args, "preset");
            if (!PRESET_ENUM.includes(preset as VisualPresetId)) {
                throw new McpToolError(-32602, `지원하지 않는 프리셋입니다: ${preset}`);
            }
            const changed = await loadDraft(path);
            const href = optionalString(args, "href");
            const src = optionalString(args, "src");
            if (href && !isSafeVisualUrl(href)) throw new McpToolError(-32602, "허용되지 않은 링크 주소입니다.");
            if (src && !isSafeVisualUrl(src)) throw new McpToolError(-32602, "허용되지 않은 이미지 주소입니다.");
            const { document, added } = addVisualElement(changed.document, {
                parent: parentSelector,
                preset: preset as VisualPresetId,
                text: optionalString(args, "text"),
                href,
                src,
                alt: optionalString(args, "alt"),
            });
            if (!added) throw new McpToolError(-32602, "요소를 삽입하지 못했습니다. 부모 선택자를 확인하세요.");
            const saved = await save({
                path,
                document,
                expectedRevision: optionalInt(args, "expectedRevision"),
                currentRevision: changed.revision,
                auth,
            });
            return textResult({
                path,
                revision: saved.revision,
                added,
                selector: '[data-cms-added="' + added.id + '"]',
                message: `${parentSelector} 아래에 ${preset} 요소를 삽입했습니다.`,
            });
        },

        async cms_delete_element(args, auth) {
            assertCapability(auth, "cms:write_draft");
            const path = requirePath(args);
            const selector = requireSelector(args);
            const changed = await loadDraft(path);
            const isAdded = selector.startsWith("[data-cms-added=");
            const document = isAdded
                ? removeVisualElement(changed.document, selector)
                : upsertVisualPatch(changed.document, selector, { hidden: true });
            if (isAdded && document.additions.length === changed.document.additions.length) {
                throw new McpToolError(-32007, "삽입 요소를 찾지 못했습니다.");
            }
            const saved = await save({
                path,
                document,
                expectedRevision: optionalInt(args, "expectedRevision"),
                currentRevision: changed.revision,
                auth,
            });
            return textResult({
                path,
                selector,
                revision: saved.revision,
                mode: isAdded ? "removed" : "hidden",
                message: isAdded
                    ? "삽입 요소를 초안에서 제거했습니다."
                    : "원본 요소는 React 코드를 변경하지 않고 숨김 처리했습니다.",
            });
        },

        async cms_publish_draft(args, auth) {
            assertCapability(auth, "cms:reconcile_release");
            const path = requirePath(args);
            const changed = await loadDraft(path);
            if (!changed.record) throw new McpToolError(-32008, "발행할 초안이 없습니다.");
            const expectedRevision = optionalInt(args, "expectedRevision") ?? changed.revision;
            if (expectedRevision !== changed.revision) {
                throw new McpToolError(-32004, `낙관적 잠금 실패: 서버 r${changed.revision}, 요청 r${expectedRevision}.`);
            }
            const result = await publishDraftToEdge({
                store: deps.store,
                path,
                expectedRevision,
                actorId: auth.handle || auth.subject,
                note: optionalString(args, "note"),
                bindings: deps.bindings,
                config: deps.edge,
            });
            if (!result.published) throw new McpToolError(-32009, result.message);
            return textResult({
                path,
                publishedRevision: result.published.publishedRevision,
                revision: result.published.revision,
                checksum: result.published.checksum,
                publishedAt: result.published.publishedAt,
                edge: result.edge,
                message: result.message,
            });
        },

        async cms_query_content(args) {
            const collection = requireString(args, "collection");
            if (!isCmsContentCollection(collection)) throw new McpToolError(-32602, "허용되지 않은 콘텐츠 컬렉션입니다.");
            const result = await deps.store.queryContent({
                collection: collection as CmsContentCollection,
                slug: optionalString(args, "slug"),
                status: args.status === "published" ? "published" : args.status === "draft" ? "draft" : undefined,
                limit: optionalInt(args, "limit"),
            });
            if (isCmsFailure(result)) storeError(result.message, result.reason);
            return textResult({ collection, count: result.data.length, entries: result.data });
        },

        async cms_mutate_content(args, auth) {
            assertCapability(auth, "cms:write_draft");
            const collection = requireString(args, "collection");
            if (!isCmsContentCollection(collection)) throw new McpToolError(-32602, "허용되지 않은 콘텐츠 컬렉션입니다.");
            const slug = requireString(args, "slug");
            if (!/^[a-z0-9][a-z0-9-_.]{0,80}$/i.test(slug)) throw new McpToolError(-32602, "slug 형식이 올바르지 않습니다.");
            const data = args.data;
            if (!data || typeof data !== "object" || Array.isArray(data)) {
                throw new McpToolError(-32602, "data 객체가 필요합니다.");
            }
            const result = await deps.store.mutateContent({
                collection: collection as CmsContentCollection,
                slug,
                data: data as Record<string, unknown>,
                mode: args.mode === "patch" ? "patch" : "upsert",
                status: args.status === "published" ? "published" : args.status === "draft" ? "draft" : undefined,
                actorId: auth.handle || auth.subject,
            });
            if (isCmsFailure(result)) storeError(result.message, result.reason);
            return textResult({ collection, entry: result.data, message: `${collection}/${slug} 콘텐츠를 저장했습니다.` });
        },
    };

    const readResource = async (uri: string): Promise<{ uri: string; mimeType: string; text: string }> => {
        if (uri === RESOURCE_SCHEMA_URI) {
            return {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(
                    {
                        schemaVersion: 2,
                        pagePathPattern: "^/(?:[a-z0-9/_-]*)$",
                        styleFields: VISUAL_STYLE_FIELDS,
                        styleGroups: VISUAL_STYLE_GROUPS,
                        presets: VISUAL_PRESETS.map(({ id, label, tag, description }) => ({ id, label, tag, description })),
                        selectorSyntax: [
                            "body > main:nth-of-type(1) > section:nth-of-type(2)",
                            'body > div:nth-of-type(3) > p:nth-of-type(1)',
                            '[data-cms-added="node-<uuid>"]',
                            '[data-cms-added="node-<uuid>"] > h3:nth-child(1)',
                        ],
                        addTags: ["h1", "h2", "h3", "p", "span", "div", "section", "article", "button", "a", "img", "ul", "li"],
                        limits: { additions: 120, patches: 900, textLength: 10000 },
                        tools: CMS_MCP_TOOLS.map((tool) => tool.name),
                    },
                    null,
                    2,
                ),
            };
        }
        if (uri.startsWith("cms://pages/")) {
            const path = normalizeVisualPath(decodeURIComponent(uri.slice("cms://pages/".length)));
            if (!path) throw new McpToolError(-32602, "리소스 경로가 올바르지 않습니다.");
            const snapshot = await deps.store.getPageSnapshot(path);
            if (isCmsFailure(snapshot)) storeError(snapshot.message, snapshot.reason);
            if (!snapshot.data) throw new McpToolError(-32006, `${path} 트리 스냅샷이 없습니다.`);
            return {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(snapshot.data satisfies CmsPageSnapshot, null, 2),
            };
        }
        if (uri.startsWith("cms://drafts/")) {
            const id = decodeURIComponent(uri.slice("cms://drafts/".length));
            const match = /^(.*)@r(\d+)$/.exec(id);
            if (!match) throw new McpToolError(-32602, "초안 리소스 ID는 <path>@r<revision> 형식입니다.");
            const path = normalizeVisualPath(match[1]);
            if (!path) throw new McpToolError(-32602, "초안 경로가 올바르지 않습니다.");
            const record = await deps.store.getVisualDocument(path);
            if (isCmsFailure(record)) storeError(record.message, record.reason);
            if (!record.data) throw new McpToolError(-32008, "초안이 없습니다.");
            return {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(
                    {
                        id: draftResourceId(path, record.data.revision),
                        path,
                        revision: record.data.revision,
                        publishedRevision: record.data.publishedRevision,
                        checksum: record.data.checksum,
                        document: record.data.document,
                        checksumNow: visualDocumentChecksum(record.data.document),
                    },
                    null,
                    2,
                ),
            };
        }
        throw new McpToolError(-32602, `알 수 없는 리소스 URI입니다: ${uri}`);
    };

    const handle = async (message: unknown, auth: CmsMcpAuthContext): Promise<McpJsonRpcResponse | null> => {
        const raw = JSON.stringify(message ?? null);
        if (raw.length > MAX_BODY_TOKENS) {
            return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "요청 본문이 너무 큽니다." } };
        }
        if (!message || typeof message !== "object" || Array.isArray(message)) {
            return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "JSON-RPC 2.0 객체가 필요합니다." } };
        }
        const request = message as { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
        const id = request.id ?? null;
        if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
            return { jsonrpc: "2.0", id, error: { code: -32600, message: "잘못된 JSON-RPC 요청입니다." } };
        }
        const isNotification = request.id === undefined;
        if (request.method.startsWith("notifications/")) return null;

        try {
            switch (request.method) {
                case "initialize":
                    return {
                        jsonrpc: "2.0",
                        id,
                        result: {
                            protocolVersion:
                                typeof request.params?.protocolVersion === "string" &&
                                request.params.protocolVersion === "2025-06-18"
                                    ? "2024-11-05"
                                    : MCP_PROTOCOL_VERSION,
                            capabilities: {
                                tools: { listChanged: false },
                                resources: { subscribe: false, listChanged: false },
                            },
                            serverInfo: {
                                name: CMS_MCP_SERVER_NAME,
                                version: CMS_MCP_SERVER_VERSION,
                            },
                            instructions:
                                "세종문화회관 v5 CMS 시각 편집 MCP입니다. cms_get_page_tree로 구조를 확인하고, cms_patch_element·cms_add_element로 초안을 수정한 뒤 cms_publish_draft로 발행합니다. 원본 React 소스는 변경되지 않으며 모든 변경은 리비전으로 남습니다.",
                        },
                    };
                case "ping":
                    return { jsonrpc: "2.0", id, result: {} };
                case "tools/list":
                    return { jsonrpc: "2.0", id, result: { tools: CMS_MCP_TOOLS } };
                case "tools/call": {
                    if (!auth.capabilities.includes("cms:read")) {
                        return { jsonrpc: "2.0", id, error: { code: -32003, message: "cms:read 권한이 필요합니다." } };
                    }
                    const name = String(request.params?.name || "");
                    const args = (request.params?.arguments && typeof request.params.arguments === "object"
                        ? request.params.arguments
                        : {}) as Record<string, unknown>;
                    const tool = tools[name];
                    if (!tool) {
                        return { jsonrpc: "2.0", id, error: { code: -32601, message: `알 수 없는 도구입니다: ${name}` } };
                    }
                    try {
                        const result = await tool(args, auth);
                        return { jsonrpc: "2.0", id, result };
                    } catch (error) {
                        if (error instanceof McpToolError) {
                            return {
                                jsonrpc: "2.0",
                                id,
                                result: {
                                    content: [{ type: "text", text: error.message }],
                                    isError: true,
                                } satisfies McpToolResult,
                            } as McpJsonRpcResponse;
                        }
                        throw error;
                    }
                }
                case "resources/list": {
                    if (!auth.capabilities.includes("cms:read")) {
                        return { jsonrpc: "2.0", id, error: { code: -32003, message: "cms:read 권한이 필요합니다." } };
                    }
                    return {
                        jsonrpc: "2.0",
                        id,
                        result: {
                            resources: [
                                {
                                    uri: RESOURCE_SCHEMA_URI,
                                    name: "CMS 비주얼 스키마",
                                    description: "스타일 키·프리셋·선택자 문법·도구 목록",
                                    mimeType: "application/json",
                                },
                            ],
                        },
                    };
                }
                case "resources/templates/list":
                    return {
                        jsonrpc: "2.0",
                        id,
                        result: {
                            resourceTemplates: [
                                {
                                    uriTemplate: PAGE_TEMPLATE_URI,
                                    name: "페이지 트리",
                                    description: "캔버스가 캡처한 페이지 DOM 트리 (path는 /programs 형식)",
                                    mimeType: "application/json",
                                },
                                {
                                    uriTemplate: DRAFT_TEMPLATE_URI,
                                    name: "비주얼 초안",
                                    description: "초안 문서 (id는 encodeURIComponent(path)@r{revision})",
                                    mimeType: "application/json",
                                },
                            ],
                        },
                    };
                case "resources/read": {
                    if (!auth.capabilities.includes("cms:read")) {
                        return { jsonrpc: "2.0", id, error: { code: -32003, message: "cms:read 권한이 필요합니다." } };
                    }
                    const uri = String(request.params?.uri || "");
                    try {
                        const content = await readResource(uri);
                        return { jsonrpc: "2.0", id, result: { contents: [content] } };
                    } catch (error) {
                        if (error instanceof McpToolError) {
                            return { jsonrpc: "2.0", id, error: { code: error.code, message: error.message } };
                        }
                        throw error;
                    }
                }
                default:
                    if (isNotification) return null;
                    return { jsonrpc: "2.0", id, error: { code: -32601, message: `지원하지 않는 메서드입니다: ${request.method}` } };
            }
        } catch (error) {
            return {
                jsonrpc: "2.0",
                id,
                error: {
                    code: -32603,
                    message: error instanceof Error ? error.message : "내부 오류가 발생했습니다.",
                },
            };
        }
    };

    return {
        handle,
        listTools: () => CMS_MCP_TOOLS,
        listResources: () => [RESOURCE_SCHEMA_URI, PAGE_TEMPLATE_URI, DRAFT_TEMPLATE_URI],
        draftResourceId,
        storeKind: deps.store.kind,
    };
}

export type CmsMcpServer = ReturnType<typeof createCmsMcpServer>;

// [HTTP 전송 계층 공통 처리 / Shared HTTP transport helper]
// Next.js Route Handler와 Node 서버가 같은 규칙(JSON-RPC 단건/배치, 202 알림)을 사용합니다.
export async function handleMcpHttpBody(
    server: CmsMcpServer,
    auth: CmsMcpAuthContext,
    body: unknown,
): Promise<{ status: number; payload: unknown | null }> {
    if (Array.isArray(body)) {
        if (!body.length) {
            return { status: 400, payload: { jsonrpc: "2.0", id: null, error: { code: -32600, message: "빈 배치 요청입니다." } } };
        }
        const responses = [];
        for (const item of body.slice(0, 20)) {
            const response = await server.handle(item, auth);
            if (response) responses.push(response);
        }
        return { status: responses.length ? 200 : 202, payload: responses.length ? responses : null };
    }
    const response = await server.handle(body, auth);
    return { status: response ? 200 : 202, payload: response };
}

