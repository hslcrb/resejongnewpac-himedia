import assert from "node:assert/strict";
import test from "node:test";
import { isStudioFrameLocation } from "../src/cms/studio-frame.ts";

const origin = "https://example.org";
test("작업 문서의 동일 출처와 동일 공개 경로만 허용한다", () => {
    assert.equal(isStudioFrameLocation(origin, "/visit", origin + "/v5/visit/"), true);
    assert.equal(isStudioFrameLocation(origin, "/", origin + "/v5/"), true);
    assert.equal(isStudioFrameLocation(origin, "/visit", origin + "/v5/visit/?mode=normal#detail"), true);
    assert.equal(isStudioFrameLocation(origin, "/visit", origin + "/v5/visit/area/"), false);
    assert.equal(isStudioFrameLocation(origin, "/visit", "https://example.net/v5/visit/"), false);
    assert.equal(isStudioFrameLocation(origin, "/visit", origin + "/visit/"), false);
    assert.equal(isStudioFrameLocation(origin, "/admin", origin + "/v5/admin/"), false);
    assert.equal(isStudioFrameLocation(origin, "/visit", "about:blank"), false);
});
