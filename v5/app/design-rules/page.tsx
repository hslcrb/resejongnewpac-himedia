"use client";

import React, { useState } from "react";
import Link from "next/link";
import { showToast } from "../../components/Toast";

// 01. Primitives Data Definition (sejong-color-guide.html 기준 정확한 8개)
const PRIMITIVES = [
    {
        name: "color/black",
        hex: "#000000",
        role: "Primary · Text",
        origin: "기존 유지",
        title: "브랜드 블랙",
        desc: "로고의 중심색. 제목·본문과 예매 등 핵심 행동에 사용합니다.",
        sample: "Aa",
        ink: "#FFFFFF",
    },
    {
        name: "color/sky",
        hex: "#54C8E8",
        role: "Secondary",
        origin: "기존 유지",
        title: "하늘색 · 천",
        desc: "보조 버튼과 탐색·안내 영역에 사용합니다. 글자는 검정으로 고정합니다.",
        sample: "天",
        ink: "#000000",
    },
    {
        name: "color/yellow",
        hex: "#FFE800",
        role: "Accent / Highlight",
        origin: "기존 유지",
        title: "노란색 · 인",
        desc: "추천 배지와 짧은 강조에 사용합니다. 기본 예매 버튼을 대체하지 않습니다.",
        sample: "人",
        ink: "#000000",
    },
    {
        name: "color/ochre",
        hex: "#C36D15",
        role: "Accent / Heritage",
        origin: "기존 유지",
        title: "황토색 · 지",
        desc: "문화 이야기·브랜드 콘텐츠의 제한적 강조색입니다. 작은 본문색으로 쓰지 않습니다.",
        sample: "地",
        ink: "#000000",
    },
    {
        name: "color/white",
        hex: "#FFFFFF",
        role: "Surface",
        origin: "기존 유지",
        title: "퓨어 화이트",
        desc: "카드·헤더·정보 패널의 표면과 어두운 배경 위 글자에 사용합니다.",
        sample: "Aa",
        ink: "#000000",
    },
    {
        name: "color/gray/050",
        hex: "#F7F7F5",
        role: "Background",
        origin: "신규 제안",
        title: "웜 그레이 050",
        desc: "페이지의 기본 배경. 흰색 카드가 놓이는 바탕을 부드럽게 구분합니다.",
        sample: "Aa",
        ink: "#000000",
    },
    {
        name: "color/gray/300",
        hex: "#D9D9D4",
        role: "Border",
        origin: "신규 제안",
        title: "웜 그레이 300",
        desc: "카드의 장식 테두리·구분선에 사용합니다. 입력창의 유일한 경계로는 쓰지 않습니다.",
        sample: "Aa",
        ink: "#000000",
    },
    {
        name: "color/gray/600",
        hex: "#626262",
        role: "Text / Secondary",
        origin: "신규 제안",
        title: "그레이 600",
        desc: "날짜·설명·보조 본문에 사용합니다. 입력창 경계와 검정 버튼의 호버에도 재사용합니다.",
        sample: "Aa",
        ink: "#FFFFFF",
    },
];

