import { writeFile } from "node:fs/promises";
import { PAGES } from "../src/data/catalog.ts";
import { OFFICIAL_SERVICES, OFFICIAL_REVIEWED } from "../src/data/official.ts";
import { OFFICIAL_MENU_MAP } from "../src/data/official-navigation.ts";

// [공식 메뉴 대응 기록 / Reproducible official menu parity record]
const lines = [
    "# 세종문화회관 공식 메뉴 대응 기록",
    "",
    `확인일: ${OFFICIAL_REVIEWED} (Asia/Seoul). 기준: https://www.sejongpac.or.kr/portal/main/main.do 의 공개 전체 메뉴, 하단 메뉴와 주요 서비스.`,
    "",
    `공식 메뉴·서비스 ${OFFICIAL_MENU_MAP.length}개를 v5 경로에 연결했다. 새 공식 안내 페이지 ${OFFICIAL_SERVICES.length}개와 검색 가능한 /services 이용 길잡이를 추가했다. 등록 경로는 총 ${PAGES.length}개다.`,
    "",
    "## 구현 범위",
    "",
    "- 기존 Next catch-all이 정보·신청 화면을 공통 문구로만 출력하던 문제를 수정했다. 보존된 TypeScript 렌더러의 전체 본문, 필터, 단계별 폼, 브라우저 저장 동작을 React 경로에 연결했다.",
    "- /programs/[id]가 공연 상세 외의 교육·전시·시즌·투어·예매안내 경로를 가로막던 문제를 수정했다. 등록된 한 단계 경로를 생성하고 올바른 안내 화면을 연다.",
    "- 누락됐던 /apply/education 정적 경로를 등록했다. /account/bookings, /account/applications 등 계정 하위 경로도 정적 내보내기에 포함한다.",
    "- 새 안내는 공식 원문을 요약하고 정확한 원문 링크를 제공한다. 데이티켓 연령 확인, 강의실 비교, 서비스 검색·분야 필터, 공연장별 좌석 안내와 레퍼토리 아코디언은 이 사이트에서 동작한다.",
    "- 실제 예매·접수·회원 인증·대관 승인·기부·신고·구독 전송은 해당 공식 서비스로 연결한다. 공식 서버와 연동하지 않은 동작을 실제 접수로 표시하지 않는다.",
    "- 기존 예매·신청·상품 주문 데이터는 시연용이며 실시간 공식 일정·잔여석·가격을 대체하지 않는다. 신규 티켓오픈 목록은 확인일 기준 자료이고 실시간 피드가 아니다.",
    "- 기관 규정·신고·개인정보 문서의 현행 원문은 공식 링크로 확인한다. 신고자의 민감정보를 신규 안내 화면에서 수집하지 않는다.",
    "",
    "## 메뉴별 대응표",
    "",
    "| 공식 항목 | v5 경로 | 구현 방식 | 확인한 공식 URL |",
    "| --- | --- | --- | --- |",
    ...OFFICIAL_MENU_MAP.map((item) => `| ${item.title} | \`${item.path}\` | ${item.mode === "local-with-official-source" ? "기존 상세·체험 화면 복원 + 공식 원문 연결" : "새 안내·상호작용 + 공식 서비스 연결"} | ${item.source} |`),
    "",
    "## 검증",
    "",
    "- `node --test tests/official-services.test.mjs`: 공식 메뉴 경로·출처, 신규 렌더러, 검색 조합·출력 이스케이프, 데이티켓 경계값 검증.",
    "- `node --test tests/routes.test.mjs`: 원본 경로 보존, 경로 중복, 로컬 자산, 날짜, 등록된 화면 렌더링 검증. 기존 검증에서 누락된 디자인 시스템 렌더러를 추가했다.",
    "- `node tests/official-parity.ts <base-url> --all`: 배포 산출물의 전체 경로 HTTP 응답, 실제 본문, 페이지 오류, 보이는 이미지, 내부 링크 및 가로 넘침 검사.",
    "- 같은 브라우저 검사에서 모바일 서비스 검색·초기화, 데이티켓 확인, 강의실 선택, 예매 프리필·좌석·할인·완료·저장 내역을 확인한다.",
    "- `--mobile`은 390px 화면으로 전체 경로를 검사한다. `--width=숫자`로 별도 화면 너비를 지정할 수 있다.",
    "- 실제 실행 결과는 `docs/verification/official-parity-{all|smoke}-{desktop|mobile}.json`에 기록한다. 스크립트가 존재한다는 사실만으로 전체 검증 통과를 뜻하지 않는다.",
    "",
];
await writeFile(new URL("../docs/official-parity-2026-10-21.md", import.meta.url), lines.join("\n"));
console.log(`Recorded ${OFFICIAL_MENU_MAP.length} official entries, ${OFFICIAL_SERVICES.length} new guides and ${PAGES.length} total routes.`);
