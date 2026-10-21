"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PAGES, PROGRAMS } from "../src/data/catalog.ts";
import { OFFICIAL_MENU_MAP } from "../src/data/official-navigation.ts";
import { renderOfficialPage, bindOfficialPage } from "../src/features/official.ts";
import { renderPages, bindPages } from "../src/features/pages.ts";
import { renderPrograms, bindPrograms } from "../src/features/programs.ts";
import { renderFlows, bindFlows } from "../src/features/flows.ts";
import { renderGoods, bindGoods } from "../src/features/goods.ts";
import { renderUtilities, bindUtilities } from "../src/features/utilities.ts";
import { renderJourneys, bindJourneys } from "../src/features/journeys.ts";
import { renderStory, bindStory } from "../src/features/story.ts";
import { bindCards } from "../src/components/cards.ts";
import { bindPageMotion } from "../src/components/motion.ts";
import { readStore, writeStore, esc, icon } from "../src/lib/core.ts";
import { showToast } from "./Toast";

type Renderer = (path: string, query: URLSearchParams) => string | null | undefined;
type Binder = (root: HTMLElement, path: string, query: URLSearchParams) => unknown;
const features: [Renderer, Binder][] = [
    [renderOfficialPage, bindOfficialPage], [renderJourneys, bindJourneys],
    [renderStory, bindStory], [renderFlows, bindFlows], [renderPrograms, bindPrograms],
    [renderGoods, bindGoods], [renderPages, bindPages], [renderUtilities, bindUtilities],
];

// [기존 이용 흐름을 실제 Next 경로로 연결 / Mount complete service flows in Next routes]
// 원본 렌더러의 폼·필터·저장 동작을 유지하며 링크와 자산 경로를 정규화합니다.
// Preserve working forms, filters and local records while adapting links and assets.
function ServiceContent({ path }: { path: string }) {
    const rootRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const search = searchParams.toString();
    const meta = PAGES.find((page) => page.path === path);
    const bookingProgram = path.startsWith("/booking/") ? PROGRAMS.find((program) => program.id === path.slice(9)) : undefined;

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const previousPage = document.body.dataset.page;
        const query = new URLSearchParams(search);
        let disposeFeature: unknown;
        let rendered = false;
        const normalize = () => {
            root.querySelectorAll<HTMLElement>("[src], [href]").forEach((element) => {
                for (const attribute of ["src", "href"]) {
                    const value = element.getAttribute(attribute);
                    if (!value) continue;
                    if (value.startsWith("assets/")) element.setAttribute(attribute, "/v5/" + value);
                    else if (attribute === "href" && value.startsWith("#/")) element.setAttribute(attribute, "/v5" + value.slice(1));
                }
            });
        };
        for (const [render, bind] of features) {
            const html = render(path, query);
            if (html === null || html === undefined) continue;
            const original = OFFICIAL_MENU_MAP.find((item) => item.path === path && item.mode === "local-with-official-source");
            root.innerHTML = html + (original ? `<div class="container official-page"><section class="official-source"><div><h2>공식 서비스로 이어가기</h2><p>최신 운영 정보와 실제 신청은 세종문화회관에서 확인하세요.</p></div><a class="button button--dark" href="${esc(original.source)}" target="_blank" rel="noopener noreferrer">${esc(original.title)} 공식 안내 ${icon("diagonal", 18)}<span class="sr-only"> (새 창)</span></a></section></div>` : "");
            normalize();
            disposeFeature = bind(root, path, query);
            rendered = true;
            break;
        }
        if (!rendered) root.innerHTML = '<div class="container page-content"><h1>안내를 찾을 수 없습니다</h1><a class="button button--dark" href="/v5/services/">이용 길잡이</a></div>';

        const navigateHash = () => {
            if (!window.location.hash.startsWith("#/")) return;
            router.replace(window.location.hash.slice(1));
        };
        const handleClick = (event: MouseEvent) => {
            if (!(event.target instanceof Element)) return;
            const favorite = event.target.closest<HTMLButtonElement>("[data-favorite]");
            if (favorite) {
                const program = PROGRAMS.find((item) => item.id === favorite.dataset.favorite);
                if (!program) return;
                const previous = readStore<string[]>("favorites", []);
                const exists = previous.includes(program.id);
                writeStore("favorites", exists ? previous.filter((id) => id !== program.id) : [...previous, program.id]);
                root.querySelectorAll<HTMLElement>(`[data-favorite="${program.id}"]`).forEach((button) => {
                    button.classList.toggle("selected", !exists);
                    button.setAttribute("aria-pressed", String(!exists));
                    button.setAttribute("aria-label", `${program.title} 관심 프로그램 ${exists ? "등록" : "해제"}`);
                });
                showToast(exists ? "관심 프로그램에서 삭제했어요." : "관심 프로그램에 저장했어요.");
                return;
            }
            const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
            if (!anchor || anchor.target || anchor.hasAttribute("download") || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
            const destination = anchor.getAttribute("href") || "";
            if (destination.startsWith("/v5/") || destination === "/v5" || destination.startsWith("#/")) {
                event.preventDefault();
                router.push(destination.startsWith("#") ? destination.slice(1) : destination.slice(3) || "/");
            }
        };
        const observer = new MutationObserver(normalize);
        observer.observe(root, { subtree: true, childList: true });
        root.addEventListener("click", handleClick);
        window.addEventListener("hashchange", navigateHash);
        const disposeCards = bindCards(root);
        const disposeMotion = bindPageMotion(root);
        document.body.dataset.page = path;
        document.title = `${meta?.title || (bookingProgram ? bookingProgram.title + " 예매 체험" : "이용 안내")} | 세종문화회관`;
        navigateHash();
        return () => {
            if (previousPage === undefined) delete document.body.dataset.page;
            else document.body.dataset.page = previousPage;
            observer.disconnect();
            root.removeEventListener("click", handleClick);
            window.removeEventListener("hashchange", navigateHash);
            if (typeof disposeFeature === "function") disposeFeature();
            if (typeof disposeCards === "function") disposeCards();
            if (typeof disposeMotion === "function") disposeMotion();
        };
    }, [path, search, router, meta?.title, bookingProgram?.title]);

    // 하위 DOM은 위 효과가 소유합니다. React 자식과 직접 변경한 DOM을 섞지 않습니다.
    // The effect owns this subtree, avoiding reconciliation with imperatively rendered children.
    return <div ref={rootRef} className="service-page-host" />;
}

export default function ServicePageClient({ path }: { path: string }) {
    return <Suspense fallback={<div className="container page-content" role="status">안내를 준비하고 있습니다.</div>}><ServiceContent path={path} /></Suspense>;
}
