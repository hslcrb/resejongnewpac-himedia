"use client";

import CmsVisualDesigner from "../../components/CmsVisualDesigner";
import { useCmsAdminSession } from "../../src/cms/admin-session.ts";

// [관리자 = 피그마형 캔버스 / Admin is the Figma-like canvas]
// 접속 즉시 전체 화면 3단 캔버스가 열립니다. 세션이 없으면 브라우저 샌드박스 모드로 편집하고,
// 관리자 로그인 시 DB 저장·발행이 열립니다.
export default function AdminCmsWorkspacePage() {
    const session = useCmsAdminSession();
    return (
        <CmsVisualDesigner
            userId={session.userId}
            access={session.access}
            accessHandle={session.handle}
            accessMessage={session.message}
        />
    );
}
