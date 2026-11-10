// [Cloudflare 에지 발행 어댑터 / Cloudflare edge publish adapter]
// 정적 사이트(v5, output: export)의 발행본은 KV에 JSON으로 미러링하고, Pages 캐시는 URL 단위로 무효화합니다.
// KV/R2 바인딩은 Cloudflare Worker 런타임에서, REST 경로는 Node/CI에서 사용합니다.
// 설정이 없으면 아무 것도 하지 않고 "미설정"을 그대로 반환합니다(성공으로 가장하지 않음).
import type { CmsStore, CmsVisualRevisionRecord } from "./cms-store.ts";
import { isCmsFailure } from "./cms-store.ts";
import { documentPathSlug, normalizeVisualPath } from "./visual-document.ts";

export interface CmsKvNamespace {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number; metadata?: Record<string, unknown> }): Promise<void>;
    delete(key: string): Promise<void>;
    list?(options?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }>;
}

export interface CmsR2Bucket {
    put(key: string, value: string | ArrayBuffer | Blob, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
    get?(key: string): Promise<{ text(): Promise<string> } | null>;
}

export interface CmsEdgeBindings {
    CMS_CMS_KV?: CmsKvNamespace;
    CMS_CMS_R2?: CmsR2Bucket;
    caches?: { default?: { delete(request: Request | string): Promise<boolean> } };
}

export interface CmsEdgeConfig {
    baseUrl: string;
    zoneId?: string;
    apiToken?: string;
    accountId?: string;
    kvNamespaceId?: string;
    fetchImpl?: typeof fetch;
}

export interface CmsEdgeStepResult {
    step: "kv_mirror" | "r2_archive" | "cache_purge";
    status: "done" | "skipped" | "failed";
    detail: string;
}

export interface CmsEdgePublishResult {
    path: string;
    publishedRevision: number;
    checksum: string;
    cacheKey: string;
    steps: CmsEdgeStepResult[];
}

export function publishedDocumentKey(path: string): string {
    return "cms/visual/" + documentPathSlug(path) + ".json";
}

export function publishedArchiveKey(path: string, publishedRevision: number): string {
    return "cms/visual/" + documentPathSlug(path) + "/r" + publishedRevision + ".json";
}

export function edgeCacheUrls(baseUrl: string, path: string): string[] {
    const origin = baseUrl.replace(/\/$/, "");
    const normalized = normalizeVisualPath(path) || "/";
    const route = normalized === "/" ? "" : normalized.replace(/^\//, "");
    const page = origin + "/v5/" + (route ? route + "/" : "");
    return [page, origin + "/v5/"];
}

export function serializePublishedRevision(revision: CmsVisualRevisionRecord): string {
    return JSON.stringify({
        schemaVersion: 2,
        path: revision.path,
        revision: revision.revision,
        publishedRevision: revision.publishedRevision,
        checksum: revision.checksum,
        publishedAt: revision.publishedAt,
        publishedBy: revision.publishedBy,
        note: revision.note,
        document: revision.document,
    });
}

export async function readPublishedRevision(
    bindings: CmsEdgeBindings,
    path: string,
): Promise<{ publishedRevision: number; checksum: string; document: unknown } | null> {
    const raw = await bindings.CMS_CMS_KV?.get(publishedDocumentKey(path));
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as { publishedRevision?: number; checksum?: string; document?: unknown };
        return {
            publishedRevision: Number(parsed.publishedRevision) || 0,
            checksum: parsed.checksum || "",
            document: parsed.document || null,
        };
    } catch {
        return null;
    }
}

// [KV · R2 미러링 / KV and R2 mirroring] 발행 리비전을 에지 저장소에 고정합니다.
export async function mirrorPublishedRevision(input: {
    bindings: CmsEdgeBindings;
    revision: CmsVisualRevisionRecord;
}): Promise<CmsEdgeStepResult[]> {
    const results: CmsEdgeStepResult[] = [];
    const payload = serializePublishedRevision(input.revision);
    const kv = input.bindings.CMS_CMS_KV;
    if (!kv) {
        results.push({ step: "kv_mirror", status: "skipped", detail: "KV 바인딩이 없어 미러링을 건너뛰었습니다." });
    } else {
        try {
            await kv.put(publishedDocumentKey(input.revision.path), payload, {
                metadata: {
                    checksum: input.revision.checksum,
                    publishedRevision: input.revision.publishedRevision,
                },
            });
            results.push({
                step: "kv_mirror",
                status: "done",
                detail: publishedDocumentKey(input.revision.path) + " 키에 발행본을 기록했습니다.",
            });
        } catch (error) {
            results.push({
                step: "kv_mirror",
                status: "failed",
                detail: "KV 기록 실패: " + (error instanceof Error ? error.message : String(error)),
            });
        }
    }
    const r2 = input.bindings.CMS_CMS_R2;
    if (!r2) {
        results.push({ step: "r2_archive", status: "skipped", detail: "R2 바인딩이 없어 아카이브를 건너뛰었습니다." });
    } else {
        try {
            await r2.put(publishedArchiveKey(input.revision.path, input.revision.publishedRevision), payload, {
                httpMetadata: { contentType: "application/json; charset=utf-8" },
            });
            results.push({
                step: "r2_archive",
                status: "done",
                detail: "R2에 발행 리비전 원본을 보존했습니다.",
            });
        } catch (error) {
            results.push({
                step: "r2_archive",
                status: "failed",
                detail: "R2 기록 실패: " + (error instanceof Error ? error.message : String(error)),
            });
        }
    }
    return results;
}

// [Cloudflare 캐시 무효화 / Cache purge] zoneId·apiToken이 없으면 미설정으로 보고합니다.
export async function purgeCloudflareCache(
    config: CmsEdgeConfig,
    urls: readonly string[],
): Promise<CmsEdgeStepResult> {
    if (!config.zoneId || !config.apiToken) {
        return {
            step: "cache_purge",
            status: "skipped",
            detail: "CLOUDFLARE_ZONE_ID/CLOUDFLARE_API_TOKEN이 없어 캐시 무효화를 실행하지 않았습니다.",
        };
    }
    const fetcher = config.fetchImpl || fetch;
    try {
        const response = await fetcher(
            `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(config.zoneId)}/purge_cache`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${config.apiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ files: urls.slice(0, 30) }),
            },
        );
        const body = (await response.json().catch(() => null)) as { success?: boolean; errors?: { message?: string }[] } | null;
        if (response.ok && body?.success) {
            return { step: "cache_purge", status: "done", detail: `${urls.length}개 URL의 에지 캐시를 무효화했습니다.` };
        }
        const message = body?.errors?.map((item) => item.message).filter(Boolean).join(" / ") || `HTTP ${response.status}`;
        return { step: "cache_purge", status: "failed", detail: `Cloudflare 캐시 무효화 실패: ${message}` };
    } catch (error) {
        return {
            step: "cache_purge",
            status: "failed",
            detail: "Cloudflare 캐시 무효화 요청 오류: " + (error instanceof Error ? error.message : String(error)),
        };
    }
}

