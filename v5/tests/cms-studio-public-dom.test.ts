import assert from "node:assert/strict";
import test from "node:test";
import { applyPublicVisual } from "../src/cms/studio-public-dom.ts";
import { emptyVisualDocument, upsertVisualPatch } from "../src/cms/visual-document.ts";

function fixture() {
    const attributes = new Map<string, string>();
    const text = { nodeType: 3, nodeValue: "원래 제목" };
    const make = (tagName: string, firstChild?: typeof text) => ({
        tagName, firstChild, lastChild: firstChild, namespaceURI: "http://www.w3.org/1999/xhtml", children: [], isConnected: true,
        textContent: firstChild?.nodeValue || "", hidden: false,
        getAttribute: (key: string) => attributes.get(key) ?? null,
        hasAttribute: (key: string) => attributes.has(key),
        setAttribute: (key: string, value: string) => { attributes.set(key, value); },
        removeAttribute: (key: string) => { attributes.delete(key); },
    });
    const title = make("H1", text);
    const siteNav = make("A", { nodeType: 3, nodeValue: "메뉴" });
    const main = { contains: (element: unknown) => element === title, querySelectorAll: () => [] };
    const titleSelector = "body > main:nth-of-type(1) > h1:nth-of-type(1)";
    const navSelector = "body > header:nth-of-type(1) > a:nth-of-type(1)";
    const doc = { querySelector: (selector: string) => selector === titleSelector ? title : siteNav };
    return { doc: doc as unknown as Document, main: main as unknown as HTMLElement, text, titleSelector, navSelector, siteNav };
}

test("public DOM updates only page content and restores the original text node on navigation", () => {
    const { doc, main, text, titleSelector, navSelector, siteNav } = fixture();
    const draft = upsertVisualPatch(upsertVisualPatch(emptyVisualDocument("/visit"), titleSelector,
        { text: "발행한 제목" }), navSelector, { text: "바뀌면 안 되는 메뉴" });
    const restore = applyPublicVisual(doc, main, draft);
    assert.equal(text.nodeValue, "발행한 제목");
    assert.equal(siteNav.firstChild?.nodeValue, "메뉴");
    restore();
    assert.equal(text.nodeValue, "원래 제목");
});
