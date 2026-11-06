const groups = ["programs", "rental", "visit", "news", "about"] as const;
export function editorialGroup(pathname: string): (typeof groups)[number] | null {
    const route = pathname.replace(/^\/v5(?=\/|$)/, "").replace(/\/+$/, "") || "/";
    return groups.find((group) => route === `/${group}` || route.startsWith(`/${group}/`)) ?? null;
}
