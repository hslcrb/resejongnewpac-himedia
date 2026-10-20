import type { Program, Venue, Notice, NavItem, PageMeta } from "../../types/sejong.ts";

const page = (path: string, title: string, group: string, description = "", type = "content"): PageMeta => ({
    path,
    title,
    group,
    description,
    type,
    eyebrow:
        ({
            programs: "PROGRAMS",
            rental: "VENUE RENTAL",
            visit: "VISIT SEJONG",
            news: "NEWS & BENEFITS",
            about: "ABOUT SEJONG",
            account: "MY SEJONG",
        } as Record<string, string>)[group] || "SEJONG CENTER",
});

export const NAV: NavItem[] = [
    {
        id: "programs",
        title: "프로그램",
        path: "/programs",
        items: [
            ["공연", "/programs/performance"],
            ["전시", "/programs/exhibition"],
            ["교육", "/programs/education"],
            ["기획·시즌 프로그램", "/programs/season"],
            ["백스테이지 투어", "/programs/tour"],
            ["세종·충무공 이야기", "/programs/history"],
        ],
    },
    {
        id: "rental",
        title: "대관",
        path: "/rental",
        items: [
            ["대관안내", "/rental/guide"],
            ["대관시설", "/rental/venues"],
            ["대관일정", "/rental/schedule"],
            ["대관절차", "/rental/process"],
            ["대관신청", "/rental/apply"],
            ["대관문의", "/rental/contact"],
        ],
    },
    {
        id: "visit",
        title: "이용안내",
        path: "/visit",
        items: [
            ["공간안내", "/visit/spaces"],
            ["오시는 길·주차", "/visit/directions"],
            ["편의시설", "/visit/amenities"],
            ["장애인 이용안내", "/visit/accessibility"],
            ["관람 유의사항", "/visit/etiquette"],
            ["고객지원", "/visit/support"],
        ],
    },
    {
        id: "news",
        title: "소식과 혜택",
        path: "/news",
        items: [
            ["공지사항", "/news/notices"],
            ["이벤트", "/news/events"],
            ["뉴스레터·세종문화N", "/news/newsletter"],
            ["멤버십", "/news/membership"],
            ["세종 굿즈", "/news/goods"],
        ],
    },
    {
        id: "about",
        title: "세종문화회관",
        path: "/about",
        items: [
            ["기관소개", "/about/introduction"],
            ["서울시예술단", "/about/companies"],
            ["ESG 경영", "/about/esg"],
            ["정보공개", "/about/disclosure"],
            ["협력 및 협찬", "/about/partners"],
            ["후원", "/about/donation"],
        ],
    },
];

