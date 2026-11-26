import assert from "node:assert/strict";
import test from "node:test";
import { revealStudioScrollParents } from "../src/cms/studio-nested-reveal.ts";

test("안쪽 스크롤 박스부터 움직이고 각 단계에서 최신 요소 위치를 읽는다", () => {
    const moves: Array<[string, number, number]> = [];
    let left = 270;
    let top = 490;
    const outer = make("outer", 0, 0, 200, 200, null, "hidden", "auto");
    const inner = make("inner", 100, 300, 150, 150, outer, "auto", "scroll");
    const target = { parentElement: inner, getBoundingClientRect: () => ({ left, top, width: 10, height: 10 }) };

    function make(id: string, x: number, y: number, width: number, height: number, parent: unknown, overflowX: string, overflowY: string) {
        return { parentElement: parent, clientLeft: 0, clientTop: 0, clientWidth: width, clientHeight: height,
            scrollWidth: width + 400, scrollHeight: height + 400, overflowX, overflowY,
            getBoundingClientRect: () => ({ left: x, top: y }),
            scrollBy: (options: ScrollToOptions) => {
                moves.push([id, options.left ?? 0, options.top ?? 0]);
                left -= options.left ?? 0;
                top -= options.top ?? 0;
            },
        };
    }
    const view = { getComputedStyle: (el: typeof inner) => el };
    revealStudioScrollParents(target as unknown as HTMLElement, view as unknown as Window, null);
    assert.deepEqual(moves, [["inner", 100, 120], ["outer", 0, 275]]);
});

test("문서 스크롤 루트는 건너뛰고 조상이 더 없으면 종료한다", () => {
    const root = { scrollBy: () => assert.fail("document scroll belongs to the window") };
    revealStudioScrollParents({ parentElement: root } as unknown as HTMLElement, {} as Window, root as unknown as Element);
});
