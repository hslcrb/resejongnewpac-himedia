import type { PageMeta } from "../../types/sejong.ts";

// [공식 메뉴의 출처와 이용 경로 / Source-backed public service routes]
// 확인한 안내를 요약하고, 실시간 조회·신청은 해당 공식 서비스로 연결합니다.
// Summaries are dated; live availability and submissions remain with the official service.
export const OFFICIAL_REVIEWED = "2026-10-21";
const base = "https://www.sejongpac.or.kr";
const content = (menu: string) => `${base}/portal/main/contents.do?menuNo=${menu}`;
export type OfficialSection = { title: string; text?: string; items?: string[] };
export type OfficialService = PageMeta & {
    source: string;
    collection: string;
    action: string;
    facts?: [string, string][];
    sections?: OfficialSection[];
    kind?: "day" | "noon" | "seats" | "classroom" | "repertory" | "tickets";
};

function service(path: string, title: string, group: string, description: string, source: string, collection: string, extra: Partial<OfficialService> = {}): OfficialService {
    return { path, title, group, description, source: source.startsWith("http") ? source : content(source), collection, type: "content", eyebrow: "이용 안내", action: "공식 안내 확인", ...extra };
}

export const OFFICIAL_SERVICES: OfficialService[] = [
    service("/programs/day-ticket", "데이티켓", "programs", "공연 당일, 서울시예술단의 무대를 더 가깝게.", `${base}/portal/youthDayTicket/youthDayTicket/userView.do?menuNo=200631`, "티켓", {
        kind: "day", action: "오늘의 대상 공연 확인", facts: [["할인", "대상 잔여 좌석 70%"], ["구매", "공연 당일 오전 9시부터"], ["매수", "관람자 본인 1매"], ["문의", "02-399-1000"]],
        sections: [{ title: "나에게 맞는 데이티켓", text: "2026년 기준 청소년은 2002~2019년생, 어르신은 1961년 및 이전 출생자가 대상입니다. 거주지 제한은 없습니다." }, { title: "예매 전에", items: ["청소년은 공연별 최저 등급, 어르신은 최고 등급을 제외한 잔여석에 적용됩니다.", "티켓을 받을 때 관람자 본인의 연령 증빙 원본을 제시합니다.", "대상 공연과 잔여석은 공식 페이지에서 확인하며, 구매 후 취소·변경은 불가합니다."] }],
    }),
    service("/programs/noon-ticket", "정오티켓", "programs", "광화문에서 맞는 정오, 오늘의 공연을 만나는 한 시간.", `${base}/portal/noonTicket/noonTicket/userView.do?menuNo=200668`, "티켓", {
        kind: "noon", action: "정오티켓 대상 공연 확인", facts: [["시간", "공연 당일 12:00–13:00"], ["장소", "1층 세종라운지 서비스플라자"], ["수량", "회차당 50매 · 1인 2매"], ["혜택", "대상 공연 3층 좌석 50% 할인"]],
        sections: [{ title: "현장에서 만나는 티켓", text: "서비스플라자 지정 창구에서 선착순으로 구매합니다. 온라인·전화·공연장 매표소에서는 구매할 수 없으며, 준비된 수량이 소진되면 일찍 종료됩니다." }, { title: "구매 전 확인", items: ["당일 대상 공연과 판매 여부를 공식 안내에서 확인해 주세요.", "구매 후 환불·취소·변경 및 다른 할인과의 중복 적용은 불가합니다."] }],
    }),
    service("/programs/repertory", "레퍼토리 공연투어", "programs", "서울의 무대가 다른 도시의 관객을 만납니다.", "200658", "시즌", { kind: "repertory", action: "시즌별 투어 일정·기술자료 확인", sections: [{ title: "공연을 초청하려면", text: "공연별 러닝타임, 필요한 무대 크기와 설치·리허설 일정을 살펴본 뒤 각 프로덕션 담당자와 협의하세요. 세부 투어 일정과 기술 조건은 공식 자료를 기준으로 합니다." }] }),
    service("/programs/season/inspiration", "세종 인스피레이션", "programs", "작품을 만나는 또 하나의 방식. 연도별 특별 프로그램을 살펴보세요.", `${base}/portal/etc/seasonEtcUser/inspiration.do?menuNo=200639`, "시즌", { action: "연도별 프로그램 보기", sections: [{ title: "2026년의 만남", items: ["죽음과 소녀 콘서트 - 2026.07.27 · 세종대극장", "리딩 & 리스닝 스테이지 - 2026.01.25–01.26 · 세종대극장"] }] }),
    service("/programs/exhibition/booking-guide", "전시 예매안내", "programs", "전시별 관람 시간과 입장 조건을 확인하고 여유롭게 방문하세요.", "200587", "티켓", { action: "공식 전시 예매안내", sections: [{ title: "관람 준비", items: ["관람 날짜, 운영 시간, 입장 마감과 휴관일을 먼저 확인합니다.", "전시마다 입장권·할인·단체관람 기준이 다를 수 있습니다.", "실제 예매와 취소는 해당 전시의 공식 예매처에서 진행합니다."] }] }),
    service("/programs/education/introduction", "세종예술아카데미", "programs", "음악과 미술을 배우며 일상 속 감상의 폭을 넓힙니다.", "200561", "교육", { action: "아카데미 소개 확인", sections: [{ title: "배움에서 시작되는 예술", text: "관심 분야의 강좌를 살펴보고 수업 일정, 수강 대상, 장소와 신청 조건을 확인하세요. 모집 여부와 수강료는 공식 교육일정에서 확인할 수 있습니다." }] }),
    service("/programs/history/exhibition", "세종·충무공 전시관 소개", "programs", "광화문광장 아래에서 만나는 세종대왕과 충무공 이순신의 이야기.", "200334", "세종·충무공이야기", { sections: [{ title: "두 인물, 이어지는 이야기", text: "한글과 과학, 음악에 담긴 세종의 생각과 이순신의 삶을 전시와 체험으로 만나는 공간입니다. 전시관 정보와 체험 안내를 함께 확인해 방문을 준비하세요." }] }),
    service("/programs/history/information", "전시관 정보", "programs", "세종의 시대와 충무공의 생애를 전시 주제별로 살펴보세요.", "200340", "세종·충무공이야기", { sections: [{ title: "전시의 두 갈래", items: ["세종이야기: 세종대왕, 한글, 과학과 예술의 성취", "충무공이야기: 이순신의 생애와 조선 수군의 역사"] }] }),
    service("/programs/history/experience", "전시관 체험 프로그램", "programs", "한글을 쓰고, 이야기를 찾고, 손으로 기억하는 역사.", "200345", "세종·충무공이야기", { facts: [["상설 체험", "10:40–18:10"], ["유료 체험", "2,000원"], ["무료 체험", "붓글씨로 한글 이름 쓰기"]], sections: [{ title: "직접 만들어보세요", items: ["열쇠고리·배지·복주머니·자석·그립톡 등 기념품 만들기", "전시를 둘러보며 활동지 퀴즈 풀기", "붓글씨로 내 이름을 한글로 써보기"] }, { title: "참여 전 확인", text: "체험별 운영 여부와 마지막 접수 시간은 방문 전에 공식 안내를 확인하세요. 4D 영상체험관은 별도의 이용 조건이 적용됩니다." }] }),
    service("/programs/history/gallery", "한글갤러리", "programs", "문자가 예술이 되는 공간. 한글을 새롭게 읽는 전시를 만납니다.", `${base}/portal/performance/performance/korGallery.do?menuNo=200344`, "세종·충무공이야기", { action: "진행 전시와 전시 이력 보기", sections: [{ title: "전시를 찾아보세요", text: "공식 한글갤러리에서 진행 중인 전시와 지난 전시, 참여 작가 및 관람 일정을 확인할 수 있습니다." }] }),
    service("/programs/history/notices", "전시관 공지사항", "programs", "휴관과 운영 변경, 특별 체험과 전시 소식을 확인하세요.", `${base}/portal/bbs/B0000062/list.do?menuNo=200333`, "세종·충무공이야기", { action: "최신 전시관 공지 보기", sections: [{ title: "방문 전 마지막 확인", text: "전시관 운영과 체험 프로그램은 현장 사정에 따라 바뀔 수 있습니다. 방문 날짜에 해당하는 공지를 공식 게시판에서 확인하세요." }] }),
    service("/programs/tour/reservation", "백스테이지 투어 예약", "programs", "객석 뒤의 또 다른 극장. 실제 투어 신청은 공식 예약 화면에서 이어집니다.", `${base}/portal/backstage/tourApply/userWrite.do?menuNo=200675`, "백스테이지 투어", { action: "공식 투어 예약으로 이동", sections: [{ title: "일정 선택부터 예약까지", items: ["공식 예약 화면에서 신청 가능한 날짜와 인원을 확인합니다.", "참여자 정보와 이용 조건을 확인한 뒤 신청합니다.", "완료 후 공식 예약내역에서 접수 결과를 확인하세요."] }] }),
    service("/programs/tour/reservations", "백스테이지 투어 예약 확인", "programs", "신청한 투어의 날짜와 인원, 예약 상태를 확인합니다.", `${base}/portal/backstage/tourApply/userList.do?menuNo=200676`, "백스테이지 투어", { action: "공식 예약내역 확인", sections: [{ title: "신청한 곳에서 확인하세요", text: "공식 홈페이지에서 신청한 투어는 공식 예약내역에서 확인합니다. 이 리뉴얼의 예매 체험 기록은 마이페이지에 별도로 보관됩니다." }] }),
    service("/programs/season/classic/schedule", "누구나 클래식 공연안내", "programs", "누구에게나 열려 있는 클래식의 다음 무대를 확인하세요.", `${base}/portal/classic4all/schedule/yearList.do?menuNo=200452`, "모든 누구나", { action: "연간 공연 일정 보기", sections: [{ title: "연도별로 만나는 무대", text: "공식 공연안내에서 연도별 프로그램과 공연 날짜를 선택하고 신청 기간을 확인할 수 있습니다." }] }),
    service("/programs/season/classic/companion", "행복동행석", "programs", "문화예술을 누리기 어려운 이웃과 함께하는 객석.", "200455", "모든 누구나", { action: "신청 방법·공식 접수 확인", facts: [["신청", "복지시설·지원센터 등 관련 기관"], ["문의", "02-399-1037"]], sections: [{ title: "기관과 함께 신청합니다", text: "누구나 클래식의 일부 객석을 문화예술 향유에 어려움이 있는 관객에게 나눕니다. 대상과 신청 방법을 확인하고 공식 신청서를 제출한 뒤 결과를 확인하세요." }] }),
    service("/programs/season/orchestra/history", "꿈나무오케스트라의 발자취", "programs", "함께 악기를 배우고 무대에 서며 쌓아온 시간을 돌아봅니다.", `${base}/portal/htmlContents/htmlContents/view.do?menuCd=footprints&menuNo=200463`, "모든 누구나", { action: "연도별 활동 기록 보기", sections: [{ title: "아이들과 함께한 기록", text: "공식 연혁에서 누구나 꿈나무오케스트라의 활동과 공연 이력을 연도별로 살펴볼 수 있습니다." }] }),
    service("/programs/season/orchestra/support", "꿈나무오케스트라 후원", "programs", "아이들의 다음 연주가 이어질 수 있도록 함께합니다.", "200465", "모든 누구나", { action: "공식 후원 안내 확인", sections: [{ title: "후원 참여", text: "공식 안내에서 후원 방식과 담당 창구를 확인하세요. 기부 신청과 결제, 영수증 발급은 공식 후원 절차에 따라 진행됩니다." }] }),
    service("/programs/season/summer/schedule", "세종썸머페스티벌 공연안내", "programs", "도시의 여름을 채우는 공연과 프로그램을 찾아보세요.", `${base}/portal/sejongSummer/sejongSummer/list.do?menuNo=200592`, "모든 누구나", { action: "공식 페스티벌 프로그램 보기", sections: [{ title: "여름의 무대", text: "공식 프로그램에서 공연별 날짜와 장소, 관람·참여 방법을 확인하세요. 야외 프로그램은 기상과 운영 상황에 따른 공지도 함께 확인합니다." }] }),
    service("/visit/seating", "좌석배치도", "visit", "내가 머물 객석을 먼저 둘러보세요.", "200368", "공간", { kind: "seats", action: "공식 좌석배치도 열기", sections: [{ title: "객석과 무대의 거리", text: "공연장을 선택해 공간 정보를 확인하세요. 실제 좌석 번호와 시야, 휠체어석 위치는 공식 좌석배치도와 공연별 예매 화면을 기준으로 확인합니다." }] }),
    service("/visit/virtual-tour", "공간형 웹서비스", "visit", "가기 전에 걸어보는 세종. 공간을 둘러보고 방문 동선을 준비하세요.", "https://www.sejongstory.or.kr", "공간", { action: "공간형 웹서비스 둘러보기", sections: [{ title: "온라인으로 먼저 방문하세요", text: "세종문화회관과 세종·충무공이야기를 공간형 웹서비스로 둘러볼 수 있습니다. 실제 방문은 오시는 길과 접근성 안내도 함께 확인해 주세요." }] }),
    service("/rental/notices", "대관공고", "rental", "정기·수시 대관 모집과 공식 신청 일정을 확인합니다.", `${base}/portal/reservation/reservation/list.do?menuNo=200402`, "대여·대관", { action: "최신 대관공고 확인", sections: [{ title: "공고부터 신청까지", items: ["공간, 사용 가능 기간과 접수 마감을 확인합니다.", "공고에 첨부된 실제 신청 서식과 심사 기준을 준비합니다.", "공식 대관시스템에서 접수하고 승인 결과를 확인합니다."] }] }),
    service("/rental/classrooms", "강의실 대여", "rental", "강의, 워크숍, 작은 만남의 크기에 맞는 공간을 고르세요.", "200427", "대여·대관", { kind: "classroom", action: "공식 요금·대여절차 확인", sections: [{ title: "장비와 일정 확인", text: "강의실별 장비, 사용 시간과 행사 성격에 따라 적용 요금이 달라집니다. 아래 공간을 비교한 뒤 공식 대여절차에서 일정과 최종 금액을 확인하세요." }] }),
    service("/rental/outdoor", "야외공간 대여", "rental", "도시와 예술이 만나는 열린 공간에서 행사를 준비합니다.", "200429", "대여·대관", { action: "공간 사진·공식 신청서 확인", sections: [{ title: "빌릴 수 있는 공간", items: ["중앙계단 · 대극장계단 · 아트피아계단", "세종뜨락 · 예술의 정원 · 예인마당"] }, { title: "행사 준비", text: "공식 페이지에서 기업행사 안내문과 부대시설 대관신청서, 계약서를 확인합니다. 설치·철수, 관람객 동선과 기상 대응을 포함해 담당자와 협의하세요." }] }),
    service("/rental/costumes", "의상·소품 대여", "rental", "무대의 이야기를 완성하는 의상과 소품을 만나보세요.", "200431", "대여·대관", { action: "공식 품목·대여조건 확인", facts: [["의상실", "02-399-1656"], ["소품실", "02-399-1013"], ["대여기간", "최대 30일 · 승인 후 대여"]], sections: [{ title: "실물을 확인하고 신청합니다", text: "의상실 또는 소품실을 방문해 모양·크기·색상을 확인한 뒤 신청서를 작성합니다. 심의와 대여료 납부 후 반출하며, 사용 후 정해진 날짜에 반납합니다." }] }),
    service("/rental/ticket-sales", "티켓판매안내", "rental", "대관 공연의 판매 준비부터 발권·정산까지.", "200435", "티켓·광고", { action: "공식 판매위탁 절차 확인", sections: [{ title: "판매를 준비하는 순서", items: ["입장권 판매위탁 계약과 홈페이지 게재 신청", "부대설비 신청 및 입장권 검인·공연 판매 등록", "발권과 현장 인력 협의, 판매 후 정산"] }, { title: "공식 대관시스템 이용", text: "절차별 제출자료와 담당자를 확인한 뒤 대관시스템에서 신청합니다. 모든 절차가 완료되어야 실제 판매·발권이 가능합니다." }] }),
    service("/rental/advertising", "배너광고안내", "rental", "공연의 첫인상을 관객에게 전하는 자리.", "200436", "티켓·광고", { action: "공식 요금·디자인 가이드 확인", facts: [["배너 문의", "02-399-1748"], ["상단 배너", "1주 150,000원 · 부가세 별도"]], sections: [{ title: "게시 일정을 먼저 협의하세요", text: "담당자와 일정을 협의하고 공식 대관시스템에서 신청합니다. 배너 규격과 소재, 사용료 납부 및 승인 절차를 확인한 뒤 게시됩니다." }] }),
    service("/news/ticket-open", "티켓오픈안내", "news", "기다리던 공연의 예매 시작을 놓치지 마세요.", `${base}/portal/bbs/B0000049/list.do?menuNo=200440`, "소식", { kind: "tickets", action: "최신 티켓오픈 공지 보기" }),
    service("/news/events/ended", "종료 이벤트", "news", "함께했던 이벤트를 돌아보고 결과를 확인하세요.", `${base}/portal/qestnar/qustnr/list.do?status=F&menuNo=200442`, "소식", { action: "공식 종료 이벤트 보기", sections: [{ title: "참여한 이벤트를 찾으세요", text: "공식 종료 이벤트 목록에서 행사별 안내를 확인할 수 있습니다. 당첨 여부는 당첨자 발표 게시판 또는 해당 이벤트의 결과 안내를 확인하세요." }] }),
    service("/news/goods/vendor", "세종굿즈 입점문의", "news", "세종을 찾는 관객과 만날 상품을 제안해 주세요.", `${base}/portal/goods/store/userWrite.do?menuNo=200661`, "굿즈", { action: "공식 입점문의 작성", sections: [{ title: "제안 전 준비할 내용", items: ["브랜드와 제안 상품 소개", "상품 이미지, 구성과 판매 조건", "담당자 연락처와 협의할 내용"] }, { title: "공식 창구에서 접수합니다", text: "입점문의는 공식 홈페이지에서 작성합니다. 이 화면은 접수 사실을 생성하거나 제안서를 전송하지 않습니다." }] }),
    service("/about/esg/human-rights", "인권경영", "about", "예술을 만드는 사람과 만나는 사람, 모두의 존엄을 생각합니다.", "200524", "책임경영", { action: "인권경영 체계·정책 확인", sections: [{ title: "인권을 존중하는 운영", text: "공식 페이지에서 인권경영의 뜻과 운영 체계, 관련 선언과 자료를 확인할 수 있습니다. 피해 구제와 신고는 인권침해신고센터로 이어집니다." }] }),
    service("/about/esg/code", "윤리규범", "about", "신뢰받는 문화예술기관을 위한 행동의 기준.", "200551", "책임경영", { action: "윤리헌장·행동강령 원문 보기", sections: [{ title: "원문으로 확인하세요", text: "윤리헌장과 관련 규범은 공식 사이트의 현행 원문에서 확인하세요. 적용 범위와 최신 개정 내용도 함께 살펴볼 수 있습니다." }] }),
    ...[
        ["irregularity", "부조리 신고센터", "200517", "부당한 업무 처리와 부조리에 대한 공식 신고 안내를 확인합니다."],
        ["clean", "클린 신고센터", "200518", "금품 등 수수와 관련한 신고 기준과 접수 방법을 확인합니다."],
        ["solicitation", "청탁 신고센터", "200519", "청탁 관련 신고의 대상과 공식 처리 절차를 확인합니다."],
        ["public-duty", "청탁금지법 공무수행사인", "200520", "공무수행사인 관련 안내와 공개 자료를 확인합니다."],
        ["ceo", "CEO 핫라인 신고센터", "200516", "기관 운영과 관련한 신고를 공식 CEO 핫라인으로 전달합니다."],
        ["regulation", "규제혁신센터", "200665", "업무와 제도에서 겪는 불편, 개선이 필요한 규제를 제안합니다."],
    ].map(([id, title, menu, description]) => service(`/about/report/${id}`, title, "about", description, menu, "신고·제안", { action: "공식 신고 안내·접수처 확인", sections: [{ title: "공식 접수처에서 진행하세요", text: "대상, 접수 방법과 처리 절차를 확인한 후 공식 신고 창구를 이용합니다. 민감한 신고 내용은 이 리뉴얼 사이트에 저장하거나 제출하지 않습니다." }] })),
    service("/about/report/human-rights", "인권침해신고센터", "about", "인권침해에 대한 상담과 구제 절차를 안내합니다.", "200654", "신고·제안", { action: "공식 신고서·구제절차 확인", facts: [["상담 전화", "02-399-1520"], ["이메일", "sangdam@sejongpac.or.kr"]], sections: [{ title: "신고할 수 있는 분", text: "기관의 경영 활동이나 임직원으로 인해 피해를 입은 당사자 또는 해당 사실을 알고 있는 제3자가 신고할 수 있습니다. 익명 신고 시 조사와 결과 안내가 제한될 수 있습니다." }, { title: "신고 이후", text: "접수 후 상담·조사, 심의, 조치와 결과 통보 절차로 진행됩니다. 공식 페이지에서 신고자 보호 원칙과 신고서 양식을 확인하세요." }] }),
    service("/policy/service", "고객서비스헌장", "utility", "세종문화회관이 관객에게 약속하는 서비스의 기준.", "200164", "책임경영", { action: "고객서비스헌장 원문 보기", sections: [{ title: "관객과의 약속", text: "공식 고객서비스헌장과 분야별 이행 기준을 확인하세요. 관람 과정의 문의는 고객지원과 FAQ에서도 안내받을 수 있습니다." }] }),
];

export const OFFICIAL_PAGE_META: PageMeta[] = [
    { path: "/services", title: "세종 이용 길잡이", description: "공연부터 대관, 배움과 나눔까지. 필요한 서비스를 찾아보세요.", group: "utility", type: "content", eyebrow: "이용 길잡이" },
    ...OFFICIAL_SERVICES.map(({ path, title, description, group, type, eyebrow }) => ({ path, title, description, group, type, eyebrow })),
];

export const OFFICIAL_TICKET_NOTICES = [
    { title: "네이처 오브 포겟팅 · 3차 티켓오픈", date: "2026.10.15", time: "16:00", url: `${base}/portal/bbs/B0000049/view.do?nttId=50187&menuNo=200440&pageIndex=1` },
    { title: "유니버설발레단 〈호두까기인형〉", date: "2026.10.15", time: "14:00", url: `${base}/portal/bbs/B0000049/view.do?nttId=50200&menuNo=200440&pageIndex=1` },
    { title: "SJF at the Theater 2026 · 백예린×윤석철", date: "2026.10.14", time: "12:00", url: `${base}/portal/bbs/B0000049/view.do?nttId=50188&menuNo=200440&pageIndex=1` },
];
