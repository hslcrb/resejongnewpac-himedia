// [CMS 저장소 계약 / CMS store contract]
// Supabase 어댑터와 메모리(세션 스테이징)·테스트 저장소가 같은 계약을 구현합니다.
// 어떤 저장소도 실패를 성공으로 바꾸지 않으며, 실패는 이유와 함께 반환합니다.
import type { CmsPageSnapshot } from "./page-tree.ts";
import type { VisualDraftDocument } from "./visual-document.ts";
import { sanitizeVisualDocument, visualDocumentChecksum } from "./visual-document.ts";

export type CmsStoreFailureReason = "conflict" | "unavailable" | "invalid" | "not_found";

export type CmsStoreResult<T> =
    | { ok: true; data: T }
    | { ok: false; reason: CmsStoreFailureReason; message: string; currentRevision?: number };

// strict: false 환경에서도 안전하게 실패 분기를 좁히는 판별 함수입니다.
export function isCmsFailure<T>(
    result: CmsStoreResult<T>,
): result is { ok: false; reason: CmsStoreFailureReason; message: string; currentRevision?: number } {
    return result.ok !== true;
}

export interface CmsVisualRecord {
    path: string;
    document: VisualDraftDocument;
    revision: number;
    status: "draft" | "published";
    checksum: string;
    updatedAt: string;
    updatedBy: string;
    publishedRevision: number;
    publishedAt: string | null;
}

export interface CmsVisualRevisionRecord {
    path: string;
    revision: number;
    publishedRevision: number;
    document: VisualDraftDocument;
    checksum: string;
    publishedAt: string;
    publishedBy: string;
    note: string;
}

export interface CmsContentEntry {
    id: string;
    collection: string;
    slug: string;
    data: Record<string, unknown>;
    status: "draft" | "published";
    updatedAt: string;
    updatedBy: string;
}

// 콘텐츠 컬렉션은 화이트리스트로 제한합니다(임의 테이블 접근 방지).
export const CMS_CONTENT_COLLECTIONS = [
    "notices",
    "programs",
    "pages",
    "faq",
    "banners",
    "media",
] as const;
export type CmsContentCollection = (typeof CMS_CONTENT_COLLECTIONS)[number];

export interface CmsSaveDraftInput {
    path: string;
    document: VisualDraftDocument;
    expectedRevision: number;
    actorId: string;
    now?: string;
}

export interface CmsPublishInput {
    path: string;
    expectedRevision: number;
    actorId: string;
    note?: string;
    now?: string;
}

export interface CmsQueryContentInput {
    collection: CmsContentCollection;
    slug?: string;
    status?: "draft" | "published";
    limit?: number;
}

export interface CmsMutateContentInput {
    collection: CmsContentCollection;
    slug: string;
    data: Record<string, unknown>;
    actorId: string;
    mode?: "upsert" | "patch";
    status?: "draft" | "published";
    now?: string;
}

export interface CmsStore {
    readonly kind: "supabase" | "memory";
    getVisualDocument(path: string): Promise<CmsStoreResult<CmsVisualRecord | null>>;
    saveVisualDraft(input: CmsSaveDraftInput): Promise<CmsStoreResult<CmsVisualRecord>>;
    publishVisualDraft(input: CmsPublishInput): Promise<CmsStoreResult<CmsVisualRevisionRecord>>;
    listVisualRevisions(path: string, limit?: number): Promise<CmsStoreResult<CmsVisualRevisionRecord[]>>;
    getPageSnapshot(path: string): Promise<CmsStoreResult<CmsPageSnapshot | null>>;
    savePageSnapshot(input: { snapshot: CmsPageSnapshot; actorId: string }): Promise<CmsStoreResult<CmsPageSnapshot>>;
    queryContent(input: CmsQueryContentInput): Promise<CmsStoreResult<CmsContentEntry[]>>;
    mutateContent(input: CmsMutateContentInput): Promise<CmsStoreResult<CmsContentEntry>>;
}

export function isCmsContentCollection(value: unknown): value is CmsContentCollection {
    return typeof value === "string" && (CMS_CONTENT_COLLECTIONS as readonly string[]).includes(value);
}

export function emptyCmsVisualRecord(path: string): CmsVisualRecord {
    const document = sanitizeVisualDocument({ schemaVersion: 2, path, patches: [], additions: [] }, path);
    return {
        path,
        document,
        revision: 0,
        status: "draft",
        checksum: visualDocumentChecksum(document),
        updatedAt: new Date(0).toISOString(),
        updatedBy: "",
        publishedRevision: 0,
        publishedAt: null,
    };
}

