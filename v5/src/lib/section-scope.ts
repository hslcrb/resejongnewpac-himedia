/** The five public navigation families; transaction and account screens keep their own lifecycle. */
export function getSectionGroup(pathname: string): string | null {
    const path = pathname.replace(/^\/v5(?=\/|$)/, "").replace(/\/$/, "");
    return /^\/(programs|rental|visit|news|about)(?:\/|$)/.exec(path)?.[1] || null;
}
