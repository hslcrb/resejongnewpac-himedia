"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import Icon from "../../components/Icon";
import BookingInvitation from "../../components/BookingInvitation";
import ProgramCard from "../../components/ProgramCard";
import FloatingMenu from "../../components/FloatingMenu";
import LiquidGlassDemo from "../../components/LiquidGlassDemo";
import type { PanelPoint } from "../../src/lib/floating-panel";
import { PROGRAMS } from "../../src/data/catalog";
import type { Program } from "../../types/sejong";
import VioletQuickMenu, { SEJONG_QUICK_MENU_ITEMS } from "../../components/VioletQuickMenu";
import type { VioletQuickMenuItems } from "../../components/VioletQuickMenu";
import {
    SystemBadge,
    SystemButton,
    SystemField,
    SystemNotice,
} from "../../components/SystemPrimitives";
import {
    CHAPTERS,
    DESIGN_COLORS,
    SEMANTIC_COLORS,
    SPACE_SCALE,
    TYPE_SCALE,
    contrastRatio,
    designTokensCss,
} from "../../src/data/design-system";
import type { ChapterId } from "../../src/data/design-system";

const groups = [...new Set(CHAPTERS.map((chapter) => chapter.group))];
const searchEntries = [
    ...CHAPTERS.flatMap((chapter) => [
        { chapter: chapter.id, anchor: "", title: chapter.label, description: chapter.description },
        ...chapter.sections.map(([anchor, title]) => ({
            chapter: chapter.id,
            anchor,
            title,
            description: chapter.label + " · " + chapter.description,
        })),
    ]),
    ...DESIGN_COLORS.map((color) => ({
        chapter: "color" as const,
        anchor: "palette",
        title: color.name,
        description: `--${color.token} · ${color.hex}`,
    })),
    ...TYPE_SCALE.map((type) => ({
        chapter: "typography" as const,
        anchor: "scale",
        title: type.role,
        description: `--${type.token} · ${type.size}px`,
    })),
];
const inlineMenuItems = SEJONG_QUICK_MENU_ITEMS.map((item, index) =>
    index === 0 ? { ...item, href: "/#quick-booking" } : item,
) as unknown as VioletQuickMenuItems;
const sampleTabs = ["공연", "전시", "교육"];

function Section({
    chapter,
    id,
    title,
    children,
}: {
    chapter: ChapterId;
    id: string;
    title: string;
    children: ReactNode;
}) {
    return (
        <section className="ds-section" id={`${chapter}-${id}`} data-doc-section>
            <h2 tabIndex={-1}>{title}</h2>
            {children}
        </section>
    );
}

