"use client";

import React from "react";
import Link from "next/link";
import type { Program } from "../../../types/sejong.ts";
import { mediaPath } from "../../../src/lib/media";
import { SystemBadge, SystemLink } from "../../../components/SystemPrimitives";

interface ProgramDetailClientProps {
    program: Program;
}

export default function ProgramDetailClient({ program }: ProgramDetailClientProps) {
    const imagePath = mediaPath(program.image);

    return (
        <div className="container" style={{ padding: "3rem 1.5rem 6rem", maxWidth: "1000px", margin: "0 auto" }}>
            <nav
                className="breadcrumbs"
                aria-label="현재 위치"
                style={{
                    marginBottom: "1.5rem",
                    display: "flex",
                    gap: "0.5rem",
                    color: "var(--text-secondary)",
                    fontSize: "0.875rem",
                }}
            >
                <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
                    홈
                </Link>
                <span>/</span>
                <Link href="/programs" style={{ textDecoration: "none", color: "inherit" }}>
                    프로그램
                </Link>
                <span>/</span>
                <span aria-current="page" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {program.title}
                </span>
            </nav>

            <article
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: "2.5rem",
                    marginTop: "1rem",
                }}
            >
                {/* 포스터 영역 */}
                <div>
                    <div
                        style={{
                            borderRadius: "12px",
                            overflow: "hidden",
                            border: "1px solid var(--border-default)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                        }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={imagePath}
                            alt={program.imageAlt || program.title}
                            style={{ width: "100%", height: "auto", display: "block" }}
                            onError={(e) => {
                                const target = e.currentTarget;
                                if (!target.dataset.fallback) {
                                    target.dataset.fallback = "true";
                                    target.src = mediaPath();
                                }
                            }}
                        />
                    </div>
                </div>

                {/* 상세 정보 영역 */}
                <div>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                        <SystemBadge tone="info">
                            {program.category}
                        </SystemBadge>
                        <SystemBadge>
                            {program.genre}
                        </SystemBadge>
                    </div>

                    <h1
                        style={{
                            fontSize: "2rem",
                            fontWeight: 800,
                            color: "var(--text-primary)",
                            margin: "0 0 1rem 0",
                            lineHeight: 1.3,
                            letterSpacing: "-0.03em",
                        }}
                    >
                        {program.title}
                    </h1>

                    <div
                        style={{
                            background: "var(--surface-subtle)",
                            border: "1px solid var(--border-default)",
                            borderRadius: "10px",
                            padding: "1.25rem",
                            marginBottom: "1.5rem",
                        }}
                    >
                        <dl
                            style={{
                                margin: 0,
                                display: "grid",
                                gridTemplateColumns: "80px 1fr",
                                gap: "0.6rem",
                                fontSize: "0.925rem",
                            }}
                        >
                            <dt style={{ color: "var(--text-secondary)", fontWeight: 600 }}>일시</dt>
                            <dd style={{ margin: 0, color: "var(--text-primary)", fontWeight: 600 }}>
                                {program.start} ~ {program.end}
                            </dd>

                            <dt style={{ color: "var(--text-secondary)", fontWeight: 600 }}>장소</dt>
                            <dd style={{ margin: 0, color: "var(--text-primary)" }}>{program.venue}</dd>

                            <dt style={{ color: "var(--text-secondary)", fontWeight: 600 }}>가격</dt>
                            <dd style={{ margin: 0, color: "var(--text-primary)" }}>
                                {typeof program.price === "number"
                                    ? `${program.price.toLocaleString("ko-KR")}원`
                                    : (program.price || "VIP석 100,000원 / R석 80,000원 / S석 50,000원")}
                            </dd>

                            <dt style={{ color: "var(--text-secondary)", fontWeight: 600 }}>시간</dt>
                            <dd style={{ margin: 0, color: "var(--text-primary)" }}>
                                {program.time || "평일 19:30 / 주말 15:00, 19:00"}
                            </dd>
                        </dl>
                    </div>

                    <div style={{ marginBottom: "2rem" }}>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 0.5rem 0" }}>
                            프로그램 소개
                        </h3>
                        <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, fontSize: "0.95rem", margin: 0 }}>
                            {program.description}
                        </p>
                    </div>

                    {/* [공통 예매 이동 조작 / Shared booking navigation actions] */}
                    <div style={{ display: "flex", gap: "1rem" }}>
                        <SystemLink
                            context="flow"
                            href={`/booking/${program.id}`}
                            style={{ flex: 1 }}
                        >
                            예매하기 (온라인 예매) →
                        </SystemLink>
                        <SystemLink
                            context="flow"
                            variant="secondary"
                            href="/programs"
                        >
                            목록으로
                        </SystemLink>
                    </div>
                </div>
            </article>
        </div>
    );
}
