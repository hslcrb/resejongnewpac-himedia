// [Supabase CMS 어댑터 / Supabase CMS adapter]
// 테이블 계약: sejong_cms_visual_documents · sejong_cms_visual_revisions · sejong_cms_page_snapshots · sejong_cms_content_entries
// 스토리지 계약: cms-media 버킷에 원본 보존 + SHA-256 무결성 메타데이터를 기록합니다.
// RLS가 켜진 공개 클라이언트(anon + 로그인 세션)에서만 동작하며 서비스 롤 키를 브라우저에 두지 않습니다.
import type {
    CmsContentEntry,
    CmsMutateContentInput,
    CmsPublishInput,
    CmsQueryContentInput,
    CmsSaveDraftInput,
    CmsStore,
    CmsStoreResult,
    CmsVisualRecord,
    CmsVisualRevisionRecord,
} from "./cms-store.ts";
import { emptyCmsVisualRecord } from "./cms-store.ts";
import { isCmsFailure } from "./cms-store.ts";
import type { CmsPageSnapshot } from "./page-tree.ts";
import { sanitizePageSnapshot } from "./page-tree.ts";
import type { VisualDraftDocument } from "./visual-document.ts";
import { sanitizeVisualDocument, visualDocumentChecksum } from "./visual-document.ts";

export {
    CMS_CONTENT_TABLE,
    CMS_MEDIA_BUCKET,
    CMS_PAGE_SNAPSHOTS_TABLE,
    CMS_VISUAL_DOCUMENTS_TABLE,
    CMS_VISUAL_REVISIONS_TABLE,
} from "./cms-tables.ts";
import { CMS_CONTENT_TABLE, CMS_MEDIA_BUCKET, CMS_PAGE_SNAPSHOTS_TABLE, CMS_VISUAL_DOCUMENTS_TABLE, CMS_VISUAL_REVISIONS_TABLE } from "./cms-tables.ts";

export interface CmsDbError {
    message: string;
    code?: string;
}

interface CmsQueryBuilder {
    select(columns?: string): CmsQueryBuilder;
    eq(column: string, value: unknown): CmsQueryBuilder;
    order(column: string, options?: { ascending?: boolean }): CmsQueryBuilder;
    limit(count: number): CmsQueryBuilder;
    insert(row: Record<string, unknown>): CmsQueryBuilder;
    upsert(row: Record<string, unknown>, options?: { onConflict?: string }): CmsQueryBuilder;
    update(row: Record<string, unknown>): CmsQueryBuilder;
    maybeSingle(): PromiseLike<{ data: unknown; error: CmsDbError | null }>;
    single(): PromiseLike<{ data: unknown; error: CmsDbError | null }>;
    then<TResult1 = { data: unknown; error: CmsDbError | null }, TResult2 = never>(
        onfulfilled?:
            | ((value: { data: unknown; error: CmsDbError | null }) => TResult1 | PromiseLike<TResult1>)
            | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2>;
}

export interface CmsSupabaseLike {
    from(table: string): CmsQueryBuilder;
    rpc?(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: CmsDbError | null }>;
    storage?: {
        from(bucket: string): {
            upload(
                path: string,
                file: Blob,
                options?: { contentType?: string; upsert?: boolean },
            ): PromiseLike<{ data: unknown; error: CmsDbError | null }>;
            createSignedUrl?(path: string, expiresIn: number): PromiseLike<{ data: unknown; error: CmsDbError | null }>;
        };
    };
}

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;
}

function asRows(value: unknown): Row[] {
    return Array.isArray(value) ? value.map(asRow).filter((row): row is Row => row !== null) : [];
}

function fail(reason: "unavailable" | "invalid" | "not_found", message: string): CmsStoreResult<never> {
    return { ok: false, reason, message };
}

function mapDocumentRow(row: Row): CmsVisualRecord | null {
    const path = String(row.target_path || "");
    if (!path) return null;
    let document: VisualDraftDocument;
    try {
        document = sanitizeVisualDocument(row.document, path);
    } catch {
        return null;
    }
    return {
        path,
        document,
        revision: Number(row.revision) || 0,
        status: row.status === "published" ? "published" : "draft",
        checksum: typeof row.checksum === "string" ? row.checksum : visualDocumentChecksum(document),
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date(0).toISOString(),
        updatedBy: typeof row.updated_by === "string" ? row.updated_by : "",
        publishedRevision: Number(row.published_revision) || 0,
        publishedAt: typeof row.published_at === "string" ? row.published_at : null,
    };
}

