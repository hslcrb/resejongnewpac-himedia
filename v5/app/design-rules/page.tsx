"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { showToast } from "../../components/Toast";
import { FigmaPrimitiveToken, FigmaSemanticToken } from "../../types/sejong";

// 01. Primitives Data Definition
const PRIMITIVES: FigmaPrimitiveToken[] = [
    // [A] 기존 세종문화회관 역사적 상징색 (Heritage)
    { group: "Heritage (원색)", origin: "기존 브랜드", name: "heritage/cheon", hex: "#54C8E8", desc: "천(天) - 맑고 청명한 세종의 하늘빛 원색" },
    { group: "Heritage (원색)", origin: "기존 브랜드", name: "heritage/ji", hex: "#C36D15", desc: "지(地) - 유구한 대지와 무대의 품격 원색" },
    { group: "Heritage (원색)", origin: "기존 브랜드", name: "heritage/in", hex: "#FFE800", desc: "인(人) - 시민과 예술가의 생명력 원색 (황금빛)" },

    // [B] 새롭게 제안한 연한 파스텔 틴트 셰이드 (Heritage Tints - 원색 완화)
    { group: "Heritage Tints (연한 톤)", origin: "신규 제안", name: "cheon/tint-50", hex: "#F0F9FF", desc: "천(天)의 가장 연한 하늘빛 틴트 (배경·태그용)" },
    { group: "Heritage Tints (연한 톤)", origin: "신규 제안", name: "cheon/tint-100", hex: "#E0F2FE", desc: "천(天)의 소프트 스카이 틴트 (경계·선택 영역)" },
    { group: "Heritage Tints (연한 톤)", origin: "신규 제안", name: "ji/tint-50", hex: "#FFF7ED", desc: "지(地)의 부드러운 웜 크림 틴트 (배경용)" },
    { group: "Heritage Tints (연한 톤)", origin: "신규 제안", name: "ji/tint-100", hex: "#FFEDD5", desc: "지(地)의 은은한 테라코타 틴트" },
    { group: "Heritage Tints (연한 톤)", origin: "신규 제안", name: "in/tint-50", hex: "#FEFCE8", desc: "인(人)의 가장 은은한 레몬 밀크 틴트 (배경용)" },
    { group: "Heritage Tints (연한 톤)", origin: "신규 제안", name: "in/tint-100", hex: "#FEF9C3", desc: "인(人)의 부드러운 파스텔 옐로우 (배지용)" },

    // [C] 60% 중립색 (Neutrals - 눈의 피로를 던 웜/쿨 슬레이트)
    { group: "Neutrals (중립색)", origin: "신규 제안", name: "neutral/white", hex: "#FFFFFF", desc: "순백 (Canvas & Card Surface)" },
    { group: "Neutrals (중립색)", origin: "신규 제안", name: "neutral/paper-subtle", hex: "#F8FAFC", desc: "차분하고 은은한 서브 컨테이너 배경" },
    { group: "Neutrals (중립색)", origin: "신규 제안", name: "neutral/border-subtle", hex: "#F1F5F9", desc: "미세한 섹션 분할선" },
    { group: "Neutrals (중립색)", origin: "신규 제안", name: "neutral/line-subtle", hex: "#E2E8F0", desc: "기본 카드 및 컴포넌트 경계선" },
    { group: "Neutrals (중립색)", origin: "신규 제안", name: "neutral/text-muted", hex: "#64748B", desc: "보조 캡션 및 메타데이터 텍스트" },
    { group: "Neutrals (중립색)", origin: "신규 제안", name: "neutral/text-secondary", hex: "#334155", desc: "본문 서브 텍스트" },
    { group: "Neutrals (중립색)", origin: "신규 제안", name: "neutral/text-primary", hex: "#0F172A", desc: "최고 명도 대비 본문 텍스트 (WCAG AAA)" },

    // [D] 정제된 상태색 (원색 지양 - 톤다운 셰이드 & 소프트 파스텔 틴트)
    { group: "Status Tones (정제된 상태색)", origin: "신규 제안", name: "status/success-dark", hex: "#15803D", desc: "성공 본문 텍스트 (톤다운 에메랄드 그린)" },
    { group: "Status Tones (정제된 상태색)", origin: "신규 제안", name: "status/success-subtle", hex: "#F0FDF4", desc: "성공 알림 배경 틴트 (원색 탈피 파스텔)" },
    { group: "Status Tones (정제된 상태색)", origin: "신규 제안", name: "status/error-dark", hex: "#B91C1C", desc: "오류 본문 텍스트 (자극을 뺀 딥 레드)" },
    { group: "Status Tones (정제된 상태색)", origin: "신규 제안", name: "status/error-subtle", hex: "#FEF2F2", desc: "오류 알림 배경 틴트 (연한 소프트 로즈)" },
    { group: "Status Tones (정제된 상태색)", origin: "신규 제안", name: "status/warning-dark", hex: "#C2410C", desc: "주의 본문 텍스트 (정갈한 앰버 테라코타)" },
    { group: "Status Tones (정제된 상태색)", origin: "신규 제안", name: "status/warning-subtle", hex: "#FFF7ED", desc: "주의 알림 배경 틴트 (온화한 웜 크림)" },
    { group: "Status Tones (정제된 상태색)", origin: "신규 제안", name: "status/info-dark", hex: "#0369A1", desc: "정보 본문 텍스트 (깊은 세종 블루)" },
    { group: "Status Tones (정제된 상태색)", origin: "신규 제안", name: "status/info-subtle", hex: "#F0F9FF", desc: "정보 안내 배경 틴트 (청명한 페일 블루)" },
];

