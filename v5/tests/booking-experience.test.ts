import test from 'node:test';
import assert from 'node:assert/strict';
import { createExperienceGateway } from '../src/booking/experience-gateway.ts';
import { BookingError } from '../src/booking/contracts.ts';
const start = Date.parse('2026-11-06T00:00:00Z');
function setup() {
    let now = start, sequence = 0;
    const gateway = createExperienceGateway({ now: () => now, id: () => `id-${++sequence}` });
    return { gateway, advance: (ms: number) => { now += ms; } };
}
const code = (expected: string) => (error: unknown) => error instanceof BookingError && error.code === expected;
async function choice(gateway: ReturnType<typeof createExperienceGateway>) {
    const catalog = await gateway.catalog();
    const session = catalog.sessions.find(item => item.bookingEnabled)!;
    const inventory = await gateway.inventory(session.id);
    return { catalog, session, inventory, seats: inventory.seats.filter(item => item.available) };
}
test('experience catalog uses isolated IDs and future Seoul dates', async () => {
    const { gateway } = setup(); const { catalog, session } = await choice(gateway);
    assert.equal(gateway.mode, 'experience');
    assert.ok(catalog.programs.length > 0);
    assert.ok(catalog.programs.every(item => item.id.startsWith('experience-')));
    assert.ok(catalog.sessions.every(item => item.id.startsWith('experience-')));
    assert.ok(Date.parse(session.startsAt) > start);
});
test('selected seats progress held → unpaid → cancelled without issuing a ticket', async () => {
    const { gateway } = setup(); const { session, seats } = await choice(gateway);
    const held = await gateway.hold({ sessionId: session.id, seatIds: seats.slice(0, 2).map(s => s.id), participants: 2, requestKey: 'hold-1' });
    assert.equal(held.status, 'held'); assert.equal(held.total, seats[0].price + seats[1].price);
    assert.equal(Date.parse(held.expiresAt) - Date.parse(held.serverNow), 300_000);
    assert.equal((await gateway.inventory(session.id)).seats.find(s => s.id === seats[0].id)?.available, false);
    const confirmed = await gateway.confirm({ reservationId: held.id, requestKey: 'confirm-1' });
    assert.equal(confirmed.status, 'reserved_unpaid'); assert.equal(confirmed.mode, 'experience');
    assert.equal((await gateway.cancel(held.id)).status, 'cancelled');
    assert.equal((await gateway.inventory(session.id)).seats.find(s => s.id === seats[0].id)?.available, true);
});
test('invalid counts, duplicate, unavailable and foreign seats never create a hold', async () => {
    const { gateway } = setup(); const { session, seats, inventory } = await choice(gateway);
    for (const participants of [0, 5, 1.5, NaN]) await assert.rejects(gateway.hold({ sessionId: session.id, seatIds: [seats[0].id], participants, requestKey: 'x' }), code('INVALID_SELECTION'));
    await assert.rejects(gateway.hold({ sessionId: session.id, seatIds: [seats[0].id, seats[0].id], participants: 2, requestKey: 'dup' }), code('INVALID_SELECTION'));
    await assert.rejects(gateway.hold({ sessionId: session.id, seatIds: ['foreign'], participants: 1, requestKey: 'foreign' }), code('INVALID_SELECTION'));
    const blocked = inventory.seats.find(s => !s.available)!;
    await assert.rejects(gateway.hold({ sessionId: session.id, seatIds: [blocked.id], participants: 1, requestKey: 'blocked' }), code('SEATS_UNAVAILABLE'));
});
test('idempotent retry reuses the reservation and detects changed payload', async () => {
    const { gateway } = setup(); const { session, seats } = await choice(gateway);
    const input = { sessionId: session.id, seatIds: seats.slice(0, 2).map(s => s.id), participants: 2, requestKey: 'retry' };
    const first = await gateway.hold(input);
    assert.equal((await gateway.hold({ ...input, seatIds: [...input.seatIds].reverse() })).id, first.id);
    await assert.rejects(gateway.hold({ ...input, seatIds: [seats[2].id, seats[3].id] }), code('IDEMPOTENCY_CONFLICT'));
    const confirmed = await gateway.confirm({ reservationId: first.id, requestKey: 'confirm' });
    assert.equal((await gateway.confirm({ reservationId: first.id, requestKey: 'confirm' })).id, confirmed.id);
});
test('concurrent holds cannot claim the same seat; quantity limit includes holds', async () => {
    const { gateway } = setup(); const { session, seats } = await choice(gateway);
    const input = { sessionId: session.id, seatIds: [seats[0].id], participants: 1 };
    const results = await Promise.allSettled([gateway.hold({ ...input, requestKey: 'a' }), gateway.hold({ ...input, requestKey: 'b' })]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    await gateway.hold({ sessionId: session.id, seatIds: seats.slice(1, 4).map(s => s.id), participants: 3, requestKey: 'remaining' });
    await assert.rejects(gateway.hold({ sessionId: session.id, seatIds: [seats[4].id], participants: 1, requestKey: 'fifth' }), code('MEMBER_LIMIT'));
});
test('expiry releases seats and blocks confirmation and replay', async () => {
    const { gateway, advance } = setup(); const { session, seats } = await choice(gateway);
    const input = { sessionId: session.id, seatIds: [seats[0].id], participants: 1, requestKey: 'expire' };
    const held = await gateway.hold(input); advance(300_000);
    await assert.rejects(gateway.confirm({ reservationId: held.id, requestKey: 'late' }), code('RESERVATION_EXPIRED'));
    await assert.rejects(gateway.hold(input), code('RESERVATION_EXPIRED'));
    assert.equal((await gateway.inventory(session.id)).seats.find(s => s.id === seats[0].id)?.available, true);
});
test('cancel is idempotent; replay cannot resurrect a cancelled hold', async () => {
    const { gateway } = setup(); const { session, seats } = await choice(gateway);
    const input = { sessionId: session.id, seatIds: [seats[0].id], participants: 1, requestKey: 'cancel' };
    const held = await gateway.hold(input); await gateway.cancel(held.id);
    assert.equal((await gateway.cancel(held.id)).status, 'cancelled');
    await assert.rejects(gateway.hold(input), code('RESERVATION_CLOSED'));
});
test('unknown, disabled and past sessions are rejected', async () => {
    const { gateway, advance } = setup(); const { catalog, session, seats } = await choice(gateway);
    await assert.rejects(gateway.inventory('unknown'), code('SESSION_NOT_FOUND'));
    const disabled = catalog.sessions.find(s => !s.bookingEnabled)!;
    await assert.rejects(gateway.hold({ sessionId: disabled.id, seatIds: [], participants: 1, requestKey: 'disabled' }), code('BOOKING_DISABLED'));
    advance(Date.parse(session.startsAt) - start + 1);
    await assert.rejects(gateway.hold({ sessionId: session.id, seatIds: [seats[0].id], participants: 1, requestKey: 'past' }), code('BOOKING_DISABLED'));
});
test('returned arrays cannot mutate saved inventory and reservations', async () => {
    const { gateway } = setup(); const { session, seats } = await choice(gateway);
    const input = { sessionId: session.id, seatIds: [seats[0].id], participants: 1, requestKey: 'immutable' };
    const held = await gateway.hold(input); held.seats.length = 0;
    assert.equal((await gateway.hold(input)).seats.length, 1);
    seats[0].price = -1;
    assert.ok((await gateway.inventory(session.id)).seats[0].price >= 0);
});
test('aborted reads are rejected', async () => {
    const { gateway } = setup(); const abort = new AbortController(); abort.abort();
    await assert.rejects(gateway.catalog(abort.signal), { name: 'AbortError' });
});
