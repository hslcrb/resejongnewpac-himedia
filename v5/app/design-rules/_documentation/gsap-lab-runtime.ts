"use client";

import { gsap, ScrollTrigger, Flip } from "../../../src/lib/gsap";
import { CustomEase } from "gsap/CustomEase";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { SplitText } from "gsap/SplitText";
import { Draggable } from "gsap/Draggable";
import { Observer } from "gsap/Observer";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { Physics2DPlugin } from "gsap/Physics2DPlugin";
import type { GsapExampleId } from "./gsap-lab-data";

// Advanced plugins stay inside the guide's private route. Product modules do not import this file.
gsap.registerPlugin(CustomEase, MorphSVGPlugin, SplitText, Draggable, Observer, ScrambleTextPlugin, Physics2DPlugin);
const softEase = CustomEase.create("sejongLabEase", ".16,1,.3,1");
const STAR = "M180 28 L202 91 L269 92 L215 132 L235 196 L180 158 L125 196 L145 132 L91 92 L158 91 Z";

export type LabController = {
    play: () => void; pause: () => void; restart: () => void;
    seek: (progress: number) => void; nudge: (amount: number) => void; cleanup: () => void;
};

/** All tweens are paused until a person starts them; explicit seeking also works with reduced motion. */
export function createGsapLab(stage: HTMLElement, kind: GsapExampleId, reduced: boolean,
    report: (progress: number) => void, completed: () => void, stopped: () => void = () => {}): LabController {
    const placeholder = gsap.timeline({ paused: true });
    let animation: gsap.core.Animation = placeholder;
    let split: SplitText | undefined;
    let draggable: Draggable | undefined;
    let observer: Observer | undefined;
    let trigger: ScrollTrigger | undefined;
    let disposed = false;
    let playing = false;
    let lastReport = 0;
    const contextCleanup: (() => void)[] = [];
    const query = <T extends Element>(selector: string) => stage.querySelector<T>(selector)!;
    const targets = [...stage.querySelectorAll<HTMLElement>("[data-lab-target]")];
    const target = targets[0];
    const travel = Math.max(24, stage.clientWidth - 100);
    const text = stage.querySelector<HTMLElement>("[data-lab-text]");
    const originalText = text?.textContent || "";
    const flipParent = stage.querySelector<HTMLElement>("[data-lab-flip]");
    const initialTiles = flipParent ? [...flipParent.children] : [];
    const send = (force = false) => {
        if (disposed) return;
        const now = performance.now();
        if (force || now - lastReport > 70) { lastReport = now; report(animation.progress()); }
    };
    function seek(progress: number) {
        playing = false;
        animation.pause().progress(gsap.utils.clamp(0, 1, progress));
        if (kind === "scroll") ScrollTrigger.update();
        send(true); stopped();
    }
    function nudge(amount: number) { seek(animation.progress() + amount); }
    const context = gsap.context(() => {
        const timeline = () => gsap.timeline({ paused: true });
        if (kind === "timeline") {
            animation = timeline().fromTo(targets, { x: 0, scale: .8 }, { x: travel, scale: 1, rotation: 90, duration: 1.2, stagger: .2, ease: "power2.inOut" });
        } else if (kind === "easing") {
            const sequence = timeline();
            ["none", softEase, "elastic.out(1,.5)"].forEach((ease, i) => sequence.to(targets[i], { x: travel, duration: 2, ease }, 0));
            animation = sequence;
        } else if (kind === "scroll") {
            const scroller = query<HTMLElement>("[data-lab-scroller]");
            const content = query<HTMLElement>("[data-lab-scroll-content]");
            const movement = gsap.to(target, { x: Math.max(24, scroller.clientWidth - 88), rotation: 180, duration: 1, paused: true, ease: "none" });
            trigger = ScrollTrigger.create({ scroller, trigger: content, start: "top top", end: "bottom bottom", animation: movement, scrub: true });
            const maximum = scroller.scrollHeight - scroller.clientHeight;
            // Explicit starts avoid lazy .to() capturing a person's first manual scroll as the new origin.
            animation = timeline().fromTo(scroller, { scrollTop: 0 }, { scrollTop: maximum, duration: 2, ease: "none", onUpdate: () => ScrollTrigger.update() });
            const onScroll = () => {
                if (!animation.isActive()) {
                    const value = scroller.scrollTop / Math.max(1, maximum);
                    if (Math.abs(value - animation.progress()) > .001) {
                        playing = false; animation.pause().progress(value, true); stopped();
                    }
                    report(value);
                }
            };
            const interrupt = () => { playing = false; animation.pause(); stopped(); };
            scroller.addEventListener("scroll", onScroll, { passive: true });
            for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) scroller.addEventListener(event, interrupt, { passive: true });
            contextCleanup.push(() => {
                scroller.removeEventListener("scroll", onScroll);
                for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) scroller.removeEventListener(event, interrupt);
            });
            trigger.refresh();
        } else if (kind === "flip") {
            const state = Flip.getState(initialTiles);
            flipParent!.append(initialTiles[0]);
            animation = Flip.from(state, { duration: 1.6, ease: "power2.inOut", paused: true, scale: true });
        } else if (kind === "draw") {
            animation = gsap.fromTo(query("[data-lab-path]"), { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 2, ease: "none", paused: true });
        } else if (kind === "motion-path") {
            const path = query<SVGPathElement>("[data-lab-path]");
            animation = gsap.to(target, { motionPath: { path, align: path, alignOrigin: [.5, .5] }, duration: 2, ease: "none", paused: true });
            animation.progress(0.00001).pause();
        } else if (kind === "morph") {
            animation = gsap.to(query("[data-lab-path]"), { morphSVG: STAR, duration: 2, ease: "power2.inOut", paused: true });
        } else if (kind === "split") {
            if (!reduced) {
                split = SplitText.create(text!, { type: "lines,words", aria: "auto", autoSplit: true, onSplit(self) {
                    // SplitText restores totalTime after this callback; preserve the person's play/pause intent.
                    animation = gsap.from(self.words, { y: 16, opacity: .35, stagger: .08, duration: 1.2, paused: !playing });
                    bindCallbacks();
                    return animation;
                } });
            } else animation = timeline().to(text!, { opacity: 1, duration: 2 });
        } else if (kind === "drag") {
            // Draggable may move before the first seek/play; its canonical track still starts at x=0.
            animation = timeline().fromTo(target, { x: 0 }, { x: travel, duration: 2, ease: "none" });
            [draggable] = Draggable.create(target, { type: "x", bounds: { minX: 0, maxX: travel }, minimumMovement: 4,
                allowNativeTouchScrolling: true, onPress() { playing = false; animation.pause(); stopped(); },
                onDrag() { report(gsap.utils.clamp(0, 1, this.x / travel)); },
                onDragEnd() { seek(this.x / travel); },
            });
        } else if (kind === "observer") {
            animation = timeline().to(target, { x: travel, rotation: 180, duration: 2, ease: "none" });
            observer = Observer.create({ target: stage, type: "wheel,touch,pointer", preventDefault: false,
                onChangeY(self) { if (Math.abs(self.deltaY) > 1) nudge(self.deltaY > 0 ? .05 : -.05); },
            });
        } else if (kind === "scramble") {
            animation = gsap.to(text!, { duration: 2, paused: true, scrambleText: { text: "예술이 일상이 되는 곳", chars: "세종문화예술", speed: .5 } });
        } else {
            const velocity = gsap.utils.clamp(60, 170, stage.clientWidth / 2);
            animation = gsap.to(target, { physics2D: { velocity, angle: -55, gravity: 160 }, duration: 1.6, paused: true, ease: "none" });
        }
    }, stage);
    if (animation !== placeholder) placeholder.kill();
    // Listener cleanup is separate from GSAP's context records.
    function bindCallbacks() {
        animation.eventCallback("onUpdate", () => send());
        animation.eventCallback("onComplete", () => { playing = false; send(true); completed(); });
    }
    bindCallbacks();
    return {
        play() { if (!reduced) { playing = true; if (animation.progress() >= .999) animation.restart(); else animation.play(); } },
        pause() { playing = false; animation.pause(); send(true); },
        restart() { if (!reduced) { playing = true; animation.restart(); send(true); } },
        seek, nudge,
        cleanup() {
            disposed = true;
            observer?.kill(); draggable?.kill(); trigger?.kill(); split?.revert();
            contextCleanup.forEach(cleanup => cleanup()); context.revert();
            if (flipParent) initialTiles.forEach(tile => flipParent.append(tile));
            if (text && kind !== "split") text.textContent = originalText;
        },
    };
}
