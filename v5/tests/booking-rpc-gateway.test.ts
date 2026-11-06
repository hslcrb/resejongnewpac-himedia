import test from 'node:test';
import assert from 'node:assert/strict';
import { createRpcBookingGateway } from '../src/booking/rpc-gateway.ts';
import { BookingError } from '../src/booking/contracts.ts';
const serverNow = '2026-11-06T00:00:00Z';
const catalog = { programs: [{ id: 'concert', title: '공연', venue: '극장', category: '공연' }], sessions: [{ id: 'session-1', programId: 'concert', startsAt: '2026-11-07T19:00:00+09:00', bookingEnabled: true }] };
const inventory = { kind: 'inventory', sessionId: 'session-1', bookingEnabled: true, serverNow, seats: [{ id: 'seat-1', label: 'A1', row: 'A', number: 1, price: 30000, available: true }] };
const result = { kind: 'reservation', serverNow, reservation: { id: 'reservation-1', sessionId: 'session-1', programId: 'concert', title: '공연', venue: '극장', date: '2026-11-07', time: '19:00', seats: ['A1'], total: 30000, status: 'held', expiresAt: '2026-11-06T00:05:00Z' } };
const input = { sessionId: 'session-1', seatIds: ['seat-1'], participants: 1, requestKey: 'request-1' };
const fail = (code: string) => (error: unknown) => error instanceof BookingError && error.code === code;
function make(data: unknown, error: unknown = null) {
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const gateway = createRpcBookingGateway({ catalog: async () => catalog, rpc: async (name, args) => { calls.push({ name, args }); return { data, error }; } });
    return { gateway, calls };
}
test('live holds pass only identifiers and the idempotency key, never client prices or owner', async () => {
    const { gateway, calls } = make(result);
    assert.equal(gateway.mode, 'live');
    assert.equal((await gateway.hold(input)).mode, 'live');
    assert.deepEqual(calls, [{ name: 'hold_seats', args: { p_session_id: 'session-1', p_seat_ids: ['seat-1'], p_request_key: 'request-1' } }]);
});
test('same retry key is passed unchanged after uncertain network outcome', async () => {
    const calls: string[] = [];
    const gateway = createRpcBookingGateway({ catalog: async () => catalog, rpc: async (_name, args) => {
        calls.push(String(args.p_request_key)); if (calls.length === 1) throw new Error('offline'); return { data: result, error: null };
    } });
    await assert.rejects(gateway.hold(input), fail('NETWORK_ERROR'));
    await gateway.hold(input); assert.deepEqual(calls, ['request-1', 'request-1']);
});
test('experience IDs are blocked before a live RPC call', async () => {
    const { gateway, calls } = make(result);
    await assert.rejects(gateway.hold({ ...input, sessionId: 'experience-session' }), fail('EXPERIENCE_ID_REJECTED'));
    await assert.rejects(gateway.hold({ ...input, seatIds: ['experience-seat-1'] }), fail('EXPERIENCE_ID_REJECTED'));
    await assert.rejects(gateway.cancel('experience-reservation-1'), fail('EXPERIENCE_ID_REJECTED'));
    assert.equal(calls.length, 0);
});
test('inventory rejects negative prices, duplicate seats and wrong session responses', async () => {
    const valid = make(inventory); assert.equal((await valid.gateway.inventory('session-1')).seats[0].price, 30000);
    for (const data of [
        { ...inventory, sessionId: 'session-other' },
        { ...inventory, seats: [inventory.seats[0], inventory.seats[0]] },
        { ...inventory, seats: [{ ...inventory.seats[0], price: -1 }] },
        { ...inventory, seats: [{ ...inventory.seats[0], available: 'yes' }] },
    ]) await assert.rejects(make(data).gateway.inventory('session-1'), fail('INVALID_RESPONSE'));
});
test('malformed receipt or unrelated reservation cannot be treated as success', async () => {
    for (const reservation of [
        { ...result.reservation, total: 1.5 }, { ...result.reservation, status: 'paid' },
        { ...result.reservation, sessionId: 'other-session' }, { ...result.reservation, seats: [] },
        { ...result.reservation, expiresAt: 'not-a-time' }, { ...result.reservation, id: 'experience-id' },
    ]) await assert.rejects(make({ ...result, reservation }).gateway.hold(input), fail('INVALID_RESPONSE'));
    await assert.rejects(make(result).gateway.confirm({ reservationId: 'different-id', requestKey: 'confirm-1' }), fail('INVALID_RESPONSE'));
});
test('business errors and auth failure do not fall back to local success', async () => {
    await assert.rejects(make({ kind: 'error', code: 'SEATS_UNAVAILABLE' }).gateway.hold(input), fail('SEATS_UNAVAILABLE'));
    await assert.rejects(make(null, { code: '42501' }).gateway.hold(input), fail('AUTH_REQUIRED'));
    await assert.rejects(make(null, { code: 'other' }).gateway.hold(input), fail('NETWORK_ERROR'));
});
test('catalog validates relationships and rejects experience records', async () => {
    assert.equal((await make(result).gateway.catalog()).sessions.length, 1);
    const gateway = createRpcBookingGateway({ catalog: async () => ({ ...catalog, sessions: [{ ...catalog.sessions[0], programId: 'missing' }] }), rpc: async () => ({ data: null, error: null }) });
    await assert.rejects(gateway.catalog(), fail('INVALID_RESPONSE'));
});
test('cancel requires a closed response; held response does not clear selection', async () => {
    await assert.rejects(make(result).gateway.cancel('reservation-1'), fail('INVALID_RESPONSE'));
    const closed = { ...result, reservation: { ...result.reservation, status: 'cancelled' } };
    assert.equal((await make(closed).gateway.cancel('reservation-1')).status, 'cancelled');
});
