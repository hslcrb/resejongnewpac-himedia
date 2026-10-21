"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PROGRAMS } from "../../src/data/catalog";
import ProgramCard from "../../components/ProgramCard";
import { SystemField, SystemFilterButton } from "../../components/SystemPrimitives";
import type { Program } from "../../types/sejong.ts";

export default function ProgramsPage() {
    const [category, setCategory] = useState<string>("전체");
    const [search, setSearch] = useState<string>("");

    const categories = ["전체", "공연", "전시", "교육"];

    const filtered = (PROGRAMS as unknown as Program[]).filter((p) => {
        const matchCat = category === "전체" || p.category === category;
        const matchSearch = !search.trim() || [p.title, p.genre || "", p.venue || "", p.description || ""].join(" ").toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
    });

    return (
        <div className="container" style={{ padding: "3rem 1.5rem 6rem", maxWidth: "1200px", margin: "0 auto" }}>
            <nav className="breadcrumbs" aria-label="현재 위치" style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>홈</Link>
                <span>/</span>
                <span aria-current="page" style={{ fontWeight: 600, color: "var(--text-primary)" }}>프로그램 전체보기</span>
            </nav>

            <header style={{ marginBottom: "2.5rem" }}>
                <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 0.5rem 0", letterSpacing: "-0.03em" }}>
                    세종의 프로그램
                </h1>
                <p style={{ fontSize: "1.05rem", color: "var(--text-secondary)", margin: 0 }}>
                    서울시향, 서울시무용단, 서울시극단의 정기공연부터 기획전시와 예술아카데미까지.
                </p>
            </header>

            {/* [공통 범주 필터와 검색 / Shared category filters and search] */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {categories.map((cat) => (
                        <SystemFilterButton
                            key={cat}
                            selected={category === cat}
                            onClick={() => setCategory(cat)}
                        >
                            {cat}
                        </SystemFilterButton>
                    ))}
                </div>

                <div style={{ position: "relative", minWidth: "260px" }}>
                    <SystemField
                        id="program-query"
                        label="프로그램 검색"
                        labelHidden
                        type="search"
                        placeholder="공연명, 장르, 공연장 검색..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* 프로그램 카드 목록 */}
            {filtered.length > 0 ? (
                <div className="program-results-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.5rem" }}>
                    {filtered.map((program) => (
                        <ProgramCard key={program.id} program={program} />
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: "center", padding: "5rem 1rem", background: "var(--surface-subtle)", borderRadius: "12px", border: "1px solid var(--border-default)" }}>
                    <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 0.5rem 0" }}>
                        검색 결과가 없습니다
                    </p>
                    <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: 0 }}>
                        다른 검색어를 입력하시거나 카테고리 필터를 변경해 보세요.
                    </p>
                </div>
            )}
        </div>
    );
}
