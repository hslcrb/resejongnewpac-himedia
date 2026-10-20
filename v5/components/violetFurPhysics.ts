export interface VioletInteraction {
    x: number;
    y: number;
    energy: number;
    velocityX: number;
    velocityY: number;
    spin: number;
    lastInput: number;
    active: boolean;
}

export interface TuftField {
    /** Normalized root positions, phase and stiffness, four values per tuft. */
    anchors: Float32Array;
    /** Local x/y deflection and velocity; roots never enter this mutable array. */
    springs: Float32Array;
    /** Root, control, tip, root width, spring offset and flexibility, grouped by shade. */
    fibers: Float32Array[];
    colors: string[];
}

export const FUR_SIZE = 600;
export const FUR_CENTER = FUR_SIZE / 2;
export const FUR_RADIUS = FUR_CENTER / 1.3;
const TUFT_SHADES = 10;
const FIBER_STRIDE = 10;

export function createTufts(expanded: boolean, modestDevice: boolean): TuftField {
    let seed = expanded ? 7341 : 4157;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    // [터프 밀도] 뭉치가 빈약해 보이지 않도록 각 상태의 털 수와 가닥 수를 늘린다 · Dense tuft counts per state.
    const bodyCount = expanded ? modestDevice ? 34 : 48 : 24;
    const rimCount = expanded ? modestDevice ? 28 : 40 : 26;
    const count = bodyCount + rimCount;
    const anchors = new Float32Array(count * 4);
    const buckets: number[][] = Array.from({ length: TUFT_SHADES }, () => []);

    for (let tuft = 0; tuft < count; tuft++) {
        const rim = tuft >= bodyCount;
        const angle = rim ? (tuft - bodyCount + random() * .8) / rimCount * Math.PI * 2 : tuft * 2.399963 + random() * .35;
        const radius = rim ? FUR_RADIUS - 5 + random() * 3 : Math.sqrt((tuft + .5) / bodyCount) * FUR_RADIUS * .92;
        const nx = Math.cos(angle) * radius / FUR_RADIUS;
        const ny = Math.sin(angle) * radius / FUR_RADIUS;
        const offset = tuft * 4;
        anchors.set([nx, ny, random() * Math.PI * 2, .9 + random() * .2], offset);

        for (let hair = 0; hair < (expanded ? modestDevice ? 5 : 6 : 5); hair++) {
            const x = FUR_CENTER + nx * FUR_RADIUS + (random() - .5) * 8;
            const y = FUR_CENTER + ny * FUR_RADIUS + (random() - .5) * 8;
            const edge = Math.pow(radius / FUR_RADIUS, 5);
            const flow = -1.3 + Math.sin(nx * 11 + ny * 7) * .38 + Math.sin(ny * 15 - nx * 4) * .18 + (random() - .5) * .7;
            let dx = Math.cos(flow) * (1 - edge) + Math.cos(angle) * edge;
            let dy = Math.sin(flow) * (1 - edge) + Math.sin(angle) * edge;
            const magnitude = Math.hypot(dx, dy) || 1;
            dx /= magnitude;
            dy /= magnitude;
            const length = rim ? 21 + random() * 9 : 12 + random() * 9;
            const width = (rim ? .18 : .28) + random() * .28;
            const curl = (random() - .5) * length * .55;
            const light = Math.max(0, -nx * .52 - ny * .65 + Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * .57);
            const shade = Math.min(TUFT_SHADES - 1, Math.floor((.15 + light * .5 + random() * .28) * TUFT_SHADES));
            buckets[shade].push(
                x, y,
                x + dx * length * .52 - dy * curl, y + dy * length * .52 + dx * curl,
                x + dx * length - dy * curl * .45, y + dy * length + dx * curl * .45,
                -dy * width, dx * width, offset, .72 + random() * .28,
            );
        }
    }

    return {
        anchors,
        springs: new Float32Array(count * 4),
        fibers: buckets.map(values => new Float32Array(values)),
        colors: Array.from({ length: TUFT_SHADES }, (_, shade) => `hsla(${272 + shade * 1.1}, 75%, ${30 + shade * 5.2}%, .85)`),
    };
}

