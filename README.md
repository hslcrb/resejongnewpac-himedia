# 세종문화회관 리뉴얼

공연·전시·교육을 찾고, 방문과 관람을 준비하는 한봄고등학교 리뉴얼 프로젝트입니다. 도메인의 `/`가 이 사이트의 홈입니다. 별도의 버전 선택 화면과 하위 사이트는 없습니다.

## 실행과 배포

Node.js 22 이상에서 저장소 루트 그대로 실행합니다.

```sh
npm ci
npm run dev
# http://127.0.0.1:3000/
npm run build
npm run test:root
npm run check:export
python3 -m http.server 8000 --directory out
```

정적 호스팅의 프로젝트 루트는 이 저장소의 루트, 빌드 명령은 `npm run build`, 게시 디렉터리는 `out`입니다. 산출물을 소스 트리에 복사하지 않습니다. 홈, `/programs/`, `/visit/`, `/account/`, `/admin/`, `/design-rules/`가 같은 앱의 경로입니다.

## 폴더 구조

- `app/`: Next.js 화면과 경로
- `components/`, `styles/`: UI와 디자인 시스템
- `src/`: 카탈로그, 예약, 인증, CMS 로직과 생성 스냅샷
- `public/`: 이미지·아이콘·폰트
- `scripts/`, `tests/`: 빌드·시각 검증과 회귀 테스트
- `supabase/`: 스키마와 시드

환경 변수 없이 빌드하면 저장소에 고정된 공개 카탈로그를 사용합니다. 공개 연결 정보가 설정된 배포는 빌드 시 갱신하며 조회 실패를 숨기지 않습니다. Supabase를 쓰는 배포는 `.env.example`의 공개 연결 값만 클라이언트 빌드에 제공합니다. 로그인 콜백은 해당 운영 도메인의 `/account/callback/`을 허용해야 합니다. 실제 배포의 인증 설정과 서버 키는 저장소에 넣지 않습니다.
