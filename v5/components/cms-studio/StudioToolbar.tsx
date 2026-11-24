"use client";

import { SystemButton, SystemField, SystemFilterButton } from "../SystemPrimitives";
import { STUDIO_ARTBOARDS, STUDIO_ZOOMS } from "../../src/cms/studio-artboard.ts";
import type { StudioZoom } from "../../src/cms/studio-artboard.ts";
import type { CmsPageViewport } from "../../src/cms/page-tree.ts";

export type StudioMode = "select" | "move" | "text" | "preview";
type Props = {
    mode: StudioMode; viewport: CmsPageViewport; zoom: StudioZoom; path: string; manualPath: string;
    original: boolean; routes: readonly string[];
    onMode: (mode: StudioMode) => void; onViewport: (viewport: CmsPageViewport) => void;
    onZoom: (zoom: StudioZoom) => void; onPathInput: (path: string) => void;
    onNavigate: (path: string) => void; onOriginal: (show: boolean) => void;
};

const tools = [
    { id: "select", label: "선택", key: "V" },
    { id: "move", label: "이동", key: "M" },
    { id: "text", label: "텍스트", key: "T" },
    { id: "preview", label: "미리보기", key: "P" },
] as const;

export function StudioToolbar(props: Props) {
    return (
        <section className="cms-visual-navigation cms-studio-toolbar" aria-label="아트보드와 도구">
            <div className="cms-studio-page">
                <SystemField label="페이지 선택" labelHidden as="select" value={props.path} onChange={(e) => props.onNavigate(e.target.value)}>
                    {props.routes.map(route => <option key={route} value={route} data-text="body">{route}</option>)}
                </SystemField>
                <details className="cms-studio-path">
                    <summary data-text="action">경로 직접 열기</summary>
                    <form className="cms-visual-route-input" onSubmit={e => { e.preventDefault(); props.onNavigate(props.manualPath); }}>
                        <SystemField label="공개 페이지 경로" value={props.manualPath} onChange={e => props.onPathInput(e.target.value)} />
                        <SystemButton variant="secondary" type="submit">열기</SystemButton>
                    </form>
                </details>
            </div>
            <div className="cms-visual-tool-group" role="group" aria-label="캔버스 도구">
                {tools.map(tool => <SystemFilterButton key={tool.id} selected={props.mode === tool.id}
                    aria-keyshortcuts={tool.key} title={tool.label + " (" + tool.key + ")"}
                    onClick={() => props.onMode(tool.id)}>{tool.label}</SystemFilterButton>)}
            </div>
            <div className="cms-visual-tool-group" role="group" aria-label="아트보드 표시">
                <SystemField label="기기 너비" labelHidden as="select" value={props.viewport}
                    onChange={e => {
                        const requested = e.target.value;
                        if (requested === "desktop" || requested === "tablet" || requested === "mobile") props.onViewport(requested);
                    }}>
                    {Object.entries(STUDIO_ARTBOARDS).map(([id, board]) =>
                        <option key={id} value={id} data-text="body">{board.label} · {board.width}px</option>)}
                </SystemField>
                <SystemField label="캔버스 확대" labelHidden as="select" value={String(props.zoom)}
                    onChange={e => {
                        const zoom = STUDIO_ZOOMS.find(value => String(value) === e.target.value);
                        if (zoom != null) props.onZoom(zoom);
                    }}>
                    {STUDIO_ZOOMS.map(zoom => <option key={zoom} value={String(zoom)} data-text="body">{zoom === "fit" ? "화면 맞춤" : zoom + "%"}</option>)}
                </SystemField>
                <SystemFilterButton selected={props.original} onClick={() => props.onOriginal(!props.original)}>원본 비교</SystemFilterButton>
            </div>
        </section>
    );
}
