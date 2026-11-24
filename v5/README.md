# 세종문화회관 리뉴얼 v5

`resejongnewpac-himedia`의 실제 애플리케이션입니다. Next.js 14.2, React 18, TypeScript를 사용하고 인증·콘텐츠·회원 기록은 Supabase에 연결합니다.

상세한 소개와 실행 방법은 [저장소 README](../README.md)를 참고합니다.

## 명령

```bash
npm ci
npm run dev      # http://127.0.0.1:3000/v5/
npm run build    # 정적 산출물 out/ 생성 후 v5 루트에 미러링
```

## 빌드 구성

- `prebuild`: `scripts/prepare-design-system.ts --build`가 디자인 토큰과 컴포넌트 레지스트리를 만들고, 공개 카탈로그 스냅샷을 읽습니다.
- `build`: `next build`가 `output: 'export'`로 정적 HTML을 내보냅니다. 기본 경로는 `/v5`입니다.
- `postbuild`: `scripts/sync-out.ts`가 `out/`을 라우트 경로 구조로 복사합니다.

## 환경

`v5/.env.example`을 참고해 `.env.local`을 만듭니다. 공개 카탈로그에는 Supabase 공개(publishable) 키만 사용하며, 서비스 역할 키는 이 저장소에 두지 않습니다.

## 문서

- 디자인 시스템: `/v5/design-rules/`
- CMS 스튜디오: `/v5/admin/`
- 스키마: `supabase/migrations/`
