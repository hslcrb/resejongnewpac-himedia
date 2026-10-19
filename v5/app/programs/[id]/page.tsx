import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PROGRAMS, VENUES } from "../../../src/data/catalog.js";
import { Program } from "../../../types/sejong";

export function generateStaticParams() {
    return (PROGRAMS as unknown as Program[]).map((p) => ({
        id: String(p.id),
    }));
}

export default function ProgramDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const program = (PROGRAMS as unknown as Program[]).find((p) => String(p.id) === params.id);
    if (!program) notFound();

    return (
        <div className="container" style={{ padding: "3rem 1.5rem 6rem", maxWidth: "1000px", margin: "0 auto" }}>
            <nav className="breadcrumbs" aria-label="현재 위치" style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>홈</Link>
                <span>/</span>
                <Link href="/programs" style={{ textDecoration: "none", color: "inherit" }}>프로그램</Link>
                <span>/</span>
                <span aria-current="page" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{program.title}</span>
            </nav>

            <article style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2.5rem", marginTop: "1rem" }}>
                {/* 포스터 영역 */}
                <div>
                    <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border-default)", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={`/v5/assets/images/${program.poster}`}
                            alt={program.title}
                            style={{ width: "100%", height: "auto", display: "block" }}
                        />
                    </div>
                </div>

                {/* 상세 정보 영역 */}
                <div>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                        <span style={{ padding: "0.25rem 0.6rem", background: "var(--accent-information)", color: "var(--text-on-brand)", borderRadius: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                            {program.category}
                        </span>
                        <span style={{ padding: "0.25rem 0.6rem", background: "var(--surface-subtle)", color: "var(--text-secondary)", borderRadius: "4px", fontSize: "0.8rem", fontWeight: 600, border: "1px solid var(--border-default)" }}>
                            {program.genre}
                        </span>
                    </div>

                    <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 1rem 0", lineHeight: 1.3, letterSpacing: "-0.03em" }}>
                        {program.title}
                    </h1>

                    <div style={{ background: "var(--surface-subtle)", border: "1px solid var(--border-default)", borderRadius: "10px", padding: "1.25rem", marginBottom: "1.5rem" }}>
                        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "80px 1fr", gap: "0.6rem", fontSize: "0.925rem" }}>
                            <dt style={{ color: "var(--text-secondary)", fontWeight: 600 }}>일시</dt>
                            <dd style={{ margin: 0, color: "var(--text-primary)", fontWeight: 600 }}>{program.start} ~ {program.end}</dd>

                            <dt style={{ color: "var(--text-secondary)", fontWeight: 600 }}>장소</dt>
                            <dd style={{ margin: 0, color: "var(--text-primary)" }}>{program.venue}</dd>

                            <dt style={{ color: "var(--text-secondary)", fontWeight: 600 }}>가격</dt>
                            <dd style={{ margin: 0, color: "var(--text-primary)" }}>{program.price || "VIP석 100,000원 / R석 80,000원 / S석 50,000원"}</dd>

                            <dt style={{ color: "var(--text-secondary)", fontWeight: 600 }}>시간</dt>
                            <dd style={{ margin: 0, color: "var(--text-primary)" }}>{program.time || "평일 19:30 / 주말 15:00, 19:00"}</dd>
                        </dl>
                    </div>

                    <div style={{ marginBottom: "2rem" }}>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 0.5rem 0" }}>프로그램 소개</h3>
                        <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, fontSize: "0.95rem", margin: 0 }}>
                            {program.description}
                        </p>
                    </div>

                    <div style={{ display: "flex", gap: "1rem" }}>
                        <Link
                            href={`/booking/${program.id}`}
                            style={{
                                flex: 1,
                                textAlign: "center",
                                padding: "0.9rem 1.5rem",
                                fontSize: "1.05rem",
                                fontWeight: 700,
                                background: "var(--action-primary)",
                                color: "var(--text-inverse)",
                                borderRadius: "6px",
                                textDecoration: "none",
                            }}
                        >
                            예매하기 (온라인 예매) →
                        </Link>
                        <Link
                            href="/programs"
                            style={{
                                padding: "0.9rem 1.25rem",
                                border: "1px solid var(--border-strong)",
                                borderRadius: "6px",
                                color: "var(--text-primary)",
                                textDecoration: "none",
                                fontWeight: 600,
                                fontSize: "0.95rem",
                            }}
                        >
                            목록으로
                        </Link>
                    </div>
                </div>
            </article>
        </div>
    );
}
