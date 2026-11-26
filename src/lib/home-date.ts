import { CATALOG_SNAPSHOT } from "../catalog/snapshot.ts";
import { seoulToday } from "../features/home-domain.ts";

// The static export and the first hydration render must agree, even across Seoul midnight.
// The published snapshot is shared by server and browser; the live clock takes over after hydration.
const publishedDate = seoulToday(new Date(CATALOG_SNAPSHOT.generatedAt));
export const getHomeServerDate = () => publishedDate;
export const getHomeLiveDate = () => seoulToday();

export function subscribeHomeDate(refresh: () => void): () => void {
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
        window.clearInterval(timer);
        document.removeEventListener("visibilitychange", refresh);
        window.removeEventListener("focus", refresh);
    };
}
