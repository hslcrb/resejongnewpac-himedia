import type {
    CmsChangeSet,
    CmsCodePatch,
    CmsDocumentAst,
    CmsIdentityDecision,
} from "./contracts.ts";
import {
    computeCmsPayloadHash,
    sanitizePlainText,
    sanitizeWysiwygAst,
    sha256Hex,
    validateWysiwygAst,
    wysiwygAstToPageContent,
} from "./wysiwyg.ts";

export const GITHUB_REPO_SLUG = "hslcrb/renewsejongpac" as const;
export const DEFAULT_BASE_MAIN_SHA = "0fe3f9800f89115859e763c95282708b3de3de36" as const;

export class PrOnlyViolationError extends Error {
    readonly code = "PR_ONLY_REQUIRED" as const;
    constructor(message: string) {
        super(message);
        this.name = "PrOnlyViolationError";
    }
}

export function normalizeCmsBranchName(rawSlug: string): string {
    const cleaned = (rawSlug || "")
        .trim()
        .toLowerCase()
        .replace(/^refs\/heads\//, "")
        .replace(/[^a-z0-9/_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-/]+|[-/]+$/g, "");
    if (!cleaned || cleaned === "main" || cleaned === "master") {
        throw new PrOnlyViolationError(
            "기본 브랜치(main/master)에는 직접 커밋하거나 푸시할 수 없습니다. 전용 작업 브랜치와 PR만 허용됩니다.",
        );
    }
    if (/^(?:cms|feat|fix|docs|refactor)\/[a-z0-9._-]+$/.test(cleaned)) {
        return cleaned;
    }
    const slug = cleaned.replace(/\//g, "-").slice(0, 48) || "content-update";
    return `cms/20261106-${slug}`;
}

// [PR-only 강제 검증 / Enforce PR-only policy across code, content, and agent actions]
export function assertPrOnlyOperation(options: {
    decision: CmsIdentityDecision;
    targetBranch: string;
    directPublish?: boolean;
    agentAutoMerge?: boolean;
    bypassBranchProtection?: boolean;
}): void {
    if (!options.decision.isAdmin || options.decision.statusCode !== 200) {
        throw new PrOnlyViolationError(
            options.decision.statusCode === 423
                ? "록로그인(Lock-Login) 보안 잠금 상태에서는 변경 묶음이나 PR을 제출할 수 없습니다."
                : "검증된 Google admin 관리자 세션에서만 PR 변경 묶음을 생성할 수 있습니다.",
        );
    }
    if (
        !options.decision.capabilities.includes("cms:create_pr") &&
        !options.decision.capabilities.includes("cms:write_draft")
    ) {
        throw new PrOnlyViolationError("현재 관리자 역할에 PR 생성 권한(cms:create_pr)이 없습니다.");
    }
    if (options.directPublish) {
        throw new PrOnlyViolationError(
            "직접 운영 DB 게시(direct publish)는 금지되어 있습니다. 모든 WYSIWYG 콘텐츠와 코드 수정은 PR을 통해서만 반영됩니다.",
        );
    }
    if (options.agentAutoMerge) {
        throw new PrOnlyViolationError(
            "에이전트 자동 병합(auto-merge)은 금지되어 있습니다. 소유자 검토 후 PR 병합만 허용됩니다.",
        );
    }
    if (options.bypassBranchProtection) {
        throw new PrOnlyViolationError("GitHub 브랜치 보호 및 Ruleset 우회는 허용되지 않습니다.");
    }
    const branch = options.targetBranch.trim().replace(/^refs\/heads\//, "");
    if (!branch || branch === "main" || branch === "master") {
        throw new PrOnlyViolationError(
            "main 기본 브랜치로 직접 푸시할 수 없습니다. 작업 브랜치에서 PR을 생성해야 합니다.",
        );
    }
}

export function createCodePatchRecord(input: {
    filePath: string;
    summary: string;
    beforeExcerpt: string;
    afterExcerpt: string;
}): CmsCodePatch {
    const normalizedPath = input.filePath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (
        !normalizedPath.startsWith("v5/app/") &&
        !normalizedPath.startsWith("v5/components/") &&
        !normalizedPath.startsWith("v5/src/") &&
        !normalizedPath.startsWith("v5/types/") &&
        !normalizedPath.startsWith("v5/styles/") &&
        !normalizedPath.startsWith("docs/")
    ) {
        throw new PrOnlyViolationError(
            `허용되지 않은 파일 경로입니다(${normalizedPath}). 산출물(out/, _next/), .env, .git 경로는 수정할 수 없습니다.`,
        );
    }
    if (
        normalizedPath.includes("..") ||
        normalizedPath.includes(".env") ||
        normalizedPath.includes("/out/") ||
        normalizedPath.includes("/_next/") ||
        normalizedPath.includes("/.next/")
    ) {
        throw new PrOnlyViolationError(`보안 및 산출물 제외 정책에 의해 차단된 경로입니다: ${normalizedPath}`);
    }
    const beforeLines = input.beforeExcerpt.trimEnd().split("\n");
    const afterLines = input.afterExcerpt.trimEnd().split("\n");
    const unifiedDiff = [
        `--- a/${normalizedPath}`,
        `+++ b/${normalizedPath}`,
        `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`,
        ...beforeLines.map((line) => `-${line}`),
        ...afterLines.map((line) => `+${line}`),
    ].join("\n");

    return {
        filePath: normalizedPath,
        summary: sanitizePlainText(input.summary || `${normalizedPath} 수정`),
        beforeExcerpt: input.beforeExcerpt,
        afterExcerpt: input.afterExcerpt,
        unifiedDiff,
        sha256: sha256Hex(unifiedDiff),
    };
}

export function createPrChangeBundle(input: {
    decision: CmsIdentityDecision;
    title: string;
    summary: string;
    baseMainSha?: string;
    branchSlug: string;
    documentAst: CmsDocumentAst;
    baseRevision: number;
    draftRevision: number;
    codePatches?: CmsCodePatch[];
    nowIso?: string;
}): CmsChangeSet {
    const branchName = normalizeCmsBranchName(input.branchSlug);
    assertPrOnlyOperation({
        decision: input.decision,
        targetBranch: branchName,
        directPublish: false,
        agentAutoMerge: false,
    });

    const sanitizedAst = sanitizeWysiwygAst(input.documentAst);
    const validation = validateWysiwygAst(sanitizedAst);
    if (!validation.valid) {
        throw new Error(`콘텐츠 검증 실패: ${validation.issues.join(" ")}`);
    }

    const pageContent = wysiwygAstToPageContent(sanitizedAst, {
        revision: input.draftRevision,
        status: "draft",
    });
    const immutablePayload = {
        schemaVersion: 1 as const,
        targetPath: sanitizedAst.path,
        baseRevision: input.baseRevision,
        draftRevision: input.draftRevision,
        pageContent,
        documentAst: sanitizedAst,
    };
    const codePatches = input.codePatches ? [...input.codePatches] : [];
    const payloadHash = sha256Hex(
        JSON.stringify({
            immutablePayload,
            codePatchHashes: codePatches.map((patch) => ({
                filePath: patch.filePath,
                sha256: patch.sha256,
            })),
        }),
    );
    const baseMainSha =
        input.baseMainSha && /^[0-9a-f]{7,40}$/i.test(input.baseMainSha.trim())
            ? input.baseMainSha.trim().toLowerCase()
            : DEFAULT_BASE_MAIN_SHA;
    const now = input.nowIso || new Date().toISOString();
    const slugPart = branchName.split("/").pop() || "change";
    const id = `cs-${payloadHash.slice(0, 12)}`;
    const manifestPath = `v5/cms-changes/${slugPart}-${payloadHash.slice(0, 8)}.json`;
    const compareUrl = `https://github.com/${GITHUB_REPO_SLUG}/compare/main...${encodeURIComponent(branchName)}?expand=1`;

    return {
        id,
        title: sanitizePlainText(input.title || `${sanitizedAst.title} 콘텐츠 및 코드 변경 요청`),
        summary: sanitizePlainText(
            input.summary ||
                `${sanitizedAst.path} 위지위그 초안(r${input.draftRevision}) 및 코드 패치 ${codePatches.length}건 PR 반영 요청`,
        ),
        baseMainSha,
        branchName,
        payloadHash,
        immutablePayload,
        codePatches,
        manifestPath,
        prNumber: null,
        prUrl: "",
        compareUrl,
        prState: "draft_bundle",
        mergedMainSha: null,
        cloudflareDeploymentId: "",
        cloudflareStatus: "pending",
        authorHandle: input.decision.accountHandle,
        createdAt: now,
        updatedAt: now,
    };
}

export function renderChangeSetGitDiff(changeSet: CmsChangeSet): string {
    const manifestJson = JSON.stringify(
        {
            id: changeSet.id,
            branchName: changeSet.branchName,
            baseMainSha: changeSet.baseMainSha,
            payloadHash: changeSet.payloadHash,
            targetPath: changeSet.immutablePayload.targetPath,
            baseRevision: changeSet.immutablePayload.baseRevision,
            draftRevision: changeSet.immutablePayload.draftRevision,
            title: changeSet.immutablePayload.pageContent.title,
            description: changeSet.immutablePayload.pageContent.description,
            blockCount: changeSet.immutablePayload.pageContent.blocks.length,
        },
        null,
        4,
    );
    const manifestLines = manifestJson.split("\n");
    const manifestDiff = [
        `--- /dev/null`,
        `+++ b/${changeSet.manifestPath}`,
        `@@ -0,0 +1,${manifestLines.length} @@`,
        ...manifestLines.map((line) => `+${line}`),
    ].join("\n");

    const patches = changeSet.codePatches.map((patch) => patch.unifiedDiff);
    return [manifestDiff, ...patches].join("\n\n");
}

// [PR 병합 및 Cloudflare 배포 완료 검증 후 발행 / Reconcile merged PR and Cloudflare deployment before publishing]
export function reconcileMergedPrRelease(input: {
    changeSet: CmsChangeSet;
    githubPr: {
        number: number;
        state: "OPEN" | "CLOSED" | "MERGED";
        merged: boolean;
        baseRefName: string;
        headRefName: string;
        mergeCommitOid?: string | null;
    };
    currentLiveRevision: number;
    verifiedPayloadHash: string;
    cloudflareDeployment: {
        id: string;
        status: "pending" | "building" | "deployed" | "failed";
        commitSha: string;
    };
    nowIso?: string;
}): CmsChangeSet {
    const { changeSet, githubPr, currentLiveRevision, verifiedPayloadHash, cloudflareDeployment } =
        input;

    if (!githubPr.merged || githubPr.state !== "MERGED") {
        throw new PrOnlyViolationError(
            `PR #${githubPr.number}이 아직 병합(MERGED)되지 않았습니다(현재 상태: ${githubPr.state}). 미병합 또는 닫힌 PR은 운영에 발행할 수 없습니다.`,
        );
    }
    if (githubPr.baseRefName !== "main") {
        throw new PrOnlyViolationError(
            `PR 대상 브랜치가 main이 아닙니다(${githubPr.baseRefName}).`,
        );
    }
    if (githubPr.headRefName !== changeSet.branchName) {
        throw new PrOnlyViolationError(
            `PR 작업 브랜치(${githubPr.headRefName})가 변경 묶음 브랜치(${changeSet.branchName})와 일치하지 않습니다.`,
        );
    }
    if (verifiedPayloadHash !== changeSet.payloadHash) {
        throw new PrOnlyViolationError(
            "승인 당시의 불변 payload 해시와 현재 해시가 일치하지 않습니다. 변경된 payload는 재검토·새 PR 승인이 필요합니다.",
        );
    }
    if (currentLiveRevision !== changeSet.immutablePayload.baseRevision) {
        throw new PrOnlyViolationError(
            `원본 리비전이 변경되었습니다(기대 r${changeSet.immutablePayload.baseRevision} ≠ 현재 r${currentLiveRevision}). 최신 상태로 재검토해야 합니다.`,
        );
    }
    const mergeSha = (githubPr.mergeCommitOid || "").trim().toLowerCase();
    if (!/^[0-9a-f]{7,40}$/.test(mergeSha)) {
        throw new PrOnlyViolationError("병합 커밋 SHA(mergeCommitOid)를 확인하지 못했습니다.");
    }
    const cfSha = (cloudflareDeployment.commitSha || "").trim().toLowerCase();
    if (
        cloudflareDeployment.status !== "deployed" ||
        !cloudflareDeployment.id.trim() ||
        !/^[0-9a-f]{7,40}$/.test(cfSha) ||
        !(mergeSha.startsWith(cfSha) || cfSha.startsWith(mergeSha))
    ) {
        throw new Error(
            `Cloudflare Pages 생산 배포가 아직 완료되지 않았거나 병합 SHA와 일치하지 않습니다(상태: ${cloudflareDeployment.status}).`,
        );
    }

    return {
        ...changeSet,
        prNumber: githubPr.number,
        prUrl: `https://github.com/${GITHUB_REPO_SLUG}/pull/${githubPr.number}`,
        prState: "published",
        mergedMainSha: mergeSha,
        cloudflareDeploymentId: cloudflareDeployment.id,
        cloudflareStatus: "deployed",
        immutablePayload: {
            ...changeSet.immutablePayload,
            pageContent: {
                ...changeSet.immutablePayload.pageContent,
                status: "published",
                verifiedAt: input.nowIso || new Date().toISOString(),
            },
        },
        updatedAt: input.nowIso || new Date().toISOString(),
    };
}
