const STORAGE_KEY = "sejong-v4:favorites";
const CHANGE_EVENT = "sejong-favorites";
const EMPTY: readonly string[] = Object.freeze([]);
let snapshot: readonly string[] = EMPTY;
let serialized: string | null | undefined;
let sessionOnly = false;

// [손상된 저장값의 복구 / Recover malformed persisted favorites]
export function parseFavorites(raw: string | null): readonly string[] {
    try {
        const value: unknown = JSON.parse(raw || "[]");
        if (!Array.isArray(value)) return EMPTY;
        const ids = [...new Set(value.filter((id): id is string => typeof id === "string").map(id => id.trim()).filter(Boolean))];
        return ids.length ? ids : EMPTY;
    } catch { return EMPTY; }
}
export const serverFavorites = () => EMPTY;
export function getFavoriteIds(): readonly string[] {
    if (typeof window === "undefined") return EMPTY;
    if (sessionOnly) return snapshot;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== serialized) { serialized = raw; snapshot = parseFavorites(raw); }
    } catch { sessionOnly = true; }
    return snapshot;
}
export function subscribeFavorites(listener: () => void) {
    const storage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY || event.key === null) listener();
    };
    window.addEventListener(CHANGE_EVENT, listener);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener(CHANGE_EVENT, listener); window.removeEventListener("storage", storage); };
}
// [카드·목록·다른 탭의 같은 관심 상태 / One favorite state across cards, lists and tabs]
export function toggleFavorite(id: string) {
    const current = getFavoriteIds();
    const saved = !current.includes(id);
    snapshot = saved ? [...current, id] : current.filter(value => value !== id);
    serialized = JSON.stringify(snapshot);
    try { localStorage.setItem(STORAGE_KEY, serialized); } catch { sessionOnly = true; }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return { saved, persisted: !sessionOnly };
}
