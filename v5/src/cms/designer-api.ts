// [CMS 디자이너 API 핸들러 / CMS designer API handler]
// Next.js Route Handler와 독립 Node 서버(scripts/cms-server.ts)가 함께 사용하는 순수 핸들러입니다.
// 인증·CSRF·Origin 검증을 통과한 요청만 저장소에 접근하며, 실패 사유를 그대로 반환합니다.
import type { CmsIdentityDecision } from "./contracts.ts";
import type { CmsStore } from "./cms-store.ts";
import { isCmsFailure } from "./cms-store.ts";
import type { CmsEdgeBindings, CmsEdgeConfig } from "./cloudflare-edge-adapter.ts";
import { publishDraftToEdge } from "./cloudflare-edge-adapter.ts";
import { sanitizePageSnapshot } from "./page-tree.ts";
import type { VisualElementPatch } from "./visual-document.ts";
import {
    normalizeVisualPath,
    sanitizeVisualDocument,
    sanitizeVisualStyle,
    upsertVisualPatch,
} from "./visual-document.ts";

export interface CmsDesignerApiRequest {
    method: string;
    pathname: string;
    search?: string;
    origin?: string;
    csrfToken?: string;
    identity?: CmsIdentityDecision | null;
    body?: Record<string, unknown> | null;
}

export interface CmsDesignerApiResponse {
    status: number;
    headers: Record<string, string>;
    body: Record<string, unknown>;
}

export interface CmsDesignerApiDeps {
    store: CmsStore;
    edge?: CmsEdgeConfig;
    bindings?: CmsEdgeBindings;
    allowedOrigin?: string;
    requireCsrf?: boolean;
}

function headers(): Record<string, string> {
    return {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-CMS-Store": "cms",
    };
}

function deny(identity: CmsIdentityDecision | null | undefined, capability: string): CmsDesignerApiResponse | null {
    if (!identity || !identity.isAuthenticated) {
        return {
            status: 401,
            headers: headers(),
            body: { error: identity?.message || "관리자 세션이 필요합니다.", code: "UNAUTHENTICATED" },
        };
    }
    if (!identity.isAdmin) {
        return {
            status: 403,
            headers: headers(),
            body: { error: identity.message || "CMS 관리자 권한이 없습니다.", code: "FORBIDDEN" },
        };
    }
    if (identity.statusCode === 423) {
        return {
            status: 423,
            headers: headers(),
            body: { error: identity.message || "록로그인 잠금 상태입니다.", code: "SESSION_LOCKED" },
        };
    }
    if (!identity.capabilities.includes(capability as CmsIdentityDecision["capabilities"][number])) {
        return {
            status: 403,
            headers: headers(),
            body: { error: `이 요청에는 ${capability} 권한이 필요합니다.`, code: "CAPABILITY_REQUIRED" },
        };
    }
    return null;
}

function readPath(source: Record<string, unknown> | URLSearchParams | undefined): string | null {
    const raw = source instanceof URLSearchParams ? source.get("path") : source ? source.path : undefined;
    if (typeof raw !== "string" || !raw.trim()) return null;
    return normalizeVisualPath(raw);
}

