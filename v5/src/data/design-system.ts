// [v5 디자인 기준과 문서 구조 / v5 design standards and documentation structure]
// 팔레트는 현재 tokens.css의 값을 유지하며, 실제 CSS와 브라우저에서 함께 검증합니다.
// Preserve the current tokens.css palette and verify the documentation against computed CSS.
export const DESIGN_COLORS = [
    {
        name: "블랙",
        token: "color-black",
        hex: "#000000",
        use: "제목·본문·주요 행동",
        ink: "#FFFFFF",
    },
    {
        name: "하늘",
        token: "color-sky",
        hex: "#54C8E8",
        use: "탐색·안내·보조 행동",
        ink: "#000000",
    },
    {
        name: "노랑",
        token: "color-yellow",
        hex: "#F7D549",
        use: "추천·강조·선택의 포인트",
        ink: "#000000",
    },
    {
        name: "황토",
        token: "color-ochre",
        hex: "#C36D15",
        use: "문화·브랜드 이야기",
        ink: "#000000",
    },
    {
        name: "화이트",
        token: "color-white",
        hex: "#FFFFFF",
        use: "기본 표면·반전 글자",
        ink: "#000000",
    },
    {
        name: "그레이 050",
        token: "color-gray-050",
        hex: "#F7F7F5",
        use: "보조 표면·예시 배경",
        ink: "#000000",
    },
    {
        name: "그레이 300",
        token: "color-gray-300",
        hex: "#D9D9D4",
        use: "구분선·장식 경계",
        ink: "#000000",
    },
    {
        name: "그레이 600",
        token: "color-gray-600",
        hex: "#626262",
        use: "보조 본문·입력 경계",
        ink: "#FFFFFF",
    },
] as const;

export const SEMANTIC_COLORS = [
    ["표면", "background-page", "color-gray-050", "페이지의 보조 바탕"],
    ["표면", "surface-default", "color-white", "페이지와 기본 패널"],
    ["표면", "surface-subtle", "color-gray-050", "보조 영역과 예시 배경"],
    ["표면", "surface-inverse", "color-black", "반전 영역"],
    ["글자", "text-primary", "color-black", "제목과 본문"],
    ["글자", "text-secondary", "color-gray-600", "설명과 부가 정보"],
    ["글자", "text-inverse", "color-white", "어두운 표면 위 글자"],
    ["글자", "text-on-brand", "color-black", "브랜드색 위 글자"],
    ["경계", "border-default", "color-gray-300", "장식 구분선"],
    ["경계", "border-strong", "color-gray-600", "입력 필드의 경계"],
    ["경계", "border-focus", "color-black", "강한 초점 경계"],
    ["행동", "action-primary", "color-black", "예매·확인·신청"],
    ["행동", "action-primary-hover", "color-gray-600", "주요 버튼의 호버"],
    ["행동", "action-secondary", "color-sky", "보조 탐색"],
    ["행동", "action-tertiary", "color-white", "외곽선 행동"],
    ["행동", "action-disabled", "color-gray-300", "사용할 수 없는 행동"],
    ["행동", "action-disabled-text", "color-gray-600", "비활성 행동의 레이블"],
    ["강조", "accent-highlight", "color-yellow", "추천과 짧은 강조"],
    ["강조", "accent-heritage", "color-ochre", "문화 콘텐츠"],
    ["강조", "accent-information", "color-sky", "안내와 탐색 영역"],
] as const;

