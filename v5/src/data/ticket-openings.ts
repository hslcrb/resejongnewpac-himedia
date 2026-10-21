export type TicketOpening = {
    id: string;
    title: string;
    opensAt: string;
    href: string;
};

// [공식 공지의 티켓오픈 시각 / Ticket release times from official announcements]
// 2026-10-21 확인. 공연일과 구분하며 공지 원문으로 연결합니다.
// Verified 2026-10-21; these are release times, not performance dates.
export const TICKET_OPENINGS: readonly TicketOpening[] = [
    {
        id: "monster-farm",
        title: "불나방스타쏘세지클럽 〈모여봐요 괴물의 농장〉",
        opensAt: "2026-10-28T12:00:00+09:00",
        href: "https://www.sejongpac.or.kr/portal/bbs/B0000049/view.do?menuNo=200440&nttId=50214&pageIndex=1",
    },
    {
        id: "health",
        title: "백현진 연말 콘서트 〈건강!〉",
        opensAt: "2026-10-28T14:00:00+09:00",
        href: "https://www.sejongpac.or.kr/portal/bbs/B0000049/view.do?menuNo=200440&nttId=50215&pageIndex=1",
    },
];

export const TICKET_OPENINGS_URL = "https://www.sejongpac.or.kr/portal/bbs/B0000049/list.do?menuNo=200440";
