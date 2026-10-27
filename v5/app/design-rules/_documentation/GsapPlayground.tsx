"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useGSAP } from "../../../src/lib/gsap";
import { SystemButton, SystemField, SystemLink } from "../../../components/SystemPrimitives";
import SystemSurface from "../../../components/SystemSurface";
import CodeBlock from "./CodeBlock";
import { GSAP_EXAMPLES } from "./gsap-lab-data";
import type { GsapExampleId } from "./gsap-lab-data";
import { createGsapLab } from "./gsap-lab-runtime";
import type { LabController } from "./gsap-lab-runtime";
import "./gsap-playground.css";

function StageContent({ example, progress, onKeyboard }: { example: GsapExampleId; progress: number; onKeyboard: (event: KeyboardEvent<HTMLElement>) => void }) {
    if (example === "draw" || example === "motion-path") return <svg className="gsap-lab__svg" viewBox="0 0 360 220" aria-hidden="true"><path data-lab-path d="M24 156 C80 12 119 20 174 110 S274 210 336 54" />{example === "motion-path" && <circle data-lab-target r="9" cx="24" cy="156" />}</svg>;
    if (example === "morph") return <svg className="gsap-lab__svg" viewBox="0 0 360 220" aria-hidden="true"><path data-lab-path className="gsap-lab__morph" d="M180 35 C225 35 265 70 265 110 C265 155 225 190 180 190 C135 190 95 155 95 110 C95 70 135 35 180 35 Z" /></svg>;
    if (example === "split") return <p data-text="heading" data-lab-text className="gsap-lab__text">광화문에서 만나는<br />우리의 다음 장면</p>;
    if (example === "scramble") return <><p data-text="heading" data-lab-text className="gsap-lab__text" aria-hidden="true">세종문화회관</p><p data-text="body" className="gsap-lab__accessible-copy">완성 문구: 예술이 일상이 되는 곳</p></>;
    if (example === "flip") return <div data-lab-flip className="gsap-lab__tiles" aria-hidden="true">{["공연", "전시", "교육"].map((label, i) => <div key={label} data-lab-tile data-flip-id={`gsap-lab-${i}`}><span data-text="body">{label}</span></div>)}</div>;
    if (example === "scroll") return <div data-lab-scroller className="gsap-lab__scroller" tabIndex={0} role="region" aria-label="예제 안의 스크롤 영역"><div data-lab-scroll-content><p data-text="body">이 영역을 아래로 스크롤하세요</p><div className="gsap-lab__scroll-marker" aria-hidden="true"><span data-lab-target /></div><p data-text="body">같은 위치에 같은 장면이 연결됩니다.</p></div></div>;
    if (example === "drag") return <><div className="gsap-lab__rail" aria-hidden="true" /><div data-lab-target className="gsap-lab__dot gsap-lab__drag" role="slider" tabIndex={0} aria-label="드래그 위치" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-valuetext={`${Math.round(progress * 100)}%`} onKeyDown={onKeyboard}><span data-text="body" aria-hidden="true">↔</span></div></>;
    if (example === "observer") return <div className="gsap-lab__gesture" tabIndex={0} role="group" aria-label="제스처 반응 영역" onKeyDown={onKeyboard}><p data-text="body">여기에서 휠·드래그·방향키</p><span data-lab-target className="gsap-lab__dot" aria-hidden="true" /></div>;
    if (example === "physics") return <div data-lab-target className="gsap-lab__dot gsap-lab__physics" aria-hidden="true" />;
    return <div className="gsap-lab__lanes" aria-hidden="true">{(example === "easing" ? ["선형", "맞춤", "탄성"] : ["1", "2", "3"]).map(label => <div key={label}><span data-lab-target className="gsap-lab__dot"><span data-text="body">{label}</span></span></div>)}</div>;
}

