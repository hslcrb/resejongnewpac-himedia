import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
    CHAPTERS,
    DESIGN_COLORS,
    SEMANTIC_COLORS,
    TYPE_SCALE,
    contrastRatio,
    designTokensCss,
} from "../src/data/design-system.ts";

// [팔레트 보존과 실제 사용 기준 / Palette preservation and working standards]
test("the guide preserves all eight existing primitive colors and matches production CSS", async () => {
    const expected = [
        "#000000",
        "#54C8E8",
        "#F7D549",
        "#C36D15",
        "#FFFFFF",
        "#F7F7F5",
        "#D9D9D4",
        "#626262",
    ];
    assert.deepEqual(
        DESIGN_COLORS.map((color) => color.hex),
        expected,
    );
    const css = await readFile(new URL("../styles/tokens.css", import.meta.url), "utf8");
    for (const color of DESIGN_COLORS) {
        const match = css.match(new RegExp(`--${color.token}:\\s*(#[0-9a-f]{6})`, "i"));
        assert.equal(match?.[1].toUpperCase(), color.hex, color.token);
    }
    for (const [, token, primitive] of SEMANTIC_COLORS) {
        assert.ok(css.includes(`--${token}: var(--${primitive})`), token);
    }
});

test("contrast calculations validate readable and forbidden brand combinations", () => {
    assert.equal(contrastRatio("#000000", "#FFFFFF"), 21);
    assert.equal(contrastRatio("#F7D549", "#F7D549"), 1);
    for (const color of DESIGN_COLORS)
        assert.ok(contrastRatio(color.hex, color.ink) >= 4.5, color.name);
    assert.ok(contrastRatio("#FFFFFF", "#54C8E8") < 4.5);
    assert.throws(() => contrastRatio("red", "#000000"));
});

test("type, export and chapter links form a usable public design contract", () => {
    assert.ok(TYPE_SCALE.every((type) => type.size >= 16 && type.mobile >= 16));
    assert.equal(TYPE_SCALE.find((type) => type.token === "text-body").size, 16);
    const exported = designTokensCss();
    assert.match(exported, /--text-body: 1rem;/);
    assert.match(exported, /--control-size: 3rem;/);
    assert.match(exported, /--radius-dialog: 24px;/);
    assert.match(exported, /--space-24: 6rem;/);
    assert.equal(new Set(CHAPTERS.map((chapter) => chapter.id)).size, 9);
    for (const chapter of CHAPTERS)
        assert.equal(new Set(chapter.sections.map(([id]) => id)).size, chapter.sections.length);
});
