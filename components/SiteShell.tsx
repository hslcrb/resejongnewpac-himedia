"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useGSAP } from "../src/lib/gsap";
import { createEditorialMotion } from "../src/lib/editorial-motion";
import Header from "./Header";
import Footer from "./Footer";
import { SmallNotificationModalHost } from "./SmallNotificationModal";
import ReturnTop from "./ReturnTop";
import ContextMenu from "./ContextMenu";
import AiChatWidget from "./AiChatWidget";
import PublicVisualPublication from "./PublicVisualPublication";
import { trackScrollFragments } from "../src/lib/scroll-fragments";

// [사이트와 문서의 탐색 영역 / Product and documentation navigation]
// 디자인 가이드는 자체 문서 탐색을 사용하고, 나머지 화면은 기존 사이트 셸을 유지합니다.
// The design guide owns its documentation navigation; other pages retain the product shell.
export default function SiteShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const main = useRef<HTMLElement>(null);
    useGSAP(() => (main.current ? createEditorialMotion(main.current, pathname) : undefined), {
        scope: main,
        dependencies: [pathname],
        revertOnUpdate: true,
    });
    const documentation = pathname.replace(/\/$/, "").endsWith("/design-rules");
    // [관리자·디자이너는 사이트 셸 없이 전체 화면 캔버스 / Admin routes render the canvas without site chrome]
    const canvasRoute = /\/admin(?:\/|$)/.test(pathname.replace(/\/$/, ""));
    useEffect(() => {
        const path = pathname.replace(/\/$/, "") || "/";
        const accountState =
            /^\/account(?:\/|$)/.test(path) && !/^\/account\/(?:login|signup|recovery)$/.test(path);
        if (path === "/" || path === "/design-rules" || accountState || /^\/admin(?:\/|$)/.test(path)) return;
        return trackScrollFragments(() => {
            const content = document.getElementById("main");
            const footer = document.getElementById("footer");
            const elements = [
                content,
                ...Array.from(
                    content?.querySelectorAll<HTMLElement>(
                        "section[id], [data-scroll-fragment][id]",
                    ) || [],
                ),
                footer,
            ];
            return elements.flatMap((element) =>
                element ? [{ element, fragment: element.id }] : [],
            );
        });
    }, [pathname]);
    if (canvasRoute) return <>{children}</>;
    if (documentation) {
        return (
            <>
                <a
                    data-text="action"
                    data-text-size="control"
                    data-component-owner="site-shell"
                    data-component-part="skip-link"
                    className="skip-link"
                    href="#main"
                >
                    본문 바로가기
                </a>
                {children}
                <SmallNotificationModalHost />
            </>
        );
    }
    return (
        <>
            <a
                data-text="action"
                data-text-size="control"
                data-component-owner="site-shell"
                data-component-part="skip-link"
                className="skip-link"
                href="#main"
            >
                본문 바로가기
            </a>
            <Header />
            <main
                ref={main}
                data-component-id="site-shell"
                data-text="body"
                id="main"
                tabIndex={-1}
            >
                {children}
            </main>
            <PublicVisualPublication pathname={pathname} scope={main} />
            <Footer />
            <ReturnTop />
            <AiChatWidget />
            <ContextMenu />
            <SmallNotificationModalHost />
        </>
    );
}
