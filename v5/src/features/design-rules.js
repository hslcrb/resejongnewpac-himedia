import { esc, href, icon, toast } from "../lib/core.js";
import { pageHeader } from "../components/ui.js";

// Anime.js를 동적으로 불러오거나 브라우저에서 안전하게 애니메이션 실행
let animeModule = null;
async function getAnime() {
    if (animeModule) return animeModule;
    try {
        const mod = await import("animejs");
        animeModule = mod.default || mod;
        return animeModule;
    } catch (e) {
        console.warn("Anime.js loading fallback:", e);
        return null;
    }
}

/**
 * 01. Primitives Data Definition
 */
const PRIMITIVES = [
    { group: "Brand (Heritage)", name: "color/cheon", hex: "#54c8e8", desc: "천 (Sky) - 예술적 영감과 맑은 하늘" },
    { group: "Brand (Heritage)", name: "color/ji", hex: "#c36d15", desc: "지 (Earth) - 대지와 무대의 품격" },
    { group: "Brand (Heritage)", name: "color/in", hex: "#ffe800", desc: "인 (Human) - 시민과 예술가의 생명력" },
    { group: "Neutral (Surface/Text)", name: "neutral/000", hex: "#ffffff", desc: "순백 배경 및 카드 기본 표면" },
    { group: "Neutral (Surface/Text)", name: "neutral/050", hex: "#f8fafc", desc: "은은한 서브 표면 및 섹션 배경" },
    { group: "Neutral (Surface/Text)", name: "neutral/100", hex: "#f5f6f8", desc: "소프트 서피스 및 태그 배경" },
    { group: "Neutral (Surface/Text)", name: "neutral/200", hex: "#e2e8f0", desc: "구분선, 경계선 (Border)" },
    { group: "Neutral (Surface/Text)", name: "neutral/500", hex: "#64748b", desc: "보조 안내 텍스트 (Muted Text, 4.5:1 AA)" },
    { group: "Neutral (Surface/Text)", name: "neutral/700", hex: "#334155", desc: "보조 본문 텍스트" },
    { group: "Neutral (Surface/Text)", name: "neutral/900", hex: "#0f172a", desc: "깊은 먹색 본문 (WCAG AAA 15:1 최고 가독성)" },
    { group: "Primary & Action", name: "primary/stage-black", hex: "#18181b", desc: "공연예술 아카이브 스테이지 블랙" },
    { group: "Primary & Action", name: "brand/blue-sky", hex: "#0284c7", desc: "상호작용 링크 및 클릭 블루" },
    { group: "Semantic Feedback", name: "semantic/success", hex: "#16a34a", desc: "접수/예매 완료 성공 그린" },
    { group: "Semantic Feedback", name: "semantic/warning", hex: "#ea580c", desc: "주의 및 마감 임박 오렌지" },
    { group: "Semantic Feedback", name: "semantic/error", hex: "#dc2626", desc: "오류 및 필수 입력 누락 레드" },
];

/**
 * 02. Semantic Variables Definition
 */
const SEMANTICS = [
    { group: "Background", name: "bg/canvas", primitive: "neutral/000", hex: "#ffffff", desc: "전체 페이지 기본 캔버스 배경" },
    { group: "Background", name: "bg/subtle", primitive: "neutral/050", hex: "#f8fafc", desc: "섹션 전환 및 서브 컨테이너 배경" },
    { group: "Background", name: "bg/muted", primitive: "neutral/100", hex: "#f5f6f8", desc: "태그, 배지, 필터 칩 배경" },
    { group: "Surface", name: "surface/card", primitive: "neutral/000", hex: "#ffffff", desc: "프로그램 및 정보 카드 표면" },
    { group: "Surface", name: "surface/overlay", primitive: "primary/stage-black", hex: "#18181b", desc: "모달 및 내비게이션 드롭다운 표면" },
    { group: "Text", name: "text/primary", primitive: "neutral/900", hex: "#0f172a", desc: "가장 중요한 제목 및 본문 (대비 15:1)" },
    { group: "Text", name: "text/secondary", primitive: "neutral/700", hex: "#334155", desc: "부가 설명 및 부제목" },
    { group: "Text", name: "text/muted", primitive: "neutral/500", hex: "#64748b", desc: "날짜, 장소, 보조 캡션 (대비 4.5:1 AA 통과)" },
    { group: "Text", name: "text/inverse", primitive: "neutral/000", hex: "#ffffff", desc: "어두운 버튼 및 다크 서피스 위 글자" },
    { group: "Border", name: "border/default", primitive: "neutral/200", hex: "#e2e8f0", desc: "카드 테두리 및 구분선" },
    { group: "Action", name: "action/primary", primitive: "primary/stage-black", hex: "#18181b", desc: "주요 예매/신청 완료 버튼" },
    { group: "Action", name: "action/interactive", primitive: "brand/blue-sky", hex: "#0284c7", desc: "텍스트 링크 및 포커스 링" },
    { group: "Accent", name: "accent/human", primitive: "color/in", hex: "#ffe800", desc: "시그니처 포인트 하이라이트" },
];