// 02. Semantic Data Definition
const SEMANTICS: FigmaSemanticToken[] = [
    { collection: "02. Semantic", name: "color/background/canvas", primitiveRef: "{neutral/white}", hex: "#FFFFFF", usage: "전체 페이지 기본 배경" },
    { collection: "02. Semantic", name: "color/background/subtle", primitiveRef: "{neutral/paper-subtle}", hex: "#F8FAFC", usage: "섹션 및 컨테이너 대체 배경" },
    { collection: "02. Semantic", name: "color/surface/card", primitiveRef: "{neutral/white}", hex: "#FFFFFF", usage: "공연·전시 카드 및 다이얼로그 표면" },
    { collection: "02. Semantic", name: "color/surface/tint-cheon", primitiveRef: "{cheon/tint-50}", hex: "#F0F9FF", usage: "세종 천(天) 테마 섹션 표면" },
    { collection: "02. Semantic", name: "color/surface/tint-ji", primitiveRef: "{ji/tint-50}", hex: "#FFF7ED", usage: "세종 지(地) 테마 섹션 표면" },
    { collection: "02. Semantic", name: "color/surface/tint-in", primitiveRef: "{in/tint-50}", hex: "#FEFCE8", usage: "세종 인(人) 테마 섹션 표면" },
    { collection: "02. Semantic", name: "color/text/primary", primitiveRef: "{neutral/text-primary}", hex: "#0F172A", usage: "제목 및 주요 본문 텍스트 (대비율 13.9:1)" },
    { collection: "02. Semantic", name: "color/text/secondary", primitiveRef: "{neutral/text-secondary}", hex: "#334155", usage: "보조 설명 및 리스트 레이블" },
    { collection: "02. Semantic", name: "color/text/muted", primitiveRef: "{neutral/text-muted}", hex: "#64748B", usage: "비활성, 캡션, 플레이스홀더 텍스트" },
    { collection: "02. Semantic", name: "color/border/subtle", primitiveRef: "{neutral/border-subtle}", hex: "#F1F5F9", usage: "카드 내부 구분선 및 그리드 라인" },
    { collection: "02. Semantic", name: "color/border/default", primitiveRef: "{neutral/line-subtle}", hex: "#E2E8F0", usage: "입력창 및 기본 카드 테두리" },
    { collection: "02. Semantic", name: "color/action/primary", primitiveRef: "{heritage/cheon}", hex: "#54C8E8", usage: "예매·신청 주요 액션 버튼" },
    { collection: "02. Semantic", name: "color/action/secondary", primitiveRef: "{heritage/ji}", hex: "#C36D15", usage: "상세보기 및 보조 액션 버튼" },
    { collection: "02. Semantic", name: "color/accent/highlight", primitiveRef: "{heritage/in}", hex: "#FFE800", usage: "추천 태그 및 이벤트 배지 (10% 포인트)" },
    { collection: "02. Semantic", name: "color/status/success-bg", primitiveRef: "{status/success-subtle}", hex: "#F0FDF4", usage: "예매 완료 및 접수 성공 배지 배경" },
    { collection: "02. Semantic", name: "color/status/success-fg", primitiveRef: "{status/success-dark}", hex: "#15803D", usage: "예매 완료 텍스트 및 확인 아이콘" },
    { collection: "02. Semantic", name: "color/status/error-bg", primitiveRef: "{status/error-subtle}", hex: "#FEF2F2", usage: "입력 유효성 오류 및 경고 박스 배경" },
    { collection: "02. Semantic", name: "color/status/error-fg", primitiveRef: "{status/error-dark}", hex: "#B91C1C", usage: "오류 안내 텍스트 및 에러 아이콘" },
    { collection: "02. Semantic", name: "color/status/warning-bg", primitiveRef: "{status/warning-subtle}", hex: "#FFF7ED", usage: "잔여석 마감 임박 알림 배경" },
    { collection: "02. Semantic", name: "color/status/warning-fg", primitiveRef: "{status/warning-dark}", hex: "#C2410C", usage: "마감 임박 텍스트 및 주의 문구" },
];

