// [v5 토큰의 단일 원본 / Single source of truth for v5 design tokens]
// 팔레트·서체·실제 화면의 기하를 보존하며 문서와 CSS를 함께 생성합니다.
// Preserve the current palette, type and effective geometry in both documentation and CSS.
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

// [유리 재질의 공통 정의 / Shared glass material definitions]
export type GlassMaterial = Readonly<{
    opacity: number;
    refraction: number;
    blur: number;
    thickness: number;
}>;

export const GLASS_MATERIALS = Object.freeze({
    surface: Object.freeze({ opacity: 0.82, refraction: 64, blur: 18, thickness: 32 }),
    drawer: Object.freeze({ opacity: 0.94, refraction: 96, blur: 24, thickness: 40 }),
    hero: Object.freeze({ opacity: 0.84, refraction: 72, blur: 20, thickness: 28 }),
}) satisfies Readonly<Record<string, GlassMaterial>>;
export type GlassMaterialVariant = keyof typeof GLASS_MATERIALS;

type TokenValues = Readonly<Record<`--${string}`, string>>;
const rem = (pixels: number) => `${pixels / 16}rem`;
const reference = (token: string) => `var(--${token})`;

// [기존 컴포넌트의 호환 이름 / Compatibility aliases for existing components]
const COMPATIBILITY_TOKENS = {
    "--paper": reference("surface-default"),
    "--paper-subtle": reference("surface-subtle"),
    "--soft": reference("background-page"),
    "--ink": reference("text-primary"),
    "--ink-secondary": reference("text-secondary"),
    "--muted": reference("text-secondary"),
    "--line": reference("border-default"),
    "--line-subtle": reference("border-default"),
    "--primary": reference("action-primary"),
    "--primary-foreground": reference("text-inverse"),
    "--accent": reference("accent-highlight"),
    "--accent-foreground": reference("text-on-brand"),
    "--sky": reference("color-sky"),
    "--earth": reference("color-ochre"),
    "--human": reference("color-yellow"),
    "--yellow": reference("human"),
    "--yellow-dark": "color-mix(in srgb, var(--human) 90%, #000000)",
    "--semantic-success": reference("text-primary"),
    "--semantic-success-subtle": reference("surface-subtle"),
    "--semantic-success-border": reference("border-strong"),
    "--semantic-error": reference("color-black"),
    "--semantic-error-subtle": reference("surface-subtle"),
    "--semantic-error-border": reference("border-strong"),
    "--semantic-warning": reference("color-ochre"),
    "--semantic-warning-subtle": reference("surface-subtle"),
    "--semantic-warning-border": reference("border-default"),
    "--semantic-info": reference("color-sky"),
    "--semantic-info-subtle": reference("surface-subtle"),
    "--semantic-info-border": reference("border-default"),
} satisfies TokenValues;

// [읽기 위계와 로컬 서체 / Reading hierarchy and local font]
const FLUID_TYPE_VIEWPORTS: Partial<Record<(typeof TYPE_SCALE)[number]["token"], string>> = {
    "text-display": "5vw",
    "text-title": "3.5vw",
    "text-heading": "2.5vw",
};
const TYPOGRAPHY_TOKENS = {
    ...Object.fromEntries(TYPE_SCALE.map((type) => [
        `--${type.token}`, FLUID_TYPE_VIEWPORTS[type.token]
            ? `clamp(${rem(type.mobile)}, ${FLUID_TYPE_VIEWPORTS[type.token]}, ${rem(type.size)})`
            : rem(type.size),
    ])),
    "--text-action": rem(20),
    "--text-card-title": rem(20),
    "--text-meta": rem(16),
    "--text-menu-link": reference("text-lead"),
    "--text-menu-group": reference("text-subheading"),
    "--weight-body": "400",
    "--weight-label": "500",
    "--weight-action": "600",
    "--weight-title": "700",
    "--weight-heading": "700",
    "--leading-body": "1.7",
    "--leading-label": "1.5",
    "--leading-heading": "1.25",
    "--tracking-body": "-0.015em",
    "--tracking-heading": "-0.035em",
    "--font": '"Wanted Sans Variable", "Wanted Sans", -apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif',
    "--font-sans": reference("font"),
    "--display-font": reference("font"),
} satisfies TokenValues;