function mapRevisionRow(row: Row): CmsVisualRevisionRecord | null {
    const path = String(row.target_path || "");
    if (!path) return null;
    let document: VisualDraftDocument;
    try {
        document = sanitizeVisualDocument(row.document, path);
    } catch {
        return null;
    }
    return {
        path,
        revision: Number(row.revision) || 0,
        publishedRevision: Number(row.published_revision) || 0,
        document,
        checksum: typeof row.checksum === "string" ? row.checksum : visualDocumentChecksum(document),
        publishedAt: typeof row.published_at === "string" ? row.published_at : "",
        publishedBy: typeof row.published_by === "string" ? row.published_by : "",
        note: typeof row.note === "string" ? row.note : "",
    };
}

function mapSnapshotRow(row: Row): CmsPageSnapshot | null {
    const path = String(row.target_path || "");
    if (!path) return null;
    try {
        const snapshot = sanitizePageSnapshot(row.tree, path);
        return {
            ...snapshot,
            url: typeof row.url === "string" && row.url ? row.url : snapshot.url,
            viewport: row.viewport === "tablet" || row.viewport === "mobile" ? row.viewport : snapshot.viewport,
            capturedAt: typeof row.captured_at === "string" ? row.captured_at : snapshot.capturedAt,
        };
    } catch {
        return null;
    }
}

function mapContentRow(row: Row): CmsContentEntry | null {
    const collection = String(row.collection || "");
    const slug = String(row.slug || "");
    if (!collection || !slug) return null;
    const data = asRow(row.data) || {};
    return {
        id: String(row.id || collection + "/" + slug),
        collection,
        slug,
        data,
        status: row.status === "published" ? "published" : "draft",
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
        updatedBy: typeof row.updated_by === "string" ? row.updated_by : "",
    };
}

