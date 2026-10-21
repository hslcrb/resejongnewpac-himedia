import React from "react";
import Link from "next/link";
import { SystemLink } from "../../components/SystemPrimitives";
import { PAGES, NAV, VENUES, NOTICES } from "../../src/data/catalog";
import type { PageMeta } from "../../types/sejong.ts";

// [등록된 안내 경로의 정적 생성 / Static generation for registered information routes]
export function generateStaticParams() {
    const routes = new Set<string>();

    for (const page of PAGES) {
        if (page.path && page.path !== "/") {
            const p = page.path.replace(/^\//, "");
            // 이미 전용 폴더가 있는 라우트는 slug에서 제외
            if (
                !p.startsWith("design-rules") &&
                p !== "about/introduction" &&
                !p.startsWith("account") &&
                p !== "programs"
            ) {
                routes.add(p);
            }
        }
    }

    for (const venue of VENUES) {
        routes.add(`rental/venues/${venue.id}`);
        routes.add(`visit/spaces/${venue.id}`);
    }

    for (const notice of NOTICES) {
        routes.add(`news/notices/${notice.id}`);
    }

    return Array.from(routes).map((route) => ({
        slug: route.split("/"),
    }));
}

// [공통 지면과 읽기 폭을 나누는 안내 / Information with a shared frame and reading measure]
export default function CatalogDynamicPage({
    params,
}: {
    params: { slug: string[] };
}) {
    const path = "/" + (params.slug?.join("/") || "");
    const pageMeta = PAGES.find((p: any) => p.path === path) as PageMeta | undefined;
    const currentGroup = NAV.find((g: any) => path.startsWith(g.path));

    // venue 상세 또는 notice 상세인지 체크
    const venueMatch = VENUES.find((v: any) => path.endsWith(`/${v.id}`));
    const noticeMatch = NOTICES.find((n: any) => path.endsWith(`/${n.id}`));

    const title = pageMeta?.title || venueMatch?.name || noticeMatch?.title || "세종문화회관 안내";
    const description = pageMeta?.description || venueMatch?.description || (noticeMatch ? `등록일: ${noticeMatch.date}` : "세종문화회관의 서비스와 공간 상세 안내입니다.");

    return (
        <div className="container page-layout catalog-page">
            <nav className="page-layout-breadcrumbs" aria-label="현재 위치">
                <Link href="/">홈</Link>
                {currentGroup && (
                    <>
                        <span aria-hidden="true">/</span>
                        <Link href={currentGroup.path}>{currentGroup.title}</Link>
                    </>
                )}
                <span aria-hidden="true">/</span>
                <span aria-current="page">{title}</span>
            </nav>

            <header className="page-layout-heading catalog-page-heading">
                {currentGroup && (
                    <span className="catalog-page-category">
                        {currentGroup.title.toUpperCase()}
                    </span>
                )}
                <h1>
                    {title}
                </h1>
                <p>
                    {description}
                </p>

                {/* [줄바꿈 가능한 하위 탐색 / Wrapping navigation within the current group] */}
                {currentGroup && currentGroup.items && (
                    <nav className="catalog-page-navigation page-layout-actions" aria-label={`${currentGroup.title} 메뉴`}>
                        {currentGroup.items.map(([label, subPath]: [string, string]) => {
                            const active = path === subPath;
                            return (
                                <SystemLink
                                    key={subPath}
                                    href={subPath}
                                    variant={active ? "primary" : "secondary"}
                                    aria-current={active ? "page" : undefined}
                                >
                                    {label}
                                </SystemLink>
                            );
                        })}
                    </nav>
                )}
            </header>

            {/* [정보 종류별 내용과 공통 행동 / Information content and shared navigation actions] */}
            <section className="catalog-page-content">
                {venueMatch ? (
                    <div className="page-layout-prose">
                        <h2>공간 세부 정보</h2>
                        <dl className="page-layout-facts">
                            <dt>수용 인원</dt>
                            <dd>{venueMatch.capacity}석</dd>
                            <dt>특징</dt>
                            <dd>{venueMatch.description}</dd>
                        </dl>
                        <div className="page-layout-actions catalog-page-actions">
                            <SystemLink href="/rental/guide">
                                대관 신청 및 가이드 보기 →
                            </SystemLink>
                        </div>
                    </div>
                ) : noticeMatch ? (
                    <div className="page-layout-prose">
                        <div className="catalog-page-meta">
                            <span>구분: {noticeMatch.category}</span>
                            <span>작성일: {noticeMatch.date}</span>
                        </div>
                        <div>
                            <p>{noticeMatch.content || "세종문화회관을 이용해 주시는 시민 여러분께 감사드립니다. 본 공지사항의 자세한 사항은 고객센터(02-399-1000)로 문의해 주시기 바랍니다."}</p>
                        </div>
                        <div className="page-layout-actions catalog-page-actions">
                            <SystemLink
                                href="/news/notices"
                                variant="secondary"
                            >
                                공지사항 목록으로 돌아가기
                            </SystemLink>
                        </div>
                    </div>
                ) : (
                    <div className="page-layout-prose">
                        <h2>
                            서비스 및 공간 안내
                        </h2>
                        <p>
                            세종문화회관의 서비스와 공간을 페이지별로 정리한 안내입니다.
                        </p>
                        <div className="page-layout-actions catalog-page-actions">
                            <SystemLink href="/programs" variant="primary">
                                프로그램 보러가기 →
                            </SystemLink>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
