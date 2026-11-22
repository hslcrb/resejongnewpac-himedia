import { sanitizeVisualDocument, visualDocumentChecksum } from "./visual-document.ts";
import type { VisualDraftDocument } from "./visual-document.ts";

export type StudioRecovery = { document: VisualDraftDocument; revision: number | null };
type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "getItem" | "setItem">;
type Decision = { state: "remote" | "recover" | "conflict"; document: VisualDraftDocument | null };

// 오래된 복구본은 내보낼 수 있지만 자동으로 원격 초안 위에 쓰지 않는다.
// A stale recovery can be downloaded, never silently applied over newer remote work.
export function chooseStudioDraft(remote: VisualDraftDocument | null, revision: number, local: StudioRecovery | null): Decision {
    if (!local || (remote && visualDocumentChecksum(remote) === visualDocumentChecksum(local.document))) {
        return { state: "remote", document: remote };
    }
    if (local.revision === revision || (local.revision === null && !remote && revision === 0)) {
        return { state: "recover", document: local.document };
    }
    return { state: "conflict", document: remote };
}

function key(scope: string, path: string) {
    return "sejong-cms-studio-v3:" + encodeURIComponent(scope) + ":" + path;
}
const validRevision = (revision: number) => Number.isSafeInteger(revision) && revision >= 0;

export function readStudioDraft(storage: Reader, scope: string, path: string, requested?: number): StudioRecovery | null {
    try {
        const prefix = key(scope, path);
        const latest = storage.getItem(prefix);
        if (requested === undefined && (latest === null || !/^\d+$/.test(latest))) return null;
        const revision = requested ?? Number(latest);
        if (!validRevision(revision)) return null;
        const raw = storage.getItem(prefix + ":r" + revision);
        if (raw === null) return null;
        return { document: sanitizeVisualDocument(JSON.parse(raw), path), revision };
    } catch { return null; }
}

export function writeStudioDraft(storage: Writer, scope: string, path: string, revision: number, draft: VisualDraftDocument): boolean {
    if (draft.path !== path || !validRevision(revision)) return false;
    try {
        const prefix = key(scope, path);
        storage.setItem(prefix + ":r" + revision, JSON.stringify(draft));
        storage.setItem(prefix, String(revision));
        return true;
    } catch { return false; }
}

export function clearStudioDraft(storage: Pick<Storage, "getItem" | "removeItem">, scope: string, path: string, revision: number): void {
    if (!validRevision(revision)) return;
    const prefix = key(scope, path);
    storage.removeItem(prefix + ":r" + revision);
    if (storage.getItem(prefix) === String(revision)) storage.removeItem(prefix);
}
