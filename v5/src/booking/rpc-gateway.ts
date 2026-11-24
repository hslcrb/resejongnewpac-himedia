import { BookingError, validId, validateHold } from "./contracts.ts";
import type {
    BookingCatalog,
    BookingGateway,
    BookingInventory,
    BookingReservation,
    BookingStatus,
} from "./contracts.ts";

/** Supabase 클라이언트 자체가 아니라 공개 RPC와 카탈로그 함수를 주입합니다. */
export interface BookingRpcTransport {
    catalog(signal?: AbortSignal): Promise<unknown>;
    rpc(
        name: string,
        args: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: unknown }>;
}
const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0 && value.length <= 1000;
const instant = (value: unknown): value is string =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value));
const money = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const liveId = (value: unknown): value is string =>
    validId(value) && !value.startsWith("experience-");
const badResponse = (): never => {
    throw new BookingError("INVALID_RESPONSE");
};
function inputId(value: string): void {
    if (value.startsWith("experience-")) throw new BookingError("EXPERIENCE_ID_REJECTED");
    if (!validId(value)) throw new BookingError("INVALID_SELECTION");
}
function parseCatalog(value: unknown): BookingCatalog {
    if (!object(value) || !Array.isArray(value.programs) || !Array.isArray(value.sessions))
        return badResponse();
    const programs = value.programs.map((item) => {
        if (
            !object(item) ||
            !liveId(item.id) ||
            !text(item.title) ||
            !text(item.venue) ||
            !text(item.category)
        )
            return badResponse();
        return { id: item.id, title: item.title, venue: item.venue, category: item.category };
    });
    const ids = new Set(programs.map((item) => item.id));
    if (ids.size !== programs.length) return badResponse();
    const sessions = value.sessions.map((item) => {
        if (
            !object(item) ||
            !liveId(item.id) ||
            !liveId(item.programId) ||
            !ids.has(item.programId) ||
            !instant(item.startsAt) ||
            typeof item.bookingEnabled !== "boolean"
        )
            return badResponse();
        return {
            id: item.id,
            programId: item.programId,
            startsAt: item.startsAt,
            bookingEnabled: item.bookingEnabled,
        };
    });
    if (new Set(sessions.map((item) => item.id)).size !== sessions.length) return badResponse();
    return { programs, sessions };
}
function parseInventory(value: unknown, sessionId: string): BookingInventory {
    if (
        !object(value) ||
        value.kind !== "inventory" ||
        value.sessionId !== sessionId ||
        typeof value.bookingEnabled !== "boolean" ||
        !instant(value.serverNow) ||
        !Array.isArray(value.seats)
    )
        return badResponse();
    const seats = value.seats.map((seat) => {
        if (
            !object(seat) ||
            !liveId(seat.id) ||
            !text(seat.label) ||
            !text(seat.row) ||
            typeof seat.number !== "number" ||
            !Number.isSafeInteger(seat.number) ||
            seat.number < 1 ||
            !money(seat.price) ||
            typeof seat.available !== "boolean"
        )
            return badResponse();
        return {
            id: seat.id,
            label: seat.label,
            row: seat.row,
            number: seat.number,
            price: seat.price,
            available: seat.available,
        };
    });
    if (new Set(seats.map((seat) => seat.id)).size !== seats.length) return badResponse();
    return { sessionId, bookingEnabled: value.bookingEnabled, serverNow: value.serverNow, seats };
}
function parseReservation(
    value: unknown,
    expected: {
        id?: string;
        sessionId?: string;
        quantity?: number;
        statuses: readonly BookingStatus[];
    },
): BookingReservation {
    if (
        !object(value) ||
        value.kind !== "reservation" ||
        !instant(value.serverNow) ||
        !object(value.reservation)
    )
        return badResponse();
    const r = value.reservation;
    if (
        !liveId(r.id) ||
        !liveId(r.sessionId) ||
        !liveId(r.programId) ||
        !text(r.title) ||
        !text(r.venue) ||
        typeof r.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
        !Number.isFinite(Date.parse(`${r.date}T00:00:00Z`)) ||
        typeof r.time !== "string" ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(r.time) ||
        !Array.isArray(r.seats) ||
        r.seats.length < 1 ||
        r.seats.length > 4 ||
        !r.seats.every(text) ||
        new Set(r.seats).size !== r.seats.length ||
        !money(r.total) ||
        !instant(r.expiresAt) ||
        typeof r.status !== "string" ||
        !expected.statuses.includes(r.status as BookingStatus) ||
        (expected.id !== undefined && r.id !== expected.id) ||
        (expected.sessionId !== undefined && r.sessionId !== expected.sessionId) ||
        (expected.quantity !== undefined && r.seats.length !== expected.quantity)
    )
        return badResponse();
    if (
        ["held", "reserved_unpaid"].includes(r.status) &&
        Date.parse(r.expiresAt) <= Date.parse(value.serverNow)
    )
        throw new BookingError("RESERVATION_EXPIRED");
    return {
        mode: "live",
        id: r.id,
        sessionId: r.sessionId,
        programId: r.programId,
        title: r.title,
        venue: r.venue,
        date: r.date,
        time: r.time,
        seats: [...r.seats] as string[],
        total: r.total,
        status: r.status as BookingStatus,
        expiresAt: r.expiresAt,
        serverNow: value.serverNow,
    };
}

