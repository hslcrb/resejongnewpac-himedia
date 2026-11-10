"use client";

import { useEffect, useState } from "react";
import CmsVisualDesigner from "../../../components/CmsVisualDesigner";
import { SystemLink, SystemNotice } from "../../../components/SystemPrimitives";
import { verifySupabaseUserAsAdmin } from "../../../src/cms/auth.ts";
import { supabase } from "../../../src/lib/supabase.ts";
import type { CmsAdminRole, CmsCapability } from "../../../src/cms/contracts.ts";

export default function CmsVisualDesignerPage() {
    const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");
    const [userId, setUserId] = useState("");
    const [detail, setDetail] = useState("");
    useEffect(() => {
        let alive = true;
        const verify = async () => {
            if (!supabase) {
                if (alive) { setStatus("denied"); setDetail("Supabase 인증이 구성되지 않았습니다."); }
                return;
            }
            try {
                const { data: auth, error: authError } = await supabase.auth.getUser();
                if (authError || !auth.user) throw new Error("로그인된 Google 계정이 없습니다.");
                const { data: member, error: memberError } = await supabase
                    .from("sejong_cms_memberships")
                    .select("user_id, provider, google_subject, account_handle, verified_email, role, capabilities, active, revoked_at")
                    .eq("user_id", auth.user.id).maybeSingle();
                if (memberError || !member) throw new Error("CMS 서버에 승인된 관리자 멤버십이 없습니다.");
                const decision = verifySupabaseUserAsAdmin(auth.user, {
                    membership: {
                        userId: String(member.user_id),
                        provider: String(member.provider),
                        googleSubject: String(member.google_subject),
                        accountHandle: String(member.account_handle),
                        verifiedEmail: String(member.verified_email),
                        role: member.role as CmsAdminRole,
                        capabilities: Array.isArray(member.capabilities) ? member.capabilities as CmsCapability[] : [],
                        active: member.active === true,
                        revokedAt: member.revoked_at ? String(member.revoked_at) : null,
                    },
                });
                if (!decision.isAdmin || decision.statusCode !== 200 ||
                    !decision.capabilities.includes("cms:write_draft")) {
                    throw new Error(decision.message || "편집 권한이 없습니다.");
                }
                // 클라이언트 판정만으로 인증을 통과하지 않으며 DB/RLS의 활성 관리자 판정도 확인합니다.
                const { data: permitted, error: permissionError } = await supabase
                    .rpc("sejong_cms_is_active_admin", { p_user_id: auth.user.id });
                if (permissionError || permitted !== true) throw new Error("서버의 활성 CMS 관리자 검증에 실패했습니다.");
                if (alive) {
                    setUserId(auth.user.id);
                    setStatus("allowed");
                }
            } catch (error) {
                if (alive) {
                    setDetail(error instanceof Error ? error.message : String(error));
                    setStatus("denied");
                }
            }
        };
        void verify();
        return () => { alive = false; };
    }, []);

    if (status !== "allowed") {
        return (
            <main className="cms-visual-auth-gate" data-text="body">
                <h1 data-text="title">SEJONG / VISUAL STUDIO</h1>
                {status === "loading"
                    ? <p data-text="body">관리자 Google 세션과 Supabase 멤버십을 검증하고 있습니다.</p>
                    : <SystemNotice error title="편집 권한 확인 필요">{detail}</SystemNotice>}
                <div className="cms-visual-auth-links">
                    <SystemLink href="/login" variant="primary">Google 로그인</SystemLink>
                    <SystemLink href="/admin" variant="secondary">CMS 대시보드</SystemLink>
                </div>
            </main>
        );
    }
    return <CmsVisualDesigner userId={userId} />;
}
