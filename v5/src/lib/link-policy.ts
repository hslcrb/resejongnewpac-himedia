// [공식 사이트로 이동하는 링크 제거 / Remove navigation to the official website]
// DB가 새로 고쳐져도 같은 도메인의 링크를 다시 만들지 않습니다.
// Apply the same policy to refreshed catalog data and authored links.
const officialHost = (host: string) => {
    const normalized = host.toLowerCase().replace(/\.$/, "");
    return normalized === "sejongpac.or.kr" || normalized.endsWith(".sejongpac.or.kr");
};

export function isRemovedOfficialLink(value: unknown): boolean {
    if (value && typeof value === "object") {
        const destination = value as { href?: unknown; hostname?: unknown; host?: unknown };
        if (typeof destination.href === "string") return isRemovedOfficialLink(destination.href);
        const host = destination.hostname || destination.host;
        return typeof host === "string" && isRemovedOfficialLink(`https://${host}`);
    }
    if (typeof value !== "string" || !value.trim()) return false;
    try {
        const url = new URL(value.trim(), "https://navigation.local");
        if (officialHost(url.hostname)) return true;
        return (
            url.protocol === "mailto:" &&
            decodeURIComponent(url.pathname)
                .split(/[,;]/)
                .some((address) => officialHost(address.split("@").at(-1) || ""))
        );
    } catch {
        return false;
    }
}
