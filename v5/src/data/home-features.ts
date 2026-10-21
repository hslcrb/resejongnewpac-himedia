import { OFFICIAL_MEDIA } from "./official-media.ts";

export type HomeFeature = { id: string; theme: string; label: string; title: string; name: string; date: string; venue: string; image: string; alt: string; description: string; };

export const HOME_FEATURES: readonly HomeFeature[] = [
    {
        id: "dance",
        theme: "dance",
        label: "2026 세종시즌 · 서울시무용단",
        title: "오래된 춤의 걸음,\n지금의 무대.",
        name: "서울시무용단 〈일무〉",
        date: "2026.10.20 - 10.25",
        venue: "세종대극장",
        image: "official/" + OFFICIAL_MEDIA["ilmu-stage"].file,
        alt: OFFICIAL_MEDIA["ilmu-stage"].alt,
        description: "전통의 움직임이 오늘의 감각을 만나, 무대 가득 새로운 풍경을 펼칩니다.",
    },
    {
        id: "carmen",
        theme: "opera",
        label: "2026 세종시즌 · 서울시오페라단",
        title: "자유롭게 사랑하고,\n자유롭게 떠나는 카르멘.",
        name: "서울시오페라단 〈카르멘〉",
        date: "2026.10.15 - 10.18",
        venue: "세종대극장",
        image: "official/" + OFFICIAL_MEDIA["season-28"].file,
        alt: OFFICIAL_MEDIA["season-28"].alt,
        description: "강렬한 선율과 함께 만나는, 자신의 삶을 선택하는 카르멘의 이야기.",
    },
    {
        id: "light",
        theme: "light",
        label: "전시 · 빛과 공간",
        title: "빛의 각도에 따라\n달라지는 공간.",
        name: "빛이 머무는 자리",
        date: "2026.10.01 - 11.15",
        venue: "세종미술관",
        image: "official/" + OFFICIAL_MEDIA["venue-gallery"].file,
        alt: OFFICIAL_MEDIA["venue-gallery"].alt,
        description: "빛과 그림자 사이를 걸으며 공간의 새로운 표정을 발견해 보세요.",
    },
];
