/** v5 첫 진입 인트로: 포트폴리오의 약 7초대 연출 리듬을 참조한다. */
export const HOME_ENTRY_COPY = "2026 화이팅!";

export const HOME_ENTRY_TIMING = {
    artwork: 2_100,
    copyStart: 2_400,
    typeCharacter: 180,
    glyphReveal: 550,
    copyHold: 1_800,
    exit: 850,
    watchdog: 10_000,
} as const;

export function isV5HomeEntry(pathname: string | null | undefined): boolean {
    // usePathname()은 basePath를 제외한 "/"를 반환한다.
    // 정적 직접 진입 경로도 비교해 브라우저 전환을 안전하게 처리한다.
    return pathname === "/" || pathname === "/v5" || pathname === "/v5/";
}

export function homeEntryTimeline(text = HOME_ENTRY_COPY) {
    const typedAt =
        HOME_ENTRY_TIMING.copyStart +
        text.length * HOME_ENTRY_TIMING.typeCharacter +
        HOME_ENTRY_TIMING.glyphReveal;
    const exitAt = typedAt + HOME_ENTRY_TIMING.copyHold;
    return { typedAt, exitAt, finishAt: exitAt + HOME_ENTRY_TIMING.exit };
}
