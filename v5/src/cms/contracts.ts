import type { PageContent, PageContentBlock } from "../catalog/types.ts";

// [실제 CMS · WYSIWYG · 대화형 코딩 · PR 전용 워크스페이스 핵심 계약 / Core contracts for CMS, WYSIWYG, conversational coding, and PR-only release]
export const CMS_ADMIN_HANDLE = "admin" as const;
export const CMS_ALLOWED_GOOGLE_DOMAINS = ["gmail.com", "googlemail.com"] as const;

export type CmsAdminRole = "super_admin" | "editor" | "reviewer" | "operator";
export type CmsCapability =
    | "cms:read"
    | "cms:write_draft"
    | "cms:run_agent"
    | "cms:create_pr"
    | "cms:reconcile_release";

export type CmsDestinationId = "visitor_account" | " visitor_home" | "admin_cms" | "lock_login_gate";

export interface CmsDestinationOption {
    id: "visitor_account" | "admin_cms" | "lock_login_gate";
    label: string;
    href: string;
    description: string;
    badge: string;
}

export interface CmsIdentityVerificationInput {
    userId: string;
    email?: string | null;
    emailVerified?: boolean;
    appProvider?: string | null;
    identities?: readonly {
        provider: string;
        id?: string;
        user_id?: string;
        identity_data?: Record<string, unknown> | null;
    }[];
    userMetadata?: Record<string, unknown> | null;
    membership?: {
        userId: string;
        provider: string;
        googleSubject: string;
        accountHandle: string;
        verifiedEmail: string;
        role: CmsAdminRole;
        capabilities: readonly CmsCapability[];
        active: boolean;
        revokedAt?: string | null;
    } | null;
    sessionLocked?: boolean;
}

export interface CmsIdentityDecision {
    isAuthenticated: boolean;
    isAdmin: boolean;
    statusCode: 200 | 401 | 403 | 423;
    reasonCode:
        | "VERIFIED_GOOGLE_ADMIN"
        | "UNAUTHENTICATED"
        | "NON_GOOGLE_PROVIDER"
        | "UNVERIFIED_GOOGLE_EMAIL"
        | "HANDLE_MISMATCH"
        | "MEMBERSHIP_REVOKED"
        | "SUBJECT_MISMATCH"
        | "SESSION_LOCKED";
    accountHandle: string;
    verifiedEmail: string;
    googleSubject: string;
    role: CmsAdminRole | "visitor";
    capabilities: readonly CmsCapability[];
    destinations: readonly CmsDestinationOption[];
    message: string;
}

// [구조화 WYSIWYG 문서 AST / Structured WYSIWYG document AST]
export type CmsInlineMark =
    | { type: "bold" }
    | { type: "italic" }
    | { type: "code" }
    | { type: "link"; href: string };

export interface CmsTextSpan {
    text: string;
    marks?: CmsInlineMark[];
}

export type CmsWysiwygNode =
    | {
          id: string;
          type: "prose";
          heading: string;
          paragraphs: string[];
          richParagraphs?: CmsTextSpan[][];
      }
    | {
          id: string;
          type: "facts";
          title: string;
          items: { label: string; value: string }[];
      }
    | {
          id: string;
          type: "faq";
          title: string;
          items: { question: string; answer: string }[];
      }
    | {
          id: string;
          type: "timeline";
          title: string;
          items: { date: string; title: string; body?: string }[];
      }
    | {
          id: string;
          type: "map";
          address: string;
          href: string;
          label: string;
      }
    | {
          id: string;
          type: "downloads";
          title: string;
          items: { label: string; href: string }[];
      }
    | {
          id: string;
          type: "actions";
          items: { label: string; href: string; external?: boolean }[];
      }
    | {
          id: string;
          type: "image";
          mediaId: string;
          src: string;
          alt: string;
          caption: string;
          sha256: string;
      }
    | {
          id: string;
          type: "table";
          caption: string;
          headers: string[];
          rows: string[][];
      };