function DataTable({
    label,
    headings,
    rows,
}: {
    label: string;
    headings: string[];
    rows: ReactNode[][];
}) {
    return (
        <div className="ds-table-wrap" tabIndex={0} role="region" aria-label={label}>
            <table className="ds-table">
                <thead>
                    <tr>
                        {headings.map((heading) => (
                            <th key={heading} scope="col">
                                {heading}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={index}>
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// [문서의 탐색·검색·이력 / Document navigation, search and history]
// 각 장과 목차를 URL로 공유하고 키보드·모바일에서도 같은 문서를 탐색합니다.
// Share chapter and section URLs while keeping keyboard and mobile navigation equivalent.
export default function DesignRulesPage() {
    const [chapterId, setChapterId] = useState<ChapterId>("overview");
    const [navigation, setNavigation] = useState(0);
    const [activeSection, setActiveSection] = useState("");
    const [query, setQuery] = useState("");
    const [message, setMessage] = useState("");
    const [copied, setCopied] = useState("");
    const [specimen, setSpecimen] = useState("공연이 있는 날, 세종에서 만나요.");
    const [specimenSize, setSpecimenSize] = useState(32);
    const [specimenWeight, setSpecimenWeight] = useState(600);
    const [demoTab, setDemoTab] = useState(0);
    const [demoDate, setDemoDate] = useState("2026-10-23");
    const [floatingMenuOpen, setFloatingMenuOpen] = useState(false);
    const floatingMenuTrigger = useRef<HTMLButtonElement>(null);
    const floatingMenuPosition = useRef<PanelPoint | null>(null);
    const closeFloatingMenu = useCallback(() => setFloatingMenuOpen(false), []);
    const searchDialog = useRef<HTMLDialogElement>(null);
    const navigationDialog = useRef<HTMLDialogElement>(null);
    const demoDialog = useRef<HTMLDialogElement>(null);
    const scrollLock = useRef<string | null>(null);
    const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingTarget = useRef<{ chapter: ChapterId; anchor: string } | null>(null);
    const chapter = CHAPTERS.find((item) => item.id === chapterId)!;
    const chapterIndex = CHAPTERS.findIndex((item) => item.id === chapterId);
    const normalizedQuery = query.toLocaleLowerCase().replace(/\s/g, "");
    const results = searchEntries
        .filter(
            (entry) =>
                !normalizedQuery ||
                (entry.title + entry.description)
                    .toLocaleLowerCase()
                    .replace(/\s/g, "")
                    .includes(normalizedQuery),
        )
        .slice(0, 10);

    const restoreScroll = useCallback(() => {
        if (scrollLock.current !== null) {
            document.body.style.overflow = scrollLock.current;
            scrollLock.current = null;
        }
    }, []);
    const openDialog = useCallback((dialog: HTMLDialogElement | null) => {
        if (!dialog || dialog.open || document.querySelector(".design-system-page dialog[open]"))
            return;
        scrollLock.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialog.showModal();
    }, []);
    const navigate = useCallback(
        (next: ChapterId, anchor = "", event?: MouseEvent<HTMLAnchorElement>) => {
            if (
                event &&
                (event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button !== 0)
            )
                return;
            event?.preventDefault();
            pendingTarget.current = { chapter: next, anchor };
            history.pushState(null, "", `#${next}${anchor ? "/" + anchor : ""}`);
            setChapterId(next);
            setNavigation((value) => value + 1);
            setMessage("");
            searchDialog.current?.close();
            navigationDialog.current?.close();
        },
        [],
    );

    useEffect(() => {
        const previousTitle = document.title;
        const readLocation = () => {
            let parts: string[];
            try {
                parts = decodeURIComponent(location.hash.slice(1)).split("/");
            } catch {
                parts = [];
            }
            if (parts[0] === "violet-quick-menu") parts = ["motion", "quick-menu"];
            const next = CHAPTERS.find((item) => item.id === parts[0]) || CHAPTERS[0];
            const anchor = next.sections.some(
                (section: readonly [string, string]) => section[0] === parts[1],
            )
                ? parts[1]
                : "";
            pendingTarget.current = { chapter: next.id, anchor };
            setMessage("");
            setCopied("");
            setChapterId(next.id);
            setNavigation((value) => value + 1);
        };
        const keyboard = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
                event.preventDefault();
                openDialog(searchDialog.current);
            }
        };
        readLocation();
        window.addEventListener("hashchange", readLocation);
        window.addEventListener("popstate", readLocation);
        window.addEventListener("keydown", keyboard);
        return () => {
            window.removeEventListener("hashchange", readLocation);
            window.removeEventListener("popstate", readLocation);
            window.removeEventListener("keydown", keyboard);
            restoreScroll();
            if (copyTimer.current) clearTimeout(copyTimer.current);
            document.title = previousTitle;
        };
    }, [openDialog, restoreScroll]);

    useEffect(() => {
        document.title = `${chapter.label} · 세종문화회관 디자인 시스템`;
        setActiveSection(`${chapter.id}-${chapter.sections[0][0]}`);
        let frame = 0;
        const pending = pendingTarget.current;
        if (pending?.chapter === chapter.id) {
            pendingTarget.current = null;
            frame = requestAnimationFrame(() => {
                const target = pending.anchor
                    ? document.getElementById(`${chapter.id}-${pending.anchor}`)
                    : document.getElementById("doc-page-title");
                if (pending.anchor && target) {
                    target.scrollIntoView({
                        block: "start",
                        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                            ? "auto"
                            : "smooth",
                    });
                    target.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
                } else {
                    window.scrollTo({ top: 0, behavior: "instant" });
                    target?.focus({ preventScroll: true });
                }
            });
        }
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries)
                    if (entry.isIntersecting) setActiveSection(entry.target.id);
            },
            { rootMargin: "-96px 0px -55% 0px", threshold: 0 },
        );
        document
            .querySelectorAll("[data-doc-section]")
            .forEach((section) => observer.observe(section));
        return () => {
            if (frame) cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [chapter, navigation]);

    const copyValue = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(label);
            setMessage(`${label}을 복사했습니다.`);
            if (copyTimer.current) clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopied(""), 1800);
        } catch {
            setMessage("복사 권한을 확인하거나 아래 코드에서 직접 복사해 주세요.");
        }
    };
    const downloadTokens = () => {
        const url = URL.createObjectURL(
            new Blob([designTokensCss()], { type: "text/css;charset=utf-8" }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "sejong-v5-tokens.css";
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage("디자인 토큰 CSS 파일을 내려받았습니다.");
    };
    const navigationLinks = (mobile = false) => (
        <nav aria-label={mobile ? "모바일 디자인 시스템 분류" : "디자인 시스템 분류"}>
            {groups.map((group) => (
                <div className="ds-nav-group" key={group}>
                    <p>{group}</p>
                    {CHAPTERS.filter((item) => item.group === group).map((item) => (
                        <a
                            key={item.id}
                            href={`#${item.id}`}
                            aria-current={chapterId === item.id ? "page" : undefined}
                            onClick={(event) => navigate(item.id, "", event)}
                        >
                            {item.label}
                        </a>
                    ))}
                </div>
            ))}
        </nav>
    );
    const section = (id: string, title: string, children: ReactNode) => (
        <Section key={id} chapter={chapterId} id={id} title={title}>
            {children}
        </Section>
    );

    // [실제 토큰과 컴포넌트의 문서 / Documentation of working tokens and components]
    // 컬러·서체·상태 예제는 제품 코드와 같은 원본을 사용합니다.
    // Color, typography and state specimens use the same sources as product code.
    const renderChapter = () => {
        switch (chapterId) {
            case "overview":
                return (
                    <>
                        {section(
                            "principles",
                            "설계 원칙",
                            <>
                                <p>
                                    세종의 상징과 예술 콘텐츠가 먼저 보이도록, 인터페이스는 읽기
                                    쉽고 예측 가능한 기준을 가집니다.
                                </p>
                                <div className="ds-principles">
                                    {[
                                        [
                                            "01",
                                            "읽는 크기를 지킵니다",
                                            "본문·메뉴·도움말은 16px에서 시작합니다. 좁은 화면에서도 글자 대신 구성을 조정합니다.",
                                        ],
                                        [
                                            "02",
                                            "같은 역할은 같습니다",
                                            "버튼의 크기, 간격, 모서리와 상태를 같은 토큰으로 연결합니다.",
                                        ],
                                        [
                                            "03",
                                            "브랜드를 정확히 씁니다",
                                            "기존 컬러와 로고의 원형을 유지하고, 역할과 사용 범위를 분명하게 정합니다.",
                                        ],
                                    ].map(([number, title, text]) => (
                                        <div className="ds-principle" key={number}>
                                            <span>{number}</span>
                                            <h3>{title}</h3>
                                            <p>{text}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="ds-brand-stage" style={{ marginTop: 32 }}>
                                    <img
                                        src="/v5/assets/images/sejong-wordmark.png"
                                        width={236}
                                        height={43}
                                        alt="세종문화회관 로고"
                                    />
                                </div>
                                <p className="ds-caption">
                                    이 가이드는 v5 디지털 인터페이스의 적용 기준입니다. 기관의 공식
                                    CI 규정을 대체하지 않습니다.
                                </p>
                            </>,
                        )}
                        {section(
                            "structure",
                            "시스템의 구성",
                            <div className="ds-chapter-list">
                                {CHAPTERS.slice(1).map((item, index) => (
                                    <a
                                        key={item.id}
                                        href={`#${item.id}`}
                                        onClick={(event) => navigate(item.id, "", event)}
                                    >
                                        <span>{String(index + 1).padStart(2, "0")}</span>
                                        <div>
                                            <strong>{item.label}</strong>
                                            <p>{item.description}</p>
                                        </div>
                                        <Icon name="arrow" size={24} />
                                    </a>
                                ))}
                            </div>,
                        )}
                    </>
                );
            case "brand":
                return (
                    <>
                        {section(
                            "signature",
                            "기본형",
                            <>
                                <p>
                                    세종문화회관의 워드마크와 심벌은 원본 파일을 사용합니다.
                                    화면에서 읽기 쉬운 크기와 바탕을 먼저 확보합니다.
                                </p>
                                <div className="ds-two-columns">
                                    <div>
                                        <div className="ds-brand-stage">
                                            <img
                                                src="/v5/assets/images/sejong-wordmark.png"
                                                alt="밝은 바탕의 세종문화회관 워드마크"
                                                width={236}
                                                height={43}
                                            />
                                        </div>
                                        <p className="ds-caption">기본형 · 밝은 바탕</p>
                                    </div>
                                    <div>
                                        <div className="ds-brand-stage ds-brand-stage-inverse">
                                            <img
                                                src="/v5/assets/images/sejong-wordmark.png"
                                                alt="어두운 바탕의 반전 워드마크"
                                                width={236}
                                                height={43}
                                            />
                                        </div>
                                        <p className="ds-caption">반전형 · 어두운 바탕</p>
                                    </div>
                                </div>
                                <h3>보와 기둥</h3>
                                <div className="ds-demo-row">
                                    <img
                                        src="/v5/assets/images/sejong-official-symbol.png"
                                        width={64}
                                        height={66}
                                        alt="보와 기둥으로 구성된 세종문화회관 심벌"
                                    />
                                    <p>
                                        건축의 구조를 닮은 상징은 브랜드 영역에서 사용합니다. 일반
                                        버튼과 안내 아이콘을 대신하지 않습니다.
                                    </p>
                                </div>
                            </>,
                        )}
                        {section(
                            "clearspace",
                            "보호 공간과 최소 크기",
                            <>
                                <p>
                                    다른 글자나 경계가 로고에 붙지 않도록 여백을 확보합니다. 아래
                                    값은 v5 화면에서의 권장 기준입니다.
                                </p>
                                <div className="ds-clearspace-stage">
                                    <div className="ds-clearspace">
                                        <span>상하좌우 0.5x 이상</span>
                                        <img
                                            src="/v5/assets/images/sejong-wordmark.png"
                                            width={236}
                                            height={43}
                                            alt="보호 공간 안에 배치한 로고"
                                        />
                                    </div>
                                </div>
                                <DataTable
                                    label="로고의 디지털 사용 기준"
                                    headings={["항목", "v5 기준", "적용"]}
                                    rows={[
                                        [
                                            "기준 단위 x",
                                            "워드마크의 높이",
                                            "원본 가로세로 비율 유지",
                                        ],
                                        [
                                            "최소 가로 폭",
                                            "데스크톱 160px · 모바일 128px",
                                            "헤더의 워드마크",
                                        ],
                                        ["심벌 최소 크기", "32px", "식별이 필요한 단독 심벌"],
                                        [
                                            "보호 공간",
                                            "로고 높이의 0.5배 이상",
                                            "주변 글자·도형·경계와의 거리",
                                        ],
                                    ]}
                                />
                            </>,
                        )}
                        {section(
                            "usage",
                            "올바른 사용",
                            <div className="ds-two-columns">
                                <div className="ds-rule-example">
                                    <strong>
                                        <Icon name="check" size={24} />
                                        사용
                                    </strong>
                                    <img
                                        src="/v5/assets/images/sejong-wordmark.png"
                                        width={160}
                                        height={29}
                                        alt="원형을 유지한 로고"
                                    />
                                    <p>비율과 색을 유지하고 단색의 충분한 여백 위에 놓습니다.</p>
                                </div>
                                <div className="ds-rule-example" data-incorrect>
                                    <strong>
                                        <Icon name="close" size={24} />
                                        피하기
                                    </strong>
                                    <img
                                        src="/v5/assets/images/sejong-wordmark.png"
                                        width={160}
                                        height={29}
                                        alt="사용 금지 예: 가로로 늘어나고 흐릿해진 로고"
                                    />
                                    <p>
                                        비율을 늘이거나 투명도를 낮추지 않습니다. 그림자·외곽선·임의
                                        효과를 더하지 않습니다.
                                    </p>
                                </div>
                            </div>,
                        )}
                        {section(
                            "icons",
                            "아이콘",
                            <>
                                <p>
                                    로컬 Material Symbols Rounded SVG를 사용합니다. 기본 크기는
                                    24px, 문장 안에서는 20px로 정하고 조작 영역은 48px를 확보합니다.
                                </p>
                                <div className="ds-icon-grid">
                                    {[
                                        ["calendar", "일정"],
                                        ["ticket", "예매"],
                                        ["pin", "위치"],
                                        ["search", "검색"],
                                        ["heart", "관심"],
                                        ["user", "내 정보"],
                                        ["check", "완료"],
                                        ["close", "닫기"],
                                    ].map(([name, label]) => (
                                        <div key={name}>
                                            <Icon name={name} size={24} />
                                            <span>{label}</span>
                                        </div>
                                    ))}
                                </div>
                                <ul className="ds-rules-list">
                                    <li>아이콘의 색은 주변 글자의 currentColor를 따릅니다.</li>
                                    <li>
                                        장식 아이콘은 읽기 순서에서 숨기고, 아이콘만 있는 버튼에는
                                        행동 이름을 제공합니다.
                                    </li>
                                    <li>
                                        라운드 아이콘과 다른 굵기·스타일을 임의로 섞지 않습니다.
                                    </li>
                                </ul>
                            </>,
                        )}
                    </>
                );
            case "color":
                return (
                    <>
                        {section(
                            "palette",
                            "기본 팔레트",
                            <>
                                <p>
                                    현재 v5의 여덟 가지 기본색을 유지합니다. 노랑은 실제 CSS 값인
                                    #F7D549를 기준으로 문서와 코드를 일치시킵니다.
                                </p>
                                <div className="ds-palette">
                                    {DESIGN_COLORS.map((color) => (
                                        <div className="ds-color-card" key={color.token}>
                                            <div
                                                className="ds-color-swatch"
                                                style={{
                                                    background: `var(--${color.token})`,
                                                    color: color.ink,
                                                }}
                                            >
                                                <span>Aa</span>
                                            </div>
                                            <h3>{color.name}</h3>
                                            <code className="ds-token">--{color.token}</code>
                                            <button
                                                className="ds-copy-color"
                                                onClick={() => copyValue(color.hex, color.name)}
                                                aria-label={`${color.name} ${color.hex} 복사`}
                                            >
                                                <span>
                                                    {copied === color.name ? "복사됨" : color.hex}
                                                </span>
                                                <Icon
                                                    name={
                                                        copied === color.name
                                                            ? "check"
                                                            : "content_copy"
                                                    }
                                                    size={20}
                                                />
                                            </button>
                                            <p>{color.use}</p>
                                        </div>
                                    ))}
                                </div>
                            </>,
                        )}
                        {section(
                            "semantic",
                            "역할별 컬러",
                            <>
                                <p>
                                    컴포넌트에서는 색상 이름보다 역할 토큰을 사용합니다. 같은 종류의
                                    정보가 페이지마다 다른 색을 갖지 않도록 합니다.
                                </p>
                                <DataTable
                                    label="역할별 컬러 토큰"
                                    headings={["역할", "토큰", "원본", "사용"]}
                                    rows={SEMANTIC_COLORS.map(([group, token, source, use]) => [
                                        group,
                                        <code className="ds-token" key={token}>
                                            --{token}
                                        </code>,
                                        <code className="ds-token" key={source}>
                                            --{source}
                                        </code>,
                                        use,
                                    ])}
                                />
                            </>,
                        )}
                        {section(
                            "contrast",
                            "명도 대비",
                            <>
                                <p>
                                    일반 본문은 4.5:1 이상의 대비를 기준으로 확인합니다. 밝은
                                    브랜드색 위의 글자는 검정으로 사용합니다.
                                </p>
                                <DataTable
                                    label="실제 컬러 조합의 명도 대비"
                                    headings={["조합", "예시", "계산값", "일반 본문"]}
                                    rows={[
                                        ["검정 / 흰색", "#000000", "#FFFFFF"],
                                        ["검정 / 하늘", "#000000", "#54C8E8"],
                                        ["검정 / 노랑", "#000000", "#F7D549"],
                                        ["검정 / 황토", "#000000", "#C36D15"],
                                        ["보조 글자 / 흰색", "#626262", "#FFFFFF"],
                                        ["흰색 / 하늘", "#FFFFFF", "#54C8E8"],
                                    ].map(([label, ink, background]) => [
                                        label,
                                        <span
                                            className="ds-contrast-sample"
                                            key={label}
                                            style={{ color: ink, background }}
                                        >
                                            가독성
                                        </span>,
                                        `${contrastRatio(ink, background).toFixed(2)} : 1`,
                                        contrastRatio(ink, background) >= 4.5
                                            ? "사용 가능"
                                            : "피하기",
                                    ])}
                                />
                                <p className="ds-caption">
                                    색만으로 오류·선택·성공을 알리지 않습니다. 아이콘, 문장과 상태
                                    속성을 함께 사용합니다.{" "}
                                    <a
                                        href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        W3C 명도 대비 기준 (새 창)
                                    </a>
                                </p>
                            </>,
                        )}
                    </>
                );
            case "typography":
                return (
                    <>
                        {section(
                            "family",
                            "기본 서체",
                            <>
                                <p>
                                    로컬 Wanted Sans Variable을 사용합니다. 기본 본문은 16px / 400 /
                                    행간 1.7입니다. 메뉴·날짜·고지·도움말도 16px 아래로 줄이지
                                    않습니다.
                                </p>
                                <div className="ds-type-intro">
                                    <strong>
                                        가나다, 세종.
                                        <br />
                                        Aa 0123456789
                                    </strong>
                                    <p>
                                        Wanted Sans Variable · 400 / 500 / 600 / 700
                                        <br />
                                        한글과 숫자, 영문이 함께 놓이는 화면을 같은 글꼴로
                                        정돈합니다.
                                    </p>
                                </div>
                            </>,
                        )}
                        {section(
                            "scale",
                            "크기와 위계",
                            <>
                                <p>
                                    크기를 줄여 화면에 맞추기보다 줄바꿈과 배치를 조정합니다. 작은
                                    화면에서도 본문 기준은 같습니다.
                                </p>
                                {TYPE_SCALE.map((type) => (
                                    <div className="ds-type-row" key={type.token}>
                                        <div className="ds-type-meta">
                                            <strong>{type.role}</strong>
                                            <span>
                                                {type.mobile === type.size
                                                    ? type.size
                                                    : `${type.mobile}–${type.size}`}
                                                px · {type.weight}
                                            </span>
                                            <code className="ds-token">--{type.token}</code>
                                        </div>
                                        <div className="ds-type-sample">
                                            <div
                                                style={{
                                                    fontSize: `var(--${type.token})`,
                                                    fontWeight: type.weight,
                                                    lineHeight: type.leading,
                                                }}
                                            >
                                                예술을 만나는 날
                                            </div>
                                            <p className="ds-caption">
                                                {type.use} · 행간 {type.leading}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                <p className="ds-caption">
                                    본문 자간 −0.015em, 제목 자간 −0.035em. 글자별 등장 연출은
                                    별도의 양수 간격을 사용하고 글자를 겹치지 않습니다.
                                </p>
                            </>,
                        )}
                        {section(
                            "specimen",
                            "직접 조합하기",
                            <>
                                <SystemField
                                    id="type-specimen-text"
                                    label="확인할 문장"
                                    value={specimen}
                                    maxLength={120}
                                    onChange={(event) => setSpecimen(event.target.value)}
                                    hint="한글·영문·숫자가 섞인 실제 문장으로 확인해 보세요."
                                />
                                <div className="ds-specimen" style={{ marginTop: 24 }}>
                                    <div className="ds-specimen-controls">
                                        <label htmlFor="type-size">
                                            크기
                                            <select
                                                className="ds-select"
                                                id="type-size"
                                                value={specimenSize}
                                                onChange={(event) =>
                                                    setSpecimenSize(Number(event.target.value))
                                                }
                                            >
                                                {[16, 18, 20, 24, 32, 48, 64].map((size) => (
                                                    <option key={size} value={size}>
                                                        {size}px
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label htmlFor="type-weight">
                                            굵기
                                            <select
                                                className="ds-select"
                                                id="type-weight"
                                                value={specimenWeight}
                                                onChange={(event) =>
                                                    setSpecimenWeight(Number(event.target.value))
                                                }
                                            >
                                                {[400, 500, 600, 700].map((weight) => (
                                                    <option key={weight}>{weight}</option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                    <div
                                        className="ds-live-type"
                                        data-type-specimen
                                        style={{
                                            fontSize: specimenSize,
                                            fontWeight: specimenWeight,
                                            lineHeight: 1.7,
                                        }}
                                    >
                                        {specimen || "문장을 입력해 주세요."}
                                    </div>
                                </div>
                            </>,
                        )}
                    </>
                );
            case "layout":
                return (
                    <>
                        {section(
                            "grid",
                            "그리드와 화면",
                            <>
                                <p>
                                    콘텐츠의 최대 폭은 1320px입니다. 본문은 한 줄이 지나치게 길지
                                    않도록 문서 안에서 읽기 폭을 별도로 제한합니다.
                                </p>
                                <div className="ds-grid-sample" aria-label="반응형 그리드 예제">
                                    {Array.from({ length: 12 }, (_, index) => (
                                        <span key={index}>{index + 1}</span>
                                    ))}
                                </div>
                                <DataTable
                                    label="화면 크기별 레이아웃 기준"
                                    headings={["화면", "분할", "권장 좌우 여백", "읽기"]}
                                    rows={[
                                        ["1280px 이상", "12열", "48–64px", "문서와 보조 목차"],
                                        ["768–1279px", "8열", "32–40px", "본문 중심 배치"],
                                        ["767px 이하", "4열", "20px", "한 열, 문서 탐색은 메뉴로"],
                                    ]}
                                />
                            </>,
                        )}
                        {section(
                            "spacing",
                            "간격",
                            <>
                                <p>
                                    4px를 기본 단위로 사용합니다. 관련 정보는 가깝게, 다른 주제는
                                    충분히 떨어뜨립니다.
                                </p>
                                {SPACE_SCALE.map((value) => (
                                    <div className="ds-space-row" key={value}>
                                        <strong>{value}px</strong>
                                        <code className="ds-token">space-{value / 4}</code>
                                        <span className="ds-space-bar" style={{ width: value }} />
                                    </div>
                                ))}
                            </>,
                        )}
                        {section(
                            "shape",
                            "형태와 경계",
                            <>
                                <div className="ds-shape-grid">
                                    {[
                                        ["8px", "조작", "버튼·입력·작은 패널", "var(--radius-md)"],
                                        ["16px", "콘텐츠", "미디어·예시 영역", "var(--radius-lg)"],
                                        [
                                            "24px",
                                            "대화상자",
                                            "모달·안내 패널",
                                            "var(--radius-dialog)",
                                        ],
                                    ].map(([size, label, text, radius]) => (
                                        <div key={size}>
                                            <div
                                                className="ds-shape-sample"
                                                style={{ borderRadius: radius }}
                                            >
                                                {size}
                                            </div>
                                            <strong>{label}</strong>
                                            <p className="ds-caption">{text}</p>
                                        </div>
                                    ))}
                                </div>
                                <ul className="ds-rules-list">
                                    <li>
                                        기본 경계는 1px입니다. 입력 경계는 장식용 구분선보다 진하게
                                        표시합니다.
                                    </li>
                                    <li>상태 알림은 캡슐, 미디어는 16px 모서리를 사용합니다.</li>
                                    <li>
                                        그림자는 겹쳐진 모달처럼 높이 관계를 설명할 때만 사용합니다.
                                    </li>
                                </ul>
                            </>,
                        )}
                    </>
                );
            case "components":
                return (
                    <>
                        {section(
                            "buttons",
                            "버튼",
                            <>
                                <p>
                                    48px 높이와 16px 레이블을 기본으로 합니다. 한 영역의 주요 행동은
                                    하나로 정하고 나머지 행동은 우선순위를 낮춥니다.
                                </p>
                                <div className="ds-demo ds-demo-stack">
                                    <div className="ds-demo-row">
                                        <SystemButton
                                            onClick={() =>
                                                setMessage("주요 행동 버튼을 눌렀습니다.")
                                            }
                                        >
                                            예매하기
                                            <Icon name="arrow" size={20} />
                                        </SystemButton>
                                        <SystemButton
                                            variant="secondary"
                                            onClick={() =>
                                                setMessage("보조 행동 버튼을 눌렀습니다.")
                                            }
                                        >
                                            상세 안내
                                        </SystemButton>
                                        <SystemButton
                                            variant="accent"
                                            onClick={() => setMessage("탐색 버튼을 눌렀습니다.")}
                                        >
                                            일정 찾기
                                        </SystemButton>
                                    </div>
                                    <div className="ds-demo-row">
                                        <SystemButton disabled>예매 준비 중</SystemButton>
                                        <SystemButton
                                            variant="quiet"
                                            onClick={() => setMessage("취소 버튼을 눌렀습니다.")}
                                        >
                                            취소
                                        </SystemButton>
                                    </div>
                                </div>
                                <DataTable
                                    label="버튼의 조작 상태"
                                    headings={["상태", "표현", "동작"]}
                                    rows={[
                                        ["기본", "역할에 맞는 면과 레이블", "고정된 위치"],
                                        ["호버", "배경·경계의 명도 변화", "180ms"],
                                        ["눌림", "면의 명도 변화", "실제 누르고 있는 동안"],
                                        ["초점", "3px 외곽선 + 4px 간격", "키보드에서 분명하게"],
                                        ["비활성", "비활성 면 + 상태 문구", "실제 disabled 속성"],
                                    ]}
                                />
                            </>,
                        )}
                        {section(
                            "cards",
                            "콘텐츠 카드",
                            <>
                                <p>
                                    포스터·제목·일정·장소는 하나의 목적지로 연결합니다. 관심 버튼은
                                    별도의 형제 버튼으로 두고 키보드와 터치에서도 사용할 수 있게
                                    합니다.
                                </p>
                                <div className="ds-two-columns">
                                    <div className="ds-card-example">
                                        <ProgramCard program={PROGRAMS[0] as unknown as Program} />
                                    </div>
                                    <div>
                                        <h3>정보의 순서</h3>
                                        <ol className="ds-rules-list">
                                            <li>3:4 포스터, 여백 없이 비율 유지 크롭</li>
                                            <li>분류와 상태</li>
                                            <li>20px 제목</li>
                                            <li>16px 일정과 장소</li>
                                        </ol>
                                        <h3>조작의 구분</h3>
                                        <p className="ds-caption">
                                            카드 전체는 상세 안내로 이동합니다. 관심 버튼은 저장
                                            상태만 변경하며 저장 결과를 알림으로 안내합니다. 호버로
                                            카드를 들어 올리지 않습니다.
                                        </p>
                                    </div>
                                </div>
                            </>,
                        )}
                        {section(
                            "fields",
                            "입력",
                            <>
                                <p>
                                    레이블은 입력값이 생겨도 사라지지 않습니다. 도움말과 오류는
                                    필드에 연결해 이유와 다음 행동을 알려줍니다.
                                </p>
                                <div className="ds-demo ds-demo-stack">
                                    <div className="ds-two-columns">
                                        <SystemField
                                            id="demo-name"
                                            label="이름"
                                            placeholder="관람하실 분의 이름"
                                            hint="공백을 포함해 입력할 수 있습니다."
                                        />
                                        <SystemField
                                            id="demo-error"
                                            label="이메일"
                                            type="email"
                                            defaultValue="sejong@"
                                            error="이메일 주소를 끝까지 입력해 주세요."
                                        />
                                    </div>
                                    <SystemField
                                        id="demo-disabled"
                                        label="예매 번호"
                                        value="예매 후 확인할 수 있습니다"
                                        disabled
                                        readOnly
                                    />
                                    <label className="ds-check">
                                        <input type="checkbox" />
                                        선택한 관람 정보를 확인했습니다.
                                    </label>
                                </div>
                            </>,
                        )}
                        {section(
                            "navigation",
                            "탭과 펼침",
                            <>
                                <p>
                                    같은 수준의 콘텐츠는 탭으로, 선택해서 읽는 상세 설명은 펼침으로
                                    묶습니다. 탭은 방향키와 Home·End로 이동할 수 있습니다.
                                </p>
                                <div className="ds-demo">
                                    <div
                                        className="ds-tabs"
                                        role="tablist"
                                        aria-label="프로그램 분류 예제"
                                    >
                                        {sampleTabs.map((label, index) => (
                                            <button
                                                type="button"
                                                key={label}
                                                role="tab"
                                                id={`sample-tab-${index}`}
                                                aria-controls="sample-tabpanel"
                                                aria-selected={demoTab === index}
                                                tabIndex={demoTab === index ? 0 : -1}
                                                onClick={() => setDemoTab(index)}
                                                onKeyDown={(event) => {
                                                    let next = index;
                                                    if (event.key === "ArrowRight")
                                                        next = (index + 1) % 3;
                                                    else if (event.key === "ArrowLeft")
                                                        next = (index + 2) % 3;
                                                    else if (event.key === "Home") next = 0;
                                                    else if (event.key === "End") next = 2;
                                                    else return;
                                                    event.preventDefault();
                                                    setDemoTab(next);
                                                    document
                                                        .getElementById(`sample-tab-${next}`)
                                                        ?.focus();
                                                }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <div
                                        id="sample-tabpanel"
                                        className="ds-tabpanel"
                                        role="tabpanel"
                                        aria-labelledby={`sample-tab-${demoTab}`}
                                        tabIndex={0}
                                    >
                                        {
                                            [
                                                "공연명, 날짜와 장소를 같은 순서로 안내합니다.",
                                                "전시 기간과 운영 시간을 함께 안내합니다.",
                                                "수강 대상, 교육 일시와 신청 기간을 함께 안내합니다.",
                                            ][demoTab]
                                        }
                                    </div>
                                    <details className="ds-disclosure">
                                        <summary>관람 안내는 어떻게 표현하나요?</summary>
                                        <p>
                                            제한 사항과 준비할 내용을 짧은 문장으로 먼저 안내하고,
                                            필요한 상세 내용만 펼쳐서 읽도록 합니다.
                                        </p>
                                    </details>
                                </div>
                            </>,
                        )}
                        {section(
                            "liquid-glass",
                            "리퀴드 글래스",
                            <>
                                <p>
                                    <code className="ds-token">LiquidGlass</code>는 실제 배경을
                                    굴절시키는 공통 표면 컴포넌트입니다. 불투명한 중심과 맑게
                                    굴절되는 가장자리를 나누고, 반사광과 안쪽 음영으로 유리의 두께를
                                    표현합니다. 안에 넣은 글자와 버튼은 선명하게 유지합니다.
                                </p>
                                <LiquidGlassDemo
                                    onCopy={(code) => copyValue(code, "리퀴드 글래스 코드")}
                                    copied={copied === "리퀴드 글래스 코드"}
                                />
                                <DataTable
                                    label="LiquidGlass 컴포넌트 속성"
                                    headings={["속성", "기본값", "역할"]}
                                    rows={[
                                        ["variant", "surface", "surface · 기본 표면 / drawer · 짙고 두꺼운 서랍형 유리"],
                                        ["opacity", "0.82", "흰 유리의 불투명도 · 0–1"],
                                        ["refraction", "64", "굴절 강도 · 0–120"],
                                        ["blur", "18", "중심부 배경 흐림 · 0–40px"],
                                        ["thickness", "32", "굴절되는 가장자리의 두께 · 1–64px"],
                                        [
                                            "children / ref / HTML 속성",
                                            "기본 div와 동일",
                                            "콘텐츠·초점·위치·이벤트 연결",
                                        ],
                                    ]}
                                />
                                <DataTable
                                    label="리퀴드 글래스 재질 베리언트"
                                    headings={["베리언트", "불투명도", "굴절", "흐림", "두께"]}
                                    rows={[
                                        ["surface", "82%", "64", "18px", "32px"],
                                        ["drawer", "94%", "96", "24px", "40px"],
                                    ]}
                                />
                                <p className="ds-caption">
                                    기본값은 디자인 토큰을 따릅니다. 속성을 지정하면 해당 표면만
                                    바뀌며, 전체 메뉴도 같은 컴포넌트를 사용합니다. 고대비·투명도
                                    감소 설정에서는 불투명한 흰 표면으로 전환합니다.
                                </p>
                            </>,
                        )}
                        {section(
                            "floating-menu",
                            "떠 있는 유리 메뉴",
                            <>
                                <p>
                                    <code className="ds-token">FloatingPanel</code>은{" "}
                                    <code className="ds-token">LiquidGlass</code>를 사용하는 공통
                                    목록 창입니다. 위치·드래그·초점·등장과 퇴장을 담당하며,{" "}
                                    <code className="ds-token">FloatingMenu</code>는 그 안에 실제
                                    사이트의 탐색 목록을 넣는 컴포넌트입니다.
                                </p>
                                <p>
                                    전체 메뉴는 페이지를 가리는 흰 덮개 없이 독립된 창으로 뜹니다.
                                    기존 흰색과 검정의 투명도, 배경의 흐림, 둥근 가장자리의 굴절과
                                    반사를 겹쳐 깊이를 표현합니다. 글자는 굴절시키지 않습니다.
                                </p>
                                <div className="ds-demo">
                                    <SystemButton
                                        ref={floatingMenuTrigger}
                                        aria-haspopup="dialog"
                                        aria-expanded={floatingMenuOpen}
                                        aria-controls="menu-dialog"
                                        onClick={() => setFloatingMenuOpen(!floatingMenuOpen)}
                                    >
                                        전체 메뉴 체험하기 <Icon name="menu" size={24} />
                                    </SystemButton>
                                    <FloatingMenu
                                        open={floatingMenuOpen}
                                        onClose={closeFloatingMenu}
                                        returnFocus={floatingMenuTrigger}
                                        position={floatingMenuPosition}
                                    />
                                </div>
                                <h3>버튼에서 펼쳐지고, 버튼으로 돌아갑니다</h3>
                                <p>
                                    WebGL의 32 × 22 메시가 실제 목록 텍스처를 휘며 펼쳐집니다.
                                    버튼에서 먼 모서리가 조금 늦게 따라오고, 마지막에는 탄성으로
                                    자리 잡습니다. 닫기는 현재 위치에서 실제 호출 버튼으로
                                    되돌아가는 역방향 동작입니다. 도중에 다시 눌러도 위치와 속도를
                                    이어갑니다.
                                </p>
                                <h3>작은 화면에서는 왼쪽 서랍으로</h3>
                                <p>
                                    700px 이하에서 전체 메뉴는 왼쪽 벽에 붙는 세로 목록으로 바뀝니다.
                                    그룹을 펼쳐 탐색하고, 창 안에서 스크롤합니다. 이동 버튼과 자유
                                    드래그는 이 화면에서 제공하지 않습니다. 같은 WebGL 탄성이 왼쪽에서
                                    펼쳐지고 다시 벽 안으로 들어가며, drawer 재질의 더 높은 불투명도와
                                    강한 굴절로 목록의 가독성을 지킵니다.
                                </p>
                                <DataTable
                                    label="FloatingPanel 컴포넌트 속성"
                                    headings={["속성", "역할"]}
                                    rows={[
                                        ["variant", "floating · 자유 이동 / drawer · 왼쪽 고정 서랍"],
                                        [
                                            "open / onClose",
                                            "열림을 제어하며, 퇴장이 끝날 때까지 창을 유지합니다",
                                        ],
                                        ["anchorRef", "등장과 복귀의 기준이 되는 버튼 ref"],
                                        [
                                            "title / eyebrow / closeLabel / moveLabel",
                                            "창 제목·맥락·닫기와 이동 버튼의 접근 가능한 이름",
                                        ],
                                        [
                                            "position",
                                            "드래그한 위치를 닫았다 열어도 유지하는 ref · 선택",
                                        ],
                                        ["children", "스크롤할 목록이나 상세 콘텐츠"],
                                        ["className / id", "표면 크기와 식별자"],
                                    ]}
                                />
                                <pre className="ds-code-block">
                                    <code>{`import FloatingPanel from "@/components/FloatingPanel";\n\n<FloatingPanel\n    open={open}\n    onClose={() => setOpen(false)}\n    anchorRef={buttonRef}\n    title="목록"\n>\n    <nav className="glass-menu-content" aria-label="목록">\n        <a href="/v5/programs/">프로그램</a>\n    </nav>\n</FloatingPanel>`}</code>
                                </pre>
                                <p className="ds-caption">
                                    이동 중에는 WebGL이 시각적 전환을 담당하고, 정착하면 실제 HTML
                                    링크와 버튼을 사용합니다. 모션 감소 설정에서는 짧은 페이드만
                                    사용하며, WebGL을 사용할 수 없어도 창의 조작은 유지합니다.
                                </p>
                                <DataTable
                                    label="떠 있는 메뉴의 표면과 위계"
                                    headings={["역할", "기준", "토큰"]}
                                    rows={[
                                        [
                                            "창 제목",
                                            "36–48px · 700 / 모바일 28–32px",
                                            "--text-title",
                                        ],
                                        [
                                            "메뉴 그룹",
                                            "24px · 700 / 모바일 20px",
                                            "--text-menu-group",
                                        ],
                                        [
                                            "탐색 링크",
                                            "18px · 500 · 조작 높이 48px",
                                            "--text-menu-link",
                                        ],
                                        ["설명·개인 서비스", "16px · 400–500", "--text-sm"],
                                        ["모서리", "24px", "--radius-dialog"],
                                        [
                                            "유리 바탕",
                                            "흰색 82% + 방향성 반사광",
                                            "--glass-opacity / --glass-tint",
                                        ],
                                        [
                                            "굴절·두께",
                                            "굴절 64 · 가장자리 32px",
                                            "--glass-refraction / --glass-thickness",
                                        ],
                                        [
                                            "배경 흐림",
                                            "18px · 채도 1.4배",
                                            "--glass-blur / --glass-saturation",
                                        ],
                                        [
                                            "테두리·그림자",
                                            "흰색 88% · 겹쳐진 높이",
                                            "--glass-edge / --glass-shadow",
                                        ],
                                    ]}
                                />
                                <ul className="ds-rules-list">
                                    <li>
                                        마우스로 글자와 여백을 잡아 옮깁니다. 드래그한 링크는 열리지
                                        않습니다.
                                    </li>
                                    <li>
                                        터치에서는 제목을 잡아 옮깁니다. 본문은 세로로 스크롤하며,
                                        이동 버튼을 켜면 본문에서도 창을 옮길 수 있습니다.
                                    </li>
                                    <li>
                                        이동 버튼에 초점을 두고 방향키로 16px, Shift와 함께 4px씩
                                        옮깁니다. Home은 처음 위치, Escape는 닫기입니다.
                                    </li>
                                    <li>
                                        배경 페이지도 사용할 수 있습니다. 화면 크기가 바뀌어도
                                        닫기와 탐색을 화면 안에 유지합니다.
                                    </li>
                                    <li>
                                        투명도 감소·고대비 설정에서는 흰 불투명 표면으로 전환합니다.
                                    </li>
                                </ul>
                            </>,
                        )}
                        {section(
                            "feedback",
                            "상태와 대화상자",
                            <>
                                <div className="ds-demo-stack">
                                    <div className="ds-demo-row">
                                        <SystemBadge>안내</SystemBadge>
                                        <SystemBadge tone="highlight">추천</SystemBadge>
                                        <SystemBadge tone="info">접근성 제공</SystemBadge>
                                    </div>
                                    <SystemNotice title="관심 프로그램에 저장했습니다.">
                                        저장한 프로그램은 마이페이지에서 다시 확인할 수 있습니다.
                                    </SystemNotice>
                                    <SystemNotice title="입력 내용을 확인해 주세요." error>
                                        이메일 주소를 입력하면 다음 단계로 이동할 수 있습니다.
                                    </SystemNotice>
                                </div>
                                <h3>확인이 필요한 선택</h3>
                                <p className="ds-caption">
                                    모달은 배경을 잠그고, Esc로 닫은 뒤 열었던 버튼으로 초점을
                                    돌려줍니다.
                                </p>
                                <SystemButton
                                    variant="secondary"
                                    onClick={() => openDialog(demoDialog.current)}
                                >
                                    날짜 선택 대화상자 열기
                                </SystemButton>
                            </>,
                        )}
                    </>
                );
            case "motion":
                return (
                    <>
                        {section(
                            "timing",
                            "시간과 이징",
                            <>
                                <p>
                                    조작의 결과는 짧게, 화면의 관계는 조금 여유 있게 보여줍니다.
                                    일반 버튼은 위치를 움직이지 않고 색과 명도로 응답합니다.
                                </p>
                                <DataTable
                                    label="모션 시간과 역할"
                                    headings={["역할", "토큰", "값", "사용"]}
                                    rows={[
                                        [
                                            "즉각적인 반응",
                                            "--duration-fast",
                                            "120ms",
                                            "작은 상태 변화",
                                        ],
                                        [
                                            "조작 피드백",
                                            "--duration-feedback",
                                            "180ms",
                                            "버튼·레이블",
                                        ],
                                        ["패널 전환", "--duration-panel", "320ms", "모달·펼침"],
                                        [
                                            "기본 곡선",
                                            "--ease-standard",
                                            "cubic-bezier(.2,0,0,1)",
                                            "빠르게 반응하고 부드럽게 종료",
                                        ],
                                    ]}
                                />
                            </>,
                        )}
                        {section(
                            "scroll",
                            "글자별 스크롤 등장",
                            <>
                                <p>
                                    글자는 각각 분리된 영역 안에서 왼쪽 아래에서 들어옵니다. 양수
                                    자간과 마스크로 겹침을 막고, 충분한 스크롤 거리에서 한 글자씩
                                    천천히 드러냅니다.
                                </p>
                                <div
                                    className="ds-motion-scene"
                                    data-scroll-scene
                                    tabIndex={0}
                                    role="region"
                                    aria-label="글자 등장 체험, 이 영역을 아래로 스크롤하세요"
                                >
                                    <p className="ds-motion-hint">
                                        이 안을 천천히 스크롤해 보세요
                                        <Icon name="arrow_downward" size={20} />
                                    </p>
                                    <div className="ds-motion-track">
                                        <BookingInvitation id="design-scroll-title" />
                                    </div>
                                </div>
                                <p className="ds-caption">
                                    위 영역을 천천히 스크롤해 보세요. 멈춘 위치가 모션의 진행 위치가
                                    됩니다. 동작 줄이기 설정에서는 완성된 제목을 즉시 표시합니다.
                                </p>
                                <div className="ds-inline-links">
                                    <Link href="/">
                                        홈 관람 예약 보기
                                        <Icon name="diagonal" size={20} />
                                    </Link>
                                </div>
                            </>,
                        )}
                        {section(
                            "quick-menu",
                            "보라빛 퀵메뉴",
                            <>
                                <p>
                                    기존 퀵메뉴의 보라색은 이 컴포넌트 안의 전용 표현으로
                                    유지합니다. 문서와 일반 UI의 컬러 역할로 확장하지 않습니다.
                                </p>
                                <div className="ds-quick-menu">
                                    <VioletQuickMenu placement="inline" items={inlineMenuItems} />
                                </div>
                                <ul className="ds-rules-list">
                                    <li>
                                        클릭·터치·키보드로 열고, 방향키로 항목을 고른 뒤 Enter로
                                        이동합니다.
                                    </li>
                                    <li>
                                        원을 돌려 놓으면 선택 위치에 정렬됩니다. 놓기만 해서는
                                        이동하지 않습니다.
                                    </li>
                                    <li>
                                        동작 줄이기에서는 장식 움직임을 멈추고 탐색 기능은
                                        유지합니다.
                                    </li>
                                </ul>
                            </>,
                        )}
                    </>
                );
            case "accessibility":
                return (
                    <>
                        {section(
                            "reading",
                            "읽기",
                            <>
                                <p>
                                    일반 정보는 16px 이상으로 읽습니다. 이미지 안의 글자와 실제 UI
                                    레이블을 구분하고, 중요한 안내를 작거나 흐리게 숨기지 않습니다.
                                </p>
                                <ul className="ds-rules-list">
                                    <li>제목은 h1 → h2 → h3 순서로 구성합니다.</li>
                                    <li>본문과 배경의 대비는 4.5:1 이상으로 확인합니다.</li>
                                    <li>
                                        화면을 확대해도 본문은 줄바꿈하고, 표는 이름이 있는 내부
                                        영역에서 스크롤합니다.
                                    </li>
                                    <li>
                                        사진에는 목적에 맞는 대체 설명을 제공하고 장식 아이콘은
                                        숨깁니다.
                                    </li>
                                </ul>
                            </>,
                        )}
                        {section(
                            "interaction",
                            "조작",
                            <>
                                <div className="ds-demo-row">
                                    <SystemButton variant="secondary">
                                        Tab으로 초점 확인
                                    </SystemButton>
                                    <SystemButton variant="primary">Enter로 실행</SystemButton>
                                </div>
                                <ul className="ds-rules-list">
                                    <li>일반 조작 영역은 48px를 기본으로 확보합니다.</li>
                                    <li>초점은 3px 외곽선과 4px 간격으로 표시합니다.</li>
                                    <li>
                                        열리는 메뉴와 모달은 닫기·Esc·초점 복귀를 함께 제공합니다.
                                    </li>
                                    <li>
                                        모션 감소 설정을 따르고, 스크롤 모션은 입력 없이 계속
                                        재생하지 않습니다.
                                    </li>
                                    <li>
                                        색만으로 상태를 표현하지 않고 텍스트·아이콘·aria 속성을 함께
                                        갱신합니다.
                                    </li>
                                </ul>
                            </>,
                        )}
                        {section(
                            "writing",
                            "문장과 상태 표현",
                            <>
                                <DataTable
                                    label="안내 문장과 상태 표현 기준"
                                    headings={["상황", "사용할 문장", "기준"]}
                                    rows={[
                                        [
                                            "행동",
                                            "예매하기 · 일정 찾기",
                                            "행동과 대상을 구체적으로",
                                        ],
                                        [
                                            "입력 오류",
                                            "이메일 주소를 끝까지 입력해 주세요.",
                                            "원인과 해결 행동을 함께",
                                        ],
                                        [
                                            "빈 결과",
                                            "조건에 맞는 공연이 없습니다. 날짜를 바꿔보세요.",
                                            "현재 상황과 다음 선택",
                                        ],
                                        [
                                            "체험 완료",
                                            "예매 체험이 완료되었습니다. 실제 티켓은 발급되지 않습니다.",
                                            "실제 처리 범위를 정확하게",
                                        ],
                                    ]}
                                />
                            </>,
                        )}
                    </>
                );
            case "resources":
                return (
                    <>
                        {section(
                            "tokens",
                            "토큰 내보내기",
                            <>
                                <p>
                                    컬러·타이포그래피·조작 크기·모션의 기준을 CSS 변수로 적용합니다.
                                    실제 제품의 원본은 tokens.css와 defaults.css입니다.
                                </p>
                                <div className="ds-demo-row ds-no-print">
                                    <SystemButton onClick={downloadTokens}>
                                        <Icon name="download" size={20} />
                                        토큰 CSS 다운로드
                                    </SystemButton>
                                    <SystemButton
                                        variant="secondary"
                                        onClick={() => copyValue(designTokensCss(), "디자인 토큰")}
                                    >
                                        {copied === "디자인 토큰" ? "복사됨" : "전체 코드 복사"}
                                    </SystemButton>
                                </div>
                                <pre className="ds-code-block">
                                    <code>{designTokensCss()}</code>
                                </pre>
                            </>,
                        )}
                        {section(
                            "assets",
                            "브랜드 자료",
                            <>
                                <p>
                                    원본 로고와 설치된 서체를 사용합니다. 로고는 생성하거나 비율을
                                    바꾸지 않습니다.
                                </p>
                                <div className="ds-inline-links">
                                    <a href="/v5/assets/images/sejong-wordmark.png" download>
                                        워드마크 PNG
                                        <Icon name="download" size={20} />
                                    </a>
                                    <a href="/v5/assets/images/sejong-official-symbol.png" download>
                                        심벌 PNG
                                        <Icon name="download" size={20} />
                                    </a>
                                    <a href="/v5/assets/fonts/README.md">
                                        서체와 라이선스 안내
                                        <Icon name="diagonal" size={20} />
                                    </a>
                                </div>
                                <p className="ds-caption">
                                    워드마크는 세종문화회관의 기존 공식 소스에서 추출한 파일입니다.
                                    재사용 시 원 권리자의 사용 조건을 확인합니다.
                                </p>
                                <SystemButton
                                    variant="secondary"
                                    className="ds-no-print"
                                    onClick={() => window.print()}
                                >
                                    현재 문서 인쇄
                                </SystemButton>
                            </>,
                        )}
                        {section(
                            "references",
                            "참고 기준",
                            <>
                                <ul className="ds-rules-list">
                                    <li>
                                        <a
                                            href="https://www.sejongpac.or.kr/portal/main/main.do"
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            세종문화회관 원본 브랜드와 서비스 (새 창)
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            W3C WCAG 2.2 명도 대비 기준 (새 창)
                                        </a>
                                    </li>
                                    <li>
                                        사용자가 제시한 문서형 가이드의 분류·본문·목차 구조를 v5의
                                        정보와 컬러로 구성했습니다.
                                    </li>
                                </ul>
                            </>,
                        )}
                    </>
                );
        }
    };

    return (
        <div className="design-system-page">
            <header className="ds-doc-header">
                <Link className="ds-doc-brand" href="/" aria-label="세종문화회관 홈">
                    <img
                        src="/v5/assets/images/sejong-wordmark.png"
                        width={158}
                        height={29}
                        alt="세종문화회관"
                    />
                    <span>디자인 시스템</span>
                </Link>
                <div className="ds-doc-actions">
                    <button
                        type="button"
                        className="ds-search-trigger"
                        aria-label="디자인 가이드 검색"
                        aria-haspopup="dialog"
                        onClick={() => openDialog(searchDialog.current)}
                    >
                        <Icon name="search" size={20} />
                        <span>가이드 검색</span>
                        <kbd>Ctrl K</kbd>
                    </button>
                    <Link className="ds-site-link" href="/">
                        사이트 보기
                        <Icon name="diagonal" size={20} />
                    </Link>
                    <SystemButton
                        className="ds-menu-trigger"
                        variant="quiet"
                        aria-label="디자인 시스템 목차 열기"
                        aria-haspopup="dialog"
                        onClick={() => openDialog(navigationDialog.current)}
                    >
                        <Icon name="menu" size={24} />
                    </SystemButton>
                </div>
            </header>
            <aside className="ds-sidebar">
                {navigationLinks()}
                <p className="ds-sidebar-note">
                    v5 · 디지털 사용 기준
                    <br />
                    본문 16px · 기존 컬러 유지
                </p>
            </aside>
            <div className="ds-content-area">
                <div className="ds-doc-layout">
                    <main id="main" tabIndex={-1} className="ds-document">
                        <nav className="ds-breadcrumbs" aria-label="문서 위치">
                            <a
                                href="#overview"
                                onClick={(event) => navigate("overview", "", event)}
                            >
                                가이드
                            </a>
                            <span aria-hidden="true">/</span>
                            <span>{chapter.label}</span>
                        </nav>
                        <div className="ds-page-heading">
                            <p className="ds-version">v5 · 2026.10</p>
                            <h1 id="doc-page-title" tabIndex={-1}>
                                {chapterId === "overview"
                                    ? "세종문화회관 디자인 시스템"
                                    : chapter.label}
                            </h1>
                            <p>
                                {chapterId === "overview"
                                    ? "브랜드 컬러부터 한 글자의 간격까지. v5 화면을 만들고 확인할 때 사용하는 기준입니다."
                                    : chapter.description}
                            </p>
                        </div>
                        <p className="ds-feedback-line" role="status" aria-live="polite">
                            {message}
                        </p>
                        {renderChapter()}
                        <nav className="ds-chapter-footer" aria-label="이전 다음 문서">
                            {chapterIndex > 0 && (
                                <a
                                    href={`#${CHAPTERS[chapterIndex - 1].id}`}
                                    onClick={(event) =>
                                        navigate(CHAPTERS[chapterIndex - 1].id, "", event)
                                    }
                                >
                                    <span>이전</span>
                                    <strong>{CHAPTERS[chapterIndex - 1].label}</strong>
                                </a>
                            )}
                            {chapterIndex < CHAPTERS.length - 1 && (
                                <a
                                    href={`#${CHAPTERS[chapterIndex + 1].id}`}
                                    onClick={(event) =>
                                        navigate(CHAPTERS[chapterIndex + 1].id, "", event)
                                    }
                                >
                                    <span>다음</span>
                                    <strong>{CHAPTERS[chapterIndex + 1].label}</strong>
                                </a>
                            )}
                        </nav>
                    </main>
                    <nav className="ds-outline" aria-label="현재 문서 목차">
                        <p>이 문서의 내용</p>
                        {chapter.sections.map(([id, label]) => (
                            <a
                                href={`#${chapterId}/${id}`}
                                key={id}
                                aria-current={
                                    activeSection === `${chapterId}-${id}` ? "location" : undefined
                                }
                                onClick={(event) => navigate(chapterId, id, event)}
                            >
                                {label}
                            </a>
                        ))}
                    </nav>
                </div>
            </div>

            <dialog
                ref={searchDialog}
                className="ds-dialog ds-search-dialog"
                aria-labelledby="doc-search-title"
                onClose={restoreScroll}
            >
                <div className="ds-dialog-heading">
                    <h2 id="doc-search-title">가이드 검색</h2>
                    <SystemButton
                        variant="quiet"
                        className="ds-dialog-close"
                        aria-label="검색 닫기"
                        onClick={() => searchDialog.current?.close()}
                    >
                        <Icon name="close" size={24} />
                    </SystemButton>
                </div>
                <SystemField
                    id="doc-search"
                    label="찾을 기준"
                    placeholder="예: 컬러, 16px, 모션"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    autoFocus
                />
                <div className="ds-search-results">
                    {results.length ? (
                        results.map((result) => (
                            <a
                                key={result.chapter + result.anchor + result.title}
                                href={`#${result.chapter}${result.anchor ? "/" + result.anchor : ""}`}
                                onClick={(event) => navigate(result.chapter, result.anchor, event)}
                            >
                                <div>
                                    <strong>{result.title}</strong>
                                    <span>{result.description}</span>
                                </div>
                                <Icon name="chevron" size={20} />
                            </a>
                        ))
                    ) : (
                        <SystemNotice title="찾는 기준이 없습니다.">
                            검색어를 짧게 바꾸거나 왼쪽 분류에서 확인해 주세요.
                        </SystemNotice>
                    )}
                </div>
            </dialog>
            <dialog
                ref={navigationDialog}
                className="ds-dialog ds-navigation-dialog"
                aria-labelledby="doc-navigation-title"
                onClose={restoreScroll}
            >
                <div className="ds-dialog-heading">
                    <h2 id="doc-navigation-title">디자인 시스템</h2>
                    <SystemButton
                        variant="quiet"
                        className="ds-dialog-close"
                        aria-label="목차 닫기"
                        onClick={() => navigationDialog.current?.close()}
                    >
                        <Icon name="close" size={24} />
                    </SystemButton>
                </div>
                {navigationLinks(true)}
            </dialog>
            <dialog
                ref={demoDialog}
                className="ds-dialog"
                aria-labelledby="sample-dialog-title"
                onClose={restoreScroll}
            >
                <div className="ds-dialog-heading">
                    <h2 id="sample-dialog-title">관람할 날짜를 선택해 주세요</h2>
                    <SystemButton
                        variant="quiet"
                        className="ds-dialog-close"
                        aria-label="날짜 선택 닫기"
                        onClick={() => demoDialog.current?.close()}
                    >
                        <Icon name="close" size={24} />
                    </SystemButton>
                </div>
                <SystemField
                    id="sample-date"
                    label="관람일"
                    type="date"
                    value={demoDate}
                    onChange={(event) => setDemoDate(event.target.value)}
                />
                <p>디자인 컴포넌트를 확인하는 예제입니다. 실제 예매에는 반영되지 않습니다.</p>
                <div className="ds-dialog-actions">
                    <SystemButton variant="secondary" onClick={() => demoDialog.current?.close()}>
                        취소
                    </SystemButton>
                    <SystemButton
                        onClick={() => {
                            setMessage(
                                demoDate
                                    ? `${demoDate}을 선택했습니다.`
                                    : "관람일을 선택해 주세요.",
                            );
                            if (demoDate) demoDialog.current?.close();
                        }}
                    >
                        선택 적용
                    </SystemButton>
                </div>
            </dialog>
        </div>
    );
}