export const PAGES: PageMeta[] = [
    page("/", "홈", "home", "공연·전시·교육 일정, 예매와 이용 안내", "home"),
    ...NAV.flatMap((n) => [
        page(n.path, n.title, n.id),
        ...n.items.map(([t, p]) => page(p, t, n.id)),
    ]),
    ...[
        ["/programs/booking-guide", "예매안내", "programs"],
        ["/programs/education/apply-guide", "교육 신청안내", "programs"],
        ["/programs/season/sejong", "2026 세종시즌", "programs"],
        ["/programs/season/sync-next", "Sync Next", "programs"],
        ["/programs/season/everyone", "모든 누구나", "programs"],
        ["/programs/season/package", "시즌 패키지", "programs"],
        ["/programs/season/classic", "누구나 클래식", "programs"],
        ["/programs/season/orchestra", "누구나 꿈나무오케스트라", "programs"],
        ["/programs/season/summer", "누구나 세종썸머페스티벌", "programs"],
        ["/rental/guide/fees", "대관요금", "rental"],
        ["/rental/guide/eligibility", "대관 대상 및 기준", "rental"],
        ["/rental/process/documents", "신청서류 및 심사기준", "rental"],
        ["/rental/equipment", "무대 기술·장비 안내", "rental"],
        ["/visit/directions/parking", "주차안내", "visit"],
        ["/visit/amenities/dining", "F&B · 다이닝", "visit"],
        ["/visit/amenities/facilities", "편의시설 위치", "visit"],
        ["/visit/support/faq", "자주 묻는 질문", "visit"],
        ["/visit/support/inquiry", "문의하기", "visit"],
        ["/visit/support/lost", "분실물 안내", "visit"],
        ["/visit/group", "단체관람 안내·신청", "visit"],
        ["/news/events/winners", "당첨자 발표", "news"],
        ["/news/notices/recruit/apply", "공연장 안내원 지원 체험", "news"],
        ["/news/goods/art-postcards", "공연의 한 장면 · 엽서", "news"],
        ["/news/goods/canvas-bag", "캔버스 토트백", "news"],
        ["/news/goods/viewing-journal", "관람 기록 노트", "news"],
        ["/news/goods/cart", "굿즈 장바구니", "news"],
        ["/news/goods/orders", "굿즈 주문내역", "news"],
        ["/news/newsletter/archive", "뉴스레터 아카이브", "news"],
        ["/news/magazine", "세종문화N", "news"],
        ["/news/membership/benefits", "멤버십 혜택", "news"],
        ["/news/membership/join", "멤버십 가입", "news"],
        ["/about/introduction/greeting", "인사말", "about"],
        ["/about/introduction/history", "걸어온 역사", "about"],
        ["/about/introduction/organization", "조직도", "about"],
        ["/about/introduction/ci", "CI 소개", "about"],
        ["/about/esg/environment", "환경경영", "about"],
        ["/about/esg/social", "사회공헌", "about"],
        ["/about/esg/governance", "윤리경영", "about"],
        ["/about/disclosure/management", "경영공시", "about"],
        ["/about/disclosure/request", "정보공개 청구", "about"],
        ["/about/disclosure/ethics", "부패신고·규제혁신센터", "about"],
        ["/about/donation/apply", "후원 참여", "about"],
        ["/about/partners/apply", "협력·협찬 제안", "about"],
        ["/about/arts-center", "꿈의숲 아트센터", "about"],
        ["/account/login", "로그인", "account"],
        ["/account/signup", "회원가입", "account"],
        ["/account/recovery", "아이디·비밀번호 찾기", "account"],
        ["/account", "마이페이지", "account"],
        ["/account/bookings", "예매내역", "account"],
        ["/account/favorites", "관심 프로그램", "account"],
        ["/account/applications", "신청내역", "account"],
        ["/account/profile", "내 정보", "account"],
        ["/search", "통합검색", "utility"],
        ["/sitemap", "사이트맵", "utility"],
        ["/policy/privacy", "개인정보처리방침", "utility"],
        ["/policy/terms", "이용약관", "utility"],
        ["/policy/email", "이메일 무단수집거부", "utility"],
        ["/english", "English visitor guide", "utility"],
    ].map(([path, title, group]) => page(path, title, group)),
];

export const VENUES: Venue[] = [
    {
        id: "grand",
        name: "세종대극장",
        kind: "공연장",
        capacity: "3,022",
        description:
            "대형 규모의 대표 공연장. 오페라와 발레, 오케스트라 등 대규모 무대가 상연됩니다.",
        image: "assets/images/venue-grand.svg",
    },
    {
        id: "m-theater",
        name: "세종M씨어터",
        kind: "공연장",
        capacity: "609",
        description:
            "무대와 객석의 거리가 가까우니 배우의 표정까지 보이는 중극장입니다.",
        image: "assets/images/venue-m.svg",
    },
    {
        id: "s-theater",
        name: "세종S씨어터",
        kind: "공연장",
        capacity: "300",
        description:
            "무대와 객석 배치를 공연마다 다시 만드는 블랙박스형 공간입니다.",
        image: "assets/images/venue-s.svg",
    },
    {
        id: "chamber",
        name: "세종체임버홀",
        kind: "공연장",
        capacity: "443",
        description:
            "실내악 특화의 어쿠스틱 홀. 연주 소리의 작은 결까지 전합니다.",
        image: "assets/images/venue-chamber.svg",
    },
    {
        id: "gallery",
        name: "세종미술관",
        kind: "전시장",
        capacity: "전시 공간",
        description:
            "도심 한가운데 있는 미술관. 기획전과 아트페어가 열립니다.",
        image: "assets/images/venue-gallery.svg",
    },
];