export interface CmsDocumentAst {
    schemaVersion: 1;
    path: string;
    title: string;
    description: string;
    sourceUrl?: string;
    nodes: CmsWysiwygNode[];
}

export type CmsDraftStatus =
    | "draft"
    | "staged_for_pr"
    | "pr_open"
    | "merged_published"
    | "conflict"
    | "archived";

export interface CmsDraftRecord {
    id: string;
    targetType: "page" | "program" | "notice" | "venue" | "company" | "home_feature" | "navigation";
    targetId: string;
    title: string;
    description: string;
    astSchemaVersion: 1;
    documentAst: CmsDocumentAst;
    blocksSnapshot: PageContentBlock[];
    baseRevision: number;
    draftRevision: number;
    contentHash: string;
    status: CmsDraftStatus;
    authorId: string;
    AuthorHandle: string;
    updatedAt: string;
    persistedSource: "supabase_db" | "session_staging";
}

export interface CmsCodePatch {
    filePath: string;
    summary: string;
    beforeExcerpt: string;
    afterExcerpt: string;
    unifiedDiff: string;
    sha256: string;
}

export type CmsPrState = "draft_bundle" | "pr_open" | "pr_merged" | "pr_closed" | "published";

export interface CmsChangeSet {
    id: string;
    title: string;
    summary: string;
    baseMainSha: string;
    branchName: string;
    payloadHash: string;
    immutablePayload: {
        schemaVersion: 1;
        targetPath: string;
        baseRevision: number;
        draftRevision: number;
        pageContent: PageContent;
        documentAst: CmsDocumentAst;
    };
    codePatches: CmsCodePatch[];
    manifestPath: string;
    prNumber: number | null;
    prUrl: string;
    compareUrl: string;
    prState: CmsPrState;
    mergedMainSha: string | null;
    cloudflareDeploymentId: string;
    cloudflareStatus: "pending" | "building" | "deployed" | "failed";
    authorHandle: string;
    createdAt: string;
    updatedAt: string;
}

export type CmsAgentToolName =
    | "search_repo"
    | "read_file"
    | "edit_wysiwyg_draft"
    | "propose_code_patch"
    | "run_checks"
    | "prepare_pr_bundle";

export interface CmsAgentToolCall {
    id: string;
    tool: CmsAgentToolName;
    inputSummary: string;
    status: "completed" | "blocked" | "cancelled" | "failed";
    outputSummary: string;
    startedAt: string;
    finishedAt: string;
}

export interface CmsAgentMessage {
    id: string;
    role: "user" | "assistant" | "system";
    text: string;
    createdAt: string;
    runId?: string;
}

export interface CmsAgentRunResult {
    runId: string;
    requestId: string;
    threadId: string;
    prompt: string;
    baseMainSha: string;
    branchName: string;
    status: "completed" | "cancelled" | "failed" | "blocked_policy";
    planSteps: string[];
    toolCalls: CmsAgentToolCall[];
    updatedAst: CmsDocumentAst;
    proposedPatches: CmsCodePatch[];
    checkResults: {
        astValid: boolean;
        visualContractPassed: boolean;
        linkPolicyPassed: boolean;
        prOnlyVerified: boolean;
        issues: string[];
    };
    changeSet: CmsChangeSet | null;
    tokensUsed: number;
    tokenBudget: number;
    logCursor: number;
    assistantReply: string;
}

export interface CmsIntegrationProbe {
    service: "supabase" | "google_oauth" | "cloudflare_pages" | "github_pr_broker" | "agent_sandbox";
    label: string;
    status: "connected" | "degraded" | "unconfigured" | "unauthorized";
    projectRef: string;
    permissionsSummary: string;
    checkedAt: string;
    latencyMs: number;
    httpStatus: number | null;
    requestId: string;
    detail: string;
}
