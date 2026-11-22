"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { SystemFilterButton } from "../SystemPrimitives";

const panels = [
    { id: "layers", label: "레이어" },
    { id: "canvas", label: "캔버스" },
    { id: "inspector", label: "속성" },
] as const;

export function StudioWorkspace({ layers, canvas, inspector }: { layers: ReactNode; canvas: ReactNode; inspector: ReactNode }) {
    const [panel, setPanel] = useState<(typeof panels)[number]["id"]>("canvas");
    return (
        <>
            <nav className="cms-studio-panel-switch" aria-label="스튜디오 패널">
                {panels.map(item => <SystemFilterButton key={item.id} selected={panel === item.id}
                    aria-controls={"cms-studio-" + item.id} onClick={() => setPanel(item.id)}>{item.label}</SystemFilterButton>)}
            </nav>
            <div className="cms-visual-workspace" data-panel={panel}>
                <aside data-text="body" id="cms-studio-layers" className="cms-visual-left" aria-label="컴포넌트와 레이어">{layers}</aside>
                <section data-text="body" id="cms-studio-canvas" className="cms-visual-center" aria-label="실제 사이트 편집 캔버스">{canvas}</section>
                <aside data-text="body" id="cms-studio-inspector" className="cms-visual-right" aria-label="선택 요소 속성">{inspector}</aside>
            </div>
        </>
    );
}
