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

interface FurTexture {
    pixels: number;
    expanded: boolean;
    coats: [HTMLCanvasElement, HTMLCanvasElement];
}

const SIZE = 600;
const CENTER = SIZE / 2;
const RADIUS = CENTER / 1.3;
const SHADES = 20;

function createTexture(pixels: number, expanded: boolean): FurTexture | null {
    const coats = [document.createElement("canvas"), document.createElement("canvas")] as FurTexture["coats"];
    const contexts = coats.map(canvas => {
        canvas.width = pixels;
        canvas.height = pixels;
        const context = canvas.getContext("2d");
        context?.setTransform(pixels / SIZE, 0, 0, pixels / SIZE, 0, 0);
        return context;
    });
    if (!contexts[0] || !contexts[1]) return null;

    // Bake a shaded undercoat and thousands of short tapered fibres once.
    // The animation below only composites these two reusable bitmaps.
    const undercoat = contexts[0].createRadialGradient(218, 166, 22, CENTER, CENTER, RADIUS + 18);
    undercoat.addColorStop(0, "rgba(208, 130, 255, .96)");
    undercoat.addColorStop(.35, "rgba(148, 54, 230, .94)");
    undercoat.addColorStop(.68, "rgba(94, 15, 180, .93)");
    undercoat.addColorStop(.87, "rgba(101, 26, 178, .86)");
    undercoat.addColorStop(.94, "rgba(118, 38, 183, .3)");
    undercoat.addColorStop(1, "rgba(143, 57, 210, 0)");
    contexts[0].fillStyle = undercoat;
    contexts[0].fillRect(0, 0, SIZE, SIZE);

    let seed = expanded ? 5137 : 2917;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const paths = coats.map(() => Array.from({ length: SHADES }, () => new Path2D()));
    const density = expanded ? Math.min(1, pixels / 600) : 1;
    const bodyCount = Math.round((expanded ? 13800 : 4200) * density);
    const rimCount = Math.round((expanded ? 2400 : 1100) * density);

    for (let index = 0; index < bodyCount + rimCount; index++) {
        const rim = index >= bodyCount;
        const angle = random() * Math.PI * 2;
        const radius = rim ? RADIUS + 3 - random() * 24 : Math.sqrt(random()) * (RADIUS - 2);
        const nx = Math.cos(angle) * radius / RADIUS;
        const ny = Math.sin(angle) * radius / RADIUS;
        const x = CENTER + nx * RADIUS;
        const y = CENTER + ny * RADIUS;
        const edge = Math.pow(Math.min(1, radius / RADIUS), 5);

        // Neighbouring hairs follow loose tufts; the rim follows the sphere.
        const tuft = Math.sin(nx * 11 + ny * 7) * .38 + Math.sin(ny * 15 - nx * 4) * .18;
        const flow = -1.3 + tuft + (random() - .5) * 1.05;
        let dx = Math.cos(flow) * (1 - edge) + Math.cos(angle) * edge;
        let dy = Math.sin(flow) * (1 - edge) + Math.sin(angle) * edge;
        const magnitude = Math.hypot(dx, dy) || 1;
        dx /= magnitude;
        dy /= magnitude;
        const length = rim ? 13 + random() * 20 : 7 + random() * 13;
        const width = (rim ? .25 : .32) + random() * (rim ? .45 : .7);
        const curl = (random() - .5) * length * .8 + tuft * 2;
        const tipX = x + dx * length - dy * curl * .45;
        const tipY = y + dy * length + dx * curl * .45;
        const midX = x + dx * length * .52 - dy * curl;
        const midY = y + dy * length * .52 + dx * curl;
        const depth = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const light = Math.max(0, -nx * .52 - ny * .65 + depth * .57);
        const shade = Math.min(SHADES - 1, Math.floor((.14 + light * .49 + random() * .31 + tuft * .06) * SHADES));
        const path = paths[index % 4 === 0 ? 1 : 0][Math.max(0, shade)];

        // Filled, tapering curls have a soft pile instead of a whisker outline.
        path.moveTo(x + dy * width, y - dx * width);
        path.quadraticCurveTo(midX + dy * width * .35, midY - dx * width * .35, tipX, tipY);
        path.quadraticCurveTo(midX - dy * width * .35, midY + dx * width * .35, x - dy * width, y + dx * width);
        path.closePath();
    }

    // Shade buckets keep texture creation to forty fills, regardless of density.
    contexts.forEach((context, layer) => {
        if (!context) return;
        paths[layer].forEach((path, shade) => {
            context.fillStyle = `hsl(${270 + shade * .58} 76% ${25 + shade * 3.2}%)`;
            context.fill(path);
        });
    });

    return { pixels, expanded, coats };
}

/** Decorative only: native links remain usable if Canvas is unavailable. */
export default function VioletFur({ awake, animated, expanded = false, interaction }: VioletFurProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textureRef = useRef<FurTexture | null>(null);

    useEffect(() => {
        if (!awake) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        const modestDevice = window.matchMedia("(pointer: coarse)").matches || (navigator.hardwareConcurrency || 8) <= 4;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, modestDevice ? 1.25 : 1.5);
        // clientWidth excludes the opening scale transform, so its texture stays crisp.
        const cssSize = canvas.clientWidth || (expanded ? 480 : 114);
        const pixels = Math.max(expanded ? 420 : 160, Math.min(expanded ? 720 : 256, Math.ceil(cssSize * pixelRatio / 32) * 32));
        if (!textureRef.current || textureRef.current.pixels !== pixels || textureRef.current.expanded !== expanded) {
            textureRef.current = createTexture(pixels, expanded);
        }
        const texture = textureRef.current;
        if (!texture) return;
        canvas.width = pixels;
        canvas.height = pixels;
        context.setTransform(pixels / SIZE, 0, 0, pixels / SIZE, 0, 0);

        let frame = 0;
        let previousFrame = performance.now();
        let pointerX = interaction.current.x;
        let pointerY = interaction.current.y;
        const interval = 1000 / (modestDevice ? 20 : 24);

        function draw(time: number) {
            if (!context || !texture) return;
            const motion = animated ? time : 0;
            pointerX += (interaction.current.x - pointerX) * .14;
            pointerY += (interaction.current.y - pointerY) * .14;
            const energy = animated ? Math.min(1, interaction.current.energy) : 0;
            context.clearRect(0, 0, SIZE, SIZE);
            context.save();
            context.translate(CENTER, CENTER);
            context.rotate(animated ? Math.sin(motion * .34) * .012 + pointerX * .006 : 0);
            context.drawImage(texture.coats[0], -CENTER, -CENTER, SIZE, SIZE);
            context.restore();

            context.save();
            context.translate(CENTER + (animated ? Math.sin(motion * .7) * .7 + pointerX * .7 : 0), CENTER + (animated ? Math.cos(motion * .6) * .6 + pointerY * .7 : 0));
            context.rotate(animated ? Math.sin(motion * .43 + 1.4) * .018 - pointerY * .006 + energy * .01 : 0);
            context.drawImage(texture.coats[1], -CENTER, -CENTER, SIZE, SIZE);
            context.restore();
        }

        function tick(now: number) {
            const elapsed = now - previousFrame;
            if (elapsed >= interval) {
                draw(now / 1000);
                interaction.current.energy *= .92;
                previousFrame = now - elapsed % interval;
            }
            frame = requestAnimationFrame(tick);
        }

        draw(performance.now() / 1000);
        if (animated) frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [awake, animated, expanded, interaction]);

    return <canvas ref={canvasRef} className={styles.fur} aria-hidden="true" />;
}