// [디자이너 API 라우팅 / Designer API routing]
export async function handleDesignerApiRequest(
    request: CmsDesignerApiRequest,
    deps: CmsDesignerApiDeps,
): Promise<CmsDesignerApiResponse> {
    const base = headers();
    if (deps.allowedOrigin && request.origin && request.origin !== deps.allowedOrigin) {
        return { status: 403, headers: base, body: { error: "허용되지 않은 Origin 요청입니다.", code: "ORIGIN_FORBIDDEN" } };
    }
    if (request.method === "OPTIONS") {
        return {
            status: 204,
            headers: {
                ...base,
                "Access-Control-Allow-Origin": deps.allowedOrigin || "same-origin",
                "Access-Control-Allow-Headers": "authorization, content-type, x-cms-csrf",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                Vary: "Origin",
            },
            body: {},
        };
    }

    const search = new URLSearchParams(request.search || "");
    const body = request.body || {};

    if (request.method === "GET") {
        const blocked = deny(request.identity, "cms:read");
        if (blocked) return blocked;
        const path = readPath(search);
        if (!path) {
            return { status: 400, headers: base, body: { error: "편집 가능한 path 쿼리가 필요합니다.", code: "PATH_REQUIRED" } };
        }
        const [draft, revisions, snapshot] = await Promise.all([
            deps.store.getVisualDocument(path),
            deps.store.listVisualRevisions(path, 10),
            deps.store.getPageSnapshot(path),
        ]);
        if (isCmsFailure(draft)) return { status: 503, headers: base, body: { error: draft.message, code: "STORE_UNAVAILABLE" } };
        return {
            status: 200,
            headers: base,
            body: {
                path,
                store: deps.store.kind,
                revision: draft.data?.revision || 0,
                publishedRevision: draft.data?.publishedRevision || 0,
                checksum: draft.data?.checksum || "",
                document: draft.data?.document || sanitizeVisualDocument({ path }, path),
                revisions: !isCmsFailure(revisions) ? revisions.data : [],
                revisionsError: !isCmsFailure(revisions) ? null : revisions.message,
                tree: !isCmsFailure(snapshot) ? snapshot.data : null,
                treeError: !isCmsFailure(snapshot) ? null : snapshot.message,
            },
        };
    }

    if (request.method !== "POST") {
        return { status: 405, headers: base, body: { error: "지원하지 않는 메서드입니다.", code: "METHOD_NOT_ALLOWED" } };
    }

    if (deps.requireCsrf && (!request.csrfToken || request.csrfToken.trim().length < 8)) {
        return { status: 403, headers: base, body: { error: "CSRF 검증 토큰(x-cms-csrf)이 필요합니다.", code: "CSRF_REQUIRED" } };
    }

    const action = String(body.action || "");
    const capability = action === "publish_draft" ? "cms:reconcile_release" : "cms:write_draft";
    const blocked = deny(request.identity, capability);
    if (blocked) return blocked;
    const actorId = request.identity?.googleSubject || request.identity?.accountHandle || "unknown";

    if (action === "save_draft") {
        const path = readPath(body);
        if (!path) return { status: 400, headers: base, body: { error: "편집 가능한 path가 필요합니다.", code: "PATH_REQUIRED" } };
        const saved = await deps.store.saveVisualDraft({
            path,
            document: body.document as never,
            expectedRevision: Number(body.expectedRevision) || 0,
            actorId,
        });
        if (isCmsFailure(saved)) {
            return {
                status: saved.reason === "conflict" ? 409 : saved.reason === "invalid" ? 422 : 503,
                headers: base,
                body: { error: saved.message, code: saved.reason.toUpperCase(), currentRevision: saved.currentRevision ?? null },
            };
        }
        return {
            status: 200,
            headers: base,
            body: {
                path,
                revision: saved.data.revision,
                checksum: saved.data.checksum,
                updatedAt: saved.data.updatedAt,
                store: deps.store.kind,
                message: `초안 r${saved.data.revision}을 ${deps.store.kind === "supabase" ? "Supabase DB" : "세션 메모리"}에 저장했습니다.`,
            },
        };
    }

    if (action === "publish_draft") {
        const path = readPath(body);
        if (!path) return { status: 400, headers: base, body: { error: "편집 가능한 path가 필요합니다.", code: "PATH_REQUIRED" } };
        const result = await publishDraftToEdge({
            store: deps.store,
            path,
            expectedRevision: Number(body.expectedRevision) || 0,
            actorId,
            note: typeof body.note === "string" ? body.note : undefined,
            bindings: deps.bindings,
            config: deps.edge,
        });
        if (!result.published) {
            return { status: 409, headers: base, body: { error: result.message, code: "PUBLISH_REJECTED" } };
        }
        return {
            status: result.ok ? 200 : 207,
            headers: base,
            body: {
                path,
                publishedRevision: result.published.publishedRevision,
                revision: result.published.revision,
                checksum: result.published.checksum,
                publishedAt: result.published.publishedAt,
                message: result.message,
                edge: result.edge,
            },
        };
    }

    if (action === "capture_tree") {
        const path = readPath(body);
        if (!path) return { status: 400, headers: base, body: { error: "편집 가능한 path가 필요합니다.", code: "PATH_REQUIRED" } };
        let snapshot;
        try {
            snapshot = sanitizePageSnapshot(body.snapshot, path);
        } catch (error) {
            return {
                status: 422,
                headers: base,
                body: { error: error instanceof Error ? error.message : String(error), code: "TREE_INVALID" },
            };
        }
        const saved = await deps.store.savePageSnapshot({ snapshot, actorId });
        if (isCmsFailure(saved)) {
            return { status: 503, headers: base, body: { error: saved.message, code: "STORE_UNAVAILABLE" } };
        }
        return {
            status: 200,
            headers: base,
            body: {
                path,
                nodeCount: saved.data.nodeCount,
                checksum: saved.data.checksum,
                capturedAt: saved.data.capturedAt,
                message: `페이지 트리 ${saved.data.nodeCount}개 요소를 저장했습니다.`,
            },
        };
    }

    if (action === "patch_element") {
        const path = readPath(body);
        if (!path) return { status: 400, headers: base, body: { error: "편집 가능한 path가 필요합니다.", code: "PATH_REQUIRED" } };
        const selector = typeof body.selector === "string" ? body.selector : "";
        const changeRaw = body.change && typeof body.change === "object" ? (body.change as Record<string, unknown>) : {};
        const current = await deps.store.getVisualDocument(path);
        if (isCmsFailure(current)) return { status: 503, headers: base, body: { error: current.message, code: "STORE_UNAVAILABLE" } };
        const baseDocument = current.data?.document || sanitizeVisualDocument({ path }, path);
        const change: Omit<VisualElementPatch, "selector"> = {};
        if (typeof changeRaw.text === "string") change.text = changeRaw.text;
        if (typeof changeRaw.href === "string") change.href = changeRaw.href;
        if (typeof changeRaw.src === "string") change.src = changeRaw.src;
        if (typeof changeRaw.alt === "string") change.alt = changeRaw.alt;
        if (typeof changeRaw.hidden === "boolean") change.hidden = changeRaw.hidden;
        if (changeRaw.style && typeof changeRaw.style === "object") {
            const style: Record<string, string> = {};
            for (const [key, value] of Object.entries(changeRaw.style as Record<string, unknown>)) {
                const safe = sanitizeVisualStyle(key, value);
                if (safe !== null) style[key] = safe;
            }
            if (Object.keys(style).length) change.style = style as VisualElementPatch["style"];
        }
        const next = upsertVisualPatch(baseDocument, selector, change);
        const saved = await deps.store.saveVisualDraft({
            path,
            document: next,
            expectedRevision: current.data?.revision || 0,
            actorId,
        });
        if (isCmsFailure(saved)) {
            return {
                status: saved.reason === "conflict" ? 409 : 503,
                headers: base,
                body: { error: saved.message, code: saved.reason.toUpperCase() },
            };
        }
        return {
            status: 200,
            headers: base,
            body: { path, revision: saved.data.revision, patch: next.patches.find((item) => item.selector === selector) || null },
        };
    }

    return { status: 400, headers: base, body: { error: "알 수 없는 action입니다.", code: "UNKNOWN_ACTION", actions: ["save_draft", "publish_draft", "capture_tree", "patch_element"] } };
}