export function stepTufts(field: TuftField, input: VioletInteraction, time: number, elapsed: number, vigor = 1) {
    // A bounded timestep and near-critical damping avoid a snap after a slow frame.
    const dt = Math.min(.05, Math.max(0, elapsed));
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    const step = dt / steps;
    const freshness = Math.exp(-Math.max(0, time * 1000 - input.lastInput) / 180);
    const push = input.active ? freshness : 0;
    const spin = input.spin * freshness;
    const anchors = field.anchors;
    const springs = field.springs;
    // [바람 돌풍] 큰 파도가 천천히 지나가며 뭉치별로 시차를 둔다 · A slow gust wave sweeps the dome with lag between clumps.
    const gustWave = Math.sin(time * .3) * .55 + Math.sin(time * .17 + 1.7) * .45;

    for (let offset = 0; offset < anchors.length; offset += 4) {
        const nx = anchors[offset];
        const ny = anchors[offset + 1];
        const phase = anchors[offset + 2];
        const distance = (nx - input.x) ** 2 + (ny - input.y) ** 2;
        const nearby = 1 / (1 + distance * 7) ** 2;
        // [나풀 풍성] 각 뭉치가 자기 흐름각 위에서 숨을 쉬고, 빠른 잔떨림이 겹친다 · Each tuft breathes along its own flow angle under a fast flutter.
        const angle = -1.15 + phase * .26 + Math.sin(time * .47 + phase * 2.2) * .38;
        const gust = Math.sin(time * .5 + phase * 1.6) * .62 + Math.sin(time * .24 + phase * .8 + gustWave) * .5;
        const flutter = Math.sin(time * 1.7 + phase * 5.3) * .3 + Math.sin(time * 2.6 + phase * 6.9) * .16;
        const magnitude = (1.8 + gust * 1.5 + flutter) * vigor * anchors[offset + 3];
        let targetX = Math.cos(angle) * magnitude;
        let targetY = Math.sin(angle) * magnitude * .84;
        targetX += input.velocityX * nearby * push * .95 - ny * spin * 2.1;
        targetY += input.velocityY * nearby * push * .95 + nx * spin * 2.1;
        const bend = Math.hypot(targetX, targetY);
        if (bend > 6.4) { targetX *= 6.4 / bend; targetY *= 6.4 / bend; }

        let x = springs[offset];
        let y = springs[offset + 1];
        let vx = springs[offset + 2];
        let vy = springs[offset + 3];
        const stiffness = 34 * anchors[offset + 3];
        for (let substep = 0; substep < steps; substep++) {
            vx += ((targetX - x) * stiffness - vx * 10.8) * step;
            vy += ((targetY - y) * stiffness - vy * 10.8) * step;
            x += vx * step;
            y += vy * step;
        }
        springs[offset] = x;
        springs[offset + 1] = y;
        springs[offset + 2] = vx;
        springs[offset + 3] = vy;
    }
}

export function drawTufts(context: CanvasRenderingContext2D, field: TuftField) {
    for (let shade = 0; shade < field.fibers.length; shade++) {
        const fibers = field.fibers[shade];
        context.beginPath();
        for (let index = 0; index < fibers.length; index += FIBER_STRIDE) {
            const x = fibers[index];
            const y = fibers[index + 1];
            const widthX = fibers[index + 6];
            const widthY = fibers[index + 7];
            const spring = fibers[index + 8];
            const flex = fibers[index + 9];
            const bendX = field.springs[spring] * flex;
            const bendY = field.springs[spring + 1] * flex;
            const controlX = fibers[index + 2] + bendX * .55;
            const controlY = fibers[index + 3] + bendY * .55;
            // Only the control point and tip move. Both root edges stay fixed.
            context.moveTo(x - widthX, y - widthY);
            context.quadraticCurveTo(controlX - widthX * .35, controlY - widthY * .35, fibers[index + 4] + bendX, fibers[index + 5] + bendY);
            context.quadraticCurveTo(controlX + widthX * .35, controlY + widthY * .35, x + widthX, y + widthY);
            context.closePath();
        }
        context.fillStyle = field.colors[shade];
        context.fill();
    }
}

