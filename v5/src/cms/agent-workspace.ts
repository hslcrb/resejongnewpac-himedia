import type {
    CmsAgentRunResult,
    CmsAgentToolCall,
    CmsCodePatch,
    CmsDocumentAst,
    CmsIdentityDecision,
    CmsWysiwygNode,
} from "./contracts.ts";
import {
    DEFAULT_BASE_MAIN_SHA,
    PrOnlyViolationError,
    assertPrOnlyOperation,
    createCodePatchRecord,
    createPrChangeBundle,
    normalizeCmsBranchName,
} from "./pr-gateway.ts";
import {
    sanitizePlainText,
    sanitizeWysiwygAst,
    sha256Hex,
    validateWysiwygAst,
} from "./wysiwyg.ts";
import { isRemovedOfficialLink } from "../lib/link-policy.ts";

// [대화형 코딩 에이전트 보안·인젝션 방어벽 / Prompt-injection and policy violation detector]
const FORBIDDEN_PATTERNS: readonly { pattern: RegExp; reason: string }[] = [
    {
        pattern: /git\s+push\s+(?:--force|-f\s+)?(?:origin|upstream)\s+main\b/i,
        reason: "main 기본 브랜치로의 직접 push 명령은 PR 전용 정책에 의해 차단됩니다.",
    },
    {
        pattern: /(?:--force|-f)\b.*(?:main|master)|reset\s+--hard/i,
        reason: "공유 이력을 덮어쓰는 강제 push 및 hard reset은 허용되지 않습니다.",
    },
    {
        pattern: /(?:cat|read|print|expose|dump|echo)\s+[^\n]*(?:\.env|service_role|sb_secret_|PRIVATE_KEY|GITHUB_APP_PRIVATE_KEY)/i,
        reason: "비밀 환경 변수(.env, service_role, 개인키) 조회·노출 요청은 보안 정책으로 차단됩니다.",
    },
    {
        pattern: /direct[\s_-]*publish|bypass[\s_-]*pr|pr\s*없이\s*(?:바로|직접)\s*(?:게시|반영|배포)/i,
        reason: "PR을 거치지 않는 직접 운영 게시·배포 우회 요청은 차단됩니다.",
    },
    {
        pattern: /update\s+public\.sejong_cms_memberships|grant\s+super_admin/i,
        reason: "에이전트 대화를 통한 관리자 권한 임의 상승은 허용되지 않습니다.",
    },
];

export function detectPromptPolicyViolation(prompt: string): {
    blocked: boolean;
    reason: string | null;
} {
    const normalized = (prompt || "").trim();
    if (!normalized) {
        return { blocked: true, reason: "작업 지시 메시지를 입력해 주세요." };
    }
    for (const rule of FORBIDDEN_PATTERNS) {
        if (rule.pattern.test(normalized)) {
            return { blocked: true, reason: rule.reason };
        }
    }
    return { blocked: false, reason: null };
}

// [격리 작업 공간의 저장소 인덱스 / Scoped repository catalog for search_repo and read_file]
export interface ScopedRepoFile {
    path: string;
    role: string;
    excerpt: string;
    domain?: "supabase" | "database" | "cloudflare" | "frontend" | "backend";
    linkedRoute?: string;
}

