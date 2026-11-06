/** 화면과 데이터 공급자의 경계. 체험과 실제 예약은 이 계약만 공유합니다. */
export type BookingMode = "experience" | "live";
export type BookingStatus = "held" | "reserved_unpaid" | "expired" | "cancelled" | "released";
export type BookingStep = "selection" | "seats" | "review" | "complete";
export interface BookingProgram {
    id: string;
    title: string;
    venue: string;
    category: string;
}
export interface BookingSession {
    id: string;
    programId: string;
    startsAt: string;
    bookingEnabled: boolean;
}
export interface BookingCatalog {
    programs: BookingProgram[];
    sessions: BookingSession[];
}
export interface BookingSeat {
    id: string;
    label: string;
    row: string;
    number: number;
    price: number;
    available: boolean;
}
export interface BookingInventory {
    sessionId: string;
    bookingEnabled: boolean;
    seats: BookingSeat[];
    serverNow: string;
}
export interface BookingReservation {
    mode: BookingMode;
    id: string;
    sessionId: string;
    programId: string;
    title: string;
    venue: string;
    date: string;
    time: string;
    seats: string[];
    total: number;
    status: BookingStatus;
    expiresAt: string;
    serverNow: string;
}
export interface HoldInput {
    sessionId: string;
    seatIds: string[];
    participants: number;
    requestKey: string;
}
export interface ConfirmInput {
    reservationId: string;
    requestKey: string;
}
export interface BookingGateway {
    readonly mode: BookingMode;
    catalog(signal?: AbortSignal): Promise<BookingCatalog>;
    inventory(sessionId: string, signal?: AbortSignal): Promise<BookingInventory>;
    hold(input: HoldInput): Promise<BookingReservation>;
    confirm(input: ConfirmInput): Promise<BookingReservation>;
    cancel(reservationId: string): Promise<BookingReservation>;
}

const MESSAGES: Record<string, string> = {
    INVALID_SELECTION:
        "인원과 선택한 좌석을 다시 확인해 주세요. 한 번에 1~4석을 선택할 수 있습니다.",
    SESSION_NOT_FOUND: "관람 회차를 찾을 수 없습니다. 일정을 다시 선택해 주세요.",
    BOOKING_DISABLED: "현재 예약할 수 없는 회차입니다. 다른 일정을 선택해 주세요.",
    SEATS_UNAVAILABLE: "선택한 좌석의 상태가 바뀌었습니다. 좌석을 새로 불러와 선택해 주세요.",
    MEMBER_LIMIT: "한 회차에는 보류 중인 좌석을 포함해 최대 4석까지 선택할 수 있습니다.",
    IDEMPOTENCY_CONFLICT: "이전 요청과 선택 내용이 다릅니다. 좌석을 다시 선택해 주세요.",
    RESERVATION_NOT_FOUND: "예약 상태를 찾을 수 없습니다. 다시 시작해 주세요.",
    RESERVATION_EXPIRED: "좌석 보류 시간이 끝났습니다. 좌석을 다시 선택해 주세요.",
    RESERVATION_CLOSED: "이미 취소되거나 해제된 예약입니다. 다시 시작해 주세요.",
    AUTH_REQUIRED: "로그인이 필요합니다. 로그인한 뒤 다시 진행해 주세요.",
    INVALID_RESPONSE: "예약 서비스의 응답을 확인할 수 없습니다. 완료 처리하지 않았습니다.",
    EXPERIENCE_ID_REJECTED: "체험용 일정과 좌석은 실제 예약에 사용할 수 없습니다.",
    NETWORK_ERROR: "처리 결과를 확인하지 못했습니다. 같은 선택으로 다시 시도해 주세요.",
};
export class BookingError extends Error {
    readonly code: string;
    constructor(code: string) {
        super(MESSAGES[code] || "예약 요청을 처리하지 못했습니다. 다시 시도해 주세요.");
        this.name = "BookingError";
        this.code = code;
    }
}
export function bookingErrorMessage(error: unknown): string {
    return error instanceof BookingError ? error.message : MESSAGES.NETWORK_ERROR;
}
export function validateHold(input: HoldInput): void {
    if (
        !Number.isInteger(input.participants) ||
        input.participants < 1 ||
        input.participants > 4 ||
        !Array.isArray(input.seatIds) ||
        input.seatIds.length !== input.participants ||
        new Set(input.seatIds).size !== input.seatIds.length ||
        !input.seatIds.every(validId) ||
        !validId(input.sessionId) ||
        !validId(input.requestKey)
    )
        throw new BookingError("INVALID_SELECTION");
}
export function validId(value: unknown): value is string {
    return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}
export function sessionParts(startsAt: string): { date: string; time: string } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date(startsAt));
    const value = (key: string) => parts.find((part) => part.type === key)?.value || "";
    return {
        date: `${value("year")}-${value("month")}-${value("day")}`,
        time: `${value("hour")}:${value("minute")}`,
    };
}
export function remainingSeconds(reservation: BookingReservation, now: number): number {
    return Math.max(0, Math.ceil((Date.parse(reservation.expiresAt) - now) / 1000));
}
