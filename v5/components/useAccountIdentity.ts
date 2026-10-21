"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveAccountIdentity, supabase } from "../src/lib/supabase.ts";
import type { AccountIdentitySnapshot } from "../src/lib/supabase.ts";
import type { UserProfile } from "../types/sejong.ts";
import type { User } from "@supabase/supabase-js";

// [공유 체험 로그아웃과 SDK 변경 순서 / Shared demo logout and SDK mutation ordering]
// These browser-memory boundaries survive Header/page unmounts without trusting a failed write.
let demoLogoutSuppressed = false;
let pendingAccountMutation: Promise<unknown> = Promise.resolve();

export function readAccountIdentity(user: User | null, storage: Pick<Storage, "getItem"> | null) {
    return resolveAccountIdentity(user, demoLogoutSuppressed ? null : storage);
}

export function clearDemoSession(storage: Pick<Storage, "setItem"> | null): boolean {
    demoLogoutSuppressed = true;
    try {
        if (!storage) return false;
        storage.setItem("sejong-v4:session", JSON.stringify({ active: false }));
        return true;
    } catch { return false; }
}

export function activateDemoSession(storage: Pick<Storage, "getItem"> | null): boolean {
    if (resolveAccountIdentity(null, storage).mode !== "demo") return false;
    demoLogoutSuppressed = false;
    return true;
}

export function queueAccountMutation<T>(run: () => Promise<T>): Promise<T> {
    const result = pendingAccountMutation.then(run, run);
    pendingAccountMutation = result.then(() => undefined, () => undefined);
    return result;
}

// [실제 세션과 기존 체험 계정 구독 / Subscribe to real sessions and existing demo accounts]
function browserStorage(): Storage | null {
    try { return window.localStorage; } catch { return null; }
}

export default function useAccountIdentity() {
    const [identity, setIdentity] = useState<AccountIdentitySnapshot>({ ...resolveAccountIdentity(null, null), mode: "loading", ready: false });
    const currentUser = useRef<User | null>(null);
    const identityRevision = useRef(0);

    const applyUser = useCallback((user: User | null) => {
        if (currentUser.current?.id !== user?.id) identityRevision.current += 1;
        currentUser.current = user;
        setIdentity(readAccountIdentity(user, browserStorage()));
    }, []);

    useEffect(() => {
        let mounted = true;
        let revision = 0;
        const refreshLocal = (event: Event) => {
            const explicitDemoSignIn = (event as CustomEvent<{ action?: string }>).detail?.action === "demo-sign-in";
            const storageEvent = event as StorageEvent;
            const demoSignInInOtherTab = event.type === "storage" && storageEvent.key === "sejong-v4:session" && storageEvent.newValue === JSON.stringify({ active: true });
            if (explicitDemoSignIn || demoSignInInOtherTab) activateDemoSession(browserStorage());
            if (mounted) applyUser(currentUser.current);
        };
        window.addEventListener("storage", refreshLocal);
        window.addEventListener("sejong:account-identity", refreshLocal);
        const { data } = supabase?.auth.onAuthStateChange((event, session) => {
            revision += 1;
            // A late metadata response must not replace an identity changed elsewhere.
            if (event === "USER_UPDATED" && session?.user.id !== currentUser.current?.id) return;
            if (event === "SIGNED_OUT") clearDemoSession(browserStorage());
            if (mounted) applyUser(session?.user || null);
        }) || { data: null };
        if (supabase) {
            const startedAtRevision = revision;
            void supabase.auth.getSession().then(({ data: sessionData, error }) => {
                if (mounted && revision === startedAtRevision) applyUser(error ? null : sessionData.session?.user || null);
            }).catch(() => { if (mounted && revision === startedAtRevision) applyUser(null); });
        } else applyUser(null);
        return () => {
            mounted = false;
            data?.subscription.unsubscribe();
            window.removeEventListener("storage", refreshLocal);
            window.removeEventListener("sejong:account-identity", refreshLocal);
        };
    }, [applyUser]);

    // [프로필 저장과 실제 로그아웃 / Profile persistence and real sign-out]
    const logout = useCallback(async () => {
        const requestedUserId = currentUser.current?.id;
        identityRevision.current += 1;
        return queueAccountMutation(async () => {
            if (currentUser.current?.id && currentUser.current.id !== requestedUserId) throw new Error("계정이 변경되었습니다. 현재 계정에서 다시 로그아웃해 주세요.");
            if (currentUser.current && supabase) {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
            }
            const persisted = clearDemoSession(browserStorage());
            applyUser(null);
            window.dispatchEvent(new Event("sejong:account-identity"));
            if (!persisted) throw new Error("로그아웃했습니다. 브라우저 저장소에 반영하지 못해 새로고침하면 체험 계정이 다시 표시될 수 있습니다.");
        });
    }, [applyUser]);

    const updateProfile = useCallback(async (profile: UserProfile) => {
        const next = { name: profile.name.trim(), email: profile.email.trim(), phone: profile.phone.trim() };
        if (!next.name || !next.email.includes("@")) throw new Error("이름과 이메일을 확인해 주세요.");
        const initiatingUserId = currentUser.current?.id;
        const initiatingRevision = identityRevision.current;
        return queueAccountMutation(async () => {
            const identityChanged = () => identityRevision.current !== initiatingRevision || currentUser.current?.id !== initiatingUserId;
            if (identityChanged()) throw new Error("로그인 상태가 변경되어 프로필 저장을 취소했습니다.");
            if (currentUser.current && supabase) {
                if (next.email !== currentUser.current.email) throw new Error("Google 로그인 이메일은 Google 계정에서 변경해 주세요.");
                const { data, error } = await supabase.auth.updateUser({ data: { full_name: next.name, name: next.name, phone: next.phone } });
                if (error) throw error;
                if (identityChanged()) throw new Error("로그인 상태가 변경되어 프로필 저장 결과를 적용하지 않았습니다.");
                if (!data.user) throw new Error("프로필을 저장하지 못했습니다. 다시 로그인해 주세요.");
                applyUser(data.user);
            } else {
                const previous = readAccountIdentity(null, browserStorage());
                if (previous.mode !== "demo") throw new Error("프로필을 수정하려면 먼저 로그인해 주세요.");
                const storage = browserStorage();
                if (!storage) throw new Error("브라우저 저장소를 사용할 수 없습니다.");
                storage.setItem("sejong-v4:profile", JSON.stringify({ ...next, localId: previous.identityId.slice("demo:".length) }));
                applyUser(null);
            }
            window.dispatchEvent(new Event("sejong:account-identity"));
        });
    }, [applyUser]);

    return { ...identity, logout, updateProfile };
}
