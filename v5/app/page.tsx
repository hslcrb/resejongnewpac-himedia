"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PROGRAMS, VENUES, NOTICES } from "../src/data/catalog.js";
import ProgramCard from "../components/ProgramCard";
import { Program } from "../types/sejong";

export default function HomePage() {
    const [selectedCategory, setSelectedCategory] = useState<string>("전체");

    const filteredPrograms = selectedCategory === "전체"
        ? (PROGRAMS as unknown as Program[]).slice(0, 8)
        : (PROGRAMS as unknown as Program[]).filter((p) => p.category === selectedCategory).slice(0, 8);

    const categories = ["전체", "공연", "전시", "교육"];

    return (
        <div className="home-v4">
            {/* 메인 히어로 섹션 */}
            <section className="home-hero">
                <div className="container home-hero__content">
                    <div className="home-hero__badge">
                        <span>2026 SEJONG SEASON</span>
                        <Link href="/design-rules" style={{ color: "#38bdf8", marginLeft: "8px", fontWeight: 700 }}>
                            [v5 디자인 규칙 보기 →]
                        </Link>
                    </div>
                    <h1 className="home-hero__title">
                        예술로 이어지는 하루,<br />
                        당신의 일상에 스며드는 감동
                    </h1>
                    <p className="home-hero__desc">
                        서울의 중심 광화문에서 펼쳐지는 최고 수준의 클래식, 연극, 뮤지컬, 전시를 만나보세요.
                    </p>
                    <div className="home-hero__actions">
                        <Link href="/programs" className="button button--dark">
                            공연·전시 전체보기 →
                        </Link>
                        <Link href="/visit/plan" className="button button--outline">
                            방문 계획 세우기
                        </Link>
                    </div>
                </div>
            </section>

            {/* 프로그램 탐색 섹션 */}
            <section className="container home-section" style={{ marginTop: "3.5rem" }}>
                <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem" }}>
                    <div>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0284c7" }}>CURATION</span>
                        <h2 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "0.2rem 0 0 0" }}>지금 주목할 세종의 예술</h2>
                    </div>
                    {/* 카테고리 필터 탭 */}
                    <div className="category-tabs" style={{ display: "flex", gap: "0.5rem" }}>
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                style={{
                                    padding: "0.45rem 0.9rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.85rem",
                                    fontWeight: 600,
                                    border: selectedCategory === cat ? "1px solid #0f172a" : "1px solid #e2e8f0",
                                    background: selectedCategory === cat ? "#0f172a" : "#ffffff",
                                    color: selectedCategory === cat ? "#ffffff" : "#475569",
                                    cursor: "pointer",
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="program-results-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.5rem" }}>
                    {filteredPrograms.map((program) => (
                        <ProgramCard key={program.id} program={program} />
                    ))}
                </div>

                <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
                    <Link href="/programs" className="button button--outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                        더 많은 프로그램 보기 ({PROGRAMS.length}개) →
                    </Link>
                </div>
            </section>

            {/* 주요 공간 안내 & 소식 섹션 */}
            <section className="container home-section" style={{ marginTop: "4.5rem", marginBottom: "4rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem" }}>
                    {/* 공간 안내 */}
                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.75rem" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#854d0e" }}>VENUES</span>
                        <h3 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0.3rem 0 1rem 0" }}>세종의 대표 무대</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {VENUES.slice(0, 4).map((venue: any) => (
                                <Link
                                    key={venue.id}
                                    href={`/rental/venues/${venue.id}`}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "0.75rem",
                                        background: "#f8fafc",
                                        borderRadius: "8px",
                                        textDecoration: "none",
                                        color: "inherit",
                                    }}
                                >
                                    <div>
                                        <strong style={{ fontSize: "0.95rem" }}>{venue.name}</strong>
                                        <span style={{ fontSize: "0.8rem", color: "#64748b", marginLeft: "0.5rem" }}>{venue.capacity}석</span>
                                    </div>
                                    <span style={{ fontSize: "0.85rem", color: "#0284c7", fontWeight: 600 }}>상세보기 →</span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* 공지사항 */}
                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.75rem" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0369a1" }}>NOTICE</span>
                        <h3 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0.3rem 0 1rem 0" }}>주요 소식</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {NOTICES.slice(0, 4).map((notice: any) => (
                                <Link
                                    key={notice.id}
                                    href={`/news/notices/${notice.id}`}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "0.75rem",
                                        borderBottom: "1px solid #f1f5f9",
                                        textDecoration: "none",
                                        color: "inherit",
                                    }}
                                >
                                    <span style={{ fontSize: "0.9rem", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                                        {notice.title}
                                    </span>
                                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{notice.date}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