export function createSupabaseCmsStore(client: CmsSupabaseLike): CmsStore {
    const now = () => new Date().toISOString();

    return {
        kind: "supabase",

        async getVisualDocument(path): Promise<CmsStoreResult<CmsVisualRecord | null>> {
            const { data, error } = await client
                .from(CMS_VISUAL_DOCUMENTS_TABLE)
                .select("*")
                .eq("target_path", path)
                .maybeSingle();
            if (error) return fail("unavailable", `Supabase 초안 조회 실패: ${error.message}`);
            return { ok: true, data: data ? mapDocumentRow(asRow(data) || {}) : null };
        },

        async saveVisualDraft(input: CmsSaveDraftInput): Promise<CmsStoreResult<CmsVisualRecord>> {
            let document: VisualDraftDocument;
            try {
                document = sanitizeVisualDocument(input.document, input.path);
            } catch (error) {
                return fail("invalid", error instanceof Error ? error.message : String(error));
            }
            const timestamp = input.now || now();
            const checksum = visualDocumentChecksum(document);
            const base = {
                target_path: input.path,
                document,
                checksum,
                updated_at: timestamp,
                updated_by: input.actorId,
            };
            if (input.expectedRevision <= 0) {
                const { data, error } = await client
                    .from(CMS_VISUAL_DOCUMENTS_TABLE)
                    .insert({ ...base, revision: 1, status: "draft", published_revision: 0 })
                    .select("*")
                    .maybeSingle();
                if (error) {
                    if (error.code === "23505") {
                        return {
                            ok: false,
                            reason: "conflict",
                            message: "동시 편집으로 리비전이 이미 생성되었습니다. 최신 초안을 다시 불러오세요.",
                        };
                    }
                    return fail("unavailable", `Supabase 초안 생성 실패: ${error.message}`);
                }
                const record = data ? mapDocumentRow(asRow(data) || {}) : null;
                if (!record) return fail("unavailable", "Supabase가 생성된 초안 행을 반환하지 않았습니다.");
                return { ok: true, data: record };
            }
            const { data, error } = await client
                .from(CMS_VISUAL_DOCUMENTS_TABLE)
                .update({ ...base, revision: input.expectedRevision + 1, status: "draft" })
                .eq("target_path", input.path)
                .eq("revision", input.expectedRevision)
                .select("*")
                .maybeSingle();
            if (error) return fail("unavailable", `Supabase 초안 저장 실패: ${error.message}`);
            const record = data ? mapDocumentRow(asRow(data) || {}) : null;
            if (!record) {
                const current = await this.getVisualDocument(input.path);
                const currentRevision = !isCmsFailure(current) ? current.data?.revision || 0 : 0;
                return {
                    ok: false,
                    reason: currentRevision ? "conflict" : "not_found",
                    message: `서버 리비전 r${currentRevision}이 요청 r${input.expectedRevision}과 달라 덮어쓰지 않았습니다.`,
                    currentRevision,
                };
            }
            return { ok: true, data: record };
        },

        async publishVisualDraft(input: CmsPublishInput): Promise<CmsStoreResult<CmsVisualRevisionRecord>> {
            const timestamp = input.now || now();
            if (client.rpc) {
                const { data, error } = await client.rpc("sejong_cms_publish_visual_draft", {
                    p_path: input.path,
                    p_expected_revision: input.expectedRevision,
                    p_note: (input.note || "").slice(0, 500),
                    p_actor: input.actorId,
                });
                if (!error) {
                    const row = asRow(data);
                    const revision = row ? mapRevisionRow(row) : null;
                    if (revision) return { ok: true, data: revision };
                    return fail("unavailable", "발행 RPC가 발행 리비전을 반환하지 않았습니다.");
                }
                const missingFunction = error.code === "42883" || error.code === "PGRST202" || /could not find the function/i.test(error.message);
                if (!missingFunction) {
                    if (/conflict|revision/i.test(error.message)) {
                        const current = await this.getVisualDocument(input.path);
                        return {
                            ok: false,
                            reason: "conflict",
                            message: error.message,
                            currentRevision: !isCmsFailure(current) ? current.data?.revision || 0 : 0,
                        };
                    }
                    return fail("unavailable", `Supabase 발행 실패: ${error.message}`);
                }
            }
            // RPC가 없을 때의 2단계 폴백: 리비전 조건 업데이트 후 발행 이력을 기록합니다.
            const current = await this.getVisualDocument(input.path);
            if (isCmsFailure(current)) return fail("unavailable", current.message);
            const record = current.data;
            if (!record) return fail("not_found", "발행할 초안이 없습니다.");
            if (record.revision !== input.expectedRevision) {
                return {
                    ok: false,
                    reason: "conflict",
                    message: `서버 리비전 r${record.revision}과 요청 r${input.expectedRevision}이 다릅니다.`,
                    currentRevision: record.revision,
                };
            }
            const publishedRevision = record.publishedRevision + 1;
            const updated = await client
                .from(CMS_VISUAL_DOCUMENTS_TABLE)
                .update({
                    status: "published",
                    published_revision: publishedRevision,
                    published_at: timestamp,
                })
                .eq("target_path", input.path)
                .eq("revision", input.expectedRevision)
                .select("*")
                .maybeSingle();
            if (updated.error) return fail("unavailable", `Supabase 발행 표시 실패: ${updated.error.message}`);
            if (!updated.data) {
                return {
                    ok: false,
                    reason: "conflict",
                    message: "발행 중 리비전이 변경되어 중단했습니다.",
                    currentRevision: record.revision,
                };
            }
            const revisionRow = {
                target_path: input.path,
                revision: record.revision,
                published_revision: publishedRevision,
                document: record.document,
                checksum: record.checksum,
                published_at: timestamp,
                published_by: input.actorId,
                note: (input.note || "").slice(0, 500),
            };
            const inserted = await client
                .from(CMS_VISUAL_REVISIONS_TABLE)
                .insert(revisionRow)
                .select("*")
                .maybeSingle();
            if (inserted.error) {
                return fail(
                    "unavailable",
                    `발행 문서는 표시되었으나 발행 이력 기록에 실패했습니다: ${inserted.error.message}`,
                );
            }
            const revision = mapRevisionRow(asRow(inserted.data) || revisionRow);
            if (!revision) return fail("unavailable", "발행 이력 행을 해석하지 못했습니다.");
            return { ok: true, data: revision };
        },

        async listVisualRevisions(path, limit = 20) {
            const { data, error } = await client
                .from(CMS_VISUAL_REVISIONS_TABLE)
                .select("*")
                .eq("target_path", path)
                .order("published_at", { ascending: false })
                .limit(Math.min(Math.max(limit, 1), 50));
            if (error) return fail("unavailable", `Supabase 발행 이력 조회 실패: ${error.message}`);
            return {
                ok: true,
                data: asRows(data)
                    .map(mapRevisionRow)
                    .filter((row): row is CmsVisualRevisionRecord => row !== null),
            };
        },

        async getPageSnapshot(path) {
            const { data, error } = await client
                .from(CMS_PAGE_SNAPSHOTS_TABLE)
                .select("*")
                .eq("target_path", path)
                .maybeSingle();
            if (error) return fail("unavailable", `Supabase 페이지 트리 조회 실패: ${error.message}`);
            return { ok: true, data: data ? mapSnapshotRow(asRow(data) || {}) : null };
        },

        async savePageSnapshot(input) {
            const timestamp = now();
            const { data, error } = await client
                .from(CMS_PAGE_SNAPSHOTS_TABLE)
                .upsert(
                    {
                        target_path: input.snapshot.path,
                        tree: input.snapshot.nodes,
                        checksum: input.snapshot.checksum,
                        viewport: input.snapshot.viewport,
                        url: input.snapshot.url,
                        captured_at: input.snapshot.capturedAt,
                        updated_by: input.actorId,
                        updated_at: timestamp,
                    },
                    { onConflict: "target_path" },
                )
                .select("*")
                .maybeSingle();
            if (error) return fail("unavailable", `Supabase 페이지 트리 저장 실패: ${error.message}`);
            const snapshot = data ? mapSnapshotRow(asRow(data) || {}) : null;
            return snapshot ? { ok: true, data: snapshot } : fail("unavailable", "페이지 트리 저장 결과를 해석하지 못했습니다.");
        },

        async queryContent(input: CmsQueryContentInput) {
            let builder = client
                .from(CMS_CONTENT_TABLE)
                .select("*")
                .eq("collection", input.collection);
            if (input.slug) builder = builder.eq("slug", input.slug);
            if (input.status) builder = builder.eq("status", input.status);
            const { data, error } = await builder.limit(Math.min(Math.max(input.limit ?? 50, 1), 100));
            if (error) return fail("unavailable", `Supabase 콘텐츠 조회 실패: ${error.message}`);
            return {
                ok: true,
                data: asRows(data)
                    .map(mapContentRow)
                    .filter((row): row is CmsContentEntry => row !== null),
            };
        },

        async mutateContent(input: CmsMutateContentInput) {
            const timestamp = input.now || now();
            const existing = await this.queryContent({
                collection: input.collection,
                slug: input.slug,
                limit: 1,
            });
            if (isCmsFailure(existing)) return fail("unavailable", existing.message);
            const current = existing.data[0];
            const data = input.mode === "patch" && current ? { ...current.data, ...input.data } : { ...input.data };
            const row = {
                collection: input.collection,
                slug: input.slug,
                data,
                status: input.status || current?.status || "draft",
                updated_at: timestamp,
                updated_by: input.actorId,
            };
            const { data: saved, error } = await client
                .from(CMS_CONTENT_TABLE)
                .upsert(row, { onConflict: "collection,slug" })
                .select("*")
                .maybeSingle();
            if (error) return fail("unavailable", `Supabase 콘텐츠 저장 실패: ${error.message}`);
            const entry = saved ? mapContentRow(asRow(saved) || {}) : mapContentRow(row);
            return entry ? { ok: true, data: entry } : fail("unavailable", "콘텐츠 저장 결과를 해석하지 못했습니다.");
        },
    };
}

