import { notFound } from "next/navigation";
import { PAGES, PROGRAMS } from "../../src/data/catalog.ts";
import ServicePageClient from "../../components/ServicePageClient";

// [실제 안내와 정적 내보내기 / Complete service content and static route export]
// 전용 React 화면만 제외하고 등록된 모든 하위 경로를 정적 산출물에 포함합니다.
// Export every registered service route except those owned by a dedicated React page.
const dedicated = new Set(["/", "/programs", "/about/introduction", "/design-rules", "/account", "/account/login", "/account/signup", "/account/recovery"]);

export function generateStaticParams() {
    const programs = new Set(PROGRAMS.map((program) => "/programs/" + program.id));
    return PAGES.filter((page) => !dedicated.has(page.path) && !programs.has(page.path)
        && !/^\/programs\/[^/]+$/.test(page.path))
        .map((page) => ({ slug: page.path.slice(1).split("/") }));
}

export default function CatalogDynamicPage({ params }: { params: { slug: string[] } }) {
    const path = "/" + params.slug.join("/");
    if (!PAGES.some((page) => page.path === path)) notFound();
    return <ServicePageClient path={path} />;
}
