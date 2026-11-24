import { normalizeVisualPath } from "./visual-document.ts";

// 프레임 URL을 실제 문서와 대조한다. / Match the actual frame URL to the selected public document.
export function isStudioFrameLocation(origin: string, target: string, actual: string): boolean {
    try {
        const url = new URL(actual);
        return url.origin === origin && /^\/v5(?:\/|$)/.test(url.pathname)
            && normalizeVisualPath(target) === target && normalizeVisualPath(url.pathname) === target;
    } catch {
        return false;
    }
}

export function readStudioFrame(frame: HTMLIFrameElement | null, origin: string, path: string): Document | null {
    try {
        const doc = frame?.contentDocument;
        return doc?.body && isStudioFrameLocation(origin, path, doc.URL) ? doc : null;
    } catch {
        return null;
    }
}
