"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { CatalogSnapshot } from "./types.ts";
import { CATALOG_SNAPSHOT } from "./snapshot.ts";
import { createCatalogRepository } from "./repository.ts";
import { limitCatalogToExport } from "./static-routes.ts";
const catalogRepository = createCatalogRepository(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);
type CatalogState = {
    catalog: CatalogSnapshot;
    error: string;
    loading: boolean;
    refresh: () => Promise<void>;
};
const CatalogContext = createContext<CatalogState>({
    catalog: CATALOG_SNAPSHOT,
    error: "",
    loading: false,
    refresh: async () => {},
});
export function CatalogProvider({ children }: { children: React.ReactNode }) {
    const [catalog, setCatalog] = useState(CATALOG_SNAPSHOT);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const next = await catalogRepository.loadPublishedCatalog();
            // Static exports can refresh existing routes; newly published IDs need a rebuild.
            setCatalog(limitCatalogToExport(next, CATALOG_SNAPSHOT));
            setError("");
        } catch {
            setError("최신 콘텐츠를 불러오지 못했습니다. 마지막 게시 내용을 표시합니다.");
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void refresh();
    }, [refresh]);
    return (
        <CatalogContext.Provider value={{ catalog, error, loading, refresh }}>
            {children}
        </CatalogContext.Provider>
    );
}
export function useCatalog() {
    return useContext(CatalogContext);
}
