import assert from "node:assert/strict";
import test from "node:test";
import { visualSelectorFor } from "../src/cms/page-tree-capture.ts";
import { isSafeVisualSelector } from "../src/cms/visual-document.ts";

class Layer {
    readonly localName: string;
    readonly owner: Layer;
    readonly parentElement: Layer | null;
    readonly previousElementSibling: Layer | null;
    readonly addedId: string;

    constructor(localName: string, opts: { previous?: Layer; parent?: Layer; addedId?: string } = {}) {
        this.localName = localName;
        this.parentElement = opts.parent ?? null;
        this.previousElementSibling = opts.previous ?? null;
        this.owner = opts.addedId ? this : opts.parent?.owner ?? this;
        this.addedId = opts.addedId ?? "";
    }

    closest(selector: string) { return selector === "[data-cms-added]" && this.owner.addedId ? this.owner : null; }
    getAttribute(name: string) { return name === "data-cms-added" ? this.addedId || null : null; }
}

function assertSelector(layer: Layer, expected: string) {
    const selector = visualSelectorFor(layer as unknown as Element);
    assert.equal(selector, expected);
    assert.equal(isSafeVisualSelector(selector), true);
}

test("삽입 카드의 서로 다른 태그는 실제 전체 자식 위치를 사용한다", () => {
    const card = new Layer("article", { addedId: "card-01" });
    const title = new Layer("h3", { parent: card });
    const body = new Layer("p", { parent: card, previous: title });
    const button = new Layer("a", { parent: card, previous: body });
    const detail = new Layer("span", { parent: button });
    assertSelector(card, '[data-cms-added="card-01"]');
    assertSelector(title, '[data-cms-added="card-01"] > h3:nth-child(1)');
    assertSelector(body, '[data-cms-added="card-01"] > p:nth-child(2)');
    assertSelector(button, '[data-cms-added="card-01"] > a:nth-child(3)');
    assertSelector(detail, '[data-cms-added="card-01"] > a:nth-child(3) > span:nth-child(1)');
});

test("원본 레이어는 기존 태그별 위치 규칙을 유지한다", () => {
    const body = new Layer("body");
    const title = new Layer("h3", { parent: body });
    const first = new Layer("p", { parent: body, previous: title });
    const image = new Layer("img", { parent: body, previous: first });
    const second = new Layer("p", { parent: body, previous: image });
    assertSelector(second, "body > p:nth-of-type(2)");
});

test("중첩해 삽입한 레이어는 부모의 위치가 아닌 자기 ID로 고정한다", () => {
    const card = new Layer("article", { addedId: "card-01" });
    const independentImage = new Layer("img", { parent: card, addedId: "image-01" });
    assertSelector(independentImage, '[data-cms-added="image-01"]');
});
