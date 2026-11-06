import test from "node:test";
import assert from "node:assert/strict";
import { BookingController } from "../src/booking/controller.ts";
import { createExperienceGateway } from "../src/booking/experience-gateway.ts";

test("uncertain confirmation can be reconciled after the local hold expires", async () => {
    let now = Date.parse("2026-11-06T00:00:00Z"), sequence = 0, calls = 0;
    const gateway = createExperienceGateway({ now: () => now, id: () => `r-${++sequence}` });
    const controller = new BookingController(gateway, () => now, () => `key-${++sequence}`);
    assert.equal(controller.getSnapshot().loading, true);
    await controller.start();
    const session = controller.getSnapshot().catalog!.sessions.find(item => item.bookingEnabled)!;
    controller.setDate(session.startsAt.slice(0, 10));
    controller.setProgram(session.programId);
    controller.setSession(session.id);
    await controller.openSeats();
    controller.toggleSeat(controller.getSnapshot().inventory!.seats.find(item => item.available)!.id);
    await controller.review();
    controller.setAccepted(true);
    const original = gateway.confirm;
    gateway.confirm = async input => {
        calls++;
        const result = await original(input);
        if (calls === 1) throw new Error("reply lost after server success");
        return result;
    };
    await controller.confirm();
    assert.equal(controller.getSnapshot().uncertainAction, "confirm");
    now += 300_000;
    controller.tick();
    await controller.confirm();
    assert.equal(calls, 2);
    assert.equal(controller.getSnapshot().uncertain, false);
    await controller.back();
    assert.equal(controller.getSnapshot().step, "seats");
    await controller.restart();
    assert.equal(controller.getSnapshot().loading, false);
});
