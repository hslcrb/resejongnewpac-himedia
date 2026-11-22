import assert from "node:assert/strict";
import test from "node:test";
import { revealStudioAxis, studioStageTarget } from "../src/cms/studio-reveal.ts";

test("보이는 선택 영역은 그대로 두고 화면 바깥의 요소를 중심으로 가져온다", () => {
    assert.equal(revealStudioAxis(20, 30, 200), 0);
    assert.equal(revealStudioAxis(275, 50, 200), 200);
    assert.equal(revealStudioAxis(-55, 20, 200), -145);
});

test("화면보다 큰 요소는 앞 가장자리를 보여주고 숨겨진 캔버스는 움직이지 않는다", () => {
    assert.equal(revealStudioAxis(35, 800, 200), 35);
    assert.equal(revealStudioAxis(1, 40, 0), 0);
    assert.equal(revealStudioAxis(1, Infinity, 200), 0);
});

test("확대된 프레임 좌표는 프레임에 실제로 보이는 부분만 사용한다", () => {
    const frame = { left: 100, top: 60, width: 400, height: 300 };
    assert.deepEqual(studioStageTarget({ left: -20, top: 500, width: 220, height: 200 }, frame, 800, 600),
        { left: 100, top: 310, width: 100, height: 50 });
    assert.equal(studioStageTarget({ left: 900, top: 30, width: 40, height: 40 }, frame, 800, 600), null);
    assert.equal(studioStageTarget({ left: 0, top: 0, width: 40, height: 40 }, frame, 0, 600), null);
});
