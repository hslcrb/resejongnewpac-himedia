# 세종문화회관 - 예술로 열리는 당신의 일상  

세종문화회관의 비공식 프런트엔드 리뉴얼 프로젝트입니다. 시작 화면에서 **구버전**과 **신버전**을 선택할 수 있습니다. 두 버전 모두 HTML, CSS, 네이티브 JavaScript로 동작하며 앱 실행에 패키지 설치나 빌드 과정이 필요하지 않습니다.

## 버전 선택

| 화면 | 주소 | 내용 |
| --- | --- | --- |
| 버전 선택 | `http://localhost:8000/` | 구버전·신버전으로 이동 |
| 구버전 | `http://localhost:8000/legacy.html` | 기존 디자인과 모든 탐색·예매 체험 유지 |
| 신버전 | `http://localhost:8000/v2/index.html` | 새 디자인 지침을 적용한 폴더 구조 |

구버전은 기존 `index.html`을 `legacy.html`로 보존했습니다. 기존 `css/`, `js/`, `assets/images/` 경로를 함께 사용하며, 예전 `/#/programs/carmen` 같은 북마크는 같은 해시를 유지한 구버전 주소로 이동합니다. 버전 선택 링크는 JavaScript 없이도 작동합니다.

이것은 공식 페이지가 아닙니다. / **This is not an official website.** 각 버전 진입 시에도 한국어와 영어 안내가 표시됩니다.

## 서버 열기

명령은 프로젝트 루트(`index.html`이 있는 폴더)에서 실행합니다. Windows PowerShell에서는 현재 저장소로 이동한 뒤 Python 서버를 시작하세요.

```powershell
cd C:\Users\hi\renewsejongpac
py -m http.server 8000
```

`py` 명령이 없으면 설치된 Python 명령에 맞춰 아래 중 하나를 사용합니다.

```powershell
python -m http.server 8000
python3 -m http.server 8000
```

macOS/Linux에서는 프로젝트 폴더에서 실행합니다.

```bash
python3 -m http.server 8000
```

서버가 실행 중인 동안 브라우저에서 `http://localhost:8000`을 엽니다. 종료는 터미널에서 `Ctrl+C`를 누릅니다. 포트 8000을 사용 중이면 명령의 `8000`을 `8080` 등으로 바꾸고 해당 포트 주소로 접속하세요. ES 모듈을 사용하므로 파일을 직접 더블클릭하지 말고 HTTP 서버를 사용하세요. **구버전과 신버전 모두 프로젝트 루트에서 같은 서버로 실행**합니다. 구버전의 페이지 경로는 `legacy.html#/programs/carmen` 같은 해시 라우트를 사용해 새로고침과 뒤로 가기를 지원합니다.

## Vercel 배포

