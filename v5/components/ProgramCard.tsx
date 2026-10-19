"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Program } from "../types/sejong";
import { showToast } from "./Toast";

interface ProgramCardProps {
    program: Program;
}

export default function ProgramCard({ program }: ProgramCardProps) {
    const [isFavorite, setIsFavorite] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem("sejong-v4:favorites");
            if (raw) {
                const list = JSON.parse(raw);
                if (Array.isArray(list) && list.includes(program.id)) {
                    setIsFavorite(true);
                }
            }
        } catch {}
    }, [program.id]);

    const toggleFavorite = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const raw = localStorage.getItem("sejong-v4:favorites");
            let list: string[] = [];
            if (raw) list = JSON.parse(raw);
            if (!Array.isArray(list)) list = [];

            const exists = list.includes(program.id);
            const next = exists ? list.filter((id) => id !== program.id) : [...list, program.id];
            localStorage.setItem("sejong-v4:favorites", JSON.stringify(next));
            setIsFavorite(!exists);
            showToast(exists ? "관심 프로그램에서 삭제했어요." : "관심 프로그램에 저장했어요.");
        } catch {
            showToast("관심 프로그램 설정에 실패했습니다.");
        }
    };

    // 포스터 이미지 경로 안전 취득
    const imagePath = program.image
        ? `/v5/${program.image.replace(/^\/?(v5\/)?/, "")}`
        : `/v5/assets/images/poster-${program.id}.svg`;

    const formatDate = (val?: string) => String(val || "").replaceAll("-", ".");

    return (
        <article className="card card--poster program-card" data-card="poster">
            <Link
                href={`/programs/${program.id}`}
                className="card-poster-link"
                draggable={false}
                aria-label={`${program.title} 상세보기`}
            >
                <div className="poster-media program-art">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={imagePath}
                        alt={`${program.title} 포스터`}
                        loading="lazy"
                        width={450}
                        height={600}
                        draggable={false}
                        onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src.includes("/v5/assets/")) {
                                target.src = target.src.replace("/v5/assets/", "/assets/");
                            }
                        }}
                    />
                    <span className="poster-tag">
                        {program.category || "공연"}
                    </span>
                </div>

                <div className="program-card-meta">
                    <span>{program.genre || "클래식"}</span>
                    <span>{program.status || "예매중"}</span>
                </div>

                <h3>{program.title}</h3>

                <p className="program-card-date">
                    {formatDate(program.start)} - {formatDate(program.end)}
                </p>

                <p className="program-card-venue">{program.venue}</p>
            </Link>

            <div className="card-poster-actions">
                <button
                    type="button"
                    className={`favorite-button round-button ${isFavorite ? "selected" : ""}`}
                    onClick={toggleFavorite}
                    aria-pressed={isFavorite}
                    aria-label={`${program.title} 관심 프로그램 ${isFavorite ? "해제" : "등록"}`}
                >
                    <svg
                        className="material-icon"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill={isFavorite ? "var(--color-black)" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                </button>
            </div>
        </article>
    );
}
