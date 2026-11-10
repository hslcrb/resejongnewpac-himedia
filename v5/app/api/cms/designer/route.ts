import { NextResponse } from "next/server";
import { cmsDesignerEnv, cmsEdgeConfig, createCmsStore, readCmsEnv } from "../../../../src/cms/cms-runtime.ts";
import { handleDesignerApiRequest } from "../../../../src/cms/designer-api.ts";
import { resolveCmsRouteAuth } from "../../../../src/cms/route-auth.ts";

// [CMS 디자이너 API / CMS designer API]
// GET  /api/cms/designer?path=/programs   → 초안·발행 리비전·페이지 트리
// POST /api/cms/designer { action: save_draft | publish_draft | capture_tree | patch_element }
// 주의: v5는 output: 'export' 정적 빌드이므로 이 라우트는 Node 서버(next dev / next start / scripts/cms-server.ts)에서만 동작합니다.
export const runtime = "nodejs";

const MAX_BODY_BYTES = 300_000;

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
    const text = await request.text();
    if (!text) return null;
    if (text.length > MAX_BODY_BYTES) throw new Error("요청 본문이 너무 큽니다(300KB 제한).");
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
}

async function dispatch(request: Request): Promise<NextResponse> {
    const env = readCmsEnv();
    const designer = cmsDesignerEnv();
    const auth = await resolveCmsRouteAuth(request.headers, {
        supabaseUrl: env.supabaseUrl,
        anonKey: env.anonKey,
        mcpAccessToken: env.mcpAccessToken,
    });
    const { store } = createCmsStore(env, auth.source === "supabase_session" ? auth.bearer : null);
    const url = new URL(request.url);
    let body: Record<string, unknown> | null = null;
    if (request.method === "POST") {
        try {
            body = await readJson(request);
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : "본문을 읽지 못했습니다.", code: "BODY_INVALID" },
                { status: 413, headers: { "Cache-Control": "no-store" } },
            );
        }
    }
    const result = await handleDesignerApiRequest(
        {
            method: request.method,
            pathname: url.pathname,
            search: url.search,
            origin: request.headers.get("origin") || undefined,
            csrfToken: request.headers.get("x-cms-csrf") || undefined,
            identity: auth.identity,
            body,
        },
        {
            store,
            edge: cmsEdgeConfig(env),
            allowedOrigin: designer.allowedOrigin,
            requireCsrf: designer.requireCsrf,
        },
    );
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export async function GET(request: Request): Promise<NextResponse> {
    return dispatch(request);
}

export async function POST(request: Request): Promise<NextResponse> {
    return dispatch(request);
}

export async function OPTIONS(request: Request): Promise<NextResponse> {
    return dispatch(request);
}