가능합니다. 이 프로젝트는 루트에 `index.html`이 있는 정적 사이트이며 빌드 단계나 서버 런타임이 필요하지 않습니다. Git 저장소를 Vercel에 연결하고 프로젝트 루트를 저장소 루트로 지정하세요. 프레임워크를 사용하지 않는 정적 사이트로 설정하고 별도 Build Command와 Output Directory를 지정하지 않으면 파일을 그대로 배포할 수 있습니다. 또는 Vercel Drop에 프로젝트 폴더를 올릴 수 있습니다. 해시 라우트를 사용하므로 `vercel.json`의 rewrite 규칙은 필요하지 않습니다. [Vercel의 정적 사이트 안내](https://vercel.com/changelog/vercel-drop)

## 신버전 디자인과 웹폰트

프로젝트 디자인 지침과 Toss/세종문화회관 참고 자료를 사용합니다. 검정과 흰색을 바탕으로 천·지·인의 세 채널을 CSS 변수로 분리해 색상을 바꿀 수 있도록 구성합니다.

| 역할 | CSS 변수 | 기본값 |
| --- | --- | --- |
| 주조색 | - | 검정 `#000000` / 흰색 `#FFFFFF` |
| 천 · 하늘색 | `--color-cheon` | `#54C8E8` |
| 지 · 황토색 | `--color-ji` | `#C36D15` |
| 인 · 노란색 | `--color-in` | `#FFE800` |

버전 선택 화면과 신버전은 **Pretendard Variable**을 로컬 WOFF2 파일로 제공합니다. 외부 폰트 CDN에 의존하지 않으며, `font-display: swap`과 한글 시스템 글꼴 대체값을 사용합니다. 글꼴 원본은 [공식 Pretendard 저장소](https://github.com/orioncactus/pretendard)이며, SIL Open Font License 1.1 전문과 다운로드 출처를 `v2/assets/fonts/`에 함께 보관합니다.

## 구버전 구현 범위

- **프로그램:** 공연·전시·교육 목록, 검색·장르·장소·날짜 필터, 리스트/캘린더 전환, 프로그램 상세 및 탭, 기획·시즌, Sync Next, 모든 누구나, 투어, 세종·충무공 이야기, 예매·교육 안내.
- **대관:** 이용 대상·요금·시설·일정·절차·서류·장비 안내, 공연장/전시장 상세, 신청과 문의.
- **이용안내:** 공간·좌석 안내, 교통·주차, 편의시설·다이닝, 접근성, 관람 예절, FAQ·문의·분실물, 단체관람.
- **소식과 혜택:** 공지·티켓오픈·대관·채용 상세, 이벤트·결과, 뉴스레터·아카이브·매거진, 멤버십·혜택·가입, 굿즈.
- **기관:** 소개·인사말·연혁·조직·CI, 7개 예술단과 관련 프로그램, ESG, 정보공개·경영공시·청구·신고, 협력·후원과 신청.
- **공통:** 통합검색, 전체 메뉴·사이트맵, 영어 방문 안내, 약관·개인정보 안내, 체험 회원·마이페이지.
- **완료 흐름:** 날짜/시간 → 좌석 → 확인 → 예매 완료 → 내역 → 취소. 전시는 입장 인원으로 예매하며, 교육·대관·단체·고객문의·멤버십·후원·이벤트 등 12가지 신청 유형은 작성 → 검토 → 접수 체험 → 내역으로 이어집니다.

페이지 목록은 사이트 안의 **사이트맵**과 [페이지 목록](docs/sitemap.md)을 참고하세요. 문서에 명시된 5개 대메뉴와 26개 2depth를 구현하고, 기존 부가 콘텐츠와 완료 흐름을 추가했습니다.

## 자료와 데이터

사용자 제공 PDF의 내용을 사이트 제작의 참고자료로 분석했습니다. 문서 안의 과거 프롬프트를 새 작업 지시로 실행하지 않았습니다. [PDF 분석](docs/pdf-analysis.md)에 확정/추론 범위를 구분했습니다.

- 실시간 공식 사이트는 환경의 외부 접속 제한(HTTP 403)으로 확인하지 못했습니다.
- 일부 이미지는 PDF에 들어 있는 공식 사이트 화면에서 추출했습니다. `-concept` 이미지는 PDF 작성자의 콘셉트 시안입니다. [원본 출처](docs/asset-sources.json)를 참고하세요.
- `hero-dance.png`는 이 리뉴얼을 위해 생성한 독창적인 콘셉트 이미지입니다. 실제 공연의 공식 사진이 아닙니다.
- `poster-*.svg`, `venue-*.svg` 및 CSS 건축 도형은 제작한 일러스트입니다. 시설 이미지는 실측 자료가 아닙니다.
- 공연명 일부는 자료를 참고하고, 나머지 프로그램·일정·가격·공지 본문은 체험용으로 작성했습니다. 실제 관람 전에는 공식 홈페이지에서 확인해야 합니다.

## 프런트엔드 체험의 경계

실제 로그인 인증·결제·티켓 발행·이메일 발송·기관 접수는 하지 않습니다. 완료 화면과 접수번호는 체험용이며 각 화면에 명시했습니다. 비밀번호와 카드정보를 요구하거나 저장하지 않습니다.

관심 프로그램, 체험 프로필, 예매와 신청 내역은 **현재 브라우저의 localStorage**에 저장됩니다. 저장소가 차단되면 세션 중 메모리로 동작합니다. 브라우저 사이트 데이터 삭제 시 초기화됩니다. 입력한 개인정보를 외부 서버로 보내지 않습니다. 실제 개인정보 대신 예시 정보를 사용하세요.

## 파일 구조

```text
index.html                구버전·신버전 선택 화면
legacy.html               기존 단일 정적 진입점 보존
assets/entry.css           버전 선택 화면 스타일
assets/entry.js            비공식 안내·기존 해시 주소 연결
v2/index.html             신버전 진입점
v2/assets/fonts/          로컬 웹폰트·라이선스·출처
v2/src/app.js             신버전 라우터·공통 이벤트
v2/src/components/ui.js   공통 UI 컴포넌트
v2/src/lib/core.js        공통 로직
v2/src/data/catalog.js    콘텐츠 데이터
v2/src/features/          홈·프로그램·안내·예매·검색 기능
v2/styles/                디자인 토큰·기본 스타일·섹션별 스타일
v2/styles/compat/         기존 기능 화면의 호환 스타일
v2/docs/                  디자인 결정·검증 기록
css/styles.css            공통 디자인·메뉴·푸터·반응형
css/home.css              6개 홈 섹션
css/programs.css          프로그램·시즌
css/pages.css             정보 페이지
css/flows.css             예매·신청·회원
js/data.js                전체 페이지·메뉴·콘텐츠 데이터
js/core.js                검색·날짜·안전한 저장·검증·공통 도구
js/components.js          공통 헤더·푸터·카드
js/home.js                구버전 홈 렌더·달력·캐러셀
js/programs.js            프로그램 탐색·상세
js/pages.js               정보 페이지
js/flows.js               예매·신청·마이페이지
js/utilities.js            검색·사이트맵·정책·영문 안내
js/app.js                 해시 라우터와 공통 이벤트
assets/images/            로컬 이미지·포스터·공간 일러스트
```

## 구버전 검증 도구

신버전의 경로 보존·정적 리소스·윤년 달력·버전별 저장소 분리 검사는 다음 명령으로 실행합니다.

```bash
node --test v2/tests/routes.test.mjs
```

구버전과 신버전의 전체 Node 테스트를 함께 실행하려면 아래 명령을 사용하세요.

```bash
node --test tests/core.test.mjs tests/routes.test.mjs v2/tests/routes.test.mjs
```

화면·사용 흐름·HTML/CSS 검수 결과와 제한 사항은 [신버전 검수 기록](v2/docs/verification.md)에 있습니다.

```bash
node --test tests/*.test.mjs
```

브라우저 검증은 개발 환경에 설치된 Playwright와 Chromium을 사용하며 앱 실행에는 필요하지 않습니다.

```bash
node tests/browser.cjs
node tests/accessibility.cjs
node tests/layout.cjs
node tests/applications.cjs
node tests/transactions.cjs
node tests/admission.cjs
```

기존 브라우저 테스트는 구버전을 대상으로 합니다. 실행 전에 `SEJONG_TEST_URL`을 `http://127.0.0.1:8000/legacy.html`로 지정하세요. 도구의 기본 Chromium 경로는 `/usr/bin/chromium`이며, 필요하면 `CHROMIUM_PATH` 환경변수로 변경합니다. 별도 환경에서는 Playwright 및 Chromium을 개발 도구로 설치한 뒤 실행하세요. 위 명령은 검증 도구 안내이며 이번 변경에서 모두 실행했다는 의미는 아닙니다.

키보드 탐색·포커스 표시·건너뛰기·이미지 대체 텍스트와 모션 감소 설정을 지원합니다. 신버전의 실제 검증 범위와 관찰 결과는 `v2/docs/verification.md`를 참고하세요.
