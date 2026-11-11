"use client";

import CmsVisualDesigner from "../../../components/CmsVisualDesigner";
import { useCmsAdminSession } from "../../../src/cms/admin-session.ts";

// [/admin/designer도 같은 캔버스 / The designer route opens the same canvas]
// 접속 즉시 전체 화면 캔버스. 세션이 없어도 편집·미리보기는 차단하지 않습니다.
export default function CmsVisualDesignerPage() {
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
