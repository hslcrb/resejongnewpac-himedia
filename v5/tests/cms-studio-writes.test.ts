import assert from "node:assert/strict";
import test from "node:test";
import { createStudioWrites } from "../src/cms/studio-writes.ts";

test("중복 원격 쓰기를 거부하고 저장 중 생긴 새 편집을 그대로 둔다", () => {
    const writes = createStudioWrites();
    const save = writes.begin();
    assert.equal(writes.busy(), true);
    assert.equal(writes.begin(), null);
    writes.changed();
    assert.equal(writes.isCurrent(save!), false);
    writes.finish(save!);
    assert.equal(writes.busy(), false);
    const next = writes.begin();
    assert.ok(next);
    assert.equal(writes.isCurrent(next), true);
    writes.finish(save!);
    assert.equal(writes.busy(), true);
    writes.finish(next);
    assert.equal(writes.busy(), false);
});
