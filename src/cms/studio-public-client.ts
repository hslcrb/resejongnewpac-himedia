import { decodePublicVisualSnapshot } from "./studio-public-snapshot.ts";

const publicPathPattern = /^\/(?:[a-z0-9_-]+(?:\/[a-z0-9_-]+)*)?$/;
const excludedRoutes = /^\/(admin|account|booking|login|design-rules|api)(?:\/|$)/;
const maxResponseBytes = 1024 * 1024;
const networkTimeoutMs = 2500;

function allowedPath(path: string): boolean {
    return path.length <= 220 && publicPathPattern.test(path) && !excludedRoutes.test(path);
}

// 익명 운영 페이지에만 적용한다. / Never load public overrides into a CMS artboard iframe.
export function publicVisualPath(browserPath: string, topLevel: boolean): string | null {
    if (!topLevel || !browserPath.startsWith("/") || browserPath.includes("//")) return null;
    const path = browserPath.replace(/\/$/, "") || "/";
    return allowedPath(path) ? path : null;
}

function publicApiKey(key: string): boolean {
    if (key.length > 2048) return false;
    if (/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key)) return true;
    if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(key)) return false;
    try {
        const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        return payload?.role === "anon";
    } catch { return false; }
}

async function readBoundedJson(response: Response) {
    if (!response.body || !/^application\/json(?:;|$)/i.test(response.headers.get("content-type") || "")) return null;
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    let body = "";
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) return JSON.parse(body + decoder.decode());
            bytes += value.byteLength;
            if (bytes > maxResponseBytes) return null;
            body += decoder.decode(value, { stream: true });
        }
    } finally {
        void reader.cancel().catch(() => {});
        reader.releaseLock();
    }
}

export async function readPublishedVisual(options: {
    origin: string;
    key: string;
    path: string;
    signal: AbortSignal;
    fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
}) {
    const { origin, key, path, signal, fetcher = fetch } = options;
    const base = origin.replace(/\/$/, "");
    if (signal.aborted || !allowedPath(path) || !publicApiKey(key) ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base)) return null;
    const request = new AbortController();
    const abort = () => request.abort();
    const timeout = setTimeout(abort, networkTimeoutMs);
    signal.addEventListener("abort", abort, { once: true });
    try {
        const response = await fetcher(base + "/rest/v1/rpc/sejong_cms_read_public_visual", {
            method: "POST",
            headers: { apikey: key, "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ p_path: path }),
            credentials: "omit",
            redirect: "error",
            referrerPolicy: "no-referrer",
            signal: request.signal,
        });
        if (!response.ok || request.signal.aborted) return null;
        const value = await readBoundedJson(response);
        return request.signal.aborted ? null : decodePublicVisualSnapshot(value, path);
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
    }
}
