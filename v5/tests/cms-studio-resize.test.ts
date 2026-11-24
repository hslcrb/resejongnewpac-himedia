import assert from "node:assert/strict";
import test from "node:test";
import { resizeStudioBox } from "../src/cms/studio-resize.ts";

test("축소 캔버스의 화면 이동을 문서 픽셀로 한 번만 환산한다", () => {
    assert.deepEqual(resizeStudioBox({ width: 200, height: 120 }, { x: 25, y: 15 }, 0.5), { width: 250, height: 150 });
    assert.deepEqual(resizeStudioBox({ width: 200, height: 120 }, { x: 0, y: 0 }, 2), { width: 200, height: 120 });
});

test("가로세로 비율과 허용 범위를 유지한다", () => {
    assert.deepEqual(resizeStudioBox({ width: 200, height: 100 }, { x: 50, y: 1 }, 1, true), { width: 250, height: 125 });
    assert.deepEqual(resizeStudioBox({ width: 200, height: 100 }, { x: -400, y: 0 }, 1, true), { width: 24, height: 12 });
    assert.deepEqual(resizeStudioBox({ width: 200, height: 100 }, { x: 5000, y: 0 }, 1, true), { width: 4096, height: 2048 });
    assert.equal(resizeStudioBox({ width: 0, height: 100 }, { x: 3, y: 2 }, 1), null);
    assert.equal(resizeStudioBox({ width: 200, height: 100 }, { x: 3, y: 2 }, 0), null);
});
