import { OFFICIAL_MEDIA } from "./official-media.ts";

export type HomeFeature = { id: string; theme: string; label: string; title: string; name: string; programTitle: string; date: string; venue: string; image: string; alt: string; description: string; };

export const HOME_FEATURES: readonly HomeFeature[] = [
    {
        id: "dance",
        theme: "dance",
        label: "2026 세종시즌 서울시무용단",
        title: "같은 숨으로\n이어지는 춤",
        name: "서울시무용단 〈일무〉",
        programTitle: "일무",
        date: "2026.10.20 - 10.25",
        venue: "세종대극장",
        image: "official/" + OFFICIAL_MEDIA["ilmu-stage"].file,
        alt: OFFICIAL_MEDIA["ilmu-stage"].alt,
        description: "나란히 선 몸짓이 하나의 커다란 춤이 되는 시간",
    },
    {
        id: "carmen",
        theme: "opera",
        label: "2026 세종시즌 서울시오페라단",
        title: "누구의 것도 아닌\n카르멘",
        name: "서울시오페라단 〈카르멘〉",
        programTitle: "카르멘",
        date: "2026.10.15 - 10.18",
        venue: "세종대극장",
        image: "official/" + OFFICIAL_MEDIA["season-28"].file,
        alt: OFFICIAL_MEDIA["season-28"].alt,
        description: "익숙한 선율 너머에서 만나는 카르멘의 선택",
    },
    {
        id: "light",
        theme: "light",
        label: "세종미술관 전시",
        title: "잠시 걸음을 멈추고\n빛을 바라보는 일",
        name: "빛이 머무는 자리",
        programTitle: "빛이 머무는 자리",
        date: "2026.10.01 - 11.15",
        venue: "세종미술관",
        image: "official/" + OFFICIAL_MEDIA["venue-gallery"].file,
        alt: OFFICIAL_MEDIA["venue-gallery"].alt,
        description: "창을 지나 바닥에 닿은 빛을 따라 천천히 걷는 전시",
    },
];
