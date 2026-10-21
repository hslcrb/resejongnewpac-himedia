"use client";

import { Fragment } from "react";
import Icon from "./Icon";
import { SystemButton, SystemLink } from "./SystemPrimitives";
import { mediaPath } from "../src/lib/media";
import type { HomeFeature } from "../src/data/home-features";

// [작품 중심 히어로의 공통 규격 / Shared artwork-led hero slide]
export default function HeroSlide({ feature, active, entering = false, preview, onSelect, layout = "with-companion" }: {
    feature: HomeFeature;
    active: boolean;
    entering?: boolean;
    preview?: "previous" | "next";
    onSelect?: () => void;
    layout?: "standalone" | "with-companion";
}) {
    return (
        <article
            className={`card card--hero season-slide season-${feature.theme}${active ? " is-active" : ""}${entering ? " is-entering" : ""}`}
            data-card="hero"
            data-component="HeroSlide"
            data-layout={layout}
            data-feature={feature.id}
            data-preview={preview}
            id={active ? `home-feature-${feature.id}` : undefined}
            data-home-anchor={active ? "" : undefined}
            aria-hidden={!active && !preview}
        >
            <div className="season-card-link">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    className="season-image"
                    src={mediaPath(`assets/images/${feature.image}`)}
                    alt={feature.alt}
                    width={1672}
                    height={941}
                    draggable={false}
                    loading={active || preview ? "eager" : "lazy"}
                    onError={event => {
                        if (event.currentTarget.dataset.fallback) return;
                        event.currentTarget.dataset.fallback = "true";
                        event.currentTarget.src = mediaPath();
                    }}
                />
                <div className="season-copy" aria-hidden={!active}>
                    <p className="season-label">{feature.label}</p>
                    <h2>{feature.title.split("\n").map((line, index, lines) => (
                        <Fragment key={index}>{line}{index < lines.length - 1 && <br />}</Fragment>
                    ))}</h2>
                    <p className="season-name">{feature.name}</p>
                    <p className="season-meta">{feature.date}<span>{feature.venue}</span></p>
                    <p className="season-description">{feature.description}</p>
                    <div className="season-actions">
                        <SystemLink variant="inverse" href={`/programs/${feature.id}`} tabIndex={active ? 0 : -1} draggable={false}>
                            상세보기 <Icon name="arrow" size={20} />
                        </SystemLink>
                        <SystemLink variant="inverse-outline" href={`/booking/${feature.id}`} tabIndex={active ? 0 : -1} draggable={false}>
                            예매하기 <Icon name="ticket" size={20} />
                        </SystemLink>
                    </div>
                </div>
                {preview && <SystemButton
                    variant="inverse-quiet"
                    className="season-peer-title"
                    aria-label={`${feature.name} ${preview === "previous" ? "이전" : "다음"} 슬라이드로 보기`}
                    onClick={onSelect}
                >
                    <Icon name={preview === "previous" ? "back" : "arrow"} size={24} />
                    <strong>{feature.programTitle}</strong>
                </SystemButton>}
            </div>
        </article>
    );
}
