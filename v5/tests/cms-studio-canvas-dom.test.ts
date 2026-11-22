import assert from "node:assert/strict";
import test from "node:test";
import { applyVisualDraft } from "../src/cms/studio-canvas-dom.ts";
import type { Original } from "../src/cms/studio-canvas-dom.ts";
import { emptyVisualDocument, upsertVisualPatch } from "../src/cms/visual-document.ts";

test("원본 비교와 복귀는 실제 문서 속성을 복원하고 이전 참조를 해제한다", () => {
    const selector = "body > p:nth-of-type(1)";
    const attrs = new Map([["style", "width: 42px"]]);
    const node = {
        namespaceURI: "http://www.w3.org/1999/xhtml",
        tagName: "P",
        isConnected: true,
        hidden: false,
        children: [],
        textContent: "원본",
        style: { setProperty: (k: string, v: string) => attrs.set("style", k + ": " + v) },
        hasAttribute: (k: string) => attrs.has(k),
        getAttribute: (k: string) => attrs.get(k) ?? null,
        setAttribute: (k: string, v: string) => attrs.set(k, v),
        removeAttribute: (k: string) => attrs.delete(k),
    };
    const doc = { querySelector: () => node, querySelectorAll: () => [] } as unknown as Document;
    const originals = new Map<HTMLElement, Original>();
    const base = emptyVisualDocument("/visit");
    const draft = upsertVisualPatch(base, selector, { text: "수정", style: { width: "55px" }, hidden: true });
    applyVisualDraft(doc, draft, originals);
    assert.equal(node.textContent, "수정");
    assert.equal(node.hidden, true);
    assert.equal(attrs.get("style"), "width: 55px");
    assert.equal(originals.size, 1);
    applyVisualDraft(doc, base, originals);
    assert.equal(node.textContent, "원본");
    assert.equal(node.hidden, false);
    assert.equal(attrs.get("style"), "width: 42px");
    assert.equal(originals.size, 0);
    applyVisualDraft(doc, draft, originals);
    assert.equal(node.textContent, "수정");
});