// 02. Semantic Data Definition (sejong-color-guide.html 기준 정확한 20개 변수)
const SEMANTICS = [
    { group: "Background", name: "background/page", alias: "color/gray/050", hex: "#F7F7F5", usage: "페이지 전체 배경" },
    { group: "Surface", name: "surface/default", alias: "color/white", hex: "#FFFFFF", usage: "카드·헤더·기본 정보 패널" },
    { group: "Surface", name: "surface/subtle", alias: "color/gray/050", hex: "#F7F7F5", usage: "카드 안의 보조 영역·예시 무대 배경" },
    { group: "Surface", name: "surface/inverse", alias: "color/black", hex: "#000000", usage: "어두운 콘텐츠 패널·푸터" },
    { group: "Text", name: "text/primary", alias: "color/black", hex: "#000000", usage: "제목·본문·필수 정보" },
    { group: "Text", name: "text/secondary", alias: "color/gray/600", hex: "#626262", usage: "흰색·밝은 회색 위 설명·날짜" },
    { group: "Text", name: "text/inverse", alias: "color/white", hex: "#FFFFFF", usage: "검정·어두운 회색 위 글자, Primary 버튼 글자" },
    { group: "Text", name: "text/on/brand", alias: "color/black", hex: "#000000", usage: "하늘·노랑·황토 배경 위 글자" },
    { group: "Border", name: "border/default", alias: "color/gray/300", hex: "#D9D9D4", usage: "장식용 카드 경계·구분선" },
    { group: "Border", name: "border/strong", alias: "color/gray/600", hex: "#626262", usage: "입력창 등 식별에 필요한 경계" },
    { group: "Border", name: "border/focus", alias: "color/black", hex: "#000000", usage: "키보드 포커스 외곽선; 흰색 간격과 함께 사용" },
    { group: "Action", name: "action/primary", alias: "color/black", hex: "#000000", usage: "예매·신청 등 가장 중요한 버튼 배경" },
    { group: "Action", name: "action/primary/hover", alias: "color/gray/600", hex: "#626262", usage: "Primary 버튼 호버 배경; 글자는 흰색 유지" },
    { group: "Action", name: "action/secondary", alias: "color/sky", hex: "#54C8E8", usage: "공연 안내·탐색 등 보조 버튼 배경" },
    { group: "Action", name: "action/tertiary", alias: "color/white", hex: "#FFFFFF", usage: "우선순위가 낮은 외곽선 버튼 배경" },
    { group: "Action", name: "action/disabled", alias: "color/gray/300", hex: "#D9D9D4", usage: "사용할 수 없는 버튼 배경" },
    { group: "Action", name: "action/disabled/text", alias: "color/gray/600", hex: "#626262", usage: "비활성 버튼 글자; 실제 disabled 속성과 함께 사용" },
    { group: "Accent", name: "accent/highlight", alias: "color/yellow", hex: "#FFE800", usage: "추천·기획 배지와 짧은 강조" },
    { group: "Accent", name: "accent/heritage", alias: "color/ochre", hex: "#C36D15", usage: "문화·브랜드 이야기의 강조 면" },
    { group: "Accent", name: "accent/information", alias: "color/sky", hex: "#54C8E8", usage: "탐색·안내 패널의 강조 면" },
];

// 접근성 대비율 데이터 (WCAG AA/AAA)
const CONTRASTS = [
    { label: "흰 글자 / 검정", bg: "#000000", ink: "#FFFFFF", ratio: "21.00 : 1", pass: "일반 본문 AA/AAA 충족" },
    { label: "검정 글자 / 하늘", bg: "#54C8E8", ink: "#000000", ratio: "10.80 : 1", pass: "일반 본문 AA/AAA 충족" },
    { label: "검정 글자 / 노랑", bg: "#FFE800", ink: "#000000", ratio: "16.79 : 1", pass: "일반 본문 AA/AAA 충족" },
    { label: "검정 글자 / 황토", bg: "#C36D15", ink: "#000000", ratio: "5.52 : 1", pass: "일반 본문 AA 기준 충족" },
    { label: "그레이 600 / 흰색", bg: "#FFFFFF", ink: "#626262", ratio: "6.10 : 1", pass: "일반 본문 AA 기준 충족" },
];

