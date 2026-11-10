import assert from "node:assert/strict";
import test from "node:test";
import {
    VISUAL_PRESETS,
    VISUAL_STYLE_FIELDS,
    VISUAL_STYLE_GROUPS,
    addVisualElement,
    countVisualChanges,
    createVisualHistory,
    emptyVisualDocument,
    isSafeVisualSelector,
    normalizeVisualPath,
    redoVisualHistory,
    removeVisualElement,
    removeVisualStyle,
    sanitizeVisualDocument,
    sanitizeVisualStyle,
    undoVisualHistory,
    upsertVisualPatch,
    visualDocumentChecksum,
} from "../src/cms/visual-document.ts";

const MAIN = "body > main:nth-of-type(1)";
const HEADING = "body > main:nth-of-type(1) > h2:nth-of-type(1)";

test("경로 정규화: 공개 페이지만 허용하고 관리자 경로는 거부한다", () => {
    assert.equal(normalizeVisualPath("/v5/programs/"), "/programs");
    assert.equal(normalizeVisualPath("about/introduction"), "/about/introduction");
    assert.equal(normalizeVisualPath("/admin/designer"), null);
    assert.equal(normalizeVisualPath("/account/profile"), null);
    assert.equal(normalizeVisualPath("/../etc/passwd"), null);
});

test("선택자 화이트리스트: body 경로와 삽입 요소만 허용한다", () => {
    assert.equal(isSafeVisualSelector(MAIN), true);
    assert.equal(isSafeVisualSelector('[data-cms-added="node-abcdef12"]'), true);
    assert.equal(isSafeVisualSelector('[data-cms-added="node-abcdef12"] > h3:nth-child(1)'), true);
    assert.equal(isSafeVisualSelector("body > script"), false);
    assert.equal(isSafeVisualSelector("#main"), false);
    assert.equal(isSafeVisualSelector("body > div:nth-of-type(1)]"), false);
});

test("스타일 정화: 허용 키와 값만 통과시키고 CSS 주입은 막는다", () => {
    assert.equal(sanitizeVisualStyle("font-size", "24px"), "24px");
    assert.equal(sanitizeVisualStyle("color", "var(--text-primary)"), "var(--text-primary)");
    assert.equal(sanitizeVisualStyle("padding", "16px 24px"), "16px 24px");
    assert.equal(sanitizeVisualStyle("grid-template-columns", "repeat(3, minmax(0, 1fr))"), "repeat(3, minmax(0, 1fr))");
    assert.equal(sanitizeVisualStyle("translate", "12px -8px"), "12px -8px");
    assert.equal(sanitizeVisualStyle("font-size", "24px;background:url(//evil)"), null);
    assert.equal(sanitizeVisualStyle("position", "fixed"), null);
    assert.equal(sanitizeVisualStyle("unknown-key", "1px"), null);
    assert.equal(sanitizeVisualStyle("opacity", "2"), null);
});

test("스타일 그룹과 필드 정의가 서로 일치한다", () => {
    const keys = new Set(VISUAL_STYLE_FIELDS.map((field) => field.key));
    for (const group of VISUAL_STYLE_GROUPS) {
        assert.ok(group.keys.length > 0, group.id);
        for (const key of group.keys) assert.ok(keys.has(key), `${group.id}:${key}`);
    }
    const grouped = new Set(VISUAL_STYLE_GROUPS.flatMap((group) => [...group.keys]));
    assert.equal(grouped.size, keys.size);
});

test("v1 문서는 v2로 정규화되고 안전하지 않은 값은 버려진다", () => {
    const doc = sanitizeVisualDocument(
        {
            schemaVersion: 1,
            path: "/programs",
            patches: [
                { selector: HEADING, text: "새 제목", style: { color: "#111111", "font-size": "36px", display: "fixed" } },
                { selector: "#main", text: "무시" },
            ],
            additions: [{ id: "node-aaaaaa11", parent: MAIN, tag: "p", text: "문단" }],
        },
        "/programs",
    );
    assert.equal(doc.schemaVersion, 2);
    assert.equal(doc.patches.length, 1);
    assert.deepEqual(doc.patches[0].style, { color: "#111111", "font-size": "36px" });
    assert.equal(doc.additions.length, 1);
    assert.equal(doc.additions[0].preset, "text");
});

