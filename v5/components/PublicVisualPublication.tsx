"use client";

import type { RefObject } from "react";
import { useEffect } from "react";

// 공개 페이지 최초 HTML은 그대로 둡니다. / Keep the first static render independent of the BaaS.
export default function PublicVisualPublication({ pathname, scope }: {
    pathname: string;
    scope: RefObject<HTMLElement>;
}) {
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_CMS_PUBLIC_SNAPSHOTS !== "true" || window.self !== window.top) return;
        const root = scope.current;
        if (!root || root.querySelector("[data-cms-static-fallback]")) return;
        const controller = new AbortController();
        let restore: (() => void) | undefined;
        void (async () => {
            const { publicVisualPath, readPublishedVisual } = await import("../src/cms/studio-public-client");
            const path = publicVisualPath("/v5" + pathname, true);
            if (!path || controller.signal.aborted || publicVisualPath(window.location.pathname, true) !== path) return;
            const snapshot = await readPublishedVisual({
                origin: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
                key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
                path,
                signal: controller.signal,
            });
            if (!snapshot || !root.isConnected || controller.signal.aborted ||
                publicVisualPath(window.location.pathname, true) !== path) return;
            const { applyPublicVisual } = await import("../src/cms/studio-public-dom");
            if (root.isConnected && !controller.signal.aborted && publicVisualPath(window.location.pathname, true) === path) {
                restore = applyPublicVisual(document, root, snapshot.document);
            }
        })().catch(() => { /* 읽기 실패 시 정적 원본 유지 / Fail back to the static page. */ });
        return () => { controller.abort(); restore?.(); };
    }, [pathname, scope]);
    return null;
}
