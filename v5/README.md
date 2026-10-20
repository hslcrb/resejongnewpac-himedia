# 세종문화회관 v5

현재 웹 앱은 **Next.js 14 App Router, React 18, TypeScript**로 개발합니다. `app/`이 페이지를 구성하고 `components/`에서 공통 UI를 재사용합니다. 이전 v4의 정적 자료와 설명은 아래 참고 절에 보존합니다.

## 실행

Node.js 22 이상과 npm을 사용합니다. 현재 `package-lock.json`의 Supabase 의존성이 Node.js 22 이상을 요구합니다. 저장소 루트에서 실행합니다.

```bash
cd v5
npm ci
npm run dev -- --hostname 127.0.0.1
```

- 홈: `http://127.0.0.1:3000/v5/`
- 디자인 가이드: `http://127.0.0.1:3000/v5/design-rules/`

`next.config.mjs`의 `basePath`는 `/v5`이며 개발 중에도 이 경로를 사용합니다. 현재 페이지 소스는 `app/`, 공유 컴포넌트는 `components/`, 전역 스타일은 `styles/`, 콘텐츠 데이터는 `src/data/`, 공개 자산은 `public/`에서 관리합니다. 보라빛 퀵메뉴의 통합·입력·검증 절차는 [컴포넌트 문서](docs/components/violet-quick-menu.md)를 참고하세요.

## 정적 빌드

개발 서버를 종료한 뒤 `v5/`에서 실행합니다.

```bash
npm run build
```

`prebuild`는 이전 `.next/`와 `out/`을 비운 뒤 프로덕션 빌드를 시작합니다. `output: "export"` 설정으로 `out/`을 만들고, `postbuild`의 `scripts/sync-out.js`가 내보낸 파일을 `v5/`에도 복사합니다. 내보낸 결과에 개발용 번들이 있으면 복사를 중단합니다. 이후 저장소 루트에서 정적 서버를 실행하면 `/v5/`로 빌드 결과를 확인할 수 있습니다.

## 보존된 v4 참고 자료

아래는 이전 v4의 화면·구조·검사 안내입니다. 당시 v4는 기존 138개 경로에 방문 계획과 대관 공간 비교를 더한 정적 앱이었으며, 다음 해시 경로와 테스트 명령은 그 버전을 대상으로 합니다.

### 주요 화면

- 홈: 히어로, 빠른 예매, 프로그램 발견, 방문 안내, 소식과 참여, 기관 정체성의 6개 영역.
- 빠른 예매: 날짜·프로그램·회차·인원을 선택해 공연/전시 예매 또는 교육 신청으로 전달. 작은 화면에는 기본 날짜 입력 사용.
- 방문 계획 `#/visit/plan`: 일정과 교통·접근성에 맞춘 준비 순서, 주소 공유, 브라우저 저장.
- 공간 비교 `#/rental/compare`: 최대 세 공간의 규모·장비 비교, 일정 및 대관 신청 연결.
- 소개 `#/about`: 큰 문장과 세종의 실제 사진, 공간 선택, 예술단·역사·천지인·참여로 이어지는 구성.
- 통합검색 `#/search`: 제목·콘텐츠·동의어 검색과 분류. 굿즈·계정·기존 신청 기능 보존.

### 자료와 구조

`src/app.js`가 hash 경로를 분배하며 각 기능은 `src/features/`에 있습니다. 새 스타일은 `experience.css`, `home-v4.css`, `story.css`, `journeys.css`가 담당합니다. 기존 모션 수명 관리와 기본 입력을 유지하고 모션 감소 설정을 지원합니다. 방문자 데이터는 `sejong-v4:` 이름으로 분리합니다.

- [전체 복사 증거](docs/sources/copy-verification.json)
- [참고 사이트 관찰과 한계](docs/sources/reference-motion-evidence.md)
- [검증 기록](docs/verification-2026-10-16.md)
- 원본 Figma/PPTX 분석: 저장소 `.local-reports/analysis-v4/`
- 보존된 중첩 v2/v3·스킬 아카이브는 원본 복사본입니다. 현재 실행 파일은 이 디렉터리의 `index.html`과 `src/`입니다.

### 검사

저장소 루트에서 최종 Node 검사:

```powershell
node --test tests/*.test.mjs v2/tests/*.test.mjs v3/tests/*.test.mjs v4/tests/*.test.mjs
```

v4 브라우저 검사는 Playwright와 Chrome이 있는 환경에서 실행합니다. `SEJONG_TEST_URL`은 저장소 루트 정적 서버의 v4 주소(예: `http://127.0.0.1:8000/v4/`), `CHROMIUM_PATH`는 브라우저 실행 파일입니다. 앱 자체에는 이 도구들이 필요하지 않습니다.

```powershell
node v4/tests/site-browser.cjs
node v4/tests/home-v4.cjs
node v4/tests/story-browser.cjs
$env:SEJONG_JOURNEYS_BROWSER='1'
node --test v4/tests/journeys.test.mjs
```

실제 결제·좌석 확보·기관 접수는 없는 비공식 체험입니다. 프로그램 날짜·회차·요금은 시연 자료입니다. 예매·신청·저장 내역은 현재 브라우저에 보관합니다.
