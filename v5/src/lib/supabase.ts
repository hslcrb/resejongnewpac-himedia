import { createClient, SupabaseClient, User, AuthChangeEvent, Session } from "@supabase/supabase-js";

// 환경변수에서 Supabase 설정값 취득
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== "https://your-project-id.supabase.co"
);

// Supabase 클라이언트 싱글톤 인스턴스 (설정값이 있을 때만 활성화)
export const supabase: SupabaseClient | null = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
          },
      })
    : null;

/**
 * 소셜 OAuth 로그인 실행 (Google, Kakao, GitHub 등 다중 프로바이더 지원)
 */
export async function signInWithOAuthProvider(
    provider: "google" | "kakao" | "github" = "google",
    redirectTo?: string
) {
    if (!supabase) {
        throw new Error("Supabase 환경 변수가 설정되지 않았습니다. .env.local을 확인해 주세요.");
    }

    const targetUrl = redirectTo || (typeof window !== "undefined" ? window.location.origin + "/v5/account" : "");
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: targetUrl,
            queryParams: provider === "google" ? {
                access_type: "offline",
                prompt: "consent",
            } : {},
        },
    });

    if (error) throw error;
    return data;
}

export async function signInWithGoogle(redirectTo?: string) {
    return signInWithOAuthProvider("google", redirectTo);
}

/**
 * 로그아웃
 */
export async function signOut(): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Supabase 로그아웃 오류:", error);
}

/**
 * 현재 로그인된 사용자 정보 취득
 */
export async function getCurrentUser(): Promise<User | null> {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/**
 * 인증 상태 변경 리스너
 */
export function onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void {
    if (!supabase) return () => {};
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
    return () => subscription.unsubscribe();
}

/**
 * 1. 프로필 정보 동기화 (profiles 테이블)
 */
export async function syncUserProfile(profileData: { name?: string; phone?: string }) {
    if (!supabase) return null;
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from("profiles")
        .upsert({
            id: user.id,
            email: user.email,
            name: profileData.name || "",
            phone: profileData.phone || "",
            updated_at: new Date().toISOString(),
        }, { onConflict: "id" })
        .select()
        .single();

    if (error) console.warn("Supabase 프로필 동기화 안내:", error.message);
    return data;
}

/**
 * 2. 예매 내역 저장 (bookings 테이블)
 */
export async function saveBookingToDb(booking: Record<string, any>) {
    if (!supabase) return null;
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from("bookings")
        .insert([{
            ...booking,
            user_id: user?.id || null,
            created_at: new Date().toISOString(),
        }])
        .select()
        .single();

    if (error) console.warn("Supabase 예매 저장 안내:", error.message);
    return data;
}

/**
 * 3. 관심 프로그램 (favorites 테이블) 동기화
 */
export async function syncFavoritesToDb(programIds: string[]) {
    if (!supabase) return null;
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from("favorites")
        .upsert({
            user_id: user.id,
            program_ids: programIds,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" })
        .select()
        .single();

    if (error) console.warn("Supabase 관심목록 동기화 안내:", error.message);
    return data;
}