export default function DesignRulesPage() {
    const [selectedOrigin, setSelectedOrigin] = useState<string>("all");
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    const handleCopy = (text: string, label: string, e: React.MouseEvent) => {
        e.preventDefault();
        navigator.clipboard.writeText(text).then(() => {
            setCopiedToken(text);
            showToast(`${label} (${text}) 복사 완료!`);
            setTimeout(() => setCopiedToken(null), 1800);
        }).catch(() => {
            showToast(`${text}`);
        });

        // Anime.js 동적 펄스 인터랙션
        import("animejs").then((mod: any) => {
            const anime = mod.default || mod.animate || mod;
            if (typeof anime === "function") {
                anime({
                    targets: e.currentTarget,
                    scale: [1, 1.08, 1],
                    duration: 350,
                    easing: "easeOutElastic(1, .6)",
                });
            }
        }).catch(() => {});
    };

    const filteredPrimitives = selectedOrigin === "all"
        ? PRIMITIVES
        : PRIMITIVES.filter((p) => p.origin === selectedOrigin);

    return (
        <div className="design-rules-page wrap" style={{ maxWidth: "1240px", margin: "0 auto", padding: "2.5rem 1.5rem 6rem", color: "var(--text-primary)" }}>
            {/* 상단 브레드크럼 */}
            <nav className="breadcrumbs" aria-label="현재 위치" style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>홈</Link>
                <span>/</span>
                <span aria-current="page" style={{ fontWeight: 700, color: "var(--text-primary)" }}>웹 컬러 &amp; Figma Variables 가이드</span>
            </nav>

            {/* 히어로 헤더 */}
            <header style={{ marginBottom: "2.5rem", borderBottom: "1px solid var(--border-strong)", paddingBottom: "2rem" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".13em", color: "var(--text-secondary)", margin: "0 0 10px 0" }}>
                    SEJONG CENTER · COLOR &amp; VARIABLES
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "3rem", alignItems: "end" }}>
                    <div>
                        <h1 style={{ fontSize: "clamp(34px, 4vw, 54px)", fontWeight: 800, letterSpacing: "-.06em", lineHeight: 1.18, margin: "0 0 1rem 0" }}>
                            색은 그대로.<br />
                            경험은 <span style={{ boxShadow: "inset 0 -.22em 0 var(--accent-highlight)" }}>더 선명하게.</span>
                        </h1>
                        <p style={{ fontSize: "17px", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0, maxWidth: "620px" }}>
                            기존 브랜드의 <strong>천·지·인</strong>을 지키고, 웹에서 읽고, 찾고, 예매하기 쉬운 컬러 역할을 더합니다.
                        </p>
                    </div>

                    <div style={{ borderTop: "8px solid var(--text-primary)", paddingTop: "1rem" }}>
                        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: ".13em", color: "var(--text-secondary)", margin: "0 0 0.75rem 0" }}>
                            RENEWAL GUIDE / 2026.10.19
                        </p>
                        <dl style={{ margin: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-default)" }}>
                                <dt style={{ fontSize: "14px", color: "var(--text-secondary)" }}>컬러 구성</dt>
                                <dd style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>기존 5 + 신규 3</dd>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-default)" }}>
                                <dt style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Figma Variables</dt>
                                <dd style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>8 Primitives / 20 Aliases</dd>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                                <dt style={{ fontSize: "14px", color: "var(--text-secondary)" }}>서체 및 모드</dt>
                                <dd style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Pretendard · Light</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </header>

            {/* 브랜드 스트립 (기존 5색 유지) */}
            <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr .8fr", height: "26px", border: "1px solid var(--border-strong)", marginBottom: "3.5rem" }}>
                <span style={{ background: "var(--color-black)" }} title="검정 #000000" />
                <span style={{ background: "var(--color-sky)" }} title="하늘 #54C8E8" />
                <span style={{ background: "var(--color-yellow)" }} title="노랑 #FFE800" />
                <span style={{ background: "var(--color-ochre)" }} title="황토 #C36D15" />
                <span style={{ background: "var(--color-white)" }} title="흰색 #FFFFFF" />
            </div>

            {/* A. 브랜드 분석 및 디자인 해석 */}
            <section style={{ marginBottom: "4rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "3rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.75rem" }}>
                    <div>
                        <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".13em", color: "var(--text-secondary)" }}>A / IDENTITY</span>
                        <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "6px 0 0 0", letterSpacing: "-.04em" }}>브랜드에서 UI로.</h2>
                    </div>
                    <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0, textAlign: "right" }}>
                        확인된 브랜드 정보와 디자인 해석,<br />이번 리뉴얼의 제안을 구분했습니다.
                    </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "2rem" }}>
                    <div style={{ borderTop: "2px solid var(--text-primary)", paddingTop: "1rem" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>01 / 첨부 관찰 · 공식 설명</span>
                        <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "8px 0 10px 0" }}>보와 기둥, 천·지·인</h3>
                        <p style={{ fontSize: "14px", lineHeight: 1.75, color: "var(--text-secondary)", margin: 0 }}>
                            공식 CI는 건축물의 보와 여섯 기둥을 로고 구조로 확장합니다. 검정이 주조색이며, 하늘·황토·노랑은 각각 천·지·인을 나타냅니다.
                        </p>
                    </div>

                    <div style={{ borderTop: "2px solid var(--text-primary)", paddingTop: "1rem" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>02 / 디자인 해석</span>
                        <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "8px 0 10px 0" }}>단단한 틀, 열린 무대</h3>
                        <p style={{ fontSize: "14px", lineHeight: 1.75, color: "var(--text-secondary)", margin: 0 }}>
                            로고의 검정과 반복 구조는 단단한 인상을, 세 가지 유채색은 다양성을 표현하는 장치로 읽힙니다. 콘텐츠가 돋보이는 정돈된 틀을 만듭니다.
                        </p>
                    </div>

                    <div style={{ borderTop: "2px solid var(--text-primary)", paddingTop: "1rem" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>03 / 웹 적용 제안</span>
                        <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "8px 0 10px 0" }}>로고는 보존, 정보는 정돈</h3>
                        <p style={{ fontSize: "14px", lineHeight: 1.75, color: "var(--text-secondary)", margin: 0 }}>
                            공식 로고를 임의 수정하지 않고, 검정은 핵심 행동에 고정합니다. 새 유채색 대신 중립색 3개만 보완해 배경·설명·구분선을 구별합니다.
                        </p>
                    </div>
                </div>
            </section>

            {/* B. 컬러 팔레트 (기존 5 + 신규 3 = 8개) */}
            <section style={{ marginBottom: "4rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "3.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginBottom: "1.75rem" }}>
                    <div>
                        <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".13em", color: "var(--text-secondary)" }}>B / COLOR PALETTE</span>
                        <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "6px 0 0 0", letterSpacing: "-.04em" }}>8개의 색, 분명한 역할.</h2>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <button
                            type="button"
                            onClick={() => setSelectedOrigin("all")}
                            style={{
                                padding: "4px 10px",
                                border: "1px solid var(--border-strong)",
                                background: selectedOrigin === "all" ? "var(--surface-inverse)" : "var(--surface-default)",
                                color: selectedOrigin === "all" ? "var(--text-inverse)" : "var(--text-primary)",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            전체 (8)
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedOrigin("기존 유지")}
                            style={{
                                padding: "4px 10px",
                                border: "1px solid var(--border-strong)",
                                background: selectedOrigin === "기존 유지" ? "var(--surface-inverse)" : "var(--surface-default)",
                                color: selectedOrigin === "기존 유지" ? "var(--text-inverse)" : "var(--text-primary)",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            기존 유지 5
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedOrigin("신규 제안")}
                            style={{
                                padding: "4px 10px",
                                border: "1px dashed var(--border-strong)",
                                background: selectedOrigin === "신규 제안" ? "var(--surface-inverse)" : "var(--surface-default)",
                                color: selectedOrigin === "신규 제안" ? "var(--text-inverse)" : "var(--text-primary)",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            신규 중립색 3
                        </button>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px" }}>
                    {filteredPrimitives.map((p, idx) => {
                        const isCopied = copiedToken === p.hex;
                        return (
                            <article
                                key={p.name}
                                style={{
                                    border: "1px solid var(--border-default)",
                                    background: "var(--surface-default)",
                                    boxShadow: isCopied ? "0 0 0 2px var(--border-focus)" : "none",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                <div
                                    style={{
                                        height: "140px",
                                        background: p.hex,
                                        color: p.ink,
                                        position: "relative",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        borderBottom: "1px solid var(--border-default)",
                                    }}
                                >
                                    <span style={{ position: "absolute", top: "14px", left: "16px", fontSize: "11px", fontWeight: 600 }}>
                                        {String(idx + 1).padStart(2, "0")}
                                    </span>
                                    <span style={{ fontSize: "52px", fontWeight: 600, letterSpacing: "-.07em", lineHeight: 1 }}>
                                        {p.sample}
                                    </span>
                                </div>
                                <div style={{ padding: "18px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                        <span style={{ fontSize: "11px", fontWeight: 700 }}>{p.role}</span>
                                        <span style={{ fontSize: "10px", padding: "2px 6px", border: p.origin === "신규 제안" ? "1px dashed var(--border-strong)" : "1px solid var(--border-strong)" }}>
                                            {p.origin}
                                        </span>
                                    </div>
                                    <h3 style={{ fontSize: "19px", letterSpacing: "-.035em", margin: "0 0 8px 0" }}>{p.title}</h3>
                                    <button
                                        type="button"
                                        onClick={(e) => handleCopy(p.hex, p.title, e)}
                                        style={{
                                            border: 0,
                                            background: "transparent",
                                            padding: 0,
                                            display: "inline-flex",
                                            gap: "8px",
                                            alignItems: "center",
                                            fontSize: "18px",
                                            cursor: "pointer",
                                            fontFamily: "monospace",
                                            fontWeight: 700,
                                        }}
                                        title="클릭하여 HEX 복사"
                                    >
                                        <code>{p.hex}</code>
                                        <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>↗</span>
                                    </button>
                                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "10px", minHeight: "56px", lineHeight: 1.65, margin: "10px 0 0 0" }}>
                                        {p.desc}
                                    </p>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>

            {/* C. Figma Variables (01. Primitives & 02. Semantic) */}
            <section style={{ marginBottom: "4rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "3.5rem" }}>
                <div style={{ marginBottom: "2rem" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".13em", color: "var(--text-secondary)" }}>C / FIGMA VARIABLES</span>
                    <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "6px 0 10px 0", letterSpacing: "-.04em" }}>
                        원본값과 사용 역할을 분리합니다.
                    </h2>
                    <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>
                        <strong>Primitive</strong>는 색의 원본값, <strong>Semantic</strong>은 그 색이 맡는 역할입니다.
                        아래 Semantic은 모두 01. Primitives의 변수를 직접 참조하며, 임의의 새 HEX 값을 만들지 않습니다.
                    </p>
                </div>

                {/* 01. Primitives Table */}
                <div style={{ marginBottom: "2.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                        <h3 style={{ fontSize: "22px", fontWeight: 800, margin: 0 }}>01. Primitives</h3>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>TYPE: COLOR · MODE: light (8개)</span>
                    </div>
                    <div style={{ overflowX: "auto", border: "1px solid var(--border-default)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                            <thead>
                                <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--border-default)" }}>
                                    <th style={{ padding: "12px 16px" }}>Collection</th>
                                    <th style={{ padding: "12px 16px" }}>컬러칩 · 색상</th>
                                    <th style={{ padding: "12px 16px" }}>변수명</th>
                                    <th style={{ padding: "12px 16px" }}>HEX 코드</th>
                                    <th style={{ padding: "12px 16px" }}>사용 목적</th>
                                </tr>
                            </thead>
                            <tbody>
                                {PRIMITIVES.map((p) => (
                                    <tr key={p.name} style={{ borderBottom: "1px solid var(--border-default)" }}>
                                        <td style={{ padding: "12px 16px", color: "var(--text-secondary)", fontSize: "11px" }}>01. Primitives</td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <span style={{ width: "24px", height: "24px", background: p.hex, border: "1px solid var(--border-strong)", display: "inline-block" }} />
                                                <strong>{p.title}</strong>
                                                <small style={{ color: "var(--text-secondary)", fontSize: "10px" }}>{p.origin}</small>
                                            </div>
                                        </td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <button
                                                type="button"
                                                onClick={(e) => handleCopy(p.name, p.title, e)}
                                                style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", fontFamily: "monospace", fontWeight: 700 }}
                                            >
                                                <code>{p.name}</code> ↗
                                            </button>
                                        </td>
                                        <td style={{ padding: "12px 16px", fontFamily: "monospace" }}><code>{p.hex}</code></td>
                                        <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{p.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 02. Semantic Table */}
                <div style={{ marginBottom: "2.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                        <h3 style={{ fontSize: "22px", fontWeight: 800, margin: 0 }}>02. Semantic</h3>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>TYPE: COLOR · MODE: light (20개 역할)</span>
                    </div>
                    <div style={{ overflowX: "auto", border: "1px solid var(--border-default)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                            <thead>
                                <tr style={{ background: "var(--surface-subtle)", borderBottom: "1px solid var(--border-default)" }}>
                                    <th style={{ padding: "12px 16px" }}>Collection</th>
                                    <th style={{ padding: "12px 16px" }}>변수명</th>
                                    <th style={{ padding: "12px 16px" }}>연결할 Primitive (Alias)</th>
                                    <th style={{ padding: "12px 16px" }}>결과 색상</th>
                                    <th style={{ padding: "12px 16px" }}>사용 목적</th>
                                </tr>
                            </thead>
                            <tbody>
                                {SEMANTICS.map((s) => (
                                    <tr key={s.name} style={{ borderBottom: "1px solid var(--border-default)" }}>
                                        <td style={{ padding: "12px 16px", color: "var(--text-secondary)", fontSize: "11px" }}>02. Semantic</td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <button
                                                type="button"
                                                onClick={(e) => handleCopy(s.name, s.name, e)}
                                                style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", fontFamily: "monospace", fontWeight: 700 }}
                                            >
                                                <code>{s.name}</code> ↗
                                            </button>
                                        </td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                                <span style={{ width: "14px", height: "14px", background: s.hex, border: "1px solid var(--border-strong)", display: "inline-block" }} />
                                                <code>{s.alias}</code>
                                            </span>
                                        </td>
                                        <td style={{ padding: "12px 16px", fontFamily: "monospace" }}><code>{s.hex}</code></td>
                                        <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{s.usage}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Figma 등록 가이드 3단계 */}
                <div style={{ background: "var(--surface-subtle)", borderLeft: "4px solid var(--text-primary)", padding: "1.5rem" }}>
                    <h4 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px 0" }}>Figma 등록 순서</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem", fontSize: "13px" }}>
                        <div>
                            <strong>1. 원본값 등록</strong>
                            <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)" }}>
                                Variables 패널에서 <code>01. Primitives</code> Collection을 생성하고, Color 타입으로 8개 변수와 HEX 값을 입력합니다.
                            </p>
                        </div>
                        <div>
                            <strong>2. 역할 연결 (Alias)</strong>
                            <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)" }}>
                                <code>02. Semantic</code> Collection을 생성하고, 변수 값에서 <strong>Create alias</strong>를 선택하여 표의 Primitive를 연결합니다.
                            </p>
                        </div>
                        <div>
                            <strong>3. 화면에 적용</strong>
                            <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)" }}>
                                버튼·카드·텍스트에는 오직 Semantic 변수만 적용합니다. (예: 버튼 배경 <code>action/primary</code>, 버튼 글자 <code>text/inverse</code>)
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* D. 대비율 검증 (Contrast & Rules) */}
            <section style={{ marginBottom: "4rem", borderBottom: "1px solid var(--border-default)", paddingBottom: "3.5rem" }}>
                <div style={{ marginBottom: "1.5rem" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".13em", color: "var(--text-secondary)" }}>D / CONTRAST &amp; RULES</span>
                    <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "6px 0 8px 0", letterSpacing: "-.04em" }}>
                        예쁜 색보다, 읽히는 조합.
                    </h2>
                    <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>
                        모든 일반 본문은 최소 4.5:1 이상(WCAG AA/AAA)을 충족하도록 과학적으로 계산된 조합입니다.
                    </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "2rem" }}>
                    {CONTRASTS.map((c) => (
                        <div key={c.label} style={{ border: "1px solid var(--border-default)", background: "var(--surface-default)" }}>
                            <div style={{ height: "94px", display: "flex", alignItems: "center", justifyContent: "center", background: c.bg, color: c.ink, fontSize: "36px", fontWeight: 700 }}>
                                Aa
                            </div>
                            <div style={{ padding: "12px 14px", fontSize: "12px" }}>
                                {c.label}
                                <strong style={{ display: "block", fontSize: "20px", margin: "2px 0 1px 0" }}>{c.ratio}</strong>
                                <small style={{ color: "var(--text-secondary)" }}>{c.pass}</small>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                    <div>
                        <strong style={{ display: "block", color: "var(--text-primary)", fontSize: "14px", marginBottom: "4px" }}>
                            유채색 위 작은 흰색 글자는 피하기
                        </strong>
                        흰색 / 하늘은 1.94:1, 흰색 / 노랑은 1.25:1, 흰색 / 황토는 3.81:1로 일반 본문 4.5:1에 미달합니다. 따라서 하늘·노랑·황토 위에는 무조건 검정 글자(<code>text/on/brand</code>)를 사용합니다.
                    </div>
                    <div>
                        <strong style={{ display: "block", color: "var(--text-primary)", fontSize: "14px", marginBottom: "4px" }}>
                            장식선과 조작 경계를 명확히 구분하기
                        </strong>
                        웜 그레이 300 / 흰색은 1.42:1이므로 장식선에만 사용합니다. 입력창처럼 사용자가 조작해야 하는 UI는 그레이 600(<code>border/strong</code>)을 쓰고 포커스는 검정 외곽선을 사용합니다.
                    </div>
                </div>
            </section>

            {/* E. 실제 UI 적용 예시 (Live UI in Practice) */}
            <section style={{ marginBottom: "2rem" }}>
                <div style={{ marginBottom: "1.5rem" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".13em", color: "var(--text-secondary)" }}>E / UI IN PRACTICE</span>
                    <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "6px 0 8px 0", letterSpacing: "-.04em" }}>
                        실제 화면에서는 이렇게.
                    </h2>
                    <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>
                        배경·카드·버튼·배지·입력창을 함께 비교하세요. 버튼을 클릭하면 적용된 토큰 조합을 확인할 수 있습니다.
                    </p>
                </div>

                {/* 실제 데모 윈도우 */}
                <div style={{ border: "1px solid var(--border-strong)", background: "var(--background-page)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", background: "var(--surface-default)", borderBottom: "1px solid var(--border-default)" }}>
                        <strong style={{ fontSize: "18px", fontWeight: 800 }}>세종문화회관</strong>
                        <div style={{ display: "flex", gap: "20px", fontSize: "12px" }}>
                            <span style={{ fontWeight: 700, borderBottom: "2px solid var(--text-primary)" }}>공연·전시</span>
                            <span>이용안내</span>
                            <span>소식</span>
                        </div>
                    </div>

                    <div style={{ padding: "32px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: "24px" }}>
                            {/* 프로그램 카드 예시 */}
                            <div style={{ background: "var(--surface-default)", border: "1px solid var(--border-default)", display: "grid", gridTemplateColumns: "200px 1fr" }}>
                                <div style={{ background: "var(--surface-inverse)", color: "var(--text-inverse)", padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: "10px", letterSpacing: ".15em" }}>SEJONG / SAMPLE</span>
                                    <div style={{ fontSize: "36px", fontWeight: 800, lineHeight: 1.15 }}>새로운<br />울림</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", height: "48px", alignItems: "end" }}>
                                        <span style={{ height: "100%", background: "var(--accent-information)" }} />
                                        <span style={{ height: "68%", background: "var(--accent-highlight)" }} />
                                        <span style={{ height: "86%", background: "var(--accent-heritage)" }} />
                                    </div>
                                </div>
                                <div style={{ padding: "24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                    <div>
                                        <span style={{ display: "inline-block", padding: "4px 8px", background: "var(--accent-highlight)", color: "var(--text-on-brand)", fontSize: "11px", fontWeight: 700 }}>
                                            기획 공연 · 예시
                                        </span>
                                        <h4 style={{ fontSize: "22px", fontWeight: 700, margin: "12px 0 8px 0" }}>무대가 열리는 순간</h4>
                                        <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>
                                            포스터가 시선을 끌고, 정보는 흰색 카드 안에서 읽힙니다. 가장 중요한 행동은 검정으로.
                                        </p>
                                    </div>
                                    <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                                        <button
                                            type="button"
                                            onClick={() => showToast("예매하기: 배경 action/primary (#000000) / 글자 text/inverse (#FFFFFF)")}
                                            style={{
                                                background: "var(--action-primary)",
                                                color: "var(--text-inverse)",
                                                padding: "10px 18px",
                                                border: "1px solid var(--action-primary)",
                                                fontWeight: 600,
                                                fontSize: "13px",
                                                cursor: "pointer",
                                            }}
                                        >
                                            예매하기 ↗
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => showToast("공연 안내: 배경 action/secondary (#54C8E8) / 글자 text/on/brand (#000000)")}
                                            style={{
                                                background: "var(--action-secondary)",
                                                color: "var(--text-on-brand)",
                                                padding: "10px 18px",
                                                border: "1px solid var(--action-secondary)",
                                                fontWeight: 600,
                                                fontSize: "13px",
                                                cursor: "pointer",
                                            }}
                                        >
                                            공연 안내
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 사이드 안내 패널 */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ background: "var(--accent-information)", color: "var(--text-on-brand)", padding: "24px", flex: 1 }}>
                                    <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: ".13em" }}>INFORMATION</span>
                                    <h4 style={{ fontSize: "20px", fontWeight: 800, margin: "8px 0 10px 0" }}>
                                        나에게 맞는<br />공연을 찾아보세요.
                                    </h4>
                                    <p style={{ fontSize: "12px", margin: "0 0 16px 0" }}>
                                        하늘색은 탐색과 안내의 보조 면으로 사용합니다.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => showToast("둘러보기: 배경 action/tertiary (#FFFFFF) / 패널 accent/information (#54C8E8)")}
                                        style={{
                                            background: "var(--action-tertiary)",
                                            color: "var(--text-primary)",
                                            padding: "8px 14px",
                                            border: "1px solid var(--text-primary)",
                                            fontWeight: 600,
                                            fontSize: "12px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        둘러보기 →
                                    </button>
                                </div>

                                <div style={{ background: "var(--accent-heritage)", color: "var(--text-on-brand)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <strong>문화 이야기</strong>
                                    <span style={{ fontSize: "11px" }}>황토색의 작은 강조 면</span>
                                </div>
                            </div>
                        </div>

                        {/* 입력창 및 상태 데모 */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px", borderTop: "1px solid var(--border-default)", paddingTop: "20px" }}>
                            <div>
                                <label htmlFor="sample-search" style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                                    입력창 예시
                                </label>
                                <input
                                    id="sample-search"
                                    type="text"
                                    placeholder="관심 있는 공연을 입력해 보세요"
                                    style={{
                                        width: "100%",
                                        border: "1px solid var(--border-strong)",
                                        padding: "10px 14px",
                                        fontSize: "13px",
                                        background: "var(--surface-default)",
                                        color: "var(--text-primary)",
                                    }}
                                />
                                <small style={{ display: "block", fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px" }}>
                                    경계: border/strong (#626262) · Tab 키로 포커스 확인
                                </small>
                            </div>

                            <div>
                                <span style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                                    버튼 상태 예시
                                </span>
                                <div style={{ display: "flex", gap: "10px" }}>
                                    <button
                                        type="button"
                                        style={{
                                            background: "var(--action-primary)",
                                            color: "var(--text-inverse)",
                                            padding: "10px 16px",
                                            border: "1px solid var(--action-primary)",
                                            fontSize: "13px",
                                            fontWeight: 600,
                                        }}
                                    >
                                        Primary 일반
                                    </button>
                                    <button
                                        type="button"
                                        disabled
                                        style={{
                                            background: "var(--action-disabled)",
                                            color: "var(--action-disabled-text)",
                                            padding: "10px 16px",
                                            border: "1px solid var(--action-disabled)",
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            cursor: "not-allowed",
                                        }}
                                    >
                                        비활성 상태
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