const rows: [string, string, string, string, string, string, string, number, string, string][] = [
    [
        "autumn",
        "가을의 리듬, 서울의 울림",
        "공연",
        "클래식",
        "2026-10-01",
        "2026-10-31",
        "세종대극장",
        50000,
        "orchestra",
        "서울시국악관현악단 정기공연. 국악기와 관현악이 한 무대에서 울립니다.",
    ],
    [
        "carmen",
        "카르멘",
        "공연",
        "오페라",
        "2026-10-15",
        "2026-10-18",
        "세종대극장",
        80000,
        "carmen",
        "비제 오페라 〈카르멘〉. 서울시오페라단이 부르는 뜨겁고 자유로운 사랑의 노래.",
    ],
    [
        "dance",
        "일무",
        "공연",
        "무용",
        "2026-10-20",
        "2026-10-25",
        "세종대극장",
        60000,
        "dance",
        "제례의 춤 〈일무〉를 서울시무용단이 오늘의 형태로 무대에 올립니다.",
    ],
    [
        "chamber-autumn",
        "가을, 현의 편지",
        "공연",
        "클래식",
        "2026-10-13",
        "2026-10-30",
        "세종체임버홀",
        30000,
        "chamber",
        "첼로와 현악사중주 실내악 정기공연. 가까이 듣는 스트링 음색.",
    ],
    [
        "sumire",
        "스미레 미용실",
        "공연",
        "연극",
        "2026-10-01",
        "2026-10-25",
        "세종M씨어터",
        40000,
        "sumire",
        "작은 미용실에 오가는 손님들의 이야기를 연극으로 옮겼습니다.",
    ],
    [
        "hypnosis",
        "HYPNOSIS THERAPY",
        "공연",
        "융복합",
        "2026-10-13",
        "2026-10-17",
        "세종S씨어터",
        35000,
        "hypnosis",
        "음악과 영상, 무용이 섞이는 융복합 공연. Sync Next 기획작.",
    ],
    [
        "light",
        "빛이 머무는 자리",
        "전시",
        "현대미술",
        "2026-10-01",
        "2026-11-15",
        "세종미술관",
        15000,
        "light",
        "빛을 다룬 설치 작업들이 공간의 밝기와 온도를 바꿉니다. 동시대 작가 기획전.",
    ],
    [
        "art-goods",
        "서울아트굿즈페스티벌",
        "전시",
        "아트페어",
        "2026-10-10",
        "2026-10-31",
        "세종미술관",
        0,
        "art",
        "아트굿즈 작가와 브랜드 부스가 세종미술관에 모입니다. 입장 무료.",
    ],
    [
        "academy",
        "퇴근길 클래식, 음악의 문을 열다",
        "교육",
        "음악",
        "2026-10-13",
        "2026-11-24",
        "세종예술아카데미",
        120000,
        "academy",
        "여섯 차례의 화요일 저녁 강좌. 곡마다 배경과 감상 포인트를 안내합니다.",
    ],
    [
        "art-class",
        "그림을 읽는 시간",
        "교육",
        "미술",
        "2026-10-14",
        "2026-11-18",
        "세종예술아카데미",
        100000,
        "artclass",
        "미술사의 대표 작품을 작가 이야기와 함께 해설하는 감상 강좌입니다.",
    ],
    [
        "ballet",
        "한낮의 발레",
        "공연",
        "발레",
        "2026-11-01",
        "2026-11-08",
        "세종M씨어터",
        40000,
        "ballet",
        "해설이 붙은 서울시발레단 오후 공연. 무대 가까이에서 보는 발레.",
    ],
    [
        "choral",
        "노래, 도시를 잇다",
        "공연",
        "합창",
        "2026-10-23",
        "2026-10-24",
        "세종체임버홀",
        25000,
        "choral",
        "서울시합창단 정기공연. 체임버홀에서 열립니다.",
    ],
    [
        "everyone-classic",
        "누구나 클래식",
        "공연",
        "클래식",
        "2026-10-28",
        "2026-10-28",
        "세종대극장",
        1000,
        "classic",
        "천 원 티켓으로 보는 클래식 공연. 누구나 들어갈 수 있습니다.",
    ],
    [
        "winter",
        "겨울의 문턱에서",
        "공연",
        "뮤지컬",
        "2026-11-20",
        "2026-12-06",
        "세종M씨어터",
        55000,
        "winter",
        "겨울철 상연하는 서울시뮤지컬단 창작 무대입니다.",
    ],
    [
        "tour",
        "무대 뒤의 발견, 백스테이지 투어",
        "교육",
        "투어",
        "2026-10-01",
        "2026-12-31",
        "세종대극장",
        15000,
        "tour",
        "평소에는 접근할 수 없는 대극장 무대 뒷공간을 안내원과 함께 둘러봅니다.",
    ],
];

export const PROGRAMS: Program[] = rows.map(
    ([
        id,
        title,
        category,
        genre,
        start,
        end,
        venue,
        price,
        art,
        description,
    ]) => ({
        id,
        title,
        category,
        genre,
        start,
        end,
        venue,
        price,
        image: `assets/images/poster-${art}.svg`,
        description,
        duration:
            category === "전시"
                ? "자유 관람"
                : category === "교육"
                ? "90분"
                : "100분 (인터미션 포함)",
        age: category === "전시" ? "전체 관람" : "7세 이상",
        times: category === "전시" ? ["10:00", "14:00"] : ["14:00", "19:30"],
        status: "예매중",
    })
);

