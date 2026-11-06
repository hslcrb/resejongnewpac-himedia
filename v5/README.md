# 세종문화회관 v5 / Sejong Center v5

현재 개발 대상은 이 폴더입니다. **Next.js 14.2.35 · React 18 · TypeScript · Node.js 24.x**를 사용하며, 인증·콘텐츠·회원 기록은 Supabase에 연결합니다.

This is the active application. It uses Next.js 14.2.35, React 18, TypeScript and Node.js 24.x, with Supabase for authentication and data.

**사람과 모든 모델은 작업 브랜치를 반드시 사용합니다.** 동시 작업은 별도 worktree/clone으로 분리하고, 검토한 브랜치만 main에 `--no-ff`로 통합합니다. / Task branches are mandatory; integrate reviewed work with `--no-ff`.

- [프로젝트 설명과 실행 / Project overview](../README.md)
- [문서 지도](../docs/README.md) · [시스템 구조](../docs/architecture/overview.md) · [전체 ERD](../docs/architecture/data-model.md)
- [Cloudflare 배포 절차](../docs/operations/deployment-runbook.md) · [운영·Vercel 삭제 이력](../docs/operations/2026-11-04-cloudflare-transition-history.md)
- [완료 보고 전 Cloudflare MCP 빌드·배포 확인](docs/cloudflare-deployment-verification.md)
- [main 전용·최신 커밋 우선 자동 배포 정책](docs/cloudflare-deployment-policy.md)
- [사람 개발자의 실행·커밋·검증 절차 / Human contributor workflow](../CONTRIBUTING.md)
- [에이전트의 v5 작업 규칙 / Agent instructions](CONTRIBUTING.md)
- [디자인 시스템 / Design system](https://renewsejongpac.rhee.life/v5/design-rules/)
- [실제 컴포넌트 연결표 / Component connections](docs/component-connections.md)
- [v5 첫 진입 SVG 인트로·네트워크 선연결·검증 안내 / Entry intro](docs/home-entry-intro.md)

## 실행 / Run

저장소 루트에서 아래 명령을 실행하고 `.env.local`은 [공통 안내](../README.md#내-컴퓨터에서-실행--run-locally)에 따라 작성합니다. macOS·Linux에서는 `npm.cmd` 대신 `npm`을 사용합니다.

Run from the repository root. Configure `.env.local` using the main guide; use `npm` on macOS or Linux.

```powershell
cd v5
npm.cmd ci
npm.cmd run dev -- --hostname 127.0.0.1
```

홈은 <http://127.0.0.1:3000/v5/>입니다. 주소에 `/v5/`가 필요합니다. / Open the app with the `/v5/` prefix.

## 빌드 / Build

개발 서버를 종료한 뒤 이 폴더에서 실행합니다. / Stop the development server first.

```powershell
npm.cmd run build
```

빌드는 공개 DB 스냅샷을 읽고 계약을 검사한 뒤 `out/`을 생성합니다. `scripts/sync-out.ts`가 결과를 이 폴더 루트에도 미러링합니다. 새 정적 산출물은 `.gitignore`로 제외하고 소스·문서만 선택해 커밋합니다. 기존에 커밋된 HTML·번들은 삭제하거나 추적 해제하지 않습니다.

The build exports to `out/` and mirrors it here. Ignore new exports, commit intended source changes, and preserve previously tracked snapshots. Ignore rules do not hide modifications to tracked files.

## 디자인 시스템 일치 검사 / Design system parity

`npm.cmd run check:system`은 등록·사용 연결·토큰·텍스트 속성을 검사합니다.
브라우저 검사는 선택사항입니다. 필요한 경우 정적 서버를 실행한 뒤 `npm.cmd run test:system:parity -- http://127.0.0.1:8000/v5/`로
전체 내보낸 페이지와 디자인 가이드의 버튼·입력·배지·표면과 복합 컴포넌트의 텍스트 슬롯을 실제 브라우저에서 검사합니다.
기본 너비는 320·390·768·1024·1440px입니다. 페이지는 배치를 담당하며, 같은 속성과 상태의
공통 컴포넌트의 서체·색·곡률·경계·내부 여백을 따로 덮어쓰지 않습니다.

The static audit checks registrations and tokens. The browser parity audit compares rendered shared
controls and surfaces across the export and guide at five viewport widths; page layout stays independent.

브라우저 검사 실행과 결과 캡처는 필수 커밋 조건이 아닙니다. [선택 검사 절차](docs/optional-browser-checks.md)를 참고합니다.

실서비스는 Cloudflare Pages다. `main`의 정식 빌드 후 `scripts/cloudflare-stage.ts`가 `v5/.cloudflare-output`을 준비한다. 이전 Vercel 프로젝트의 삭제는 확인 완료됐으며 DB·인증은 Supabase를 유지한다. 문서만 변경할 때는 [문서 자산 검사](../docs/readme/ASSETS.md)를 수행한다.

현재 문서에서 구버전의 hash 경로·브라우저 저장 설명을 v5 지침으로 사용하지 않습니다. 이전 버전은 [v4 README](../v4/README.md)에 보존합니다.

Legacy hash routes and browser-storage instructions do not describe v5; historical documentation remains with v4.
