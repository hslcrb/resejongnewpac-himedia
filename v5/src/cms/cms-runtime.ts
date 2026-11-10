// [CMS 런타임 구성 / CMS runtime composition]
// 서버 전용 모듈입니다(process.env). Route Handler·Node 서버가 같은 저장소·에지 설정을 공유합니다.
import { createClient } from "@supabase/supabase-js";
import type { CmsStore } from "./cms-store.ts";
import { createMemoryCmsStore } from "./cms-store.ts";
import type { CmsEdgeConfig } from "./cloudflare-edge-adapter.ts";
import { createSupabaseCmsStore } from "./supabase-cms-adapter.ts";

export interface CmsEnv {
    supabaseUrl?: string;
    anonKey?: string;
    mcpAccessToken?: string;
    siteBaseUrl: string;
    cloudflare: {
        zoneId?: string;
        apiToken?: string;
        accountId?: string;
        kvNamespaceId?: string;
    };
}

// Supabase 미설정 시에는 세션 메모리 저장소를 쓰며, 응답의 store 필드로 항상 구분합니다.
const sessionStore = createMemoryCmsStore();

export function readCmsEnv(env: NodeJS.ProcessEnv = process.env): CmsEnv {
    return {
        supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || undefined,
        anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || undefined,
        mcpAccessToken: env.CMS_MCP_ACCESS_TOKEN || undefined,
        siteBaseUrl: (env.CMS_SITE_BASE_URL || "https://renewsejongpac.rhee.life").replace(/\/$/, ""),
        cloudflare: {
            zoneId: env.CLOUDFLARE_ZONE_ID || undefined,
            apiToken: env.CLOUDFLARE_API_TOKEN || undefined,
            accountId: env.CLOUDFLARE_ACCOUNT_ID || undefined,
            kvNamespaceId: env.CLOUDFLARE_KV_NAMESPACE_ID || undefined,
        },
    };
}

export function createCmsStore(
    env: CmsEnv,
    accessToken: string | null,
): { store: CmsStore; kind: "supabase" | "memory"; reason: string } {
    if (!env.supabaseUrl || !env.anonKey) {
        return {
            store: sessionStore,
            kind: "memory",
            reason: "Supabase 환경 변수가 없어 세션 메모리 저장소를 사용합니다(영구 저장 아님).",
        };
    }
    const client = createClient(env.supabaseUrl, env.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
    });
    return {
        store: createSupabaseCmsStore(client as unknown as Parameters<typeof createSupabaseCmsStore>[0]),
        kind: "supabase",
        reason: "Supabase PostgreSQL 저장소(RLS 활성 관리자 세션)를 사용합니다.",
    };
}

export function cmsEdgeConfig(env: CmsEnv): CmsEdgeConfig | undefined {
    if (!env.cloudflare.zoneId && !env.cloudflare.kvNamespaceId) return undefined;
    return {
        baseUrl: env.siteBaseUrl,
        zoneId: env.cloudflare.zoneId,
        apiToken: env.cloudflare.apiToken,
        accountId: env.cloudflare.accountId,
        kvNamespaceId: env.cloudflare.kvNamespaceId,
    };
}

export function cmsDesignerEnv(env: NodeJS.ProcessEnv = process.env): {
    allowedOrigin: string;
    requireCsrf: boolean;
} {
    return {
        allowedOrigin: (env.CMS_ALLOWED_ORIGIN || "").replace(/\/$/, ""),
        requireCsrf: env.CMS_REQUIRE_CSRF !== "false",
    };
}