export function createRpcBookingGateway(transport: BookingRpcTransport): BookingGateway {
    async function call(name: string, args: Record<string, unknown>): Promise<unknown> {
        let response: { data: unknown; error: unknown };
        try {
            response = await transport.rpc(name, args);
        } catch {
            throw new BookingError("NETWORK_ERROR");
        }
        if (!object(response)) return badResponse();
        if (response.error)
            throw new BookingError(
                object(response.error) && response.error.code === "42501"
                    ? "AUTH_REQUIRED"
                    : "NETWORK_ERROR",
            );
        if (object(response.data) && response.data.kind === "error") {
            if (!text(response.data.code)) return badResponse();
            throw new BookingError(response.data.code);
        }
        return response.data;
    }
    return {
        mode: "live",
        async catalog(signal) {
            signal?.throwIfAborted();
            let data: unknown;
            try {
                data = await transport.catalog(signal);
            } catch (error) {
                signal?.throwIfAborted();
                throw error instanceof BookingError ? error : new BookingError("NETWORK_ERROR");
            }
            signal?.throwIfAborted();
            return parseCatalog(data);
        },
        async inventory(sessionId, signal) {
            inputId(sessionId);
            signal?.throwIfAborted();
            const data = await call("get_session_seats", { p_session_id: sessionId });
            signal?.throwIfAborted();
            return parseInventory(data, sessionId);
        },
        async hold(input) {
            inputId(input.sessionId);
            input.seatIds.forEach(inputId);
            validateHold(input);
            const data = await call("hold_seats", {
                p_session_id: input.sessionId,
                p_seat_ids: [...input.seatIds],
                p_request_key: input.requestKey,
            });
            return parseReservation(data, {
                sessionId: input.sessionId,
                quantity: input.participants,
                statuses: ["held", "reserved_unpaid"],
            });
        },
        async confirm(input) {
            inputId(input.reservationId);
            if (!validId(input.requestKey)) throw new BookingError("INVALID_SELECTION");
            return parseReservation(
                await call("confirm_reservation", {
                    p_reservation_id: input.reservationId,
                    p_request_key: input.requestKey,
                }),
                { id: input.reservationId, statuses: ["reserved_unpaid"] },
            );
        },
        async cancel(reservationId) {
            inputId(reservationId);
            return parseReservation(
                await call("cancel_reservation", { p_reservation_id: reservationId }),
                { id: reservationId, statuses: ["cancelled", "expired", "released"] },
            );
        },
    };
}
