"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { Program } from "../types/sejong.ts";
import Icon from "./Icon";
import { showToast } from "./Toast";

interface ProgramCardProps {
    program: Program;
    layout?: "poster" | "list";
}

const FAVORITES_KEY = "sejong-v4:favorites";
const FAVORITES_EVENT = "sejong:favorites-changed";

// [브라우저 간 관심 프로그램 동기화 / Favorites synchronized across views and tabs]
function readFavorites(): string[] {
    const value: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

export default function ProgramCard({ program, layout = "poster" }: ProgramCardProps) {
    const [isFavorite, setIsFavorite] = useState(false);

    useEffect(() => {
        const updateFavorite = () => {
            try { setIsFavorite(readFavorites().includes(program.id)); } catch { setIsFavorite(false); }
        };
        const onStorage = (event: StorageEvent) => {
            if (event.key === FAVORITES_KEY || event.key === null) updateFavorite();
        };
        updateFavorite();
        window.addEventListener("storage", onStorage);
        window.addEventListener(FAVORITES_EVENT, updateFavorite);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener(FAVORITES_EVENT, updateFavorite);
        };
    }, [program.id]);

    function toggleFavorite() {
        try {
            const list = readFavorites();
            const exists = list.includes(program.id);
            const next = exists ? list.filter((id) => id !== program.id) : [...list, program.id];
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
            setIsFavorite(!exists);
            window.dispatchEvent(new Event(FAVORITES_EVENT));
            showToast(exists ? "관심 프로그램에서 삭제했어요." : "관심 프로그램에 저장했어요.");
        } catch {
            showToast("관심 프로그램을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
        }
    }

    // [포스터와 프로그램 정보 / Poster and program information]
    const sourceImage = program.image || program.poster;
    const imagePath = sourceImage
        ? /^(https?:)?\/\//.test(sourceImage) ? sourceImage : `/v5/${sourceImage.replace(/^\/?(v5\/)?/, "")}`
        : `/v5/assets/images/poster-${program.id}.svg`;
    const formatDate = (value?: string) => String(value || "").replaceAll("-", ".");
    const dateLabel = program.start === program.end || !program.end
        ? formatDate(program.start)
        : `${formatDate(program.start)} - ${formatDate(program.end)}`;

    return (
        <article className={`card card--poster program-card program-card--glass program-card--${layout}`} data-card="poster" onDragStart={(event) => event.preventDefault()}>
            <Link href={`/programs/${program.id}`} className="card-poster-link" draggable={false} aria-label={`${program.title} 상세보기`}>
                <div className="poster-media program-art">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePath} alt={`${program.title} 포스터`} loading="lazy" width={450} height={600} draggable={false}
                        onError={(event) => {
                            const target = event.currentTarget;
                            if (target.src.includes("/v5/assets/")) target.src = target.src.replace("/v5/assets/", "/assets/");
                        }} />
                    <span className="poster-tag">{program.category || "공연"}</span>
                </div>
                <div className="program-card-information">
                    <div className="program-card-meta"><span>{program.genre || program.category || "공연"}</span><span>{program.status || "상세 안내"}</span></div>
                    <h3>{program.title}</h3>
                    <p className="program-card-date">{dateLabel}</p>
                    <p className="program-card-venue">{program.venue}</p>
                    {layout === "list" && <p className="program-card-description">{program.description}</p>}
                </div>
                {layout === "list" && <span className="program-card-detail">자세히 보기 <Icon name="diagonal" size={24} /></span>}
            </Link>
            <div className="card-poster-actions">
                <button type="button" className={`favorite-button round-button ${isFavorite ? "selected" : ""}`} onClick={toggleFavorite} aria-pressed={isFavorite} aria-label={`${program.title} 관심 프로그램 ${isFavorite ? "해제" : "등록"}`}>
                    <Icon name="heart" size={24} filled={isFavorite} />
                </button>
            </div>
        </article>
    );
}
