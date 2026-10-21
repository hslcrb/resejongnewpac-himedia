"use client";

import React from "react";
import Link from "next/link";
import type { Program } from "../../../types/sejong.ts";
import { mediaPath } from "../../../src/lib/media";
import { SystemBadge, SystemLink } from "../../../components/SystemPrimitives";

interface ProgramDetailClientProps {
    program: Program;
}

// [원본 포스터와 읽기 영역의 관계 / Natural poster proportions beside readable details]
export default function ProgramDetailClient({ program }: ProgramDetailClientProps) {
    const imagePath = mediaPath(program.image);

    return (
        <div className="container page-layout program-detail-page">
            <nav className="page-layout-breadcrumbs" aria-label="현재 위치">
                <Link href="/">홈</Link>
                <span aria-hidden="true">/</span>
                <Link href="/programs">프로그램</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{program.title}</span>
            </nav>

            <article className="program-detail-page-grid">
                <div className="program-detail-page-poster">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={imagePath}
                        alt={program.imageAlt || program.title}
                        onError={(event) => {
                            const target = event.currentTarget;
                            if (!target.dataset.fallback) {
                                target.dataset.fallback = "true";
                                target.src = mediaPath();
                            }
                        }}
                    />
                </div>

                <div className="program-detail-page-summary">
                    <header className="page-layout-heading">
                        <div className="page-layout-actions">
                            <SystemBadge tone="info">{program.category}</SystemBadge>
                            <SystemBadge>{program.genre}</SystemBadge>
                        </div>
                        <h1>{program.title}</h1>
                    </header>

                    <dl className="page-layout-facts program-detail-page-facts">
                        <dt>일시</dt>
                        <dd>{program.start} ~ {program.end}</dd>
                        <dt>장소</dt>
                        <dd>{program.venue}</dd>
                        <dt>가격</dt>
                        <dd>
                            {typeof program.price === "number"
                                ? `${program.price.toLocaleString("ko-KR")}원`
                                : (program.price || "VIP석 100,000원 / R석 80,000원 / S석 50,000원")}
                        </dd>
                        <dt>시간</dt>
                        <dd>{program.time || "평일 19:30 / 주말 15:00, 19:00"}</dd>
                    </dl>

                    <section className="page-layout-prose program-detail-page-description" aria-labelledby="program-description-heading">
                        <h2 id="program-description-heading">프로그램 소개</h2>
                        <p>{program.description}</p>
                    </section>

                    {/* [공통 예매 이동 조작 / Shared booking navigation actions] */}
                    <div className="page-layout-actions program-detail-page-actions">
                        <SystemLink context="flow" href={`/booking/${program.id}`}>
                            예매하기
                        </SystemLink>
                        <SystemLink context="flow" variant="secondary" href="/programs">
                            목록으로
                        </SystemLink>
                    </div>
                </div>
            </article>
        </div>
    );
}