/** Guide-only experiments. Nothing starts automatically; only one example owns animation objects. */
export default function GsapPlayground() {
    const [example, setExample] = useState<GsapExampleId>("timeline");
    const [progress, setProgress] = useState(0);
    const [playback, setPlayback] = useState("준비");
    const [reduced, setReduced] = useState(false);
    const [width, setWidth] = useState(0);
    const [copied, setCopied] = useState(false);
    const [copyMessage, setCopyMessage] = useState("");
    const root = useRef<HTMLDivElement>(null);
    const stage = useRef<HTMLDivElement>(null);
    const controller = useRef<LabController | null>(null);
    const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const copyRequest = useRef(0);
    const id = useId();
    const selected = GSAP_EXAMPLES.find(item => item.id === example)!;

    useEffect(() => {
        const media = matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduced(media.matches);
        const suspend = () => { if (document.hidden) { controller.current?.pause(); setPlayback("일시정지"); } };
        update(); media.addEventListener("change", update); document.addEventListener("visibilitychange", suspend);
        return () => { media.removeEventListener("change", update); document.removeEventListener("visibilitychange", suspend); if (copyTimer.current) clearTimeout(copyTimer.current); copyRequest.current++; };
    }, []);
    useEffect(() => {
        if (!stage.current) return;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
        observer.observe(stage.current);
        return () => observer.disconnect();
    }, [example]);
    useGSAP(() => {
        if (!stage.current) return;
        setProgress(0); setPlayback("준비");
        const owned = createGsapLab(stage.current, example, reduced, setProgress, () => setPlayback("완료"), () => setPlayback("일시정지"));
        controller.current = owned;
        return () => { controller.current = null; owned.cleanup(); };
    }, { scope: root, dependencies: [example, reduced, width], revertOnUpdate: true });

    function seek(value: number) { controller.current?.seek(value); setProgress(value); setPlayback("일시정지"); }
    function onKeyboard(event: KeyboardEvent<HTMLElement>) {
        let next: number | undefined;
        if (["ArrowRight", "ArrowUp"].includes(event.key)) next = Math.min(1, progress + .1);
        if (["ArrowLeft", "ArrowDown"].includes(event.key)) next = Math.max(0, progress - .1);
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = 1;
        if (next !== undefined) { event.preventDefault(); seek(next); }
    }
    async function copy() {
        const request = ++copyRequest.current;
        try {
            await navigator.clipboard.writeText(selected.code);
            if (request !== copyRequest.current || !root.current) return;
            setCopied(true); setCopyMessage("핵심 코드를 복사했습니다.");
            if (copyTimer.current) clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopied(false), 1600);
        } catch { if (request === copyRequest.current && root.current) { setCopied(false); setCopyMessage("복사 권한을 확인하거나 코드에서 직접 선택해 복사해 주세요."); } }
    }
    return <div ref={root} data-gsap-playground data-documentation-tool="gsap-playground" className="gsap-lab">
        <p data-text="body">GSAP 3.15.0 · React 연동 2.1.2. 같은 엔진으로 서로 다른 조작과 장면을 만듭니다. 예제를 고르고 직접 재생하거나 진행률을 움직여 보세요.</p>
        <SystemField as="select" id={`${id}-example`} label="GSAP 예제" value={example} onChange={event => { setExample(event.currentTarget.value as GsapExampleId); setCopied(false); setCopyMessage(""); copyRequest.current++; }}>
            {GSAP_EXAMPLES.map((item, index) => <option data-text="body" key={item.id} value={item.id}>{index + 1}. {item.label}</option>)}
        </SystemField>
        <SystemSurface variant="subtle" padding="lg" className="gsap-lab__specimen" data-gsap-example={example}>
            <div className="gsap-lab__heading"><h3 data-text="subheading">{selected.label}</h3><span data-text="meta">{selected.api}</span></div>
            <p data-text="body">{selected.description}</p>
            <div key={example} ref={stage} data-gsap-stage className={`gsap-lab__stage gsap-lab__stage--${example}`}>
                <StageContent example={example} progress={progress} onKeyboard={onKeyboard} />
            </div>
            <div className="gsap-lab__actions">
                <SystemButton disabled={reduced} onClick={() => { controller.current?.play(); setPlayback("재생 중"); }}>재생</SystemButton>
                <SystemButton variant="secondary" onClick={() => { controller.current?.pause(); setPlayback("일시정지"); }}>일시정지</SystemButton>
                <SystemButton variant="quiet" disabled={reduced} onClick={() => { controller.current?.restart(); setPlayback("재생 중"); }}>다시 시작</SystemButton>
            </div>
            <SystemField id={`${id}-progress`} label={<>예제 진행률 <output data-text="meta" htmlFor={`${id}-progress`}>{Math.round(progress * 100)}%</output></>} aria-label="예제 진행률" type="range" min={0} max={100} step={1} value={Math.round(progress * 100)} onChange={event => seek(Number(event.currentTarget.value) / 100)} />
            {example === "observer" && <div className="gsap-lab__actions"><SystemButton variant="secondary" onClick={() => seek(Math.max(0, progress - .1))}>이전 반응</SystemButton><SystemButton variant="secondary" onClick={() => seek(Math.min(1, progress + .1))}>다음 반응</SystemButton></div>}
            <p data-text="body" role="status">{reduced ? "모션 감소 설정 중입니다. 진행률과 직접 조작으로 장면을 확인할 수 있습니다." : `현재 상태: ${playback}`}</p>
            <p data-text="body">제품 연결: {selected.use}</p>
            <SystemLink href={selected.href} target="_blank" rel="noreferrer" variant="quiet">공식 API 설명 보기</SystemLink>
        </SystemSurface>
        <CodeBlock title={`${selected.api} · 핵심 코드`} code={selected.code} onCopy={() => void copy()} copied={copied} />
        {copyMessage && <p data-text="body" role="status">{copyMessage}</p>}
        <p data-text="body">제품에서는 useGSAP의 scope·revertOnUpdate와 matchMedia로 수명을 관리합니다. 입력·가격·긴 본문은 이동하지 않고, JavaScript가 없어도 원문을 읽을 수 있게 둡니다.</p>
        <div className="gsap-lab__sources"><SystemLink href="https://github.com/greensock/GSAP" target="_blank" variant="quiet">GSAP 소스</SystemLink><SystemLink href="https://github.com/greensock/react" target="_blank" variant="quiet">React 연동</SystemLink><SystemLink href="https://gsap.com/standard-license/" target="_blank" variant="quiet">Standard No Charge 라이선스</SystemLink></div>
    </div>;
}
