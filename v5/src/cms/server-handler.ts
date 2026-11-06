import { verifyAdminIdentity } from "./auth.ts";
import type { CmsDocumentAst, CmsIdentityVerificationInput } from "./contracts.ts";
import { executeCmsAgentCodingRun } from "./agent-workspace.ts";
import {
    PrOnlyViolationError,
    createPrChangeBundle,
    reconcileMergedPrRelease,
} from "./pr-gateway.ts";
import { probeCmsIntegrations } from "./integrations.ts";

export interface CmsApiRequest {
    method: string;
    pathname: string;
    origin?: string;
    csrfToken?: string;
    identity?: CmsIdentityVerificationInput | null;
    body?: Record<string, unknown> | null;
}

export interface CmsApiResponse {
    status: number;
    headers: Record<string, string>;
    body: Record<string, unknown>;
}

function buildHeaders(origin = "", allowedOrigin = ""): Record<string, string> {
    return {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...(origin && allowedOrigin && origin === allowedOrigin
            ? {
                  "Access-Control-Allow-Origin": origin,
                  "Access-Control-Allow-Headers": "authorization, content-type, x-cms-csrf",
                  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                  Vary: "Origin",
              }
            : {}),
    };
}

// [서버 측 관리자 CMS · 코딩 에이전트 · PR 브로커 핸들러 / Server-side handler for CMS, coding agent, and PR broker]
export async function handleCmsApiRequest(
    request: CmsApiRequest,
    options: { allowedOrigin?: string; requireCsrf?: boolean } = {},
): Promise<CmsApiResponse> {
    const allowedOrigin = options.allowedOrigin || "";
    const origin = request.origin || "";
    const headers = buildHeaders(origin, allowedOrigin);

    if (allowedOrigin && origin && origin !== allowedOrigin) {
        return {
            status: 403,
            headers,
            body: { error: "허용되지 않은 Origin 요청입니다.", code: "ORIGIN_FORBIDDEN" },
        };
    }

    if (request.method === "OPTIONS") {
        return { status: 204, headers, body: {} };
    }

    const decision = verifyAdminIdentity(request.identity);
    if (!decision.isAuthenticated) {
        return {
            status: 401,
            headers,
            body: {
                error: decision.message,
                reasonCode: decision.reasonCode,
                decision,
            },
        };
    }
    if (!decision.isAdmin) {
        return {
            status: 403,
            headers,
            body: {
                error: decision.message,
                reasonCode: decision.reasonCode,
                decision,
            },
        };
    }

    if (
        request.method === "POST" &&
        options.requireCsrf &&
        (!request.csrfToken || request.csrfToken.trim().length < 8)
    ) {
        return {
            status: 403,
            headers,
            body: { error: "CSRF 검증 토큰(x-cms-csrf)이 누락되었습니다.", code: "CSRF_REQUIRED" },
        };
    }

    try {
        if (request.pathname === "/api/cms/session" && request.method === "GET") {
            return {
                status: decision.statusCode,
                headers,
                body: { decision },
            };
        }

        if (decision.statusCode === 423) {
            return {
                status: 423,
                headers,
                body: {
                    error: decision.message,
                    reasonCode: decision.reasonCode,
                    decision,
                },
            };
        }

        if (request.pathname === "/api/cms/integrations" && request.method === "GET") {
            const status = await probeCmsIntegrations({ decision });
            return { status: 200, headers, body: status };
        }

        if (request.pathname === "/api/cms/agent/run" && request.method === "POST") {
            const body = request.body || {};
            const result = executeCmsAgentCodingRun({
                decision,
                threadId: String(body.threadId || "thread-default"),
                prompt: String(body.prompt || ""),
                currentAst: body.currentAst as CmsDocumentAst,
                baseRevision: Number(body.baseRevision || 1),
                draftRevision: Number(body.draftRevision || 1),
                baseMainSha: typeof body.baseMainSha === "string" ? body.baseMainSha : undefined,
                branchSlug: typeof body.branchSlug === "string" ? body.branchSlug : undefined,
                cancelled: Boolean(body.cancelled),
                targetFileOverride:
                    typeof body.targetFileOverride === "string" ? body.targetFileOverride : undefined,
            });
            return {
                status: result.status === "blocked_policy" ? 422 : 200,
                headers,
                body: { result },
            };
        }

        if (request.pathname === "/api/cms/pr" && request.method === "POST") {
            const body = request.body || {};
            if (body.directPublish === true || body.targetBranch === "main") {
                throw new PrOnlyViolationError(
                    "CMS API는 main 직접 푸시나 직접 DB 게시를 허용하지 않습니다. 오직 PR만 생성할 수 있습니다.",
                );
            }
            const changeSet = createPrChangeBundle({
                decision,
                title: String(body.title || "CMS 변경 요청"),
                summary: String(body.summary || ""),
                baseMainSha: typeof body.baseMainSha === "string" ? body.baseMainSha : undefined,
                branchSlug: String(body.branchSlug || "cms/20261106-update"),
                documentAst: body.documentAst as CmsDocumentAst,
                baseRevision: Number(body.baseRevision || 1),
                draftRevision: Number(body.draftRevision || 1),
            });
            return {
                status: 200,
                headers,
                body: {
                    changeSet: {
                        ...changeSet,
                        prState: "pr_open",
                        prUrl: changeSet.compareUrl,
                    },
                },
            };
        }

        if (request.pathname === "/api/cms/release/reconcile" && request.method === "POST") {
            const body = request.body || {};
            const published = reconcileMergedPrRelease({
                changeSet: body.changeSet as Parameters<typeof reconcileMergedPrRelease>[0]["changeSet"],
                githubPr: body.githubPr as Parameters<typeof reconcileMergedPrRelease>[0]["githubPr"],
                currentLiveRevision: Number(body.currentLiveRevision || 1),
                verifiedPayloadHash: String(body.verifiedPayloadHash || ""),
                cloudflareDeployment: body.cloudflareDeployment as Parameters<
                    typeof reconcileMergedPrRelease
                >[0]["cloudflareDeployment"],
            });
            return { status: 200, headers, body: { changeSet: published } };
        }

        return {
            status: 404,
            headers,
            body: { error: `알 수 없는 CMS API 경로입니다: ${request.pathname}` },
        };
    } catch (error) {
        const isPrViolation = error instanceof PrOnlyViolationError;
        return {
            status: isPrViolation ? 403 : 400,
            headers,
            body: {
                error: error instanceof Error ? error.message : "요청 처리에 실패했습니다.",
                code: isPrViolation ? error.code : "BAD_REQUEST",
            },
        };
    }
}
