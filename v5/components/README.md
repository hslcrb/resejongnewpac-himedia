# v5 reusable components

## VioletQuickMenu

히어로를 보고 있는 동안 화면 아래에 보라색 빛과 작은 원이 나타납니다. 원을 열면 여섯 개의 바로가기를 돌려 고를 수 있습니다. 메인 페이지는 이 컴포넌트를 사용하며, 열려 있는 동안 히어로의 자동 재생을 일시 정지합니다.

- Public export: `VioletQuickMenu` from `v5/components/index.ts`
- Implementation: `VioletQuickMenu.tsx`
- Scoped presentation: `VioletQuickMenu.module.css`
- Decorative canvas: `VioletFur.tsx`
- Reference: [사용자의 Figma 시안](https://www.figma.com/design/EufUvqqxgphtoLRX6bcdV6/Untitled?node-id=1-6)
- Verification: [25개 동작 검증 결과 및 PC·모바일 화면](../../docs/v5-violet-quick-menu/README.md)

```tsx
"use client";

import { useState } from "react";
import { VioletQuickMenu } from "../components";

export default function Hero() {
    const [quickMenuOpen, setQuickMenuOpen] = useState(false);
    // Pause this host's carousel timer while quickMenuOpen is true.
    return <>
        <section id="featured-season" aria-label="주요 프로그램">
            {/* Existing hero content */}
        </section>
        <VioletQuickMenu
            heroId="featured-season"
            onOpenChange={setQuickMenuOpen}
        />
    </>;
}
```

### Props

| Prop | Default | Purpose |
| --- | --- | --- |
| `heroId` | `"featured-season"` | 표시 범위를 결정할 기존 히어로 요소의 ID. 히어로가 화면에서 사라지면 메뉴와 장식을 숨깁니다. |
| `items` | `SEJONG_QUICK_MENU_ITEMS` | `id`, `label`, `href`, `icon`을 가진 여섯 항목의 readonly tuple. Next.js 경로에는 `/v5`를 직접 붙이지 않습니다. |
| `onOpenChange` | 없음 | 메뉴가 열리거나 닫힐 때 호출합니다. 부모의 자동 재생 등을 제어할 때 사용합니다. |

컴포넌트를 사용하는 페이지에는 `heroId`에 대응하는 요소가 있어야 합니다. 같은 페이지의 `#anchor` 항목은 실제 섹션 ID를 가리켜야 합니다. 기본 빠른 예매 항목은 `#quick-booking` 섹션으로 이동하고 그 제목으로 키보드 포커스를 옮깁니다.

### Registered destinations

| Menu | `href` |
| --- | --- |
| 빠른 예매 | `#quick-booking` |
| 공연·전시 | `/programs` |
| 오시는 길 | `/visit/directions` |
| 단체 관람 | `/visit/group` |
| 대관 안내 | `/rental` |
| 나의 예매 | `/account` |

### Interaction contract

- **Mouse:** 원 위에 잠깐 머물면 펼쳐집니다. 원판이나 메뉴 글자를 잡아 양방향으로 돌릴 수 있습니다. 손을 놓으면 관성을 짧게 반영해 60도 간격으로 정렬합니다. 드래그 직후 발생하는 클릭은 이동으로 처리하지 않습니다.
- **Touch:** 원을 탭해서 열고, 원판 안에서 회전합니다. 원 밖에서는 일반 페이지 스크롤을 유지합니다. 각 메뉴 또는 중앙의 선택 항목을 탭하면 이동합니다.
- **Keyboard:** 버튼에서 Enter/Space로 열 수 있습니다. Tab으로 실제 링크를 이동하고, 방향키·Home·End로 메뉴를 고를 수 있습니다. Escape로 닫으면 버튼으로 포커스가 돌아옵니다. 비모달 탐색이므로 포커스를 가두지 않습니다.
- **Motion:** CSS로 색층을 움직이고 Canvas로 털의 질감을 표현합니다. 장식 Canvas는 초당 최대 30회 그리며 화면 밖, 닫힌 메뉴, 숨겨진 탭에서는 반복 그리기를 중단합니다. `prefers-reduced-motion: reduce`일 때 자동 모션과 관성을 끕니다. 사용자가 직접 원을 돌리거나 메뉴를 누르는 기능은 유지합니다.
- **Responsive:** 펼친 원의 크기는 PC에서 최대 370px, 모바일에서 최대 332px이며, 작은 화면의 너비·높이와 safe area에 맞춰 줄어듭니다. 320px 너비 및 모바일 가로 화면도 검증 대상입니다.
- **Appearance:** `--violet-*` 값은 CSS 모듈의 컴포넌트 범위에서만 사용합니다. 기존 전역 브랜드 색상과 서체를 변경하지 않습니다. 외부 애니메이션 라이브러리, WebGL, 원격 이미지 요청이 필요하지 않습니다.

### Development and verification

Repository root:

```bash
npm --prefix v5 ci
npm --prefix v5 run dev -- --hostname 127.0.0.1 --port 3000
```

The page is `http://127.0.0.1:3000/v5/`. Run the focused browser script in an environment with `playwright/test` installed:

```bash
SEJONG_TEST_URL=http://127.0.0.1:3000/v5/ \
CHROMIUM_PATH=/path/to/chromium \
node v5/tests/violet-quick-menu.cjs
```

If Playwright is installed in a separate tooling directory, point `NODE_PATH` to its `node_modules`. `SEJONG_VIOLET_REPORT_DIR` can place the JSON report and screenshots outside the repository; by default the existing ignored `.local-reports` evidence directory is used. The script checks actual mouse/touch navigation, drag wraparound, no accidental navigation, keyboard focus, viewport bounds, reduced motion and browser errors.

```bash
cd v5
node node_modules/typescript/bin/tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Stop the dev server before building, because both commands write to `.next`. The existing `postbuild` copies the static export into the tracked `v5/` hosting directory. Commit that generated output together with the source after reviewing the diff. Test legacy versions separately; their copied `home-v4.cjs` script targets the older app and is not this component's test.
