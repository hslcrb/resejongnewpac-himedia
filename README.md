# 세종문화회관 리뉴얼 (resejongnewpac-himedia)

세종문화회관의 공연·전시·교육 정보를 찾고, 관람을 준비하고, 나의 관람 기록을 남기는 웹사이트입니다.
한봄고등학교 프로젝트로 진행한 리뉴얼 사이트의 정리본이며, 실제 애플리케이션은 `v5/`에 있습니다.

- 프레임워크: Next.js 14.2 (App Router, 정적 export), React 18, TypeScript
- 데이터·인증: Supabase (공개 카탈로그 조회, 회원 인증·기록, 예약·신청)
- 스타일: 자체 디자인 시스템(토큰·컴포넌트 레지스트리)과 정적 감사 스크립트
- 정적 배포: `npm run build`가 만드는 `out/` 디렉터리

## 폴더 구조

```text
v5/
  app/            화면 라우트(홈, 프로그램, 방문 안내, 예약, 계정, 디자인 가이드, CMS 스튜디오)
  components/     공통 UI와 화면 컴포넌트
  src/            카탈로그·예약·계정·CMS 도메인 로직과 디자인 토큰
  styles/         전역 스타일과 디자인 토큰
  public/         이미지·아이콘·폰트 등 정적 자산
  scripts/        디자인 시스템 생성·감사, 카탈로그 스냅샷, 빌드 후 미러 동기화
  supabase/       스키마 마이그레이션과 카탈로그 시드
  tests/          단위·브라우저 검사
  types/          공용 타입
```

## 실행

Node.js 22 이상이 필요합니다.

```bash
cd v5
npm ci
npm run dev
```

개발 서버의 홈은 http://127.0.0.1:3000/v5/ 입니다. 기본 경로가 `/v5`이므로 주소에 `/v5/`를 붙입니다.

## 빌드

```bash
cd v5
npm run build
```

빌드 단계는 다음과 같습니다.

1. `prebuild`: 디자인 토큰·컴포넌트 레지스트리를 생성하고 공개 카탈로그 스냅샷을 읽어 `src/generated/catalog-snapshot.json`을 갱신합니다.
2. `next build`: 모든 경로를 정적 HTML로 내보냅니다(`out/`).
3. `postbuild`: `scripts/sync-out.ts`가 `out/`을 `v5/` 루트 경로 구조로 복사해, 정적 파일 서버가 저장소 루트를 그대로 서빙해도 열리도록 맞춥니다.

빌드 후 결과를 확인하려면 저장소 루트에서 정적 서버를 실행합니다.

```bash
python3 -m http.server 8000
# http://127.0.0.1:8000/v5/
```

## 환경 변수

`v5/.env.example`을 참고해 `v5/.env.local`을 만듭니다. 공개 카탈로그 조회에는 Supabase 프로젝트 URL과 공개(publishable) 키만 사용합니다. 서비스 역할 키와 같은 비밀 값은 이 저장소에 두지 않습니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
```

## 주요 화면

| 경로 | 내용 |
| --- | --- |
| `/v5/` | 홈. 진입 인트로, 공연 히어로, 프로그램·이용 안내 |
| `/v5/programs/` | 프로그램 목록과 상세(공연·전시·교육) |
| `/v5/visit/` | 방문 안내, 공간·교통·접근성 |
| `/v5/booking/experience/` | 관람 예약 체험 흐름 |
| `/v5/account/` | 로그인, 관심 공연, 관람노트 |
| `/v5/design-rules/` | 디자인 시스템 가이드 |
| `/v5/admin/` | CMS 스튜디오(브라우저 초안 편집, 관리자 로그인 시 DB 저장·발행) |

## CMS 스튜디오

`/v5/admin/`은 페이지를 피그마처럼 편집하는 스튜디오입니다. 브라우저 초안 편집은 누구나 할 수 있고, DB 저장과 발행은 관리자 계정으로 로그인해야 동작합니다. 편집 결과는 Supabase의 CMS 스키마(`v5/supabase/migrations/`)를 사용합니다.

## 검사

```bash
cd v5
npm run check:system           # 디자인 시스템 계약 검사
npm run test:cms:visual        # CMS 시각 문서·라우트 인증 단위 검사
node --test tests/*.test.ts    # 단위 검사
```

브라우저 검사(`tests/*-browser.ts`)는 Chromium이 필요하며, 결과 파일은 `.local-reports/`에 저장됩니다.

## 배포

`out/`은 완전한 정적 산출물이므로 GitHub Pages, Cloudflare Pages, S3 같은 정적 호스팅에 그대로 올릴 수 있습니다. `/v5` 하위 경로를 기준으로 만들어지므로, 사이트를 도메인 루트에 올릴 때는 `next.config.mjs`의 `basePath`를 배포 경로에 맞게 조정해야 합니다.