export default function DesignRulesPage() {
    const [selectedOrigin, setSelectedOrigin] = useState<string>("all");
    const [copiedHex, setCopiedHex] = useState<string | null>(null);

    const handleCopy = (hex: string, name: string, e: React.MouseEvent) => {
        e.preventDefault();
        navigator.clipboard.writeText(hex).then(() => {
            setCopiedHex(hex);
            showToast(`${name} (${hex}) 색상 코드가 복사되었습니다!`);
            setTimeout(() => setCopiedHex(null), 2000);
        }).catch(() => {
            showToast(`색상 코드: ${hex}`);
        });

        // Anime.js 동적 펄스 인터랙션
        import("animejs").then((mod: any) => {
            const anime = mod.default || mod.animate || mod;
            if (typeof anime === "function") {
                anime({
                    targets: e.currentTarget,
                    scale: [1, 1.15, 1],
                    duration: 400,
                    easing: "easeOutElastic(1, .6)",
                });
            }
        }).catch(() => {});
    };

    const filteredPrimitives = selectedOrigin === "all"
        ? PRIMITIVES
        : PRIMITIVES.filter((p) => p.origin === selectedOrigin);

    return (
        <div className="design-rules-page container" style={{ padding: "3rem 1.5rem 6rem", maxWidth: "1200px", margin: "0 auto" }}>
            {/* 상단 브레드크럼 */}
            <nav className="breadcrumbs" aria-label="현재 위치" style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", color: "#64748b", fontSize: "0.875rem" }}>
                <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>홈</Link>
                <span>/</span>
                <span aria-current="page" style={{ fontWeight: 600, color: "#0f172a" }}>디자인 규칙 & 설계 근거 (v5 Design Rules)</span>
            </nav>

            {/* 히어로 헤더 */}
            <header style={{ marginBottom: "3rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "2rem" }}>
                <div style={{ display: "inline-block", padding: "0.25rem 0.75rem", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "9999px", color: "#0369a1", fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                    DESIGN SYSTEM 2026 · NEXT.JS & TYPESCRIPT
                </div>
                <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.75rem 0", letterSpacing: "-0.03em" }}>
                    세종문화회관 v5 브랜드 컬러 시스템 & Figma Variables
                </h1>
                <p style={{ fontSize: "1.1rem", color: "#475569", lineHeight: 1.6, maxWidth: "860px", margin: 0 }}>
                    세종문화회관 고유의 역사적 헤리티지 상징색(<strong>천·지·인</strong>)을 보존하면서도,
                    눈의 피로를 유발하는 고채도 원색을 완화한 <strong>소프트 파스텔 틴트(50, 100)</strong>와
                    <strong> 60-30-10 컬러 밸런스</strong>를 적용한 현대적 웹 UI 디자인 시스템입니다.
                </p>
            </header>

            {/* 디자인 원칙 카드 그리드 */}
            <section style={{ marginBottom: "3.5rem" }}>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem" }}>
                    📐 설계 핵심 원칙 (Core Principles)
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.5rem" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#f0f9ff", color: "#0369a1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, marginBottom: "1rem" }}>
                            1
                        </div>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>헤리티지 계승 & 원색 지양</h3>
                        <p style={{ fontSize: "0.925rem", color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                            천(#54C8E8), 지(#C36D15), 인(#FFE800)의 상징성은 액션과 포인트로 승화하고, 넓은 면적에는 눈의 자극을 뺀 소프트 파스텔 틴트(50~100)를 사용하여 편안한 관람 환경을 만듭니다.
                        </p>
                    </div>

                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.5rem" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#fefce8", color: "#854d0e", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, marginBottom: "1rem" }}>
                            2
                        </div>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>60-30-10 규칙 적용</h3>
                        <p style={{ fontSize: "0.925rem", color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                            배경/카드 <strong>60%</strong> (Neutrals/White), 구조/보조 <strong>30%</strong> (Slate/Borders), 액션/강조 <strong>10%</strong> (Sejong Accents)로 시각적 위계를 완벽히 통제합니다.
                        </p>
                    </div>

                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.5rem" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#f0fdf4", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, marginBottom: "1rem" }}>
                            3
                        </div>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>접근성 WCAG AAA 대비</h3>
                        <p style={{ fontSize: "0.925rem", color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                            모든 본문 텍스트는 <code>#0F172A</code>(대비율 13.9:1)를 사용하여 야외나 모바일 환경에서도 누구나 막힘없이 읽을 수 있는 극상의 가독성을 보장합니다.
                        </p>
                    </div>
                </div>
            </section>

            {/* 01. Primitives Section */}
            <section style={{ marginBottom: "4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
                    <div>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0284c7" }}>COLLECTION 01</span>
                        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: "0.2rem 0 0 0" }}>
                            01. Primitives (원시 색상 토큰)
                        </h2>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                            type="button"
                            onClick={() => setSelectedOrigin("all")}
                            style={{
                                padding: "0.4rem 0.8rem",
                                borderRadius: "6px",
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                border: "1px solid #cbd5e1",
                                background: selectedOrigin === "all" ? "#0f172a" : "#ffffff",
                                color: selectedOrigin === "all" ? "#ffffff" : "#475569",
                                cursor: "pointer",
                            }}
                        >
                            전체 보기 ({PRIMITIVES.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedOrigin("기존 브랜드")}
                            style={{
                                padding: "0.4rem 0.8rem",
                                borderRadius: "6px",
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                border: "1px solid #cbd5e1",
                                background: selectedOrigin === "기존 브랜드" ? "#0f172a" : "#ffffff",
                                color: selectedOrigin === "기존 브랜드" ? "#ffffff" : "#475569",
                                cursor: "pointer",
                            }}
                        >
                            기존 브랜드 원색
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedOrigin("신규 제안")}
                            style={{
                                padding: "0.4rem 0.8rem",
                                borderRadius: "6px",
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                border: "1px solid #cbd5e1",
                                background: selectedOrigin === "신규 제안" ? "#0f172a" : "#ffffff",
                                color: selectedOrigin === "신규 제안" ? "#ffffff" : "#475569",
                                cursor: "pointer",
                            }}
                        >
                            신규 제안 (원색 완화/소프트 틴트)
                        </button>
                    </div>
                </div>

                {/* 인터랙티브 컬러 칩 그리드 */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
                    {filteredPrimitives.map((p) => {
                        const isCopied = copiedHex === p.hex;
                        return (
                            <div
                                key={p.name}
                                onClick={(e) => handleCopy(p.hex, p.name, e)}
                                style={{
                                    background: "#ffffff",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "10px",
                                    overflow: "hidden",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    boxShadow: isCopied ? "0 0 0 2px #0284c7" : "none",
                                }}
                                title="클릭하여 HEX 코드 복사"
                            >
                                <div style={{ height: "70px", background: p.hex, position: "relative", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                                    <span style={{ position: "absolute", top: "6px", right: "6px", fontSize: "0.65rem", padding: "2px 6px", borderRadius: "4px", background: "rgba(0,0,0,0.6)", color: "#ffffff", fontWeight: 600 }}>
                                        {p.origin}
                                    </span>
                                </div>
                                <div style={{ padding: "0.75rem" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <code style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0f172a" }}>{p.name}</code>
                                        <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#64748b" }}>{p.hex}</span>
                                    </div>
                                    <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.4rem 0 0 0", lineHeight: 1.4 }}>{p.desc}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Figma Variables 패널 등록용 표 */}
                <div style={{ overflowX: "auto", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", textAlign: "left" }}>
                        <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                                <th style={{ padding: "0.75rem 1rem" }}>컬러칩</th>
                                <th style={{ padding: "0.75rem 1rem" }}>Figma 변수명</th>
                                <th style={{ padding: "0.75rem 1rem" }}>HEX 코드</th>
                                <th style={{ padding: "0.75rem 1rem" }}>구분</th>
                                <th style={{ padding: "0.75rem 1rem" }}>사용 목적 및 설명</th>
                            </tr>
                        </thead>
                        <tbody>
                            {PRIMITIVES.map((p, idx) => (
                                <tr key={p.name} style={{ borderBottom: idx < PRIMITIVES.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                    <td style={{ padding: "0.6rem 1rem" }}>
                                        <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: p.hex, border: "1px solid rgba(0,0,0,0.1)" }} />
                                    </td>
                                    <td style={{ padding: "0.6rem 1rem" }}>
                                        <code style={{ fontWeight: 700, color: "#0369a1" }}>{p.name}</code>
                                    </td>
                                    <td style={{ padding: "0.6rem 1rem", fontFamily: "monospace" }}>{p.hex}</td>
                                    <td style={{ padding: "0.6rem 1rem" }}>
                                        <span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: "4px", background: p.origin === "기존 브랜드" ? "#fef3c7" : "#e0f2fe", color: p.origin === "기존 브랜드" ? "#92400e" : "#0369a1", fontWeight: 600 }}>
                                            {p.origin}
                                        </span>
                                    </td>
                                    <td style={{ padding: "0.6rem 1rem", color: "#475569" }}>{p.desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 02. Semantic Section */}
            <section style={{ marginBottom: "4rem" }}>
                <div style={{ marginBottom: "1.25rem" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#16a34a" }}>COLLECTION 02</span>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: "0.2rem 0 0 0" }}>
                        02. Semantic (Figma Alias 매핑 표)
                    </h2>
                    <p style={{ fontSize: "0.95rem", color: "#64748b", margin: "0.3rem 0 0 0" }}>
                        Figma Variables 패널에 그대로 등록할 수 있도록 <strong>Collection 이름 / 변수명 / 연결할 Primitive (Alias) / 사용 목적</strong>을 완벽히 정리했습니다.
                    </p>
                </div>

                <div style={{ overflowX: "auto", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", textAlign: "left" }}>
                        <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                                <th style={{ padding: "0.75rem 1rem" }}>Collection</th>
                                <th style={{ padding: "0.75rem 1rem" }}>Semantic 변수명</th>
                                <th style={{ padding: "0.75rem 1rem" }}>연결할 Primitive (Alias)</th>
                                <th style={{ padding: "0.75rem 1rem" }}>결과 HEX</th>
                                <th style={{ padding: "0.75rem 1rem" }}>실제 UI 적용 목적</th>
                            </tr>
                        </thead>
                        <tbody>
                            {SEMANTICS.map((s, idx) => (
                                <tr key={s.name} style={{ borderBottom: idx < SEMANTICS.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                    <td style={{ padding: "0.6rem 1rem", color: "#64748b", fontSize: "0.8rem" }}>{s.collection}</td>
                                    <td style={{ padding: "0.6rem 1rem" }}>
                                        <code style={{ fontWeight: 700, color: "#15803d" }}>{s.name}</code>
                                    </td>
                                    <td style={{ padding: "0.6rem 1rem" }}>
                                        <span style={{ padding: "2px 6px", background: "#f1f5f9", borderRadius: "4px", fontSize: "0.8rem", color: "#334155" }}>
                                            {s.primitiveRef}
                                        </span>
                                    </td>
                                    <td style={{ padding: "0.6rem 1rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <div style={{ width: "18px", height: "18px", borderRadius: "4px", background: s.hex, border: "1px solid rgba(0,0,0,0.1)" }} />
                                            <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{s.hex}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: "0.6rem 1rem", color: "#475569" }}>{s.usage}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 실시간 컴포넌트 프리뷰 시뮬레이터 */}
            <section style={{ marginBottom: "3rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "2rem" }}>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.5rem" }}>
                    🧪 실제 UI 적용 프리뷰 (Live Component Simulator)
                </h2>
                <p style={{ fontSize: "0.925rem", color: "#64748b", margin: "0 0 1.5rem 0" }}>
                    원색 자극을 없애고 소프트 파스텔 틴트와 고대비 텍스트가 적용된 실제 컴포넌트 상태입니다.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
                    {/* 카드 프리뷰 */}
                    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "1.25rem" }}>
                        <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "9999px", background: "#f0f9ff", color: "#0369a1", fontWeight: 700 }}>
                            천(天) 테마 배지
                        </span>
                        <h4 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0.6rem 0 0.4rem 0", color: "#0f172a" }}>
                            서울시향의 마스터피스 시리즈
                        </h4>
                        <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 1rem 0" }}>
                            2026.04.10 ~ 04.12 · 세종대극장
                        </p>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button type="button" style={{ padding: "0.5rem 1rem", background: "#0f172a", color: "#ffffff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
                                예매하기
                            </button>
                            <button type="button" style={{ padding: "0.5rem 1rem", background: "#ffffff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "6px", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
                                상세정보
                            </button>
                        </div>
                    </div>

                    {/* 성공 및 알림 상태 프리뷰 */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#15803d" }} />
                            <span style={{ fontSize: "0.875rem", color: "#15803d", fontWeight: 600 }}>
                                예매가 안전하게 완료되었습니다 (소프트 그린 틴트)
                            </span>
                        </div>

                        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#b91c1c" }} />
                            <span style={{ fontSize: "0.875rem", color: "#b91c1c", fontWeight: 600 }}>
                                잔여석이 부족합니다 (자극을 뺀 톤다운 에러 틴트)
                            </span>
                        </div>

                        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#c2410c" }} />
                            <span style={{ fontSize: "0.875rem", color: "#c2410c", fontWeight: 600 }}>
                                공연 시작 10분 전까지 입장해 주세요 (온화한 웜 틴트)
                            </span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
