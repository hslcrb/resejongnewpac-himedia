import { BookingError, sessionParts, validId, validateHold } from "./contracts.ts";
import type { BookingCatalog, BookingGateway, BookingReservation, BookingSeat, BookingSession } from "./contracts.ts";

/** 네트워크·회원 저장소를 사용하지 않는 인스턴스별 체험 공급자입니다. */
export function createExperienceGateway(options: { now?: () => number; id?: () => string } = {}): BookingGateway {
    const now = options.now || Date.now;
    const id = options.id || (() => crypto.randomUUID());
    const programs = [
        { id: "experience-concert", title: "빛과 선율 · 체험 공연", venue: "체험 공연장", category: "공연" },
        { id: "experience-dance", title: "움직임의 시간 · 체험 공연", venue: "체험 소극장", category: "공연" },
    ];
    const day = sessionParts(new Date(now()).toISOString()).date;
    const sessions: BookingSession[] = [];
    for (let offset = 1; offset <= 14; offset++) {
        const date = new Date(Date.parse(`${day}T12:00:00+09:00`) + offset * 86_400_000).toISOString().slice(0, 10);
        for (const program of programs) for (const hour of [14, 19]) sessions.push({
            id: `${program.id}-${date}-${hour}`, programId: program.id,
            startsAt: `${date}T${hour}:00:00+09:00`, bookingEnabled: !(offset === 2 && hour === 14),
        });
    }
    const seats: BookingSeat[] = Array.from({ length: 24 }, (_, index) => ({
        id: `experience-seat-${index + 1}`, label: `${"ABCD"[Math.floor(index / 6)]}${index % 6 + 1}`,
        row: "ABCD"[Math.floor(index / 6)], number: index % 6 + 1,
        price: index < 12 ? 30000 : 20000, available: ![3, 10, 17].includes(index),
    }));
    const reservations = new Map<string, BookingReservation>();
    const requests = new Map<string, { signature: string; reservationId: string }>();
    const selectedSeats = new Map<string, string[]>();
    const timestamp = () => new Date(now()).toISOString();
    const copy = <T,>(value: T): T => structuredClone(value);
    function expire() {
        for (const item of reservations.values()) if (["held", "reserved_unpaid"].includes(item.status) && Date.parse(item.expiresAt) <= now()) item.status = "expired";
    }
    function getSession(sessionId: string) {
        const session = sessions.find(item => item.id === sessionId);
        if (!session) throw new BookingError("SESSION_NOT_FOUND");
        return session;
    }
    function getReservation(reservationId: string) {
        expire(); const item = reservations.get(reservationId);
        if (!item) throw new BookingError("RESERVATION_NOT_FOUND");
        return item;
    }
    function ensureActive(item: BookingReservation) {
        if (item.status === "expired") throw new BookingError("RESERVATION_EXPIRED");
        if (!["held", "reserved_unpaid"].includes(item.status)) throw new BookingError("RESERVATION_CLOSED");
    }
    function snapshot(item: BookingReservation) { return copy({ ...item, serverNow: timestamp() }); }
    function replay(key: string, signature: string) {
        const prior = requests.get(key);
        if (!prior) return null;
        if (prior.signature !== signature) throw new BookingError("IDEMPOTENCY_CONFLICT");
        const item = getReservation(prior.reservationId); ensureActive(item); return snapshot(item);
    }
    return {
        mode: "experience",
        async catalog(signal) { signal?.throwIfAborted(); return copy({ programs, sessions } satisfies BookingCatalog); },
        async inventory(sessionId, signal) {
            signal?.throwIfAborted(); expire(); const session = getSession(sessionId);
            const occupied = new Set([...reservations.values()].filter(item => item.sessionId === sessionId && ["held", "reserved_unpaid"].includes(item.status)).flatMap(item => selectedSeats.get(item.id) || []));
            return { sessionId, bookingEnabled: session.bookingEnabled && Date.parse(session.startsAt) > now(), serverNow: timestamp(), seats: seats.map(seat => ({ ...seat, available: seat.available && !occupied.has(seat.id) })) };
        },
        async hold(input) {
            expire(); const session = getSession(input.sessionId);
            if (!session.bookingEnabled || Date.parse(session.startsAt) <= now()) throw new BookingError("BOOKING_DISABLED");
            validateHold(input);
            const signature = JSON.stringify([input.sessionId, input.participants, [...input.seatIds].sort()]);
            const previous = replay(`hold:${input.requestKey}`, signature); if (previous) return previous;
            const picked = input.seatIds.map(seatId => seats.find(seat => seat.id === seatId));
            if (picked.some(seat => !seat)) throw new BookingError("INVALID_SELECTION");
            const active = [...reservations.values()].filter(item => item.sessionId === input.sessionId && ["held", "reserved_unpaid"].includes(item.status));
            const occupied = new Set(active.flatMap(item => selectedSeats.get(item.id) || []));
            if (picked.some(seat => !seat!.available || occupied.has(seat!.id))) throw new BookingError("SEATS_UNAVAILABLE");
            if (active.reduce((sum, item) => sum + item.seats.length, 0) + input.participants > 4) throw new BookingError("MEMBER_LIMIT");
            const program = programs.find(item => item.id === session.programId)!;
            const item: BookingReservation = {
                mode: "experience", id: `experience-reservation-${id()}`, sessionId: session.id, programId: program.id,
                title: program.title, venue: program.venue, ...sessionParts(session.startsAt),
                seats: picked.map(seat => seat!.label), total: picked.reduce((sum, seat) => sum + seat!.price, 0),
                status: "held", expiresAt: new Date(now() + 300_000).toISOString(), serverNow: timestamp(),
            };
            reservations.set(item.id, item); selectedSeats.set(item.id, [...input.seatIds]);
            requests.set(`hold:${input.requestKey}`, { signature, reservationId: item.id }); return snapshot(item);
        },
        async confirm(input) {
            if (!validId(input.requestKey)) throw new BookingError("INVALID_SELECTION");
            const previous = replay(`confirm:${input.requestKey}`, input.reservationId); if (previous) return previous;
            const item = getReservation(input.reservationId); ensureActive(item); item.status = "reserved_unpaid";
            requests.set(`confirm:${input.requestKey}`, { signature: input.reservationId, reservationId: item.id }); return snapshot(item);
        },
        async cancel(reservationId) {
            const item = getReservation(reservationId);
            if (["held", "reserved_unpaid"].includes(item.status)) item.status = "cancelled";
            return snapshot(item);
        },
    };
}