const sourceArtwork: Record<string, string> = {
    hypnosis: "hypnosis-therapy.png",
    sumire: "sumire-hair-salon.png",
    "everyone-classic": "everyone-classic.png",
};

PROGRAMS.forEach((p) => {
    if (sourceArtwork[p.id]) p.image = "assets/images/" + sourceArtwork[p.id];
});

export const COMPANIES = [
    ["traditional", "서울시국악관현악단", "국악기와 관현악을 함께 쓰는 정기공연", "국악"],
    ["dance", "서울시무용단", "전통춤과 창작 무용을 상연", "무용"],
    ["musical", "서울시뮤지컬단", "창작 뮤지컬과 대표작을 상연", "뮤지컬"],
    ["chorus", "서울시합창단", "합창 정기공연을 상연", "합창"],
    ["opera", "서울시오페라단", "정기 오페라 시즌을 상연", "오페라"],
    ["theater", "서울시극단", "한국 연극 작품을 상연", "연극"],
    ["ballet", "서울시발레단", "고전 발레와 창작 발레를 상연", "발레"],
].map(([id, name, description, genre]) => ({ id, name, description, genre }));

export const NOTICES: Notice[] = [
    {
        id: "season-open",
        category: "티켓오픈",
        title: "2026 세종시즌 11월 프로그램 티켓 오픈 안내",
        date: "2026-10-13",
        pinned: true,
        content:
            "새로운 계절을 함께할 11월 세종시즌 프로그램의 예매가 시작됩니다. 작품별 상세 페이지에서 공연 일정과 관람 연령, 좌석 등급을 확인해 주세요. 이 페이지의 일정은 리뉴얼 시연용입니다.",
        body:
            "새로운 계절을 함께할 11월 세종시즌 프로그램의 예매가 시작됩니다. 작품별 상세 페이지에서 공연 일정과 관람 연령, 좌석 등급을 확인해 주세요. 이 페이지의 일정은 리뉴얼 시연용입니다.",
        details: [
            ["티켓 오픈", "2026.10.15 (목) 오후 2시"],
            ["예매 방법", "프로그램 상세 → 예매하기"],
            ["대상 프로그램", "11월 세종시즌 공연"],
        ],
    },
    {
        id: "rental-2027",
        category: "대관공고",
        title: "2027년도 세종문화회관 공연장 정기대관 공고",
        date: "2026-10-12",
        pinned: true,
        content:
            "2027년 공연장 정기대관 일정을 공고합니다. 시설별 대관 기준과 신청서류를 확인한 후 대관 신청을 진행해 주세요.",
        body:
            "예술가와 관객이 만나는 새로운 무대를 기다립니다. 시설별 대관 기준과 신청서류를 확인한 후 대관 신청을 진행해 주세요.",
        details: [
            ["대상", "세종대극장 · M씨어터 · 체임버홀"],
            ["접수", "2026.10.12 ~ 10.30"],
            ["문의", "대관 문의 페이지"],
        ],
    },
    {
        id: "parking",
        category: "공지",
        title: "주말 광화문 일대 행사에 따른 교통·주차 안내",
        date: "2026-10-10",
        content:
            "광화문 일대의 행사로 주말 교통 혼잡이 예상됩니다. 원활한 관람을 위해 대중교통 이용을 권장하며 공연 시작 전 여유 있게 도착해 주세요.",
        body:
            "광화문 일대의 행사로 주말 교통 혼잡이 예상됩니다. 원활한 관람을 위해 대중교통 이용을 권장하며 공연 시작 전 여유 있게 도착해 주세요.",
        details: [
            ["지하철", "5호선 광화문역 1·8번 출구"],
            ["주차", "세종로 공영주차장 이용"],
        ],
    },
    {
        id: "recruit",
        category: "채용",
        title: "세종문화회관 공연장 안내원 모집 안내",
        date: "2026-10-08",
        content:
            "관객의 특별한 하루를 함께 만들어갈 공연장 안내원 모집 안내입니다. 본 내용은 채용 상세 페이지 구현을 위한 예시이며 실제 채용 접수는 진행되지 않습니다.",
        body:
            "관객의 특별한 하루를 함께 만들어갈 공연장 안내원을 모집합니다. 본 내용은 채용 상세 페이지 구현을 위한 예시이며 실제 채용 접수는 진행되지 않습니다.",
        details: [
            ["모집분야", "공연장 관객 안내 및 운영 지원"],
            ["근무형태", "공연 일정에 따른 탄력 근무"],
            ["전형", "서류 검토 → 면접 → 결과 안내"],
        ],
    },
    {
        id: "academy-notice",
        category: "교육",
        title: "세종예술아카데미 가을학기 수강 안내",
        date: "2026-10-05",
        content:
            "음악과 미술, 예술을 알아가는 즐거움. 가을학기 강좌별 일정과 준비물을 교육 프로그램 상세에서 확인하실 수 있습니다.",
        body:
            "음악과 미술, 예술을 알아가는 즐거움. 가을학기 강좌별 일정과 준비물을 교육 프로그램 상세에서 확인하실 수 있습니다.",
        details: [
            ["분야", "클래식 감상 · 미술사 · 예술 인문학"],
            ["신청", "교육 프로그램에서 강좌 선택"],
        ],
    },
    {
        id: "access",
        category: "공지",
        title: "모두에게 열린 공연장, 접근성 서비스 안내",
        date: "2026-10-02",
        content:
            "세종문화회관은 누구나 편안하게 문화예술을 경험할 수 있는 공간을 만들어갑니다. 휠체어석과 이동 동선, 보조기기 대여 정보를 확인해 주세요.",
        body:
            "세종문화회관은 누구나 편안하게 문화예술을 경험할 수 있는 공간을 만들어갑니다. 휠체어석과 이동 동선, 보조기기 대여 정보를 확인해 주세요.",
        details: [
            ["서비스", "휠체어석 · 이동 지원 · 보조기기 안내"],
            ["안내", "장애인 이용안내 페이지"],
        ],
    },
];

