import assert from "node:assert/strict";
import test from "node:test";
import { addVisualElement, emptyVisualDocument, sanitizeVisualDocument, visualDocumentChecksum } from "../src/cms/visual-document.ts";
import { studioSiblingIds, moveStudioLayer } from "../src/cms/studio-layer-order.ts";

const main = "body > main:nth-of-type(1)";
const group = '[data-cms-added="group-1"]';

function fixture() {
    const items = [[main, "group-1"], [group, "child-1"], [main, "text-01"], [main, "text-02"]];
    return items.reduce((doc, [parent, id]) => addVisualElement(doc, { parent, id, preset: "container" }).document,
        emptyVisualDocument("/visit"));
}

test("같은 부모 안에서만 이동하고, JSON 왕복 뒤에도 순서와 체크섬이 달라진다", () => {
    const initial = fixture();
    const changed = moveStudioLayer(initial, "text-02", "group-1");
    assert.deepEqual(changed.additions.map(item => item.id), initial.additions.map(item => item.id));
    const restored = sanitizeVisualDocument(JSON.parse(JSON.stringify(changed)), initial.path);
    assert.deepEqual(studioSiblingIds(restored, main), ["text-02", "group-1", "text-01"]);
    assert.deepEqual(studioSiblingIds(restored, group), ["child-1"]);
    assert.notEqual(visualDocumentChecksum(restored), visualDocumentChecksum(initial));
});

test("부모 간 이동, 존재하지 않는 요소와 동일 위치는 변경하지 않는다", () => {
    const doc = fixture();
    assert.equal(moveStudioLayer(doc, "child-1", "text-01"), doc);
    assert.equal(moveStudioLayer(doc, "missing", "text-01"), doc);
    assert.equal(moveStudioLayer(doc, "text-02", "text-02"), doc);
});

test("선행 레이어를 아래로 이동하면 놓은 레이어 뒤에 배치한다", () => {
    const doc = moveStudioLayer(fixture(), "group-1", "text-02");
    assert.deepEqual(studioSiblingIds(doc, main), ["text-01", "text-02", "group-1"]);
    const added = addVisualElement(doc, { parent: main, id: "text-03", preset: "text" }).document;
    assert.deepEqual(studioSiblingIds(added, main), ["text-01", "text-02", "group-1", "text-03"]);
});

test("가져온 JSON의 음수·소수·문자열 순번은 버리고, 기존 초안 순서는 그대로 읽는다", () => {
    const original = fixture();
    const additions = original.additions.map((item, i) => ({ ...item, order: [-1, 0.5, "1", 120][i] }));
    const clean = sanitizeVisualDocument({ ...original, additions }, original.path);
    assert.deepEqual(clean.additions, original.additions);
    assert.equal(visualDocumentChecksum(clean), visualDocumentChecksum(original));
});