// [배치와 조작 크기 / Layout and interaction dimensions]
// refinement에서 실제 적용되던 곡률과 섹션 간격을 보존합니다.
// Preserve the radius and section spacing previously supplied by refinements.
const GEOMETRY_TOKENS = {
    ...Object.fromEntries(SPACE_SCALE.map((value) => [`--space-${value / 4}`, rem(value)])),
    "--container": "108rem",
    "--page-gutter": "clamp(1.25rem, 2.5vw, 3rem)",
    "--content-reading-width": "72ch",
    "--content-form-width": "40rem",
    "--hero-card-width": "90rem",
    "--hero-peek": "clamp(1rem, 7vw, 10rem)",
    "--hero-gap": "clamp(0.75rem, 1.4vw, 1.5rem)",
    "--section-gap": "clamp(5rem, 7vw, 7rem)",
    "--control-size": rem(48),
    "--shortcut-size": rem(64),
    "--control-flow-button-size": "50px",
    "--control-flow-field-size": "54px",
    "--radius": "0.625rem",
    "--radius-media": "0.75rem",
    "--radius-banner": "1rem",
    "--radius-sm": "4px",
    "--radius-md": "8px",
    "--radius-lg": "16px",
    "--radius-control": "8px",
    "--radius-flow": "9px",
    "--radius-dialog": "24px",
    "--radius-pill": "9999px",
} satisfies TokenValues;

// [히어로의 공유 시간 규격 / Shared hero timing contract]
export const HERO_MOTION = Object.freeze({ interval: 3500, transition: 750, copy: 650, settle: 240 });

// [색으로 표현하는 상태와 전환 / Color feedback and transition timing]
const MOTION_AND_STATE_TOKENS = {
    "--state-hover": "#f0f2f4",
    "--state-pressed": "#e1e5e9",
    "--focus-color": "#08779a",
    "--focus-width": "3px",
    "--focus-offset": "4px",
    "--feedback-duration": "160ms",
    "--duration-fast": "120ms",
    "--duration-feedback": "180ms",
    "--duration-panel": "320ms",
    "--duration-carousel": `${HERO_MOTION.transition}ms`,
    "--duration-hero-copy": `${HERO_MOTION.copy}ms`,
    "--duration-hero-settle": `${HERO_MOTION.settle}ms`,
    "--ease-carousel": "cubic-bezier(0.22, 0.61, 0.36, 1)",
    "--ease-standard": "cubic-bezier(0.2, 0, 0, 1)",
    "--ease-out": "cubic-bezier(0.22, 1, 0.36, 1)",
} satisfies TokenValues;

const GLASS_TOKENS = {
    ...Object.fromEntries(Object.entries(GLASS_MATERIALS).flatMap(([variant, material]) => {
        const prefix = variant === "surface" ? "--glass" : `--glass-${variant}`;
        return Object.entries(material).map(([property, value]) => [
            `${prefix}-${property}`,
            `${value}${property === "blur" || property === "thickness" ? "px" : ""}`,
        ]);
    })),
    "--glass-tint": "rgb(255 255 255 / var(--glass-opacity))",
    "--glass-saturation": "1.4",
    "--glass-edge": "rgb(255 255 255 / 88%)",
    "--glass-shadow": "0 24px 80px rgb(0 0 0 / 18%), 0 4px 16px rgb(0 0 0 / 9%)",
} satisfies TokenValues;

// [문서와 배포 CSS가 공유하는 값 / Values shared by the guide and production CSS]
export const DESIGN_TOKEN_VALUES: TokenValues = Object.freeze({
    ...Object.fromEntries(DESIGN_COLORS.map((color) => [`--${color.token}`, color.hex])),
    ...Object.fromEntries(SEMANTIC_COLORS.map(([, token, source]) => [`--${token}`, reference(source)])),
    ...COMPATIBILITY_TOKENS,
    ...TYPOGRAPHY_TOKENS,
    ...GEOMETRY_TOKENS,
    ...MOTION_AND_STATE_TOKENS,
    ...GLASS_TOKENS,
});

// [원본 로컬 폰트 선언을 보존하는 결정적 CSS 생성 / Deterministic CSS preserving the local font face]
export function renderDesignTokensCss(): string {
    const declarations = Object.entries(DESIGN_TOKEN_VALUES)
        .map(([token, value]) => `    ${token}: ${value};`).join("\n");
    return `/* [v5 디자인 토큰 / v5 design tokens]
   src/data/design-tokens.ts에서 생성됩니다. / Generated from src/data/design-tokens.ts.
   node scripts/sync-design-tokens.ts --check */
@font-face {
    font-family: "Wanted Sans Variable";
    src: url("/v5/assets/fonts/woff2/WantedSansVariable.woff2") format("woff2-variations"),
         url("/assets/fonts/woff2/WantedSansVariable.woff2") format("woff2-variations"),
         url("/v5/assets/fonts/woff2/WantedSansVariable.woff2") format("woff2"),
         url("/assets/fonts/woff2/WantedSansVariable.woff2") format("woff2");
    font-weight: 400 1000;
    font-style: normal;
    font-display: swap;
}

:root {
${declarations}
}
`;
}