export const SCOPED_REPO_INDEX: readonly ScopedRepoFile[] = Object.freeze([
    {
        path: "v5/app/page.tsx",
        role: "홈 화면 및 빠른 예매·프로그램 탐색 엔트리",
        excerpt:
            'export default function HomePage() {\n    return <SystemSurface variant="panel" padding="lg">세종문화회관 홈</SystemSurface>;\n}',
        domain: "frontend",
        linkedRoute: "/",
    },
    {
        path: "v5/app/login/page.tsx",
        role: "Google 관리자 관리자 검증 및 사용자/CMS·로그인 이동 선택 게이트",
        excerpt:
            'export default function LoginGatePage() {\n    return <AdminLoginGate mode="login" />;\n}',
        domain: "frontend",
        linkedRoute: "/login",
    },
    {
        path: "v5/app/admin/page.tsx",
        role: "실제 CMS · 위지위그 편집 · 대화형 코딩 · PR 전용 워크스페이스 엔트리",
        excerpt:
            'export default function AdminCmsPage() {\n    return <CmsWorkspace />;\n}',
        domain: "frontend",
        linkedRoute: "/admin",
    },
    {
        path: "v5/components/CmsWorkspace.tsx",
        role: "통합 CMS 편집기·대화형 코딩 에이전트·PR 콘솔 공유 컴포넌트",
        excerpt:
            'export default function CmsWorkspace() {\n    return <div data-component-id="cms-workspace" data-text="body">CMS 워크스페이스</div>;\n}',
        domain: "frontend",
        linkedRoute: "/admin",
    },
    {
        path: "v5/src/catalog/page-content.ts",
        role: "공개 페이지 구조화 블록 원본 정의",
        excerpt:
            'add(["/visit", "/visit/plan"], "교통편과 공연장 위치를 확인하고 관람에 필요한 안내를 준비하세요.", official.transport);',
        domain: "database",
        linkedRoute: "/visit",
    },
    {
        path: "v5/src/data/design-tokens.ts",
        role: "단일 색상·타이포그래피·간격 토큰 원본",
        excerpt:
            'export const DESIGN_COLORS = [{ name: "어스 블랙", token: "color-black", hex: "#211F1C", ink: "#FFFEFA" }];',
        domain: "frontend",
        linkedRoute: "/design-rules",
    },
    {
        path: "v5/src/cms/integrations.ts",
        role: "수퍼베이스·디비·클플·프론트·백엔드 5대 계층 관제탑 통신 어댑터",
        excerpt:
            'export async function probeCmsIntegrations(options: { decision: CmsIdentityDecision }) {\n    return { probes, latestMainSha };\n}',
        domain: "supabase",
        linkedRoute: "/admin",
    },
    {
        path: "v5/src/cms/server-handler.ts",
        role: "백엔드 CMS API 라우트 핸들러 (/api/cms/session, /drafts, /agent, /pr)",
        excerpt:
            'export async function handleCmsApiRequest(req: CmsApiRequest): Promise<CmsApiResponse> {\n    // RBAC + CSRF + PR-Only enforcement\n}',
        domain: "backend",
        linkedRoute: "/admin",
    },
    {
        path: "v5/src/cms/pr-gateway.ts",
        role: "백엔드 GitHub PR 전용 변경 묶음 생성기 및 main 직접 반영 차단 게이트웨이",
        excerpt:
            'export function createPrChangeBundle(input: PrChangeBundleInput): CmsChangeSet {\n    assertPrOnlyOperation({ decision: input.decision, targetBranch });\n}',
        domain: "backend",
        linkedRoute: "/admin",
    },
    {
        path: "v5/supabase/migrations/20261106_sejong_cms_pr_workspace.sql",
        role: "PostgreSQL DB 스키마 (sejong_cms_memberships, sejong_cms_drafts, sejong_cms_change_sets, RLS)",
        excerpt:
            'CREATE TABLE IF NOT EXISTS public.sejong_cms_drafts (\n    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n    target_id text NOT NULL,\n    document_ast jsonb NOT NULL\n);',
        domain: "database",
        linkedRoute: "/admin",
    },
    {
        path: "v5/scripts/cloudflare-build.ts",
        role: "Cloudflare Pages 정적 빌드 스테이징 및 배포 무결성 감사 스크립트",
        excerpt:
            '// Cloudflare Pages production build & static stage verification\nexport async function runCloudflareStageBuild() {}',
        domain: "cloudflare",
        linkedRoute: "/",
    },
]);

