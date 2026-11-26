import assert from "node:assert/strict";
import test from "node:test";
import { STUDIO_ARTBOARDS, studioArtboardScale } from "../src/cms/studio-artboard.ts";

test("맞춤 배율은 작은 캔버스에도 화면 규격을 바꾸지 않고 들어간다", () => {
    const mobile = STUDIO_ARTBOARDS.mobile;
    assert.equal(mobile.width, 390);
    assert.equal(mobile.width * studioArtboardScale(mobile.width, 312, "fit"), 312);
    assert.equal(studioArtboardScale(mobile.width, 1000, "fit"), 1);
    assert.equal(studioArtboardScale(1440, 0, "fit"), 1);
    assert.equal(studioArtboardScale(1440, 1, "fit"), 0.05);
});

test("수동 줌은 가용 너비와 무관하다", () => {
    assert.equal(studioArtboardScale(768, 320, 125), 1.25);
    assert.equal(studioArtboardScale(768, 320, 50), 0.5);
});