export function renderDesignRules() {
    return `
    <div class="design-rules-page">
        ${pageHeader({
            title: "디자인 시스템 & 규칙",
            eyebrow: "SEJONG DESIGN SYSTEM V5",
            description: "천지인(天地人) 아이덴티티와 60/30/10 원칙, 그리고 Figma Variables 체계의 완벽한 조화.",
            group: "rules",
            path: "/design-rules"
        })}
        
        <div class="container page-content" style="max-width:1120px;margin:0 auto;padding-bottom:5rem;">
            <!-- 버전별 디자인 규칙 퀵 링크 네비게이션 카드 -->
            <section class="version-nav-section" style="margin-bottom:3.5rem;">
                <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:1rem;color:#0f172a;">버전별 디자인 설계 규칙 탐색</h2>
                <div class="version-rule-cards" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1rem;">
                    <a href="legacy.html" class="rule-nav-card" style="display:block;padding:1.2rem;background:#f3f4f5;border-radius:12px;text-decoration:none;color:#1e293b;border:1px solid #e2e8f0;transition:all 0.2s;">
                        <span style="font-size:0.75rem;font-weight:700;color:#64748b;">LEGACY</span>
                        <h3 style="font-size:1rem;margin:0.4rem 0;font-weight:700;">구버전 규칙</h3>
                        <p style="font-size:0.825rem;color:#64748b;margin:0;">기존 웹사이트의 전통 구조와 배치</p>
                    </a>
                    <a href="v2/docs/design-system.md" class="rule-nav-card" style="display:block;padding:1.2rem;background:#fff8db;border-radius:12px;text-decoration:none;color:#1e293b;border:1px solid #fde047;transition:all 0.2s;">
                        <span style="font-size:0.75rem;font-weight:700;color:#854d0e;">V2 DESIGN</span>
                        <h3 style="font-size:1rem;margin:0.4rem 0;font-weight:700;">v2 가독성 기본값</h3>
                        <p style="font-size:0.825rem;color:#713f12;margin:0;">16px 최소 크기 및 캡슐형 피드백</p>
                    </a>
                    <a href="v4/docs/interaction-plan.md" class="rule-nav-card" style="display:block;padding:1.2rem;background:#eff6ff;border-radius:12px;text-decoration:none;color:#1e293b;border:1px solid #bfdbfe;transition:all 0.2s;">
                        <span style="font-size:0.75rem;font-weight:700;color:#1d4ed8;">V4 INTERACTION</span>
                        <h3 style="font-size:1rem;margin:0.4rem 0;font-weight:700;">v4 인터랙션 설계</h3>
                        <p style="font-size:0.825rem;color:#1e40af;margin:0;">방문 여정 및 모션 피드백</p>
                    </a>
                    <div class="rule-nav-card is-active" style="padding:1.2rem;background:#0f172a;border-radius:12px;color:#ffffff;border:2px solid #54c8e8;">
                        <span style="font-size:0.75rem;font-weight:700;color:#54c8e8;">V5 NEXT.JS</span>
                        <h3 style="font-size:1rem;margin:0.4rem 0;font-weight:700;">v5 브랜드 시스템 (현재)</h3>
                        <p style="font-size:0.825rem;color:#94a3b8;margin:0;">Figma 변수 & 60/30/10 토큰</p>
                    </div>
                </div>
            </section>

            <!-- 1. 브랜드 아이덴티티 및 60/30/10 배분 철학 -->
            <section class="brand-philosophy-card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:2rem;margin-bottom:3rem;box-shadow:0 4px 12px rgba(0,0,0,0.03);">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
                    <span style="display:inline-block;width:12px;height:12px;background:#ffe800;border-radius:50%;"></span>
                    <h2 style="font-size:1.5rem;font-weight:700;margin:0;color:#0f172a;">1. 브랜드 아이덴티티 및 60/30/10 컬러 시스템</h2>
                </div>
                <p style="color:#475569;line-height:1.7;font-size:1.025rem;">
                    세종문화회관의 역사적 상징인 <strong>천·지·인(天地人) 삼재(三才) 컬러</strong>를 온전히 보존하면서, 
                    <strong>Brand Designer</strong> 및 <strong>UI Pro Max</strong>의 <em>60/30/10 법칙</em>에 따라 역할을 정밀하게 분배했습니다.
                </p>
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:1.5rem;margin-top:1.5rem;">
                    <div style="padding:1.25rem;background:#f8fafc;border-radius:12px;border-left:4px solid #64748b;">
                        <h3 style="font-size:1.1rem;font-weight:700;margin:0 0 0.5rem 0;color:#0f172a;">60% Neutral & Surface</h3>
                        <p style="font-size:0.925rem;color:#475569;line-height:1.6;margin:0;">
                            <strong>#FFFFFF, #F8FAFC, #0F172A</strong><br>
                            정보를 담는 넓은 캔버스와 최고 가독성(대비 15:1) 먹색 텍스트를 배치하여 눈의 피로를 최소화합니다.
                        </p>
                    </div>
                    <div style="padding:1.25rem;background:#f8fafc;border-radius:12px;border-left:4px solid #18181b;">
                        <h3 style="font-size:1.1rem;font-weight:700;margin:0 0 0.5rem 0;color:#0f172a;">30% Primary & Structure</h3>
                        <p style="font-size:0.925rem;color:#475569;line-height:1.6;margin:0;">
                            <strong>#18181B (Stage Black), #0284C7 (Sky Blue)</strong><br>
                            대극장 무대의 묵직한 구조감과 세종의 하늘빛(天)을 현대적 링크/버튼 인터랙션에 적용합니다.
                        </p>
                    </div>
                    <div style="padding:1.25rem;background:#f8fafc;border-radius:12px;border-left:4px solid #ffe800;">
                        <h3 style="font-size:1.1rem;font-weight:700;margin:0 0 0.5rem 0;color:#0f172a;">10% Accent Highlight</h3>
                        <p style="font-size:0.925rem;color:#475569;line-height:1.6;margin:0;">
                            <strong>#FFE800 (Human Yellow)</strong><br>
                            시민과 예술가를 잇는 황금빛 에너지를 예매 상태 및 시선 집중 배지에 한정 적용하여 품격을 높입니다.
                        </p>
                    </div>
                </div>
            </section>

            <!-- 2. 인터랙티브 컬러 팔레트 & 컬러칩 (Anime.js 인터랙션 연동) -->
            <section style="margin-bottom:3.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
                    <div>
                        <h2 style="font-size:1.5rem;font-weight:700;margin:0;color:#0f172a;">2. 시각적 인터랙티브 컬러 팔레트</h2>
                        <p style="color:#64748b;font-size:0.95rem;margin:0.25rem 0 0 0;">컬러칩을 클릭하면 애니메이션과 함께 HEX 코드가 즉시 복사됩니다.</p>
                    </div>
                    <button class="button button--outline" type="button" data-animate-palette style="font-size:0.875rem;">
                        ${icon("sparkles", 18)} 팔레트 모션 재생
                    </button>
                </div>

                <div class="palette-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(170px, 1fr));gap:1rem;">
                    ${PRIMITIVES.map((p, idx) => `
                        <div class="interactive-color-card" data-color="${p.hex}" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;cursor:pointer;transition:transform 0.2s, box-shadow 0.2s;">
                            <div class="color-swatch-box" style="height:84px;background:${p.hex};border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:flex-end;justify-content:flex-end;padding:0.5rem;">
                                <span style="font-size:0.75rem;font-weight:700;background:rgba(255,255,255,0.85);backdrop-filter:blur(4px);padding:0.15rem 0.4rem;border-radius:4px;color:#0f172a;">${p.hex}</span>
                            </div>
                            <div style="padding:0.75rem;">
                                <div style="font-size:0.7rem;font-weight:700;color:#64748b;text-transform:uppercase;">${p.group}</div>
                                <div style="font-size:0.85rem;font-weight:700;color:#0f172a;margin:0.2rem 0;">${p.name}</div>
                                <div style="font-size:0.75rem;color:#475569;line-height:1.4;">${p.desc}</div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </section>

            <!-- 3. Figma Variables: 01. Primitives Collection 표 -->
            <section style="margin-bottom:3.5rem;">
                <div style="margin-bottom:1rem;">
                    <span style="font-size:0.85rem;font-weight:700;color:#0284c7;background:#e0f2fe;padding:0.25rem 0.6rem;border-radius:999px;">Collection 01</span>
                    <h2 style="font-size:1.4rem;font-weight:700;margin:0.5rem 0 0.2rem 0;color:#0f172a;">Figma Variables: 01. Primitives</h2>
                    <p style="color:#64748b;font-size:0.925rem;margin:0;">컬러 원본값을 저장하는 Primitives 변수 명세서입니다.</p>
                </div>
                <div class="info-table-wrap" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow-x:auto;">
                    <table class="info-table" style="width:100%;border-collapse:collapse;text-align:left;font-size:0.9rem;">
                        <thead>
                            <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                                <th style="padding:0.85rem 1rem;">컬러칩</th>
                                <th style="padding:0.85rem 1rem;">Collection</th>
                                <th style="padding:0.85rem 1rem;">변수명 (Variable Name)</th>
                                <th style="padding:0.85rem 1rem;">HEX 코드</th>
                                <th style="padding:0.85rem 1rem;">사용 목적 및 특성</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${PRIMITIVES.map(p => `
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:0.75rem 1rem;"><span style="display:inline-block;width:24px;height:24px;border-radius:6px;background:${p.hex};border:1px solid rgba(0,0,0,0.1);vertical-align:middle;"></span></td>
                                    <td style="padding:0.75rem 1rem;font-weight:600;color:#64748b;">01. Primitives</td>
                                    <td style="padding:0.75rem 1rem;font-family:monospace;font-weight:700;color:#0284c7;">${p.name}</td>
                                    <td style="padding:0.75rem 1rem;font-family:monospace;font-weight:600;">${p.hex}</td>
                                    <td style="padding:0.75rem 1rem;color:#334155;">${p.desc}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- 4. Figma Variables: 02. Semantic Collection 표 -->
            <section style="margin-bottom:3.5rem;">
                <div style="margin-bottom:1rem;">
                    <span style="font-size:0.85rem;font-weight:700;color:#16a34a;background:#dcfce7;padding:0.25rem 0.6rem;border-radius:999px;">Collection 02</span>
                    <h2 style="font-size:1.4rem;font-weight:700;margin:0.5rem 0 0.2rem 0;color:#0f172a;">Figma Variables: 02. Semantic</h2>
                    <p style="color:#64748b;font-size:0.925rem;margin:0;">UI 역할별로 정의되며 Primitives 변수와 Alias로 1:1 연결되는 시맨틱 토큰 명세서입니다.</p>
                </div>
                <div class="info-table-wrap" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow-x:auto;">
                    <table class="info-table" style="width:100%;border-collapse:collapse;text-align:left;font-size:0.9rem;">
                        <thead>
                            <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                                <th style="padding:0.85rem 1rem;">역할 구분</th>
                                <th style="padding:0.85rem 1rem;">변수명 (Variable Name)</th>
                                <th style="padding:0.85rem 1rem;">연결할 Primitive (Alias)</th>
                                <th style="padding:0.85rem 1rem;">실제 HEX</th>
                                <th style="padding:0.85rem 1rem;">UI 사용 목적</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${SEMANTICS.map(s => `
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:0.75rem 1rem;font-weight:600;color:#0f172a;">${s.group}</td>
                                    <td style="padding:0.75rem 1rem;font-family:monospace;font-weight:700;color:#0f172a;">${s.name}</td>
                                    <td style="padding:0.75rem 1rem;"><span style="font-family:monospace;background:#f1f5f9;padding:0.2rem 0.5rem;border-radius:4px;color:#0284c7;font-weight:600;">{${s.primitive}}</span></td>
                                    <td style="padding:0.75rem 1rem;font-family:monospace;color:#64748b;"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${s.hex};margin-right:6px;vertical-align:middle;border:1px solid rgba(0,0,0,0.1);"></span>${s.hex}</td>
                                    <td style="padding:0.75rem 1rem;color:#334155;">${s.desc}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </section>

            <!-- 5. 실제 UI 적용 인터랙티브 쇼케이스 -->
            <section style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:2rem;">
                <h2 style="font-size:1.4rem;font-weight:700;margin:0 0 0.5rem 0;color:#0f172a;">5. 추천 브랜드 컬러 UI 적용 예시</h2>
                <p style="color:#64748b;font-size:0.95rem;margin:0 0 1.5rem 0;">정의된 60/30/10 시맨틱 변수가 실제 버튼, 카드, 배지에 일관되게 적용된 인터페이스입니다.</p>

                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:1.5rem;">
                    <!-- 예시 1: 프로그램 티켓팅 카드 -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:1.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;">
                            <span style="background:#ffe800;color:#0f172a;font-weight:700;font-size:0.75rem;padding:0.25rem 0.6rem;border-radius:4px;">예매중 · 인기</span>
                            <span style="font-size:0.85rem;color:#64748b;">세종대극장</span>
                        </div>
                        <h3 style="font-size:1.25rem;font-weight:700;color:#0f172a;margin:0 0 0.5rem 0;">카르멘 (Carmen)</h3>
                        <p style="font-size:0.9rem;color:#64748b;line-height:1.5;margin:0 0 1.25rem 0;">
                            자유를 노래하는 가장 뜨거운 이름. 비제의 선율과 서울시오페라단이 전하는 강렬한 무대.
                        </p>
                        <div style="display:flex;gap:0.75rem;">
                            <button class="button button--dark" type="button" style="flex:1;">
                                빠른 예매하기 ${icon("arrow", 16)}
                            </button>
                            <button class="button button--outline" type="button" style="padding:0 1rem;">
                                ${icon("heart", 18)}
                            </button>
                        </div>
                    </div>

                    <!-- 예시 2: 상태 피드백 알림 배너 -->
                    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:1.5rem;display:flex;flex-direction:column;justify-content:space-between;">
                        <div>
                            <div style="display:flex;align-items:center;gap:0.5rem;color:#16a34a;font-weight:700;margin-bottom:0.75rem;">
                                ${icon("check", 20)}
                                <span>예매 내역이 정상적으로 보관되었습니다</span>
                            </div>
                            <p style="font-size:0.925rem;color:#334155;line-height:1.6;margin:0;">
                                고유 번호: <strong>SJP-2026-X9B2</strong><br>
                                관람일시: 2026.10.20 (화) 오후 7:30 · 세종대극장
                            </p>
                        </div>
                        <div style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
                            <a href="${href("/account/bookings")}" style="color:#0284c7;font-weight:600;font-size:0.9rem;text-decoration:none;">
                                예매내역 확인하기 →
                            </a>
                            <span style="font-size:0.8rem;color:#94a3b8;">WCAG AAA 검증</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>
    `;
}

export function bindDesignRules(root) {
    if (!root) return;

    // Anime.js를 활용한 팔레트 모션 및 카드 인터랙션
    const cards = root.querySelectorAll(".interactive-color-card");
    cards.forEach((card) => {
        card.addEventListener("click", () => {
            const hex = card.dataset.color;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(hex);
                toast(`컬러 코드 ${hex}가 클립보드에 복사되었습니다.`);
            }
            // Anime.js 펄스 피드백
            getAnime().then((anime) => {
                if (anime) {
                    anime({
                        targets: card,
                        scale: [1, 0.94, 1.03, 1],
                        duration: 350,
                        easing: "easeOutElastic(1, .6)",
                    });
                }
            });
        });
    });

    // 팔레트 모션 재생 버튼
    root.querySelector("[data-animate-palette]")?.addEventListener("click", () => {
        getAnime().then((anime) => {
            if (anime) {
                anime({
                    targets: ".interactive-color-card",
                    translateY: [20, 0],
                    opacity: [0, 1],
                    delay: anime.stagger(40, { start: 50 }),
                    duration: 600,
                    easing: "easeOutCubic",
                });
            }
        });
    });
}