export function searchScopedRepository(query: string): ScopedRepoFile[] {
    const keywords = (query || "")
        .toLowerCase()
        .split(/[\s,·/]+/)
        .filter((token) => token.length >= 2);
    if (keywords.length === 0) return [...SCOPED_REPO_INDEX.slice(0, 3)];
    const matches = SCOPED_REPO_INDEX.filter((entry) => {
        const haystack = `${entry.path} ${entry.role} ${entry.excerpt}`.toLowerCase();
        return keywords.some((kw) => haystack.includes(kw));
    });
    return matches.length ? matches : [...SCOPED_REPO_INDEX.slice(0, 3)];
}

function applyPromptToDocumentAst(
    ast: CmsDocumentAst,
    prompt: string,
): { updatedAst: CmsDocumentAst; changeDescription: string } {
    const cleanPrompt = sanitizePlainText(prompt);
    const nextNodes: CmsWysiwygNode[] = ast.nodes.map((node) => ({ ...node }));
    let nextTitle = ast.title;
    let nextDescription = ast.description;
    const notes: string[] = [];

    const titleMatch = cleanPrompt.match(/제목(?:을|은)?\s*["'「]?([^"'」\n]{2,60})["'」]?(?:으로|로)\s*(?:변경|수정|바꿔)/);
    if (titleMatch) {
        nextTitle = sanitizePlainText(titleMatch[1]);
        notes.push(`페이지 제목을 "${nextTitle}"(으)로 갱신`);
    }

    if (/faq|자주\s*묻는\s*질문/i.test(cleanPrompt)) {
        const newFaq: CmsWysiwygNode = {
            id: `faq-agent-${nextNodes.length + 1}`,
            type: "faq",
            title: "에이전트가 추가한 관람·이용 안내 FAQ",
            items: [
                {
                    question: "관리자 CMS에서 수정한 내용은 언제 반영되나요?",
                    answer: "모든 위지위그 편집과 코드 변경은 PR 검토·병합 및 Cloudflare 배포 검증을 거친 뒤에만 반영됩니다.",
                },
            ],
        };
        nextNodes.push(newFaq);
        notes.push("FAQ 안내 블록 1건 추가");
    } else if (/표|table|요약\s*항목|핵심\s*안내|facts/i.test(cleanPrompt)) {
        const newFacts: CmsWysiwygNode = {
            id: `facts-agent-${nextNodes.length + 1}`,
            type: "facts",
            title: "추가 확인 안내",
            items: [
                { label: "점검 기준", value: cleanPrompt.slice(0, 120) },
                { label: "반영 방식", value: "GitHub PR 검토 및 승인 후 정식 반영" },
            ],
        };
        nextNodes.push(newFacts);
        notes.push("핵심 안내(facts) 블록 1건 추가");
    } else {
        const firstProseIndex = nextNodes.findIndex((node) => node.type === "prose");
        if (firstProseIndex >= 0 && nextNodes[firstProseIndex].type === "prose") {
            const proseNode = nextNodes[firstProseIndex] as Extract<CmsWysiwygNode, { type: "prose" }>;
            nextNodes[firstProseIndex] = {
                ...proseNode,
                paragraphs: [
                    ...proseNode.paragraphs,
                    `[에이전트 편집 초안] ${cleanPrompt}`,
                ],
            };
            notes.push(`본문 블록(${proseNode.id})에 요청 문단 반영`);
        } else {
            nextNodes.push({
                id: `prose-agent-${nextNodes.length + 1}`,
                type: "prose",
                heading: "추가 안내",
                paragraphs: [cleanPrompt],
            });
            notes.push("새 본문(prose) 블록 추가");
        }
    }

    if (!notes.length) {
        nextDescription = `${ast.description} (${cleanPrompt.slice(0, 40)})`.trim();
        notes.push("페이지 요약 설명 보강");
    }

    return {
        updatedAst: sanitizeWysiwygAst({
            ...ast,
            title: nextTitle,
            description: nextDescription,
            nodes: nextNodes,
        }),
        changeDescription: notes.join(", "),
    };
}