// 저장소가 준비되지 않은 환경에서 기록으로 남기는 세션 초안 (DB 저장으로 가장하지 않음)
export function sessionVisualRecord(path: string, document: VisualDraftDocument, actorId: string): CmsVisualRecord {
    const clean = sanitizeVisualDocument(document, path);
    return {
        ...emptyCmsVisualRecord(path),
        document: clean,
        revision: 1,
        checksum: visualDocumentChecksum(clean),
        updatedAt: new Date().toISOString(),
        updatedBy: actorId,
        status: "draft",
    };
}

// [스토리지 계약 / Storage contract] cms-media 버킷에 원본을 보존하고 SHA-256 무결성을 기록합니다.
async function sha256Bytes(buffer: ArrayBuffer): Promise<string> {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

export async function uploadCmsAsset(
    client: CmsSupabaseLike,
    input: { path: string; file: Blob; contentType?: string },
): Promise<CmsStoreResult<{ path: string; checksum: string }>> {
    if (!client.storage) return fail("unavailable", "Supabase Storage 클라이언트가 구성되지 않았습니다.");
    const buffer = await input.file.arrayBuffer();
    const checksum = await sha256Bytes(buffer);
    const { error } = await client.storage
        .from(CMS_MEDIA_BUCKET)
        .upload(input.path, input.file, { contentType: input.contentType, upsert: false });
    if (error) return fail("unavailable", `Storage 업로드 실패: ${error.message}`);
    return { ok: true, data: { path: input.path, checksum } };
}