// 세션 메모리 저장소: Supabase 미설정·로컬 개발·단위 테스트에서 쓰며, DB 저장으로 가장하지 않습니다.
export function createMemoryCmsStore(seed?: {
    documents?: CmsVisualRecord[];
    snapshots?: CmsPageSnapshot[];
    content?: CmsContentEntry[];
}): CmsStore {
    const documents = new Map<string, CmsVisualRecord>();
    const revisions = new Map<string, CmsVisualRevisionRecord[]>();
    const snapshots = new Map<string, CmsPageSnapshot>();
    const content = new Map<string, CmsContentEntry>();
    for (const record of seed?.documents || []) documents.set(record.path, record);
    for (const snapshot of seed?.snapshots || []) snapshots.set(snapshot.path, snapshot);
    for (const entry of seed?.content || []) content.set(entry.collection + "/" + entry.slug, entry);

    const contentKey = (collection: string, slug: string) => collection + "/" + slug;

    return {
        kind: "memory",
        async getVisualDocument(path) {
            return { ok: true, data: documents.get(path) || null };
        },
        async saveVisualDraft(input) {
            const current = documents.get(input.path);
            const currentRevision = current?.revision || 0;
            if (input.expectedRevision !== currentRevision) {
                return {
                    ok: false,
                    reason: current ? "conflict" : "not_found",
                    message: current
                        ? `서버 리비전 r${currentRevision}과 요청 리비전 r${input.expectedRevision}이 다릅니다. 덮어쓰지 않았습니다.`
                        : "초안이 존재하지 않습니다. expectedRevision을 0으로 다시 시도하세요.",
                    currentRevision,
                };
            }
            let document: VisualDraftDocument;
            try {
                document = sanitizeVisualDocument(input.document, input.path);
            } catch (error) {
                return { ok: false, reason: "invalid", message: error instanceof Error ? error.message : String(error) };
            }
            const now = input.now || new Date().toISOString();
            const next: CmsVisualRecord = {
                path: input.path,
                document,
                revision: currentRevision + 1,
                status: current?.status || "draft",
                checksum: visualDocumentChecksum(document),
                updatedAt: now,
                updatedBy: input.actorId,
                publishedRevision: current?.publishedRevision || 0,
                publishedAt: current?.publishedAt || null,
            };
            documents.set(input.path, next);
            return { ok: true, data: next };
        },
        async publishVisualDraft(input) {
            const current = documents.get(input.path);
            if (!current) return { ok: false, reason: "not_found", message: "발행할 초안이 없습니다." };
            if (input.expectedRevision !== current.revision) {
                return {
                    ok: false,
                    reason: "conflict",
                    message: `서버 리비전 r${current.revision}과 요청 리비전 r${input.expectedRevision}이 다릅니다.`,
                    currentRevision: current.revision,
                };
            }
            const now = input.now || new Date().toISOString();
            const publishedRevision = current.publishedRevision + 1;
            const revision: CmsVisualRevisionRecord = {
                path: input.path,
                revision: current.revision,
                publishedRevision,
                document: current.document,
                checksum: current.checksum,
                publishedAt: now,
                publishedBy: input.actorId,
                note: (input.note || "").slice(0, 500),
            };
            const list = revisions.get(input.path) || [];
            revisions.set(input.path, [revision, ...list].slice(0, 50));
            documents.set(input.path, {
                ...current,
                status: "published",
                publishedRevision,
                publishedAt: now,
            });
            return { ok: true, data: revision };
        },
        async listVisualRevisions(path, limit = 20) {
            return { ok: true, data: (revisions.get(path) || []).slice(0, Math.min(Math.max(limit, 1), 50)) };
        },
        async getPageSnapshot(path) {
            return { ok: true, data: snapshots.get(path) || null };
        },
        async savePageSnapshot(input) {
            snapshots.set(input.snapshot.path, input.snapshot);
            return { ok: true, data: input.snapshot };
        },
        async queryContent(input) {
            const entries = [...content.values()]
                .filter((entry) => entry.collection === input.collection)
                .filter((entry) => !input.slug || entry.slug === input.slug)
                .filter((entry) => !input.status || entry.status === input.status)
                .slice(0, Math.min(Math.max(input.limit ?? 50, 1), 100));
            return { ok: true, data: entries };
        },
        async mutateContent(input) {
            const key = contentKey(input.collection, input.slug);
            const current = content.get(key);
            const now = input.now || new Date().toISOString();
            const base = current && input.mode === "patch" ? current.data : {};
            const entry: CmsContentEntry = {
                id: current?.id || "entry-" + key.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
                collection: input.collection,
                slug: input.slug,
                data: { ...base, ...input.data },
                status: input.status || current?.status || "draft",
                updatedAt: now,
                updatedBy: input.actorId,
            };
            content.set(key, entry);
            return { ok: true, data: entry };
        },
    };
}