export const TYPE_SCALE = [
    {
        role: "디스플레이",
        token: "text-display",
        size: 64,
        mobile: 40,
        weight: 700,
        leading: 1.15,
        use: "홈의 핵심 메시지",
    },
    {
        role: "페이지 제목",
        token: "text-title",
        size: 48,
        mobile: 36,
        weight: 700,
        leading: 1.25,
        use: "페이지의 유일한 h1",
    },
    {
        role: "섹션 제목",
        token: "text-heading",
        size: 32,
        mobile: 28,
        weight: 700,
        leading: 1.25,
        use: "콘텐츠의 큰 구분",
    },
    {
        role: "그룹 제목",
        token: "text-subheading",
        size: 24,
        mobile: 24,
        weight: 700,
        leading: 1.4,
        use: "모달·컴포넌트 그룹",
    },
    {
        role: "소제목",
        token: "text-item-title",
        size: 20,
        mobile: 20,
        weight: 700,
        leading: 1.5,
        use: "카드·항목의 제목",
    },
    {
        role: "리드 문장",
        token: "text-lead",
        size: 18,
        mobile: 18,
        weight: 400,
        leading: 1.7,
        use: "짧은 도입과 요약",
    },
    {
        role: "본문",
        token: "text-body",
        size: 16,
        mobile: 16,
        weight: 400,
        leading: 1.7,
        use: "모든 설명의 시작점",
    },
    {
        role: "레이블·보조",
        token: "text-sm",
        size: 16,
        mobile: 16,
        weight: 500,
        leading: 1.5,
        use: "메뉴·날짜·고지·도움말",
    },
] as const;

export const SPACE_SCALE = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96] as const;
export const CHAPTERS = [
    {
        id: "overview",
        label: "디자인 시스템 소개",
        group: "시작하기",
        description: "세종의 브랜드를 일관된 화면으로 이어가는 기준",
        sections: [
            ["principles", "설계 원칙"],
            ["structure", "시스템의 구성"],
        ],
    },
    {
        id: "brand",
        label: "브랜드와 로고",
        group: "기초 원칙",
        description: "원형을 보존하는 로고와 디지털 사용 기준",
        sections: [
            ["signature", "기본형"],
            ["clearspace", "보호 공간과 최소 크기"],
            ["usage", "올바른 사용"],
            ["icons", "아이콘"],
        ],
    },
    {
        id: "color",
        label: "컬러",
        group: "기초 원칙",
        description: "기존 팔레트와 역할별 사용법",
        sections: [
            ["palette", "기본 팔레트"],
            ["semantic", "역할별 컬러"],
            ["contrast", "명도 대비"],
        ],
    },
    {
        id: "typography",
        label: "타이포그래피",
        group: "기초 원칙",
        description: "16px에서 시작하는 한글 중심의 읽기 체계",
        sections: [
            ["family", "기본 서체"],
            ["scale", "크기와 위계"],
            ["specimen", "직접 조합하기"],
        ],
    },
    {
        id: "layout",
        label: "레이아웃과 간격",
        group: "기초 원칙",
        description: "4px 단위의 간격과 반응형 구성",
        sections: [
            ["grid", "그리드와 화면"],
            ["spacing", "간격"],
            ["shape", "형태와 경계"],
        ],
    },
    {
        id: "components",
        label: "컴포넌트",
        group: "화면 만들기",
        description: "같은 역할에 같은 형태와 상태를 사용합니다",
        sections: [
            ["buttons", "버튼"],
            ["cards", "콘텐츠 카드"],
            ["fields", "입력"],
            ["navigation", "탭과 펼침"],
            ["liquid-glass", "리퀴드 글래스"],
            ["floating-menu", "떠 있는 유리 메뉴"],
            ["feedback", "상태와 대화상자"],
        ],
    },
    {
        id: "motion",
        label: "모션",
        group: "화면 만들기",
        description: "읽기와 조작을 돕는 속도, 스크롤에 반응하는 등장",
        sections: [
            ["timing", "시간과 이징"],
            ["scroll", "글자별 스크롤 등장"],
            ["quick-menu", "보라빛 퀵메뉴"],
        ],
    },
    {
        id: "accessibility",
        label: "접근성과 문장",
        group: "화면 만들기",
        description: "색·크기·입력 방식과 관계없이 전달하는 정보",
        sections: [
            ["reading", "읽기"],
            ["interaction", "조작"],
            ["writing", "문장과 상태 표현"],
        ],
    },
    {
        id: "resources",
        label: "토큰과 자료",
        group: "적용하기",
        description: "실제 코드와 연결된 토큰과 원본 자료",
        sections: [
            ["tokens", "토큰 내보내기"],
            ["assets", "브랜드 자료"],
            ["references", "참고 기준"],
        ],
    },
] as const;
export type ChapterId = (typeof CHAPTERS)[number]["id"];

