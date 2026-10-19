import { createClient } from "@supabase/supabase-js";

// 환경변수에서 Supabase 설정값 취득
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== "https://your-project-id.supabase.co"
);

// Supabase 클라이언트 싱글톤 인스턴스 (설정값이 있을 때만 활성화)
export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
          },
      })
    : null;

/**
 * Google OAuth 로그인 실행
 * @param {string} redirectTo 로그인 완료 후 복귀할 URL
 */
export async function signInWithGoogle(redirectTo) {
    if (!supabase) {
        throw new Error("Supabase 환경 변수가 설정되지 않았습니다. .env.local을 확인해 주세요.");
    }

    const targetUrl = redirectTo || (typeof window !== "undefined" ? window.location.href : "");
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: targetUrl,
            queryParams: {
                access_type: "offline",
                prompt: "consent",
            },
        },
    });

    if (error) throw error;
    return data;
}

/**
 * 로그아웃
 */
export async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Supabase 로그아웃 오류:", error);
}

/**
 * 현재 로그인된 사용자 정보 취득
 */
export async function getCurrentUser() {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/**
 * 인증 상태 변경 리스너
 */
export function onAuthStateChange(callback) {
    if (!supabase) return () => {};
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
    return () => subscription.unsubscribe();
}