for (const p of PROGRAMS)
    if (!PAGES.some((page) => page.path === "/programs/" + p.id))
        PAGES.push(
            page("/programs/" + p.id, p.title, "programs", p.description, "program")
        );

for (const v of VENUES) {
    PAGES.push(
        page("/rental/venues/" + v.id, v.name, "rental", v.description, "venue")
    );
    PAGES.push(
        page(
            "/visit/spaces/" + v.id,
            v.name + " 공간안내",
            "visit",
            v.description,
            "space"
        )
    );
}

for (const c of COMPANIES)
    PAGES.push(
        page("/about/companies/" + c.id, c.name, "about", c.description, "company")
    );

for (const n of NOTICES)
    PAGES.push(page("/news/notices/" + n.id, n.title, "news", n.content, "notice"));

for (const [id, title] of [
    ["autumn-walk", "가을의 취향을 나누다"],
    ["review", "관람 후기 이벤트"],
    ["summer-end", "여름의 기억"],
])
    PAGES.push(
        page(
            "/news/events/" + id,
            title,
            "news",
            "이벤트 상세 안내입니다.",
            "event"
        )
    );

for (const [path, title, group, description] of [
    [
        "/news/events/autumn-walk/apply",
        "가을의 취향을 나누다 · 참여",
        "news",
        "내 가을 취향과 함께 이벤트 참여를 체험해 보세요.",
    ],
    [
        "/news/events/review/apply",
        "관람 후기 이벤트 · 참여",
        "news",
        "관람한 작품에 대한 후기를 남겨 주세요.",
    ],
    [
        "/visit/support/lost/umbrella",
        "분실물 상세 · 우산",
        "visit",
        "가상의 습득물 정보와 문의 경로를 확인하세요.",
    ],
    [
        "/visit/support/lost/scarf",
        "분실물 상세 · 머플러",
        "visit",
        "가상의 습득물 정보와 문의 경로를 확인하세요.",
    ],
    [
        "/visit/support/lost/glasses",
        "분실물 상세 · 안경",
        "visit",
        "가상의 습득물 정보와 문의 경로를 확인하세요.",
    ],
])
    PAGES.push(page(path, title, group, description));

PAGES.push(
    { path: "/visit/plan", title: "방문 계획", description: "관람 날짜와 이동 방법, 준비할 안내를 정리합니다.", group: "visit", eyebrow: "방문 준비", type: "content" },
    { path: "/rental/compare", title: "대관 공간 비교", description: "규모와 무대, 장비를 비교하고 맞는 공간으로 이어가세요.", group: "rental", eyebrow: "대관 준비", type: "content" },
    { path: "/design-rules", title: "디자인 시스템 & 규칙", description: "세종문화회관 v5 브랜드 컬러 시스템 및 Figma Variables 가이드", group: "rules", eyebrow: "디자인 설계", type: "content" }
);
