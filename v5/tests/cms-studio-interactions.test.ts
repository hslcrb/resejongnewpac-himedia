import assert from "node:assert/strict";
import test from "node:test";
import { moveStudioDrag, startStudioDrag, studioShortcut, studioTextChange } from "../src/cms/studio-interactions.ts";

test("포인터를 식별하고 실제 이동이 시작된 한 번만 저장한다", () => {
    const drag = startStudioDrag(7, { x: 30, y: 50 }, "10px -5px");
    assert.equal(moveStudioDrag(drag, 8, { x: 500, y: 500 }), null);
    assert.equal(moveStudioDrag(drag, 7, { x: 31, y: 51 }), null);
    assert.equal(moveStudioDrag(drag, 7, { x: 44, y: 42 }), "24px -13px");
});

test("드래그에 NaN과 무한대를 적용하지 않는다", () => {
    const drag = startStudioDrag(2, { x: 0, y: 0 }, "auto");
    assert.equal(moveStudioDrag(drag, 2, { x: Infinity, y: 0 }), null);
    assert.equal(moveStudioDrag(drag, 2, { x: 0, y: 4 }), "0px 4px");
});

test("스튜디오 키가 입력과 조합 중인 한글을 훔치지 않는다", () => {
    assert.equal(studioShortcut({ key: "z", ctrlKey: true }, true), null);
    assert.equal(studioShortcut({ key: "Escape", isComposing: true }), null);
    assert.equal(studioShortcut({ key: "v", altKey: true }), null);
    assert.equal(studioShortcut({ key: "Z", metaKey: true, shiftKey: true }), "redo");
    assert.equal(studioShortcut({ key: "y", ctrlKey: true }), "redo");
    assert.equal(studioShortcut({ key: "Escape" }, true), "cancel");
    assert.equal(studioShortcut({ key: "Delete" }), "remove");
    assert.equal(studioShortcut({ key: "m" }), "move");
});

test("F2는 캔버스 텍스트 편집을 열고 입력 필드와 조합을 가로채지 않는다", () => {
    assert.equal(studioShortcut({ key: "F2" }), "edit-text");
    assert.equal(studioShortcut({ key: "F2" }, true), null);
    assert.equal(studioShortcut({ key: "F2", isComposing: true }), null);
});

test("캔버스에서 빈 텍스트 및 간격을 보존하고 취소와 구분한다", () => {
    assert.equal(studioTextChange("삭제 전", "", false), "");
    assert.equal(studioTextChange("기본", "앞   뒤", false), "앞   뒤");
    assert.equal(studioTextChange("원본", "줄 1\r\n줄 2", false), "줄 1\n줄 2");
    assert.equal(studioTextChange("원본", "원본", false), null);
    assert.equal(studioTextChange("원본", "수정", true), null);
    assert.equal(studioTextChange("원본", "😀".repeat(6000), false)?.length, 10000);
});
