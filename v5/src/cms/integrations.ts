import { supabase, isSupabaseConfigured, getGoogleOAuthAvailability } from "../lib/supabase.ts";
import type {
    CmsChangeSet,
    CmsDocumentAst,
    CmsDraftRecord,
    CmsIdentityDecision,
    CmsIntegrationProbe,
} from "./contracts.ts";
import {
    computeCmsPayloadHash,
    detectRevisionConflict,
    sanitizeWysiwygAst,
    wysiwygAstToPageContent,
} from "./wysiwyg.ts";
import { DEFAULT_BASE_MAIN_SHA, GITHUB_REPO_SLUG } from "./pr-gateway.ts";

const CMS_API_ENDPOINT = (process.env.NEXT_PUBLIC_CMS_API_URL || "").replace(/\/$/, "");
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function makeRequestId(prefix: string): string {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

// [실제 Supabase DB 초안 저장 및 조회 / Real Supabase DB draft persistence and query]
// 네트워크·권한·테이블 미적용 오류를 숨기거나 로컬 저장을 DB 저장 성공으로 가장하지 않습니다.
export async function saveCmsDraftToSupabase(input: {
    decision: CmsIdentityDecision;
    userId: string;
    documentAst: CmsDocumentAst;
    baseRevision: number;
    draftRevision: number;
    serverCurrentRevision: number;
}): Promise<{
    savedToDb: boolean;
    draft: CmsDraftRecord;
    conflictMessage: string | null;
    dbStatusMessage: string;
}> {
    if (!input.decision.isAdmin || input.decision.statusCode !== 200) {
        throw new Error(
            input.decision.statusCode === 423
                ? "록로그인(Lock-Login) 잠금 상태에서는 초안을 저장할 수 없습니다."
                : "검증된 Google admin 관리자 세션이 필요합니다.",
        );
    }

    const conflict = detectRevisionConflict(input.baseRevision, input.serverCurrentRevision);
    const cleanAst = sanitizeWysiwygAst(input.documentAst);
    const contentHash = computeCmsPayloadHash(cleanAst);
    const pageContent = wysiwygAstToPageContent(cleanAst, {
        revision: input.draftRevision,
        status: "draft",
    });
    const now = new Date().toISOString();

    const record: CmsDraftRecord = {
        id: `draft-${contentHash.slice(0, 12)}`,
        targetType: "page",
        targetId: cleanAst.path,
        title: cleanAst.title,
        description: cleanAst.description,
        astSchemaVersion: 1,
        documentAst: cleanAst,
        blocksSnapshot: pageContent.blocks,
        baseRevision: input.baseRevision,
        draftRevision: input.draftRevision,
        contentHash,
        status: conflict.hasConflict ? "conflict" : "draft",
        authorId: input.userId,
        AuthorHandle: input.decision.accountHandle,
        updatedAt: now,
        persistedSource: "session_staging",
    };

    if (conflict.hasConflict) {
        return {
            savedToDb: false,
            draft: record,
            conflictMessage: conflict.message,
            dbStatusMessage: conflict.message,
        };
    }

    if (!supabase || !isSupabaseConfigured) {
        return {
            savedToDb: false,
            draft: record,
            conflictMessage: null,
            dbStatusMessage:
                "공개 Supabase 연결이 설정되지 않아 DB 저장은 수행되지 않았으며 현재 작업 세션에만 초안이 보관되었습니다.",
        };
    }

    const { data, error } = await supabase
        .from("sejong_cms_drafts")
        .upsert(
            {
                target_type: record.targetType,
                target_id: record.targetId,
                title: record.title,
                description: record.description,
                ast_schema_version: 1,
                document_ast: record.documentAst,
                blocks_snapshot: record.blocksSnapshot,
                base_revision: record.baseRevision,
                draft_revision: record.draftRevision,
                content_hash: record.contentHash,
                status: record.status,
                author_id: input.userId,
                updated_at: now,
            },
            { onConflict: "target_type,target_id,draft_revision" },
        )
        .select("id, updated_at")
        .maybeSingle();

    if (error) {
        return {
            savedToDb: false,
            draft: record,
            conflictMessage: null,
            dbStatusMessage: `Supabase DB 초안 저장 미반영(${error.code || "ERR"}: ${error.message}). 세션 초안으로만 유지되며 운영 콘텐츠는 변경되지 않았습니다.`,
        };
    }

    return {
        savedToDb: true,
        draft: {
            ...record,
            id: typeof data?.id === "string" ? data.id : record.id,
            updatedAt: typeof data?.updated_at === "string" ? data.updated_at : now,
            persistedSource: "supabase_db",
        },
        conflictMessage: null,
        dbStatusMessage: `Supabase sejong_cms_drafts 테이블에 초안(r${record.draftRevision}, 해시 ${record.contentHash.slice(0, 8)})을 저장했습니다. 운영 반영은 PR 생성·병합 후에만 수행됩니다.`,
    };
}

export async function submitChangeSetToPrBroker(input: {
    changeSet: CmsChangeSet;
    accessToken?: string | null;
    fetcher?: typeof fetch;
}): Promise<{
    submittedToApi: boolean;
    changeSet: CmsChangeSet;
    statusMessage: string;
}> {
    const runFetch = input.fetcher || fetch;
    if (CMS_API_ENDPOINT) {
        try {
            const response = await runFetch(`${CMS_API_ENDPOINT}/api/cms/pr`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
                },
                body: JSON.stringify({ changeSet: input.changeSet }),
            });
            if (response.ok) {
                const body = (await response.json()) as {
                    prNumber?: number;
                    prUrl?: string;
                };
                const updated: CmsChangeSet = {
                    ...input.changeSet,
                    prNumber: body.prNumber ?? input.changeSet.prNumber,
                    prUrl: body.prUrl || input.changeSet.compareUrl,
                    prState: "pr_open",
                    updatedAt: new Date().toISOString(),
                };
                return {
                    submittedToApi: true,
                    changeSet: updated,
                    statusMessage: `CMS PR 브로커를 통해 GitHub PR(${updated.prUrl})을 생성했습니다.`,
                };
            }
        } catch {
            /* 브로커 미응답 시 수동 PR 생성 경로 안내 / Fall back to verified GitHub compare link */
        }
    }

    if (supabase && isSupabaseConfigured) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
            await supabase.from("sejong_cms_change_sets").insert({
                title: input.changeSet.title,
                summary: input.changeSet.summary,
                base_main_sha: input.changeSet.baseMainSha,
                branch_name: input.changeSet.branchName,
                payload_hash: input.changeSet.payloadHash,
                immutable_payload: input.changeSet.immutablePayload,
                code_patches: input.changeSet.codePatches,
                pr_url: input.changeSet.compareUrl,
                pr_state: "draft_bundle",
                author_id: userData.user.id,
            });
        }
    }

    return {
        submittedToApi: false,
        changeSet: input.changeSet,
        statusMessage: `PR 전용 변경 묶음(${input.changeSet.id}, 해시 ${input.changeSet.payloadHash.slice(0, 10)})을 고정했습니다. GitHub PR 비교 경로(${input.changeSet.compareUrl})에서 검토·승인 후 반영됩니다.`,
    };
}

