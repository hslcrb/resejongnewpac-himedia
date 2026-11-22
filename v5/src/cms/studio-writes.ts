// 쓰기 완료는 해당 편집 세대에만 적용한다. / A completion acknowledges only its own edit generation.
type Write = Readonly<{ generation: number }>;

export function createStudioWrites() {
    let generation = 0;
    let active: Write | null = null;
    return {
        changed() { generation++; },
        busy() { return active !== null; },
        begin(): Write | null {
            if (active) return null;
            active = { generation };
            return active;
        },
        isCurrent(request: Write) { return active === request && generation === request.generation; },
        finish(request: Write) { if (active === request) active = null; },
    };
}
