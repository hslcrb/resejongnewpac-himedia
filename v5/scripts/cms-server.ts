import { createServer } from "node:http";
import { handleCmsApiRequest } from "../src/cms/server-handler.ts";
import type { CmsIdentityVerificationInput } from "../src/cms/contracts.ts";
import { cmsEdgeConfig, createCmsStore, readCmsEnv } from "../src/cms/cms-runtime.ts";
import { handleDesignerApiRequest } from "../src/cms/designer-api.ts";
import { resolveCmsRouteAuth } from "../src/cms/route-auth.ts";
import { createCmsMcpServer, handleMcpHttpBody } from "../src/mcp/cms-mcp-server.ts";

const port = Number(process.env.CMS_PORT || 8788);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "";
const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(
    /\/$/,
    "",
);
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

async function resolveBearerIdentity(
    authHeader: string | undefined,
    sessionLockedHeader: string | undefined,
): Promise<CmsIdentityVerificationInput | null> {
    if (!supaUrl || !anonKey || !authHeader?.startsWith("Bearer ")) return null;
    const response = await fetch(`${supaUrl}/auth/v1/user`, {
        headers: {
            authorization: authHeader,
            apikey: anonKey,
        },
        signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const user = (await response.json()) as {
        id?: string;
        email?: string;
        email_confirmed_at?: string;
        app_metadata?: { provider?: string };
        identities?: {
            provider: string;
            id?: string;
            user_id?: string;
            identity_data?: Record<string, unknown>;
        }[];
        user_metadata?: Record<string, unknown>;
    };
    if (!user?.id) return null;
    return {
        userId: user.id,
        email: user.email || null,
        emailVerified: Boolean(user.email_confirmed_at),
        appProvider: user.app_metadata?.provider || null,
        identities: user.identities || [],
        userMetadata: user.user_metadata || null,
        sessionLocked: sessionLockedHeader === "true",
    };
}

if (process.argv[1] && process.argv[1].endsWith("cms-server.ts")) {
    createServer(async (req, res) => {
        let raw = "";
        for await (const chunk of req) {
            raw += chunk.toString("utf8");
            if (raw.length > 250_000) {
                res.writeHead(413, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ error: "요청 본문이 너무 큽니다." }));
                return;
            }
        }
        const parsedBody = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
        const identity = await resolveBearerIdentity(
            req.headers.authorization,
            String(req.headers["x-cms-session-locked"] || ""),
        );
        const url = new URL(req.url || "/", "http://127.0.0.1");

        // [시각 디자이너 · MCP 엔드포인트 / Visual designer and MCP endpoints]
        if (url.pathname === "/api/cms/designer" || url.pathname === "/api/cms/mcp") {
            const headers = new Headers(req.headers as Record<string, string>);
            const env = readCmsEnv();
            const auth = await resolveCmsRouteAuth(headers, {
                supabaseUrl: env.supabaseUrl,
                anonKey: env.anonKey,
                mcpAccessToken: env.mcpAccessToken,
            });
            const { store } = createCmsStore(env, auth.source === "supabase_session" ? auth.bearer : null);
            if (url.pathname === "/api/cms/mcp") {
                if (req.method === "GET") {
                    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
                    res.end(JSON.stringify({
                        server: "sejong-cms-visual",
                        transport: "http-json-rpc",
                        tools: createCmsMcpServer({ store }).listTools().map((tool) => tool.name),
                    }));
                    return;
                }
                if (!auth.mcp) {
                    res.writeHead(401, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
                    res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "MCP 인증이 필요합니다." } }));
                    return;
                }
                const server = createCmsMcpServer({ store, edge: cmsEdgeConfig(env) });
                const response = await handleMcpHttpBody(server, auth.mcp, parsedBody);
                res.writeHead(response.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
                res.end(response.payload === null ? undefined : JSON.stringify(response.payload));
                return;
            }
            const result = await handleDesignerApiRequest(
                {
                    method: req.method || "GET",
                    pathname: url.pathname,
                    search: url.search,
                    origin: req.headers.origin,
                    csrfToken: String(req.headers["x-cms-csrf"] || ""),
                    identity: auth.identity,
                    body: parsedBody,
                },
                { store, edge: cmsEdgeConfig(env), requireCsrf: process.env.CMS_REQUIRE_CSRF !== "false" },
            );
            res.writeHead(result.status, result.headers);
            res.end(JSON.stringify(result.body));
            return;
        }

        const result = await handleCmsApiRequest(
            {
                method: req.method || "GET",
                pathname: url.pathname,
                origin: req.headers.origin,
                csrfToken: String(req.headers["x-cms-csrf"] || ""),
                identity,
                body: parsedBody,
            },
            { allowedOrigin },
        );
        res.writeHead(result.status, result.headers);
        res.end(result.status === 204 ? undefined : JSON.stringify(result.body));
    }).listen(port, "0.0.0.0", () => {
        console.log(`Sejong CMS & Agent server listening on ${port}`);
    });
}
