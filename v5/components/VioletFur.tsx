"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import styles from "./VioletQuickMenu.module.css";

export interface VioletInteraction {
    x: number;
    y: number;
    energy: number;
}

interface VioletFurProps {
    awake: boolean;
    animated: boolean;
    expanded?: boolean;
    interaction: MutableRefObject<VioletInteraction>;
}

const SIZE = 600;
const RADIUS = SIZE / 2 / 1.3;
const noise = (seed: number) => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
};

/** Decorative only: native links remain usable if Canvas is unavailable. */
export default function VioletFur({ awake, animated, expanded = false, interaction }: VioletFurProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!awake) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = SIZE * pixelRatio;
        canvas.height = SIZE * pixelRatio;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        // Seeded strands keep the texture stable across mounts and resize.
        const count = expanded ? 1380 : 380;
        const strands = Array.from({ length: count }, (_, index) => ({
            angle: (index / count) * Math.PI * 2,
            depth: noise(index + 11),
            length: noise(index + 73),
            curl: noise(index + 193) - .5,
            light: noise(index + 317),
        }));
        let frame = 0;
        let previousFrame = 0;
        const origin = performance.now();

        function draw(time: number) {
            if (!context) return;
            context.clearRect(0, 0, SIZE, SIZE);
            context.lineCap = "round";
            const pointer = interaction.current;
            const fluff = expanded ? 1 : .24;

            const undercoat = context.createRadialGradient(300, 300, RADIUS - 8, 300, 300, RADIUS + 21 * fluff);
            undercoat.addColorStop(0, "rgba(163, 74, 234, .32)");
            undercoat.addColorStop(.5, "rgba(186, 107, 248, .14)");
            undercoat.addColorStop(1, "rgba(174, 83, 244, 0)");
            context.fillStyle = undercoat;
            context.beginPath();
            context.arc(300, 300, RADIUS + 21 * fluff, 0, Math.PI * 2);
            context.arc(300, 300, RADIUS - 8, 0, Math.PI * 2, true);
            context.fill("evenodd");

            for (let i = 0; i < strands.length; i++) {
                const strand = strands[i];
                const angle = strand.angle;
                const wind = animated ? Math.sin(time * 1.35 + angle * 7 + strand.depth * 3) : 0;
                const attraction = (Math.cos(angle) * pointer.x + Math.sin(angle) * pointer.y) * .018;
                const root = RADIUS - 5 - strand.depth * 14;
                const tip = RADIUS + (4 + strand.length * 13 + pointer.energy * 4) * fluff;
                const bend = angle + strand.curl * .08 + wind * .018 + attraction;
                const light = 57 + strand.light * 29 + Math.max(0, -Math.sin(angle) - Math.cos(angle)) * 5;

                context.beginPath();
                context.moveTo(300 + Math.cos(angle) * root, 300 + Math.sin(angle) * root);
                context.quadraticCurveTo(
                    300 + Math.cos(bend) * (RADIUS + 8 * fluff),
                    300 + Math.sin(bend) * (RADIUS + 8 * fluff),
                    300 + Math.cos(bend + strand.curl * .04) * tip,
                    300 + Math.sin(bend + strand.curl * .04) * tip,
                );
                context.lineWidth = .4 + strand.depth * .55;
                context.strokeStyle = `hsla(${264 + strand.light * 22}, 92%, ${light}%, ${.2 + strand.length * .4})`;
                context.stroke();

                // Short curved fibres inside the sphere connect its liquid core to the soft rim.
                if (expanded && i % 2 === 0) {
                    const inner = Math.sqrt(strand.depth) * RADIUS * .96;
                    const innerAngle = angle + time * .018;
                    context.beginPath();
                    context.moveTo(300 + Math.cos(innerAngle) * inner, 300 + Math.sin(innerAngle) * inner);
                    context.quadraticCurveTo(
                        300 + Math.cos(innerAngle + .025) * (inner + 5),
                        300 + Math.sin(innerAngle + .025) * (inner + 5),
                        300 + Math.cos(innerAngle + .06) * (inner + 8 + strand.length * 8),
                        300 + Math.sin(innerAngle + .06) * (inner + 8 + strand.length * 8),
                    );
                    context.lineWidth = .7;
                    context.strokeStyle = `rgba(242, 205, 255, ${.045 + strand.light * .12})`;
                    context.stroke();
                }
            }
        }

        function tick(now: number) {
            // Keep the decorative surface at 30 fps; input itself is not throttled.
            if (now - previousFrame >= 1000 / 30) {
                draw((now - origin) / 1000);
                interaction.current.energy *= .94;
                previousFrame = now;
            }
            frame = requestAnimationFrame(tick);
        }

        draw(0);
        if (animated) frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [awake, animated, expanded, interaction]);

    return <canvas ref={canvasRef} className={styles.fur} aria-hidden="true" />;
}