// [명도 대비 계산 / Relative luminance contrast]
// WCAG의 sRGB 상대 명도 공식으로 실제 팔레트 조합을 계산합니다.
// Calculate palette pairs from the WCAG sRGB relative luminance formula.
export function contrastRatio(first: string, second: string): number {
    const luminance = (hex: string) => {
        if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error("Expected a six-digit hex color");
        const channels = [1, 3, 5].map((offset) => {
            const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const a = luminance(first);
    const b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function designTokensCss(): string {
    const colors = DESIGN_COLORS.map((color) => `    --${color.token}: ${color.hex};`);
    const semantics = SEMANTIC_COLORS.map(
        ([, token, source]) => `    --${token}: var(--${source});`,
    );
    return `/* Sejong v5 - digital design tokens */\n:root {\n${[
        ...colors,
        "",
        ...semantics,
        "",
        "    --text-body: 1rem;",
        "    --text-sm: 1rem;",
        "    --text-lead: 1.125rem;",
        "    --text-item-title: 1.25rem;",
        "    --text-subheading: 1.5rem;",
        "    --text-heading: clamp(1.75rem, 2.5vw, 2rem);",
        "    --text-title: clamp(2.25rem, 3.5vw, 3rem);",
        "    --leading-body: 1.7;",
        "    --text-display: clamp(2.5rem, 5vw, 4rem);",
        "    --text-action: 1.25rem;",
        "    --text-meta: 1rem;",
        "    --text-card-title: 1.25rem;",
        "    --weight-body: 400;",
        "    --weight-label: 500;",
        "    --weight-action: 600;",
        "    --weight-title: 700;",
        "    --weight-heading: 700;",
        "    --leading-label: 1.5;",
        "    --leading-heading: 1.25;",
        "    --tracking-body: -0.015em;",
        "    --tracking-heading: -0.035em;",
        ...SPACE_SCALE.map((value) => `    --space-${value / 4}: ${value / 16}rem;`),
        "    --container: 1320px;",
        "    --page-gutter: clamp(20px, 4vw, 64px);",
        "    --control-size: 3rem;",
        "    --radius-md: 8px;",
        "    --radius-lg: 16px;",
        "    --radius-sm: 4px;",
        "    --radius: 8px;",
        "    --radius-media: 16px;",
        "    --radius-banner: 24px;",
        "    --radius-dialog: 24px;",
        "    --radius-pill: 9999px;",
        "    --glass-opacity: 0.82;",
        "    --glass-tint: rgb(255 255 255 / var(--glass-opacity));",
        "    --glass-blur: 18px;",
        "    --glass-refraction: 64;",
        "    --glass-thickness: 32px;",
        "    --glass-saturation: 1.4;",
        "    --glass-edge: rgb(255 255 255 / 88%);",
        "    --glass-shadow: 0 24px 80px rgb(0 0 0 / 18%), 0 4px 16px rgb(0 0 0 / 9%);",
        "    --text-menu-link: var(--text-lead);",
        "    --text-menu-group: var(--text-subheading);",
        "    --focus-color: #08779a;",
        "    --font: 'Wanted Sans Variable', 'Wanted Sans', system-ui, sans-serif;",
        "    --font-sans: var(--font);",
        "    --display-font: var(--font);",
        "    --duration-fast: 120ms;",
        "    --duration-feedback: 180ms;",
        "    --duration-panel: 320ms;",
        "    --ease-standard: cubic-bezier(.2, 0, 0, 1);",
        "    --ease-out: cubic-bezier(.22, 1, .36, 1);",
    ].join("\n")}\n}\n`;
}