// [KV REST 동기화 / KV REST sync] Worker 바인딩이 없는 CI·Node 환경에서 KV에 발행본을 기록합니다.
export async function syncPublishedRevisionToKvRest(
    config: CmsEdgeConfig,
    revision: CmsVisualRevisionRecord,
): Promise<CmsEdgeStepResult> {
    if (!config.accountId || !config.kvNamespaceId || !config.apiToken) {
        return {
            step: "kv_mirror",
            status: "skipped",
            detail: "CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_KV_NAMESPACE_ID/CLOUDFLARE_API_TOKEN이 없어 KV REST 동기화를 건너뛰었습니다.",
        };
    }
    const fetcher = config.fetchImpl || fetch;
    const key = publishedDocumentKey(revision.path);
    try {
        const response = await fetcher(
            `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/storage/kv/namespaces/${encodeURIComponent(config.kvNamespaceId)}/values/${encodeURIComponent(key)}`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${config.apiToken}`,
                    "Content-Type": "application/json; charset=utf-8",
                },
                body: serializePublishedRevision(revision),
            },
        );
        if (response.ok) {
            return { step: "kv_mirror", status: "done", detail: key + " 키를 KV REST로 동기화했습니다." };
        }
        return { step: "kv_mirror", status: "failed", detail: `KV REST 동기화 실패: HTTP ${response.status}` };
    } catch (error) {
        return {
            step: "kv_mirror",
            status: "failed",
            detail: "KV REST 동기화 오류: " + (error instanceof Error ? error.message : String(error)),
        };
    }
}

// [초안 발행 → 에지 반영 파이프라인 / Draft publish to edge pipeline]
// 1) 저장소에서 리비전 확정 2) KV·R2 미러 3) 캐시 무효화. 각 단계 상태를 그대로 보고합니다.
export async function publishDraftToEdge(input: {
    store: CmsStore;
    path: string;
    expectedRevision: number;
    actorId: string;
    note?: string;
    bindings?: CmsEdgeBindings;
    config?: CmsEdgeConfig;
}): Promise<{ ok: boolean; published: CmsVisualRevisionRecord | null; message: string; edge: CmsEdgePublishResult | null }> {
    const published = await input.store.publishVisualDraft({
        path: input.path,
        expectedRevision: input.expectedRevision,
        actorId: input.actorId,
        note: input.note,
    });
    if (isCmsFailure(published)) {
        return { ok: false, published: null, message: published.message, edge: null };
    }
    const steps: CmsEdgeStepResult[] = [];
    if (input.bindings) {
        steps.push(...(await mirrorPublishedRevision({ bindings: input.bindings, revision: published.data })));
    } else if (input.config) {
        steps.push(await syncPublishedRevisionToKvRest(input.config, published.data));
    }
    if (input.config) {
        steps.push(await purgeCloudflareCache(input.config, edgeCacheUrls(input.config.baseUrl, input.path)));
    }
    const failed = steps.filter((step) => step.status === "failed");
    return {
        ok: failed.length === 0,
        published: published.data,
        message: failed.length
            ? `발행 리비전 r${published.data.publishedRevision}은 저장되었으나 에지 반영 일부가 실패했습니다: ${failed.map((step) => step.detail).join(" / ")}`
            : `발행 리비전 r${published.data.publishedRevision}을 확정하고 에지 미러·캐시 무효화를 마쳤습니다.`,
        edge: {
            path: published.data.path,
            publishedRevision: published.data.publishedRevision,
            checksum: published.data.checksum,
            cacheKey: publishedDocumentKey(published.data.path),
            steps,
        },
    };
}

// Worker에서 발행본 JSON을 제공할 때 사용하는 읽기 핸들러 계약입니다.
export async function readEdgePublishedDocument(
    bindings: CmsEdgeBindings,
    path: string,
): Promise<{ status: number; body: string | null }> {
    const stored = await readPublishedRevision(bindings, path);
    if (!stored) return { status: 404, body: null };
    return { status: 200, body: JSON.stringify(stored) };
}
