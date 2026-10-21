"use client";

import React from "react";
import Link from "next/link";
import type { Program } from "../types/sejong.ts";
import { showSmallNotification } from "./SmallNotificationModal";
import Icon from "./Icon";
import useFavorites from "./useFavorites";
import { toggleFavorite } from "../src/lib/favorites";
import { mediaPath } from "../src/lib/media";

interface ProgramCardProps {
    program: Program;
}

export default function ProgramCard({ program }: ProgramCardProps) {
    const isFavorite = useFavorites().includes(program.id);

    const handleFavorite = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const { saved, persisted } = toggleFavorite(program.id);
        const message = saved ? "관심 프로그램에 저장했어요." : "관심 프로그램에서 삭제했어요.";
        showSmallNotification(message + (persisted ? "" : " (이 창에서만 유지)"));
    };

    // 포스터 이미지 경로 안전 취득
    const imagePath = mediaPath(program.image);

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
                        alt={program.imageAlt || program.title}
                        loading="lazy"
                        width={450}
                        height={600}
                        draggable={false}
                        onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.dataset.fallback) {
                                target.dataset.fallback = "true";
                                target.src = mediaPath();
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
                    onClick={handleFavorite}
                    aria-pressed={isFavorite}
                    aria-label={`${program.title} 관심 프로그램 ${isFavorite ? "해제" : "등록"}`}
                >
                    <Icon name="heart" filled={isFavorite} size={24} />
                </button>
            </div>
        </article>
    );
}