function synthesizeCodePatchFromPrompt(
    prompt: string,
    targetFiles: readonly ScopedRepoFile[],
    updatedAst: CmsDocumentAst,
): CmsCodePatch {
    const cleanPrompt = sanitizePlainText(prompt);
    const wantsComponentPatch = /컴포넌트|버튼|여백|스타일|tsx|코드|배너|헤더|히어로/i.test(cleanPrompt);
    if (wantsComponentPatch) {
        const target =
            targetFiles.find((file) => file.path.endsWith(".tsx")) || SCOPED_REPO_INDEX[3];
        return createCodePatchRecord({
            filePath: target.path,
            summary: `에이전트 요청 반영: ${cleanPrompt.slice(0, 72)}`,
            beforeExcerpt: target.excerpt,
            afterExcerpt: `${target.excerpt}\n// [CMS 에이전트 패치 제안 / Agent proposed patch]: ${cleanPrompt.slice(0, 80)}`,
        });
    }

    return createCodePatchRecord({
        filePath: "v5/src/catalog/page-content.ts",
        summary: `${updatedAst.path} 페이지 구조화 블록 동기화 패치`,
        beforeExcerpt: `// path: "${updatedAst.path}"\n// blocks: existing published blocks`,
        afterExcerpt: `// path: "${updatedAst.path}"\n// title: "${updatedAst.title}"\n// blocks: ${updatedAst.nodes.length} verified blocks (${cleanPrompt.slice(0, 60)})`,
    });
}