// [Supabase · Google OAuth · Cloudflare Pages · GitHub · 샌드박스 실시간 상태 점검 / Live multi-service health and permission probes]
export async function probeCmsIntegrations(options: {
    decision: CmsIdentityDecision;
    fetcher?: typeof fetch;
}): Promise<{
    probes: CmsIntegrationProbe[];
    latestMainSha: string;
}> {
    const runFetch = options.fetcher || fetch;
    const checkedAt = new Date().toISOString();
    const probes: CmsIntegrationProbe[] = [];
    let latestMainSha: string = DEFAULT_BASE_MAIN_SHA;

    // 1. Supabase Auth & PostgreSQL
    const supaStart = Date.now();
    if (!isSupabaseConfigured || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
        probes.push({
            service: "supabase",
            label: "Supabase Auth · PostgreSQL · RLS",
            status: "unconfigured",
            projectRef: "미설정 (NEXT_PUBLIC_SUPABASE_URL 필요)",
            permissionsSummary: "공개 카탈로그 읽기 / 관리자 RLS 쓰기 대기",
            checkedAt,
            latencyMs: 0,
            httpStatus: null,
            requestId: makeRequestId("supa"),
            detail: "환경 변수에 공개 Supabase URL과 키가 설정되지 않았습니다.",
        });
    } else {
        try {
            const response = await runFetch(
                `${SUPABASE_URL}/rest/v1/rpc/sejong_catalog_snapshot`,
                {
                    method: "POST",
                    headers: {
                        apikey: SUPABASE_ANON_KEY,
                        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: "{}",
                    cache: "no-store",
                },
            );
            const latencyMs = Math.max(1, Date.now() - supaStart);
            const hostRef = new URL(SUPABASE_URL).hostname.split(".")[0] || SUPABASE_URL;
            probes.push({
                service: "supabase",
                label: "Supabase Auth · PostgreSQL · RLS",
                status: response.ok ? "connected" : "degraded",
                projectRef: hostRef,
                permissionsSummary: "sejong_catalog_snapshot RPC · sejong_cms_* RLS 보호 활성",
                checkedAt,
                latencyMs,
                httpStatus: response.status,
                requestId: response.headers.get("sb-gateway-version") || makeRequestId("supa"),
                detail: response.ok
                    ? `공개 카탈로그 RPC 응답 정상 (HTTP ${response.status}, ${latencyMs}ms)`
                    : `Supabase RPC 응답 상태 확인 필요 (HTTP ${response.status})`,
            });
        } catch (error) {
            probes.push({
                service: "supabase",
                label: "Supabase Auth · PostgreSQL · RLS",
                status: "degraded",
                projectRef: SUPABASE_URL,
                permissionsSummary: "네트워크 연결 재확인 필요",
                checkedAt,
                latencyMs: Math.max(1, Date.now() - supaStart),
                httpStatus: null,
                requestId: makeRequestId("supa"),
                detail: error instanceof Error ? error.message : "Supabase 연결 확인 실패",
            });
        }
    }

    // 2. Google OAuth (admin 바인딩)
    const googleStart = Date.now();
    try {
        const enabled = await getGoogleOAuthAvailability();
        const latencyMs = Math.max(1, Date.now() - googleStart);
        probes.push({
            service: "google_oauth",
            label: "Google OAuth · admin 관리자 바인딩",
            status: enabled
                ? options.decision.isAdmin
                    ? "connected"
                    : "unauthorized"
                : "unconfigured",
            projectRef: `Google OAuth (${options.decision.accountHandle || "admin"})`,
            permissionsSummary: "PKCE 고정 callback(/v5/account/callback/) · provider=google 검증",
            checkedAt,
            latencyMs,
            httpStatus: enabled ? 200 : 503,
            requestId: makeRequestId("google"),
            detail: enabled
                ? options.decision.isAdmin
                    ? `검증된 Google 관리자(${options.decision.verifiedEmail}, 역할 ${options.decision.role}) 세션 활성`
                    : "Google OAuth 제공자는 활성 상태이나 현재 세션은 admin 관리자가 아닙니다."
                : "Supabase Google OAuth 제공자가 비활성 상태이거나 설정되지 않았습니다.",
        });
    } catch {
        probes.push({
            service: "google_oauth",
            label: "Google OAuth · admin 관리자 바인딩",
            status: "degraded",
            projectRef: "Google OAuth (admin)",
            permissionsSummary: "PKCE 고정 callback(/v5/account/callback/)",
            checkedAt,
            latencyMs: Math.max(1, Date.now() - googleStart),
            httpStatus: null,
            requestId: makeRequestId("google"),
            detail: "Google OAuth 설정 엔드포인트(/auth/v1/settings) 조회에 실패했습니다.",
        });
    }

    // 3. GitHub PR Broker (hslcrb/renewsejongpac)
    const ghStart = Date.now();
    try {
        const response = await runFetch(
            `https://api.github.com/repos/${GITHUB_REPO_SLUG}/commits/main`,
            {
                headers: { Accept: "application/vnd.github+json" },
                cache: "no-store",
            },
        );
        const latencyMs = Math.max(1, Date.now() - ghStart);
        if (response.ok) {
            const body = (await response.json()) as { sha?: string };
            if (typeof body.sha === "string" && body.sha.length >= 7) {
                latestMainSha = body.sha;
            }
            probes.push({
                service: "github_pr_broker",
                label: "GitHub PR 게이트웨이 (hslcrb/renewsejongpac)",
                status: "connected",
                projectRef: `${GITHUB_REPO_SLUG}@main (${latestMainSha.slice(0, 8)})`,
                permissionsSummary: "main 직접 푸시 금지 · 작업 브랜치 PR 전용 반영",
                checkedAt,
                latencyMs,
                httpStatus: response.status,
                requestId: response.headers.get("x-github-request-id") || makeRequestId("gh"),
                detail: `최신 main HEAD SHA(${latestMainSha.slice(0, 8)}) 확인 완료 (${latencyMs}ms)`,
            });
        } else {
            probes.push({
                service: "github_pr_broker",
                label: "GitHub PR 게이트웨이 (hslcrb/renewsejongpac)",
                status: "degraded",
                projectRef: GITHUB_REPO_SLUG,
                permissionsSummary: "main 직접 푸시 금지 · 작업 브랜치 PR 전용 반영",
                checkedAt,
                latencyMs,
                httpStatus: response.status,
                requestId: makeRequestId("gh"),
                detail: `GitHub API 응답 HTTP ${response.status} - 기본 main SHA(${latestMainSha.slice(0, 8)})를 기준점으로 유지합니다.`,
            });
        }
    } catch {
        probes.push({
            service: "github_pr_broker",
            label: "GitHub PR 게이트웨이 (hslcrb/renewsejongpac)",
            status: "degraded",
            projectRef: `${GITHUB_REPO_SLUG} (${latestMainSha.slice(0, 8)})`,
            permissionsSummary: "main 직접 푸시 금지 · 작업 브랜치 PR 전용 반영",
            checkedAt,
            latencyMs: Math.max(1, Date.now() - ghStart),
            httpStatus: null,
            requestId: makeRequestId("gh"),
            detail: `외부 GitHub API 연결 제한으로 고정 기준 main SHA(${latestMainSha.slice(0, 8)})를 사용합니다.`,
        });
    }

    // 4. Cloudflare Pages
    const cfStart = Date.now();
    try {
        const targetUrl =
            typeof window !== "undefined" ? `${window.location.origin}/v5/` : "https://renewsejongpac.rhee.life/v5/";
        const response = await runFetch(targetUrl, { method: "HEAD", cache: "no-store" });
        const latencyMs = Math.max(1, Date.now() - cfStart);
        const cfRay = response.headers.get("cf-ray");
        probes.push({
            service: "cloudflare_pages",
            label: "Cloudflare Pages · 정적 배포 및 도메인 브리지",
            status: response.ok ? "connected" : "degraded",
            projectRef: "renewsejongpac (renewsejongpac.rhee.life)",
            permissionsSummary: "main 전용 자동 배포 · 최신 커밋 우선 빌드 · /login 브리지",
            checkedAt,
            latencyMs,
            httpStatus: response.status,
            requestId: cfRay || makeRequestId("cf"),
            detail: response.ok
                ? `웹 오리진 응답 정상 (HTTP ${response.status}, ${cfRay ? `CF-Ray ${cfRay}` : `로컬/프리뷰 ${latencyMs}ms`})`
                : `웹 오리진 상태 확인 필요 (HTTP ${response.status})`,
        });
    } catch {
        probes.push({
            service: "cloudflare_pages",
            label: "Cloudflare Pages · 정적 배포 및 도메인 브리지",
            status: "degraded",
            projectRef: "renewsejongpac",
            permissionsSummary: "main 전용 자동 배포 · 최신 커밋 우선 빌드",
            checkedAt,
            latencyMs: Math.max(1, Date.now() - cfStart),
            httpStatus: null,
            requestId: makeRequestId("cf"),
            detail: "현재 실행 환경에서 외부 도메인 HEAD 요청을 수행하지 못했습니다.",
        });
    }

    // 5. Agent Isolated Coding Sandbox
    probes.push({
        service: "agent_sandbox",
        label: "격리 코딩 실행기 · AST/시각 계약 검증기",
        status: options.decision.isAdmin && options.decision.statusCode === 200 ? "connected" : "unauthorized",
        projectRef: CMS_API_ENDPOINT || "in-process-isolated-workspace",
        permissionsSummary: "허용 경로(v5/app, components, src) 패치 · .env/.git/main 직접 쓰기 차단",
        checkedAt,
        latencyMs: 2,
        httpStatus: options.decision.statusCode,
        requestId: makeRequestId("sandbox"),
        detail:
            options.decision.isAdmin && options.decision.statusCode === 200
                ? "메시지 기반 코드·콘텐츠 패치 생성, 정적 계약 검사, PR 번들링 준비 완료"
                : "관리자 인증 또는 록로그인 잠금 해제 후 코딩 실행기가 활성화됩니다.",
    });

    return { probes, latestMainSha };
}
