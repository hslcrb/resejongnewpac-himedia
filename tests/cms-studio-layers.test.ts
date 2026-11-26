import assert from "node:assert/strict";
import test from "node:test";
import { flattenStudioLayers } from "../src/cms/studio-layers.ts";
import type { CmsPageTreeNode } from "../src/cms/page-tree.ts";

const node = (selector: string, label: string, children: CmsPageTreeNode[] = []): CmsPageTreeNode =>
    ({ selector, label, tag: "div", role: "container", children });
const nodes = [
    node("outer", "예매 영역", [node("button", "잔여 좌석 버튼"), node("note", "장애인석 안내")]),
    node("footer", "하단 정보"),
];

test("접힌 그룹은 기본 탐색에서 숨기고 검색할 때는 자식과 부모를 표시한다", () => {
    const collapsed = new Set(["outer"]);
    assert.deepEqual(flattenStudioLayers(nodes, collapsed).map(n => n.selector), ["outer","footer"]);
    assert.deepEqual(flattenStudioLayers(nodes, collapsed, " 좌석 ").map(n => [n.selector,n.depth]), [["outer",0],["button",1]]);
    assert.deepEqual(flattenStudioLayers(nodes, collapsed, "장애인석").map(n => n.selector), ["outer","note"]);
    assert.equal(collapsed.has("outer"), true);
});

test("레이어 검색은 텍스트와 역할·태그를 지원한다", () => {
    assert.equal(flattenStudioLayers(nodes,new Set(),"container").length,4);
    assert.deepEqual(flattenStudioLayers(nodes,new Set(),"없는 값"),[]);
});
