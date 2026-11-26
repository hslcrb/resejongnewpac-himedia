import assert from "node:assert/strict";
import test from "node:test";
import { restoreReadableDocument } from "../src/runtime/readable-dom.ts";

test("브라우저가 html 바로 아래에 삽입한 요소는 원본 DOM을 복원할 때 건드리지 않는다", () => {
    const spacer = { nodeType: 3, textContent: "\n    ", parentNode: { removeChild: (node: unknown) => removed.push(node) } };
    const indentation = { nodeType: 3, textContent: "\n        " };
    const extra = { nodeType: 1, nodeName: "DIV" };
    const head = { nodeType: 1, childNodes: [indentation], children: [] };
    const body = { nodeType: 1, childNodes: [], children: [] };
    const removed: unknown[] = [];
    const html = { childNodes: [extra, head, spacer, body], children: [extra, head, body] };
    const helper = { textContent: JSON.stringify({ schemaVersion: 1, changes: [
        { path: [0], childIndex: 1, original: null, formatted: "\n    " },
        { path: [0, 0], childIndex: 0, original: " ", formatted: "\n        " },
    ] }), remove: () => removed.push("manifest") };
    const doc = { children: [html], documentElement: html, head, body, getElementById: () => helper };
    restoreReadableDocument(doc as unknown as Document);
    assert.deepEqual(removed, [spacer, "manifest"]);
    assert.equal(indentation.textContent, " ");
    assert.equal(html.children[0], extra);
});

test("정상 문서의 공백은 복원하되 실제 본문 구조 불일치를 숨기지 않는다", () => {
    const text = { nodeType: 3, textContent: "    " };
    const head = { nodeType: 1, childNodes: [text], children: [] };
    const body = { nodeType: 1, childNodes: [{ nodeType: 1, nodeName: "MAIN" }], children: [] };
    const html = { childNodes: [head, body], children: [head, body] };
    const helper = { textContent: JSON.stringify({ schemaVersion: 1, changes: [
        { path: [0, 0], childIndex: 0, original: " ", formatted: "    " },
        { path: [0, 1], childIndex: 0, original: null, formatted: " " },
    ] }), remove: () => assert.fail("불일치한 문서에서는 헬퍼를 제거하지 않는다") };
    const doc = { children: [html], documentElement: html, head, body, getElementById: () => helper };
    assert.throws(() => restoreReadableDocument(doc as unknown as Document), /whitespace differs/);
    assert.equal(text.textContent, "    ", "모든 경로를 찾기 전에는 DOM을 바꾸지 않는다");
});
