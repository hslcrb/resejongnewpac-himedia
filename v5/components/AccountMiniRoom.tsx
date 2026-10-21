"use client";

import { useId } from "react";
import type { Program } from "../types/sejong.ts";
import { mediaPath } from "../src/lib/media";
import { SystemButton, SystemIconButton } from "./SystemPrimitives";

export interface AccountMiniRoomProps {
    name: string;
    message: string;
    theme: "paper" | "sky" | "sun";
    lightOn: boolean;
    programs: readonly Program[];
    hasFavorites: boolean;
    onEdit?: () => void;
    onToggleLight?: () => void;
}

// [취향이 걸린 작은 공연장 / A little theatre for personal favourites]
export default function AccountMiniRoom({
    name,
    message,
    theme,
    lightOn,
    programs,
    hasFavorites,
    onEdit,
    onToggleLight,
}: AccountMiniRoomProps) {
    const instanceId = useId().replaceAll(":", "");
    const headingId = `mini-room-heading-${instanceId}`;
    const lightId = `mini-room-light-${instanceId}`;
    const shadowId = `mini-room-shadow-${instanceId}`;
    const posters = programs.slice(0, 3);
    const lightLabel = lightOn ? "공연장 조명이 켜져 있어요. 조명 끄기" : "공연장 조명이 꺼져 있어요. 조명 켜기";

    return (
        <section className="account-mini-room" data-component="AccountMiniRoom" data-theme={theme} data-light={lightOn ? "on" : "off"} aria-labelledby={headingId}>
            {/* [제목과 공통 조작 / Heading and shared controls] */}
            <header className="mini-room-header">
                <h2 id={headingId}>나의 작은 공연장</h2>
                <div className="mini-room-actions">
                    <SystemIconButton
                        variant="secondary"
                        aria-label={lightLabel}
                        aria-pressed={lightOn}
                        onClick={onToggleLight}
                        disabled={!onToggleLight}
                        title={lightOn ? "조명 끄기" : "조명 켜기"}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/v5/assets/icons/rounded/lightbulb${lightOn ? "-fill" : ""}.svg`} width={24} height={24} alt="" />
                    </SystemIconButton>
                    <SystemButton variant="secondary" onClick={onEdit} disabled={!onEdit}>공간 꾸미기</SystemButton>
                </div>
            </header>

            {/* [한마디와 독창적인 등각 투영 무대 / Personal note and original isometric theatre] */}
            <figure className="mini-room-figure">
                <div className="mini-room-scene" data-note-layout={message.length > 40 || name.length > 16 ? "flow" : "overlay"}>
                    <blockquote className="mini-room-note">
                        <p>{message}</p>
                        <cite>{name}의 공연장</cite>
                    </blockquote>

                    <svg className="mini-room-art" viewBox="0 0 960 650" role="img" aria-label={`작은 무대와 파란 의자, 식물이 있는 나만의 공연장.${posters.length ? ` 벽에 걸린 공연 포스터: ${posters.map((program) => program.title).join(", ")}.` : ""} 조명 ${lightOn ? "켜짐" : "꺼짐"}.`}>
                        <defs>
                            <radialGradient id={lightId}>
                                <stop offset="0%" stopColor="#F7D549" stopOpacity="0.54" />
                                <stop offset="100%" stopColor="#F7D549" stopOpacity="0" />
                            </radialGradient>
                            <filter id={shadowId} x="-30%" y="-40%" width="160%" height="180%">
                                <feGaussianBlur stdDeviation="10" />
                            </filter>
                        </defs>

                        {/* [건축: 종이 같은 벽과 나무 바닥 / Architecture: paper walls and timber floor] */}
                        <ellipse cx="486" cy="565" rx="301" ry="47" fill="#000000" opacity="0.07" filter={`url(#${shadowId})`} />
                        <path d="M125 438 480 265 835 438 480 612Z" className="mini-room-floor" />
                        <path d="M125 438 480 612 480 629 125 455Z" fill="#D6C8AF" />
                        <path d="M480 612 835 438 835 455 480 629Z" fill="#BCAE96" />
                        <path d="M125 196 480 25 480 270 125 443Z" className="mini-room-wall-left" />
                        <path d="M480 25 835 196 835 443 480 270Z" className="mini-room-wall-right" />
                        <path d="M125 196 480 25 835 196" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinejoin="round" />
                        <path d="M125 196V443L480 615 835 443V196" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinejoin="round" />
                        <path d="M480 28V270" fill="none" stroke="#000000" strokeOpacity="0.06" strokeWidth="2" />
                        <g fill="none" stroke="#BCAE96" strokeOpacity="0.31" strokeWidth="1.5">
                            <path d="m186 466 354-173M250 497l354-173M315 529l354-173M380 560l354-173M445 592l354-173" />
                            <path d="m216 398 355 173M304 355l355 173M393 312l355 173" />
                        </g>
                        <path d="m131 436 349-170 349 170" fill="none" stroke="#C7BBA6" strokeWidth="8" />

                        {/* [커튼과 작은 무대 / Curtains and a small stage] */}
                        <path d="m165 426 260-126 88 43-260 127Z" fill="#D6C6A7" />
                        <path d="m165 426 88 44v15l-88-44Z" fill="#B79D78" />
                        <path d="m253 470 260-127v15L253 485Z" fill="#C4AA83" />
                        <g transform="matrix(1 -.485 0 1 125 196)">
                            <path d="M47 232V94C47 38 298 38 298 94V232Z" fill="#C4AA83" />
                            <path d="M58 232V96C58 52 287 52 287 96V232Z" fill="#292923" />
                            <path d="M67 232V102C67 66 278 66 278 102V232Z" fill="#1C211E" />
                            <path d="M67 102C108 112 143 98 172 88c29 10 64 24 106 14V85C228 63 116 63 67 85Z" className="mini-room-curtain" />
                            <path d="M67 94c25 17 31 63 6 115l-6 23V94Z" className="mini-room-curtain" />
                            <path d="M278 94c-25 17-31 63-6 115l6 23V94Z" className="mini-room-curtain" />
                            <path d="M67 104c14 19 17 62 6 105M278 104c-14 19-17 62-6 105" fill="none" stroke="#000000" strokeOpacity="0.17" strokeWidth="7" />
                            <path d="M68 192h20M258 192h20" stroke="#F7D549" strokeWidth="5" />
                            <path d="M80 232h185" stroke="#7F826C" strokeWidth="3" />
                            <g className="mini-room-glow">
                                <ellipse cx="173" cy="165" rx="79" ry="81" fill={`url(#${lightId})`} />
                                <path d="m143 93-32 139h125L202 93Z" fill="#F7D549" opacity="0.09" />
                            </g>
                            <ellipse cx="173" cy="227" rx="53" ry="8" fill="#000000" opacity="0.3" />
                            <path d="M162 189h23v38h-23Z" fill="#D8D6C8" />
                            <ellipse cx="173.5" cy="189" rx="21" ry="8" fill="#F7F7F5" />
                            <circle cx="173" cy="163" r="23" fill="#F7D549" />
                            <path d="M173 140a23 23 0 0 1 0 46Z" fill="#DFC044" />
                            <path d="M103 59v14M242 59v14" stroke="#34352D" strokeWidth="3" />
                            <rect x="92" y="68" width="24" height="12" rx="4" fill="#34352D" />
                            <rect x="230" y="68" width="24" height="12" rx="4" fill="#34352D" />
                            <path d="M96 80h16M234 80h16" className="mini-room-light-strip" strokeWidth="3" />
                        </g>

                        {/* [실제 세종 공연 포스터 갤러리 / Gallery of actual Sejong programme posters] */}
                        <g transform="matrix(1 .485 0 1 480 25)">
                            <path d="M28 46h297" stroke="#5E625C" strokeWidth="3" />
                            {posters.map((program, index) => {
                                const x = 42 + index * 94;
                                return (
                                    <g key={program.id}>
                                        <path d={`M${x + 35} 47v23`} stroke="#8F9189" strokeWidth="1.5" />
                                        <rect x={x + 3} y="74" width="76" height="110" fill="#000000" opacity="0.08" />
                                        <rect x={x - 3} y="67" width="80" height="116" rx="1" fill="#484B43" />
                                        <image href={mediaPath(program.image)} x={x} y="70" width="74" height="110" preserveAspectRatio="xMidYMid slice" />
                                    </g>
                                );
                            })}
                            <path d="M30 205h296v6H30Z" fill="#D2C1A2" />
                            <path d="M30 211h296v6H30Z" fill="#B7A285" />
                            <path d="M48 217v11M307 217v11" stroke="#8B8170" strokeWidth="4" />
                            <path d="M67 199h60v6H67Z" fill="#F7D549" />
                            <path d="M75 194h53v5H75Z" fill="#FFFFFF" />
                            <path d="M265 183h25l-3 22h-19Z" fill="#F7F7F5" />
                            <path d="M277 183v-21m0 11c-18 2-21-11-21-11 13-3 21 2 21 11Zm0-5c18-1 18-16 18-16-13 1-18 7-18 16Z" fill="#596F60" stroke="#596F60" strokeWidth="2" />
                        </g>

                        {/* [취향을 위한 의자와 책 / A chair and books for a quiet moment] */}
                        <ellipse cx="511" cy="492" rx="110" ry="44" fill="#F7F7F5" transform="rotate(26 511 492)" />
                        <ellipse cx="511" cy="492" rx="94" ry="32" fill="none" stroke="#D9D9D4" strokeWidth="2" transform="rotate(26 511 492)" />
                        <path d="m490 484-5 40m45-22 16 27m-17-66 5 35" fill="none" stroke="#555951" strokeWidth="8" strokeLinecap="round" />
                        <path d="M465 424c-4-33 45-35 73-18l18 13c9 7 14 17 11 29l-13 50c-3 12-18 14-29 9l-48-23c-9-4-14-14-12-24Z" className="mini-room-chair-back" />
                        <path d="M466 430c5-19 36-18 58-6l21 12c6 4 9 10 7 17l-9 35c-2 7-10 8-17 5l-46-22c-8-4-12-10-12-18Z" className="mini-room-chair" />
                        <path d="m473 470 45 22c13 7 29 4 35-4l-3 14c-3 9-15 12-27 6l-47-22c-7-3-11-9-10-15Z" fill="#258AA5" />
                        <path d="m454 464 18 8m65 32 18-5" stroke="#244B53" strokeWidth="8" strokeLinecap="round" />
                        <path d="m608 449 37-18 35 17-37 18Z" fill="#F7F7F5" />
                        <path d="m608 449 35 17v8l-35-17Z" fill="#BFC3BC" />
                        <path d="m643 466 37-18v8l-37 18Z" fill="#E0E2DC" />
                        <path d="m607 444 37-18 34 16-37 18Z" fill="#F7D549" />
                        <path d="m607 444 34 16v6l-34-16Z" fill="#D5B535" />
                        <path d="m641 460 37-18v6l-37 18Z" fill="#EBCF62" />

                        {/* [독서등과 식물 / Reading lamp and plants] */}
                        <ellipse cx="682" cy="411" rx="29" ry="13" fill="#000000" opacity="0.07" />
                        <ellipse cx="677" cy="401" rx="23" ry="10" fill="#4D5148" />
                        <path d="M677 398V288c0-10-7-17-17-17h-20" fill="none" stroke="#5C6055" strokeWidth="5" />
                        <path d="M616 288c0-24 37-24 37 0Z" fill="#F7D549" />
                        <ellipse cx="634.5" cy="288" rx="18.5" ry="5" fill="#E5C63A" />
                        <g className="mini-room-glow">
                            <ellipse cx="635" cy="325" rx="65" ry="83" fill={`url(#${lightId})`} />
                            <ellipse cx="634.5" cy="288" rx="15" ry="3.5" fill="#FFFFFF" />
                        </g>
                        <ellipse cx="739" cy="464" rx="35" ry="16" fill="#000000" opacity="0.08" />
                        <path d="M715 411h46l-6 49c-1 12-32 12-34 0Z" fill="#E4DDD0" />
                        <ellipse cx="738" cy="411" rx="23" ry="10" fill="#F7F7F5" />
                        <ellipse cx="738" cy="410" rx="18" ry="7" fill="#A69B83" />
                        <path d="M738 412v-78m0 49-17-23m17 9 21-27" fill="none" stroke="#52674E" strokeWidth="4" strokeLinecap="round" />
                        <path d="M737 358c-37 6-45-32-45-32 31-6 46 8 45 32Z" fill="#6D8466" />
                        <path d="M739 340c-8-35 20-51 20-51 16 27 8 48-20 51Z" fill="#819777" />
                        <path d="M739 380c29 7 42-21 42-21-26-10-39-1-42 21Z" fill="#5B7555" />
                        <path d="M724 395c-28-3-29-29-29-29 25-2 35 9 29 29Z" fill="#91A185" />
                    </svg>
                </div>
                <figcaption className="mini-room-caption">
                    <p>{hasFavorites ? "관심 공연을 포스터로 걸어 두었어요." : "아직 관심 공연이 없어, 세종의 추천 공연을 걸어 두었어요."}</p>
                    <span className="mini-room-light-status">조명 {lightOn ? "켜짐" : "꺼짐"}</span>
                </figcaption>
            </figure>
        </section>
    );
}
