import { NextResponse } from "next/server";
import { cmsEdgeConfig, createCmsStore, readCmsEnv } from "../../../../src/cms/cms-runtime.ts";
import { resolveCmsRouteAuth } from "../../../../src/cms/route-auth.ts";
import {
    CMS_MCP_SERVER_NAME,
    CMS_MCP_SERVER_VERSION,
    CMS_MCP_TOOLS,
    MCP_PROTOCOL_VERSION,
    createCmsMcpServer,
    handleMcpHttpBody,
} from "../../../../src/mcp/cms-mcp-server.ts";

// [CMS MCP 엔드포인트 / CMS MCP endpoint] JSON-RPC 2.0 over HTTP
// Claude Code · Codex · Cursor 등에서 { "url": ".../api/cms/mcp", "headers": { "Authorization": "Bearer $CMS_MCP_ACCESS_TOKEN" } }로 등록합니다.
// 주의: v5는 output: 'export' 정적 빌드이므로 이 라우트는 Node 서버(next dev / next start / scripts/cms-server.ts)에서만 동작합니다.
export const runtime = "nodejs";

const MAX_BODY_BYTES = 400_000;

function jsonError(message: string, status: number): NextResponse {
    return NextResponse.json(
        { jsonrpc: "2.0", id: null, error: { code: status === 401 ? -32001 : -32600, message } },
        { status, headers: { "Cache-Control": "no-store" } },
    );
}

export async function GET(): Promise<NextResponse> {
    return NextResponse.json(
        {
            server: CMS_MCP_SERVER_NAME,
            version: CMS_MCP_SERVER_VERSION,
            protocolVersion: MCP_PROTOCOL_VERSION,
            transport: "http-json-rpc",
            tools: CMS_MCP_TOOLS.map((tool) => tool.name),
            note: "POST JSON-RPC 2.0 요청과 Authorization: Bearer 토큰이 필요합니다.",
        },
        { headers: { "Cache-Control": "no-store" } },
    );
}

export async function POST(request: Request): Promise<NextResponse> {
    const env = readCmsEnv();
    const auth = await resolveCmsRouteAuth(request.headers, {
        supabaseUrl: env.supabaseUrl,
        anonKey: env.anonKey,
        mcpAccessToken: env.mcpAccessToken,
    });
    if (!auth.mcp) {
        return jsonError(
            env.mcpAccessToken
                ? "유효한 MCP 서비스 토큰 또는 활성 CMS 관리자 세션이 필요합니다."
                : "CMS_MCP_ACCESS_TOKEN 또는 활성 CMS 관리자 세션이 필요합니다.",
            401,
        );
    }
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return jsonError("요청 본문이 너무 큽니다(400KB 제한).", 413);
    let body: unknown;
    try {
        body = JSON.parse(text);
    } catch {
        return jsonError("JSON 본문을 해석하지 못했습니다.", 400);
    }
    const { store } = createCmsStore(env, auth.source === "supabase_session" ? auth.bearer : null);
    const server = createCmsMcpServer({ store, edge: cmsEdgeConfig(env) });
    const response = await handleMcpHttpBody(server, auth.mcp, body);
    if (response.payload === null) return new NextResponse(null, { status: response.status });
    return NextResponse.json(response.payload, {
        status: response.status,
        headers: { "Cache-Control": "no-store" },
    });
}

export async function OPTIONS(): Promise<NextResponse> {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Headers": "authorization, content-type",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Max-Age": "600",
            Vary: "Origin",
        },
    });
}
