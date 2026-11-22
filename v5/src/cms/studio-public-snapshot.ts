import { normalizeVisualPath, sanitizeVisualDocument, visualDocumentChecksum } from "./visual-document.ts";
import type { VisualDraftDocument } from "./visual-document.ts";

export type PublicVisualSnapshot = { path: string; publishedRevision: number; checksum: string; document: VisualDraftDocument };
const protectedApi = /^\/api(?:\/|$)/i;

// 동일 경로의 무결한 발행본만 전달합니다. / Accept only a verified revision for this path.
export function decodePublicVisualSnapshot(value: unknown, pathname: string): PublicVisualSnapshot | null {
    const path = normalizeVisualPath(pathname);
    if (!path || protectedApi.test(path) || !value || typeof value !== "object" || Array.isArray(value)) return null;
    const raw = value as Record<string, unknown>;
    const revision = raw.publishedRevision;
    const checksum = raw.checksum;
    if (raw.path !== path || typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1 ||
        typeof checksum !== "string" || !/^[a-f0-9]{64}$/.test(checksum) || !raw.document ||
        typeof raw.document !== "object" || Array.isArray(raw.document)) return null;
    try {
        const document = sanitizeVisualDocument(raw.document, path);
        if (visualDocumentChecksum(document) !== checksum) return null;
        return { path, publishedRevision: revision, checksum, document };
    } catch {
        return null;
    }
}
