import { useEffect, useState } from "react";
import { CMS_ADMIN_RPC } from "./cms-tables.ts";
import { verifySupabaseUserAsAdmin } from "./auth.ts";
import type { CmsAdminRole, CmsCapability } from "./contracts.ts";
import { supabase } from "../lib/supabase.ts";

// [피그마형 CMS 접속 상태 / Figma-like CMS access state]
// 캔버스는 세션과 무관하게 항상 열립니다. 세션은 "DB 초안 저장·발행 권한"만 결정하며,
// 로그인이 없으면 브라우저 샌드박스 모드로 편집·미리보기를 그대로 이어갑니다.
export type CmsAdminAccess = "checking" | "admin" | "guest" | "offline";

export interface CmsAdminSessionState {
    access: CmsAdminAccess;
    userId: string;
    handle: string;
    message: string;
}

const CHECKING: CmsAdminSessionState = {
    access: "checking",
    userId: "",
    handle: "",
    message: "관리자 세션을 확인하는 중입니다. 캔버스는 이미 편집할 수 있습니다.",
};

// 서버 RLS가 실제 관리자로 판정하는지까지 확인합니다. 클라이언트 판정만으로는 통과시키지 않습니다.
export function useCmsAdminSession(): CmsAdminSessionState {
    const [state, setState] = useState<CmsAdminSessionState>(CHECKING);

    useEffect(() => {
        let alive = true;
        const verify = async () => {
            if (!supabase) {
                if (alive) {
                    setState({
                        access: "offline",
                        userId: "",
                        handle: "",
                        message:
                            "DB 연결 설정이 없어 브라우저 샌드박스 모드로 실행합니다. 편집·미리보기는 그대로 동작하며 DB 저장만 비활성입니다.",
                    });
                }
                return;
            }
            try {
                const { data: auth } = await supabase.auth.getUser();
                if (!auth.user) {
                    if (alive) {
                        setState({
                            access: "guest",
                            userId: "",
                            handle: "",
                            message:
                                "로그인 없이 브라우저 샌드박스 모드로 실행합니다. 편집 내용은 이 브라우저에만 보관되고, DB 저장·발행은 관리자 Google 로그인 후 가능합니다.",
                        });
                    }
                    return;
                }
                const { data: member } = await supabase
                    .from("sejong_cms_memberships")
                    .select(
                        "user_id, provider, google_subject, account_handle, verified_email, role, capabilities, active, revoked_at",
                    )
                    .eq("user_id", auth.user.id)
                    .maybeSingle();
                const decision = verifySupabaseUserAsAdmin(auth.user, {
                    membership: member
                        ? {
                              userId: String(member.user_id),
                              provider: String(member.provider),
                              googleSubject: String(member.google_subject),
                              accountHandle: String(member.account_handle),
                              verifiedEmail: String(member.verified_email),
                              role: member.role as CmsAdminRole,
                              capabilities: Array.isArray(member.capabilities)
                                  ? (member.capabilities as CmsCapability[])
                                  : [],
                              active: member.active === true,
                              revokedAt: member.revoked_at ? String(member.revoked_at) : null,
                          }
                        : null,
                });
                if (!decision.isAdmin || decision.statusCode !== 200) {
                    if (alive) {
                        setState({
                            access: "guest",
                            userId: "",
                            handle: decision.accountHandle || "",
                            message:
                                "로그인한 계정은 아직 CMS 관리자 멤버십이 없습니다. 브라우저 샌드박스 모드로 편집하고, DB 저장은 승인된 관리자 계정으로 로그인한 뒤 진행하세요.",
                        });
                    }
                    return;
                }
                const { data: permitted, error } = await supabase.rpc(CMS_ADMIN_RPC, {
                    p_user_id: auth.user.id,
                });
                if (error || permitted !== true) {
                    if (alive) {
                        setState({
                            access: "guest",
                            userId: "",
                            handle: decision.accountHandle || "",
                            message:
                                "서버의 활성 CMS 관리자 검증에 실패해 DB 저장 권한이 없습니다. 브라우저 샌드박스 모드로 계속 편집할 수 있습니다.",
                        });
                    }
                    return;
                }
                if (alive) {
                    setState({
                        access: "admin",
                        userId: auth.user.id,
                        handle: decision.accountHandle || "",
                        message:
                            "관리자 세션이 확인되었습니다. DB 초안 저장과 발행 리비전 확정을 사용할 수 있습니다.",
                    });
                }
            } catch (error) {
                if (alive) {
                    setState({
                        access: "offline",
                        userId: "",
                        handle: "",
                        message:
                            "관리자 세션을 확인하지 못했습니다(" +
                            (error instanceof Error ? error.message : String(error)) +
                            "). 브라우저 샌드박스 모드로 편집을 계속할 수 있습니다.",
                    });
                }
            }
        };
        void verify();
        return () => {
            alive = false;
        };
    }, []);

    return state;
}
