import test from 'node:test';
import assert from 'node:assert/strict';
import { BookingController } from '../src/booking/controller.ts';
import { createExperienceGateway } from '../src/booking/experience-gateway.ts';
import type { BookingGateway, BookingInventory } from '../src/booking/contracts.ts';
let time = Date.parse('2026-11-06T00:00:00Z');
function setup(patch: Partial<BookingGateway> = {}) {
    let seq = 0; time = Date.parse('2026-11-06T00:00:00Z');
    const gateway = { ...createExperienceGateway({ now: () => time, id: () => `r-${++seq}` }), ...patch };
    const controller = new BookingController(gateway, () => time, () => `k-${++seq}`);
    return { controller, gateway };
}
async function choose(controller: BookingController) {
    await controller.start();
    const s = controller.getSnapshot().catalog!.sessions.find(s => s.bookingEnabled)!;
    controller.setDate(s.startsAt.slice(0,10)); controller.setProgram(s.programId); controller.setSession(s.id);
    await controller.openSeats();
    controller.toggleSeat(controller.getSnapshot().inventory!.seats.find(s => s.available)!.id);
}
test('flow validates choices then completes and resets', async () => {
    const { controller } = setup(); await controller.start(); await controller.openSeats();
    assert.equal(controller.getSnapshot().step,'selection'); assert.ok(controller.getSnapshot().error);
    await choose(controller); await controller.review(); assert.equal(controller.getSnapshot().step,'review');
    await controller.confirm(); assert.equal(controller.getSnapshot().step,'review');
    controller.setAccepted(true); await controller.confirm(); assert.equal(controller.getSnapshot().step,'complete');
    await controller.restart(); assert.equal(controller.getSnapshot().step,'selection'); assert.equal(controller.getSnapshot().receipt,null);
});
test('double-click review creates a single hold and stable request keys', async () => {
    const { controller, gateway } = setup(); let calls = 0; const original = gateway.hold;
    gateway.hold = async input => { calls++; return original(input); };
    await choose(controller); await Promise.all([controller.review(),controller.review()]); assert.equal(calls,1);
});
test('uncertain hold blocks changes and retries the same key without creating a second hold', async () => {
    const { controller, gateway } = setup(); const original = gateway.hold; const keys: string[]=[];
    gateway.hold = async input => { keys.push(input.requestKey); const r = await original(input); if(keys.length===1)throw new Error('lost reply');return r; };
    await choose(controller); const before=controller.getSnapshot().sessionId;
    await controller.review(); assert.equal(controller.getSnapshot().uncertain,true);
    controller.setSession('anything'); await controller.back(); assert.equal(controller.getSnapshot().sessionId,before); assert.equal(controller.getSnapshot().step,'seats');
    await controller.review(); assert.equal(controller.getSnapshot().step,'review');assert.deepEqual(keys,[keys[0],keys[0]]);
});
test('back cancels hold before changing seats and failure preserves hold', async () => {
    const { controller, gateway } = setup(); await choose(controller); await controller.review();
    const original=gateway.cancel; gateway.cancel=async()=>{throw new Error('offline');};
    await controller.back(); assert.equal(controller.getSnapshot().step,'review'); assert.ok(controller.getSnapshot().receipt);
    gateway.cancel=original; await controller.back(); assert.equal(controller.getSnapshot().step,'seats'); assert.equal(controller.getSnapshot().receipt,null);
});
test('late inventory cannot replace current session after going back', async () => {
    let resolve!: (value: BookingInventory)=>void;
    const { controller,gateway }=setup(); const original=gateway.inventory;
    await controller.start(); const session=controller.getSnapshot().catalog!.sessions[0];
    controller.setDate(session.startsAt.slice(0,10));controller.setProgram(session.programId);controller.setSession(session.id);
    gateway.inventory=()=>new Promise(done=>{resolve=done;});
    const pending=controller.openSeats(); await controller.back(); controller.setSession(controller.getSnapshot().catalog!.sessions[1].id);
    resolve(await original(session.id));await pending; assert.equal(controller.getSnapshot().inventory,null); assert.equal(controller.getSnapshot().step,'selection');
});
test('selection changes reset downstream fields; seat count never exceeds participants', async()=>{
    const {controller}=setup();await choose(controller);const seats=controller.getSnapshot().inventory!.seats.filter(s=>s.available);
    controller.toggleSeat(seats[1].id);assert.equal(controller.getSnapshot().seatIds.length,1);
    await controller.back();controller.setParticipants(2);assert.equal(controller.getSnapshot().seatIds.length,0);
    controller.setDate('2099-01-01');assert.equal(controller.getSnapshot().sessionId,'');assert.equal(controller.getSnapshot().programId,'');
    controller.setParticipants(5);assert.equal(controller.getSnapshot().participants,2);
});
test('expiry blocks confirmation and recovers to seat selection',async()=>{
    const {controller}=setup();await choose(controller);await controller.review();controller.setAccepted(true);
    time+=300000;controller.tick();await controller.confirm();assert.equal(controller.getSnapshot().step,'review');assert.ok(controller.getSnapshot().error);
    await controller.back();assert.equal(controller.getSnapshot().step,'seats');assert.equal(controller.getSnapshot().receipt,null);
});
test('dispose ignores pending reads and stops listener updates',async()=>{
    let resolve!: (value: BookingInventory)=>void;const {controller,gateway}=setup();await choose(controller);
    const original=gateway.inventory;gateway.inventory=()=>new Promise(done=>{resolve=done;});
    const pending=controller.refreshInventory();controller.dispose();const state=controller.getSnapshot();resolve(await original(state.sessionId));await pending;assert.equal(controller.getSnapshot(),state);
});
test('uncertain confirmation cannot be replaced by a cancellation request',async()=>{
    const {controller,gateway}=setup();await choose(controller);await controller.review();controller.setAccepted(true);
    const original=gateway.confirm;gateway.confirm=async input=>{await original(input);throw new Error('reply lost');};
    let cancelled=0;gateway.cancel=async()=>{cancelled++;throw new Error('must not call');};
    await controller.confirm();await controller.back();assert.equal(cancelled,0);assert.equal(controller.getSnapshot().uncertainAction,'confirm');
});
test('uncertain cancellation cannot be replaced by confirmation',async()=>{
    const {controller,gateway}=setup();await choose(controller);await controller.review();controller.setAccepted(true);
    gateway.cancel=async()=>{throw new Error('reply lost');};let confirmed=0;const original=gateway.confirm;
    gateway.confirm=async input=>{confirmed++;return original(input);};await controller.back();await controller.confirm();assert.equal(confirmed,0);assert.equal(controller.getSnapshot().uncertainAction,'cancel');
});

test("hold, confirmation and cancellation publish only complete state transitions", async () => {
    const { controller } = setup();
    await choose(controller);
    const states: ReturnType<typeof controller.getSnapshot>[] = [];
    const unsubscribe = controller.subscribe(() => states.push(controller.getSnapshot()));
    try {
        await controller.review();
        assert.deepEqual(states.map((s) => [s.busy, s.step, s.receipt?.status ?? null]), [
            [true, "seats", null],
            [false, "review", "held"],
        ]);
        controller.setAccepted(true);
        states.length = 0;
        await controller.confirm();
        assert.deepEqual(states.map((s) => [s.busy, s.step, s.receipt?.status ?? null]), [
            [true, "review", "held"],
            [false, "complete", "reserved_unpaid"],
        ]);
        states.length = 0;
        await controller.restart();
        assert.deepEqual(states.map((s) => [s.busy, s.step, s.receipt?.status ?? null]), [
            [true, "complete", "reserved_unpaid"],
            [false, "selection", null],
        ]);
    } finally {
        unsubscribe();
    }
});
