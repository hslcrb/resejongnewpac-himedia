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

    return (
        <article className="program-card">
            <Link href={`/programs/${program.id}`} className="program-card__poster-link" tabIndex={-1} aria-hidden="true">
                <div className="program-card__poster">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={`/v5/assets/images/${program.poster}`}
                        alt=""
                        loading="lazy"
                        width={280}
                        height={396}
                        onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.src.includes("/assets/")) {
                                target.src = `/assets/images/${program.poster}`;
                            }
                        }}
                    />
                    <span className="program-card__category">{program.category}</span>
                </div>
            </Link>

            <div className="program-card__content">
                <div className="program-card__meta">
                    <span className="program-card__genre">{program.genre}</span>
                    <span className="program-card__venue">{program.venue}</span>
                </div>

                <h3 className="program-card__title">
                    <Link href={`/programs/${program.id}`}>
                        {program.title}
                    </Link>
                </h3>

                <p className="program-card__date">
                    {program.start} ~ {program.end}
                </p>

                <div className="program-card__actions">
                    <Link
                        href={`/booking/${program.id}`}
                        className="button button--dark button--small"
                    >
                        예매하기
                    </Link>
                    <button
                        type="button"
                        className={`program-card__favorite ${isFavorite ? "selected" : ""}`}
                        onClick={toggleFavorite}
                        aria-pressed={isFavorite}
                        aria-label={`${program.title} 관심 프로그램 ${isFavorite ? "해제" : "등록"}`}
                    >
                        <svg className="material-icon" width="20" height="20" viewBox="0 0 24 24" fill={isFavorite ? "#ef4444" : "currentColor"}>
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                    </button>
                </div>
            </div>
        </article>
    );
}