test("프리셋 카드·배너는 자식 노드를 함께 삽입한다", () => {
    const base = emptyVisualDocument("/programs");
    const card = addVisualElement(base, { parent: MAIN, preset: "card" });
    assert.ok(card.added);
    assert.equal(card.added?.tag, "article");
    assert.equal(card.added?.children?.length, 2);
    assert.equal(card.document.additions.length, 1);

    const banner = addVisualElement(card.document, { parent: MAIN, preset: "banner" });
    assert.equal(banner.added?.children?.length, 3);

    const presetIds = VISUAL_PRESETS.map((preset) => preset.id);
    assert.deepEqual(presetIds, ["heading", "text", "button", "link", "image", "container", "card", "banner"]);
});

test("삽입 요소의 자식 선택자도 패치할 수 있고, 없는 요소 패치는 거부된다", () => {
    const base = emptyVisualDocument("/programs");
    const { document, added } = addVisualElement(base, { parent: MAIN, preset: "card" });
    assert.ok(added);
    const childSelector = `[data-cms-added="${added!.id}"] > h3:nth-child(1)`;
    const patched = upsertVisualPatch(document, childSelector, { text: "새 카드 제목" });
    assert.equal(patched.patches.length, 1);
    assert.equal(patched.patches[0].text, "새 카드 제목");

    const orphan = upsertVisualPatch(patched, '[data-cms-added="node-zzzzzz99"]', { text: "유령" });
    assert.equal(orphan.patches.length, 1);
});

test("히스토리 실행 취소·다시 실행이 문서를 정확히 복원한다", () => {
    let history = createVisualHistory(emptyVisualDocument("/programs"));
    const first = upsertVisualPatch(history.present, HEADING, { text: "1" });
    history = { past: [...history.past, history.present], present: first, future: [] };
    const second = upsertVisualPatch(history.present, HEADING, { text: "2" });
    history = { past: [...history.past, history.present], present: second, future: [] };
    assert.equal(history.present.patches[0].text, "2");

    history = undoVisualHistory(history);
    assert.equal(history.present.patches[0].text, "1");
    history = undoVisualHistory(history);
    assert.equal(history.present.patches.length, 0);
    history = redoVisualHistory(history);
    assert.equal(history.present.patches[0].text, "1");
});

test("스타일 제거는 빈 패치를 정리하고 체크섬은 안정적이다", () => {
    const base = upsertVisualPatch(emptyVisualDocument("/programs"), HEADING, {
        style: { "font-size": "24px", color: "var(--text-primary)" },
    });
    const oneLeft = removeVisualStyle(base, HEADING, "font-size");
    assert.deepEqual(oneLeft.patches[0].style, { color: "var(--text-primary)" });
    const noneLeft = removeVisualStyle(oneLeft, HEADING, "color");
    assert.equal(noneLeft.patches.length, 0);

    const a = upsertVisualPatch(emptyVisualDocument("/programs"), HEADING, { text: "같음" });
    const b = upsertVisualPatch(emptyVisualDocument("/programs"), HEADING, { text: "같음" });
    assert.equal(visualDocumentChecksum(a), visualDocumentChecksum(b));
    assert.notEqual(visualDocumentChecksum(a), visualDocumentChecksum(oneLeft));
});

test("삽입 요소 삭제는 해당 자식 패치까지 함께 정리한다", () => {
    const { document, added } = addVisualElement(emptyVisualDocument("/programs"), { parent: MAIN, preset: "banner" });
    assert.ok(added);
    const childSelector = `[data-cms-added="${added!.id}"] > p:nth-child(2)`;
    const patched = upsertVisualPatch(document, childSelector, { text: "설명 수정" });
    assert.equal(countVisualChanges(patched).patches, 1);
    const removed = removeVisualElement(patched, `[data-cms-added="${added!.id}"]`);
    assert.equal(removed.additions.length, 0);
    assert.equal(removed.patches.length, 0);
});
