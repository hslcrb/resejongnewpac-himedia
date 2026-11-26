import test from "node:test";
import assert from "node:assert/strict";
import { getHomeLiveDate, getHomeServerDate } from "../src/lib/home-date.ts";

test("static hydration date stays stable while the live Seoul clock crosses midnight", context => {
    const server = getHomeServerDate();
    context.mock.timers.enable({ apis: ["Date"], now: new Date("2031-12-31T14:59:30Z").valueOf() });
    assert.equal(getHomeLiveDate(), "2031-12-31");
    assert.equal(getHomeServerDate(), server);
    context.mock.timers.tick(60_000);
    assert.equal(getHomeLiveDate(), "2032-01-01");
    assert.equal(getHomeServerDate(), server, "A previously exported document must hydrate with the same date");
    assert.notEqual(server, getHomeLiveDate());
});