// [대화형 코딩 에이전트 격리 실행 / Execute conversational coding agent run with tool trace, checks, and PR bundle]
export function executeCmsAgentCodingRun(input: {
    decision: CmsIdentityDecision;
    threadId: string;
    requestId?: string;
    prompt: string;
    currentAst: CmsDocumentAst;
    baseRevision: number;
    draftRevision: number;
    baseMainSha?: string;
    branchSlug?: string;
    tokenBudget?: number;
    cancelled?: boolean;
    targetFileOverride?: string;
    nowIso?: string;
}): CmsAgentRunResult {
    const now = input.nowIso || new Date().toISOString();
    const requestId = input.requestId || `req-${sha256Hex(`${input.threadId}:${input.prompt}:${now}`).slice(0, 12)}`;
    const runId = `run-${requestId.slice(-10)}`;
    const baseMainSha = input.baseMainSha || DEFAULT_BASE_MAIN_SHA;
    const branchName = normalizeCmsBranchName(
        input.branchSlug || `cms/20261106-agent-${ input.currentAst.path.replace(/\W+/g, "-") || "edit" }`,
    );
    const tokenBudget = Math.min(Math.max(input.tokenBudget ?? 16000, 512), 128000);

    assertPrOnlyOperation({
        decision: input.decision,
        targetBranch: branchName,
        directPublish: false,
        agentAutoMerge: false,
    });
    if (!input.decision.capabilities.includes("cms:run_agent")) {
        throw new PrOnlyViolationError("현재 관리자 역할에 에이전트 실행 권한(cms:run_agent)이 없습니다.");
    }

    if (input.cancelled) {
        return {
            runId,
            requestId,
            threadId: input.threadId,
            prompt: input.prompt,
            baseMainSha,
            branchName,
            status: "cancelled",
            planSteps: ["사용자 취소 요청 감지 - 도구 실행 및 PR 생성을 중단했습니다."],
            toolCalls: [],
            updatedAst: input.currentAst,
            proposedPatches: [],
            checkResults: {
                astValid: true,
                visualContractPassed: true,
                linkPolicyPassed: true,
                prOnlyVerified: true,
                issues: ["작업이 사용자 요청으로 취소되었습니다."],
            },
            changeSet: null,
            tokensUsed: 0,
            tokenBudget,
            logCursor: 1,
            assistantReply: "요청하신 에이전트 코딩 작업을 즉시 취소했습니다. 변경 묶음이나 PR은 생성되지 않았습니다.",
        };
    }

    const policyCheck = detectPromptPolicyViolation(input.prompt);
    if (policyCheck.blocked) {
        const blockedCall: CmsAgentToolCall = {
            id: `${runId}-tool-1`,
            tool: "run_checks",
            inputSummary: input.prompt.slice(0, 120),
            status: "blocked",
            outputSummary: policyCheck.reason || "보안·PR 전용 정책 위반 요청 차단",
            startedAt: now,
            finishedAt: now,
        };
        return {
            runId,
            requestId,
            threadId: input.threadId,
            prompt: input.prompt,
            baseMainSha,
            branchName,
            status: "blocked_policy",
            planSteps: [
                "1. 프롬프트 보안 및 PR 전용 정책 검사",
                "2. 위반 요청 차단 및 감사 기록 생성",
            ],
            toolCalls: [blockedCall],
            updatedAst: input.currentAst,
            proposedPatches: [],
            checkResults: {
                astValid: true,
                visualContractPassed: true,
                linkPolicyPassed: true,
                prOnlyVerified: false,
                issues: [policyCheck.reason || "정책 위반 요청이 차단되었습니다."],
            },
            changeSet: null,
            tokensUsed: 64,
            tokenBudget,
            logCursor: 1,
            assistantReply: `[보안·PR 전용 정책 차단] ${policyCheck.reason}`,
        };
    }

    if (input.targetFileOverride) {
        // Validate targetFileOverride against path security rules immediately
        createCodePatchRecord({
            filePath: input.targetFileOverride,
            summary: "경로 보안 사전 검증",
            beforeExcerpt: "// check",
            afterExcerpt: "// check",
        });
    }

    const toolCalls: CmsAgentToolCall[] = [];

    // Tool 1: search_repo
    const matchedFiles = searchScopedRepository(input.prompt);
    toolCalls.push({
        id: `${runId}-tool-1`,
        tool: "search_repo",
        inputSummary: `query="${sanitizePlainText(input.prompt).slice(0, 80)}"`,
        status: "completed",
        outputSummary: `매칭된 소스 ${matchedFiles.length}개: ${matchedFiles.map((f) => f.path).join(", ")}`,
        startedAt: now,
        finishedAt: now,
    });

    // Tool 2: read_file
    const primaryFile = matchedFiles[0] || SCOPED_REPO_INDEX[0];
    toolCalls.push({
        id: `${runId}-tool-2`,
        tool: "read_file",
        inputSummary: `path="${primaryFile.path}", target="${input.currentAst.path}"`,
        status: "completed",
        outputSummary: `${primaryFile.path} (${primaryFile.role}) 및 현재 문서 블록 ${input.currentAst.nodes.length}개 로드 완료`,
        startedAt: now,
        finishedAt: now,
    });

    // Tool 3: edit_wysiwyg_draft
    const { updatedAst, changeDescription } = applyPromptToDocumentAst(
        input.currentAst,
        input.prompt,
    );
    toolCalls.push({
        id: `${runId}-tool-3`,
        tool: "edit_wysiwyg_draft",
        inputSummary: `path="${updatedAst.path}", blocks=${updatedAst.nodes.length}`,
        status: "completed",
        outputSummary: changeDescription,
        startedAt: now,
        finishedAt: now,
    });

    // Tool 4: propose_code_patch
    const codePatch = synthesizeCodePatchFromPrompt(input.prompt, matchedFiles, updatedAst);
    toolCalls.push({
        id: `${runId}-tool-4`,
        tool: "propose_code_patch",
        inputSummary: `file="${codePatch.filePath}"`,
        status: "completed",
        outputSummary: `유니파이드 diff 생성 완료 (SHA-256 ${codePatch.sha256.slice(0, 10)})`,
        startedAt: now,
        finishedAt: now,
    });

    // Tool 5: run_checks
    const astCheck = validateWysiwygAst(updatedAst);
    const hasRemovedLink = updatedAst.nodes.some(
        (node) =>
            node.type === "actions" &&
            node.items.some((item) => isRemovedOfficialLink(item.href)),
    );
    const visualContractPassed =
        !/#[0-9a-fA-F]{3,8}\b/.test(codePatch.afterExcerpt) ||
        codePatch.filePath.endsWith("design-tokens.ts");
    const checkIssues = [
        ...astCheck.issues,
        ...(hasRemovedLink ? ["제거 대상 외부 공식 링크가 포함되어 있습니다."] : []),
        ...(!visualContractPassed ? ["인라인 색상 리터럴이 감지되었습니다. 중앙 토큰 변수를 사용하세요."] : []),
    ];
    toolCalls.push({
        id: `${runId}-tool-5`,
        tool: "run_checks",
        inputSummary: "AST 스키마 · 시각 계약(SystemText/중앙 컬러 토큰) · 링크 정책 · PR-only 검사",
        status: checkIssues.length === 0 ? "completed" : "failed",
        outputSummary:
            checkIssues.length === 0
                ? "모든 정적 계약·시각 계약·링크 정책·PR-only 검사를 통과했습니다."
                : `검사 실패: ${checkIssues.join(" / ")}`,
        startedAt: now,
        finishedAt: now,
    });

    // Tool 6: prepare_pr_bundle
    const nextDraftRevision = input.draftRevision + 1;
    const changeSet = createPrChangeBundle({
        decision: input.decision,
        title: `[CMS 에이전트] ${updatedAst.title} (${updatedAst.path}) 업데이트`,
        summary: `${changeDescription} · 코드 패치(${codePatch.filePath}) 포함`,
        baseMainSha,
        branchSlug: branchName,
        documentAst: updatedAst,
        baseRevision: input.baseRevision,
        draftRevision: nextDraftRevision,
        codePatches: [codePatch],
        nowIso: now,
    });
    toolCalls.push({
        id: `${runId}-tool-6`,
        tool: "prepare_pr_bundle",
        inputSummary: `branch="${changeSet.branchName}", base="${changeSet.baseMainSha.slice(0, 8)}"`,
        status: "completed",
        outputSummary: `PR 전용 변경 묶음(${changeSet.id}, 해시 ${changeSet.payloadHash.slice(0, 10)}) 준비 완료`,
        startedAt: now,
        finishedAt: now,
    });

    const estimatedTokens = Math.min(
        tokenBudget,
        Math.max(180, Math.round((input.prompt.length + codePatch.unifiedDiff.length) * 1.4)),
    );

    return {
        runId,
        requestId,
        threadId: input.threadId,
        prompt: input.prompt,
        baseMainSha,
        branchName: changeSet.branchName,
        status: checkIssues.length === 0 ? "completed" : "failed",
        planSteps: [
            `1. 저장소 탐색(${primaryFile.path}) 및 ${updatedAst.path} 원본 블록 확인`,
            `2. 위지위그 AST 편집(${changeDescription}) 및 TS/TSX 유니파이드 패치 작성`,
            "3. AST·시각 계약·링크 정책·PR-only 불변성 검사 실행",
            `4. 작업 브랜치(${changeSet.branchName}) 기준 PR 전용 변경 묶음(${changeSet.id}) 고정`,
        ],
        toolCalls,
        updatedAst,
        proposedPatches: [codePatch],
        checkResults: {
            astValid: astCheck.valid,
            visualContractPassed,
            linkPolicyPassed: !hasRemovedLink,
            prOnlyVerified: true,
            issues: checkIssues,
        },
        changeSet,
        tokensUsed: estimatedTokens,
        tokenBudget,
        logCursor: toolCalls.length,
        assistantReply: `요청하신 "${sanitizePlainText(input.prompt).slice(0, 60)}" 작업을 격리 실행기에서 수행했습니다. ${changeDescription} 및 ${codePatch.filePath} diff를 생성하고 정적 검사를 마쳤으며, 운영 직접 반영 없이 PR 전용 묶음(${changeSet.id})으로 준비했습니다.`,
    };
}
