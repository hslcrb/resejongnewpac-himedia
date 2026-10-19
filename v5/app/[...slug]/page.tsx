import React from "react";
import Link from "next/link";
import { PAGES, NAV, VENUES, NOTICES } from "../../src/data/catalog.js";
import { PageMeta } from "../../types/sejong";

export function generateStaticParams() {
    const routes = new Set<string>();

    for (const page of PAGES) {
        if (page.path && page.path !== "/") {
            const p = page.path.replace(/^\//, "");
            // 이미 전용 폴더가 있는 라우트는 slug에서 제외
            if (
                !p.startsWith("design-rules") &&
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

export default function CatalogDynamicPage({
    params,
}: {
    params: { slug: string[] };
}) {
    const path = "/" + (params.slug?.join("/") || "");
    const pageMeta = PAGES.find((p: any) => p.path === path) as PageMeta | undefined;
    const currentGroup = NAV.find((g: any) => path.startsWith(g.path));

    // 혹시 venue 상세 또는 notice 상세인지 체크
    const venueMatch = VENUES.find((v: any) => path.endsWith(`/${v.id}`));
    const noticeMatch = NOTICES.find((n: any) => path.endsWith(`/${n.id}`));

    const title = pageMeta?.title || venueMatch?.name || noticeMatch?.title || "세종문화회관 안내";
    const description = pageMeta?.description || venueMatch?.description || (noticeMatch ? `등록일: ${noticeMatch.date}` : "문화와 예술이 살아 숨 쉬는 공간, 세종문화회관입니다.");

    return (
        <div className="container" style={{ padding: "3rem 1.5rem 6rem", maxWidth: "1000px", margin: "0 auto" }}>
            {/* 브레드크럼 */}
            <nav className="breadcrumbs" aria-label="현재 위치" style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", color: "#64748b", fontSize: "0.875rem" }}>
                <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>홈</Link>
                {currentGroup && (
                    <>
                        <span>/</span>
                        <Link href={currentGroup.path} style={{ textDecoration: "none", color: "inherit" }}>{currentGroup.title}</Link>
                    </>
                )}
                <span>/</span>
                <span aria-current="page" style={{ fontWeight: 600, color: "#0f172a" }}>{title}</span>
            </nav>

            <header style={{ marginBottom: "2.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "1.5rem" }}>
                {currentGroup && (
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0284c7", letterSpacing: "0.05em" }}>
                        {currentGroup.title.toUpperCase()}
                    </span>
                )}
                <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: "#0f172a", margin: "0.3rem 0 0.5rem 0" }}>
                    {title}
                </h1>
                <p style={{ fontSize: "1.05rem", color: "#64748b", margin: 0 }}>
                    {description}
                </p>

                {/* 하위 메뉴 탭 */}
                {currentGroup && currentGroup.items && (
                    <nav style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
                        {currentGroup.items.map(([label, subPath]: [string, string]) => {
                            const active = path === subPath;
                            return (
                                <Link
                                    key={subPath}
                                    href={subPath}
                                    style={{
                                        padding: "0.4rem 0.8rem",
                                        borderRadius: "6px",
                                        fontSize: "0.85rem",
                                        fontWeight: active ? 700 : 500,
                                        textDecoration: "none",
                                        border: active ? "1px solid #0f172a" : "1px solid #e2e8f0",
                                        background: active ? "#0f172a" : "#ffffff",
                                        color: active ? "#ffffff" : "#475569",
                                    }}
                                >
                                    {label}
                                </Link>
                            );
                        })}
                    </nav>
                )}
            </header>

            {/* 본문 콘텐츠 섹션 */}
            <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "2rem" }}>
                {venueMatch ? (
                    <div>
                        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1rem" }}>공간 세부 정보</h2>
                        <dl style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.75rem", fontSize: "0.95rem" }}>
                            <dt style={{ color: "#64748b", fontWeight: 600 }}>수용 인원</dt>
                            <dd style={{ margin: 0, fontWeight: 700 }}>{venueMatch.capacity}석</dd>
                            <dt style={{ color: "#64748b", fontWeight: 600 }}>특징</dt>
                            <dd style={{ margin: 0 }}>{venueMatch.description}</dd>
                        </dl>
                        <div style={{ marginTop: "2rem" }}>
                            <Link href="/rental/guide" className="button button--dark">
                                대관 신청 및 가이드 보기 →
                            </Link>
                        </div>
                    </div>
                ) : noticeMatch ? (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                            <span>구분: {noticeMatch.category}</span>
                            <span>작성일: {noticeMatch.date}</span>
                        </div>
                        <div style={{ fontSize: "1rem", lineHeight: 1.8, color: "#334155" }}>
                            <p>{noticeMatch.content || "세종문화회관을 이용해 주시는 시민 여러분께 감사드립니다. 본 공지사항의 자세한 사항은 고객센터(02-399-1000)로 문의해 주시기 바랍니다."}</p>
                        </div>
                        <div style={{ marginTop: "2.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1.5rem" }}>
                            <Link href="/news/notices" className="button button--outline">
                                공지사항 목록으로 돌아가기
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                            서비스 및 공간 안내
                        </h2>
                        <p style={{ color: "#475569", lineHeight: 1.7, fontSize: "0.95rem" }}>
                            본 페이지는 세종문화회관 v5 Next.js 14 리뉴얼 프로젝트의 정적 카탈로그 페이지입니다.
                            시민과 예술가가 함께 호흡하는 열린 문화 예술 공간의 모든 정보가 체계적으로 제공됩니다.
                        </p>
                        <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem" }}>
                            <Link href="/programs" className="button button--dark">
                                프로그램 보러가기 →
                            </Link>
                            <Link href="/design-rules" className="button button--outline">
                                v5 디자인 규칙 보기
                            </Link>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
