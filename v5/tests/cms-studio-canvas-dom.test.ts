import assert from "node:assert/strict";
import test from "node:test";
import { applyVisualDraft } from "../src/cms/studio-canvas-dom.ts";
import type { Original } from "../src/cms/studio-canvas-dom.ts";
import { emptyVisualDocument, sanitizeVisualDocument, upsertVisualPatch } from "../src/cms/visual-document.ts";

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

test("캔버스는 기존 DOM을 보존하며 삽입 부모 안의 순서를 실제로 바꾼다", () => {
    class Node {
        namespaceURI = "http://www.w3.org/1999/xhtml";
        attrs = new Map<string, string>();
        children: Node[] = [];
        parentElement: Node | null = null;
        style = { setProperty() {} };
        textContent = "";
        readonly tagName: string;
        constructor(tagName: string) { this.tagName = tagName; }
        setAttribute(key: string, value: string) { this.attrs.set(key, value); }
        appendChild(child: Node) {
            child.remove();
            child.parentElement = this;
            this.children.push(child);
        }
        remove() {
            if (!this.parentElement) return;
            this.parentElement.children = this.parentElement.children.filter(child => child !== this);
            this.parentElement = null;
        }
    }
    const main = new Node("MAIN");
    const staticNode = new Node("H1");
    main.appendChild(staticNode);
    const all = (node: Node): Node[] => node.children.flatMap(child => [child, ...all(child)]);
    const doc = {
        createElement: (name: string) => new Node(name.toUpperCase()),
        querySelectorAll: () => all(main).filter(node => node.attrs.has("data-cms-added")),
        querySelector: (selector: string) => selector === "body > main:nth-of-type(1)" ? main :
            all(main).find(node => '[data-cms-added="' + node.attrs.get("data-cms-added") + '"]' === selector) ?? null,
    } as unknown as Document;
    const ordered = sanitizeVisualDocument({ additions: [
        { id: "parent-1", parent: "body > main:nth-of-type(1)", tag: "div", order: 1 },
        { id: "nested-1", parent: '[data-cms-added="parent-1"]', tag: "p" },
        { id: "sibling-1", parent: "body > main:nth-of-type(1)", tag: "p", order: 0 },
    ] }, "/visit");
    applyVisualDraft(doc, ordered, new Map());
    assert.equal(main.children[0], staticNode);
    assert.deepEqual(main.children.slice(1).map(node => node.attrs.get("data-cms-added")), ["sibling-1", "parent-1"]);
    assert.equal(main.children[2].children[0].attrs.get("data-cms-added"), "nested-1");
});
