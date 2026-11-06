import { BookingError, bookingErrorMessage, remainingSeconds, sessionParts } from "./contracts.ts";
import type {
    BookingCatalog,
    BookingGateway,
    BookingInventory,
    BookingReservation,
    BookingStep,
} from "./contracts.ts";

export interface BookingState {
    catalog: BookingCatalog | null;
    loading: boolean;
    step: BookingStep;
    date: string;
    programId: string;
    sessionId: string;
    participants: number;
    inventory: BookingInventory | null;
    inventoryLoading: boolean;
    seatIds: string[];
    receipt: BookingReservation | null;
    accepted: boolean;
    busy: boolean;
    uncertain: boolean;
    error: string;
    now: number;
    uncertainAction: "hold" | "confirm" | "cancel" | null;
}
const initial = (): BookingState => ({
    catalog: null,
    loading: true,
    step: "selection",
    date: "",
    programId: "",
    sessionId: "",
    participants: 1,
    inventory: null,
    inventoryLoading: false,
    seatIds: [],
    receipt: null,
    accepted: false,
    busy: false,
    uncertain: false,
    error: "",
    now: 0,
    uncertainAction: null,
});

/** React 밖에서도 검증 가능한 상태 관리자. 서버 응답 전에는 성공을 만들지 않습니다. */
export class BookingController {
    private state: BookingState = initial();
    private gateway: BookingGateway;
    private clock: () => number;
    private key: () => string;
    private listeners = new Set<() => void>();
    private alive = true;
    private readVersion = 0;
    private lifetime = 0;
    private offset = 0;
    private keys = new Map<string, string>();
    constructor(
        gateway: BookingGateway,
        clock: () => number = Date.now,
        key: () => string = () => crypto.randomUUID(),
    ) {
        this.gateway = gateway;
        this.clock = clock;
        this.key = key;
    }
    getSnapshot = (): BookingState => this.state;
    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    private update(patch: Partial<BookingState>): void {
        if (!this.alive) return;
        this.state = { ...this.state, ...patch };
        this.listeners.forEach((listener) => listener());
    }
    private requestKey(signature: string): string {
        const key = this.keys.get(signature) || this.key();
        this.keys.set(signature, key);
        return key;
    }
    private canEdit(): boolean {
        return !this.state.busy && !this.state.uncertain && !this.state.receipt;
    }
    private invalidate(): void {
        this.readVersion++;
        this.keys.clear();
    }
    async start(): Promise<void> {
        this.alive = true;
        const life = ++this.lifetime;
        this.update({ loading: true, error: "", now: this.clock() });
        try {
            const catalog = await this.gateway.catalog();
            if (this.alive && life === this.lifetime) this.update({ catalog, loading: false });
        } catch (error) {
            if (life === this.lifetime)
                this.update({ loading: false, error: bookingErrorMessage(error) });
        }
    }
    dispose(): void {
        this.alive = false;
        this.lifetime++;
        this.readVersion++;
    }
    tick(): void {
        if (this.state.receipt) this.update({ now: this.clock() + this.offset });
    }
    setDate(date: string): void {
        if (!this.canEdit() || this.state.step !== "selection") return;
        this.invalidate();
        this.update({
            date,
            programId: "",
            sessionId: "",
            inventory: null,
            inventoryLoading: false,
            seatIds: [],
            error: "",
        });
    }
    setProgram(programId: string): void {
        if (!this.canEdit() || this.state.step !== "selection") return;
        this.invalidate();
        this.update({
            programId,
            sessionId: "",
            inventory: null,
            inventoryLoading: false,
            seatIds: [],
            error: "",
        });
    }
    setSession(sessionId: string): void {
        if (!this.canEdit() || this.state.step !== "selection") return;
        this.invalidate();
        this.update({
            sessionId,
            inventory: null,
            inventoryLoading: false,
            seatIds: [],
            error: "",
        });
    }
    setParticipants(participants: number): void {
        if (
            !this.canEdit() ||
            this.state.step !== "selection" ||
            !Number.isInteger(participants) ||
            participants < 1 ||
            participants > 4
        )
            return;
        this.keys.clear();
        this.update({ participants, seatIds: [], accepted: false, error: "" });
    }
    setAccepted(accepted: boolean): void {
        if (!this.state.busy && !this.state.uncertain) this.update({ accepted });
    }
    async openSeats(): Promise<void> {
        if (!this.canEdit()) return;
        const s = this.state;
        const session = s.catalog?.sessions.find(
            (item) =>
                item.id === s.sessionId &&
                item.programId === s.programId &&
                sessionParts(item.startsAt).date === s.date,
        );
        if (
            !session ||
            !session.bookingEnabled ||
            Date.parse(session.startsAt) <= this.clock() + this.offset
        ) {
            this.update({ error: "예약 가능한 날짜·프로그램·회차를 선택해 주세요." });
            return;
        }
        this.update({ step: "seats", error: "" });
        await this.refreshInventory();
    }
    async refreshInventory(): Promise<void> {
        if (!this.canEdit() || !this.state.sessionId || this.state.step !== "seats") return;
        const version = ++this.readVersion,
            sessionId = this.state.sessionId;
        this.update({ inventoryLoading: true, error: "" });
        try {
            const inventory = await this.gateway.inventory(sessionId);
            if (!this.alive || version !== this.readVersion || sessionId !== this.state.sessionId)
                return;
            this.offset = Date.parse(inventory.serverNow) - this.clock();
            const seatIds = this.state.seatIds.filter((id) =>
                inventory.seats.some((seat) => seat.id === id && seat.available),
            );
            this.update({
                inventory,
                inventoryLoading: false,
                seatIds,
                now: this.clock() + this.offset,
            });
        } catch (error) {
            if (version === this.readVersion)
                this.update({
                    inventory: null,
                    inventoryLoading: false,
                    error: bookingErrorMessage(error),
                });
        }
    }
    toggleSeat(seatId: string): void {
        const s = this.state;
        if (
            !this.canEdit() ||
            s.step !== "seats" ||
            s.inventoryLoading ||
            !s.inventory?.bookingEnabled ||
            !s.inventory.seats.some((seat) => seat.id === seatId && seat.available)
        )
            return;
        if (!s.seatIds.includes(seatId) && s.seatIds.length >= s.participants) {
            this.update({
                error: `${s.participants}석까지 선택할 수 있습니다. 선택한 좌석을 해제한 뒤 바꿔 주세요.`,
            });
            return;
        }
        this.keys.clear();
        this.update({
            seatIds: s.seatIds.includes(seatId)
                ? s.seatIds.filter((id) => id !== seatId)
                : [...s.seatIds, seatId],
            error: "",
        });
    }
    private async mutate(
        action: "hold" | "confirm" | "cancel",
        operation: () => Promise<BookingReservation>,
        success: (receipt: BookingReservation) => void,
    ): Promise<void> {
        if (this.state.busy || !this.alive) return;
        const life = this.lifetime;
        this.update({ busy: true, error: "" });
        try {
            const receipt = await operation();
            if (!this.alive || life !== this.lifetime) return;
            this.offset = Date.parse(receipt.serverNow) - this.clock();
            this.update({
                busy: false,
                uncertain: false,
                uncertainAction: null,
                now: this.clock() + this.offset,
            });
            success(receipt);
        } catch (error) {
            if (!this.alive || life !== this.lifetime) return;
            const uncertain =
                !(error instanceof BookingError) ||
                ["NETWORK_ERROR", "INVALID_RESPONSE"].includes(error.code);
            if (
                error instanceof BookingError &&
                ["RESERVATION_EXPIRED", "RESERVATION_CLOSED"].includes(error.code)
            )
                this.keys.clear();
            this.update({
                busy: false,
                uncertain,
                uncertainAction: uncertain ? action : null,
                error: bookingErrorMessage(error),
            });
        }
    }
    async review(): Promise<void> {
        const s = this.state;
        if (s.busy || s.step !== "seats" || s.inventoryLoading) return;
        if (!s.inventory?.bookingEnabled || s.seatIds.length !== s.participants) {
            this.update({ error: `${s.participants}석을 선택해 주세요.` });
            return;
        }
        const signature = `hold:${s.sessionId}:${s.participants}:${[...s.seatIds].sort().join(",")}`;
        const input = {
            sessionId: s.sessionId,
            seatIds: [...s.seatIds],
            participants: s.participants,
            requestKey: this.requestKey(signature),
        };
        await this.mutate(
            "hold",
            () => this.gateway.hold(input),
            (receipt) =>
                this.update({
                    receipt,
                    accepted: false,
                    step: receipt.status === "reserved_unpaid" ? "complete" : "review",
                }),
        );
    }
    async confirm(): Promise<void> {
        const s = this.state;
        if (
            s.step !== "review" ||
            !s.receipt ||
            s.busy ||
            (s.uncertain && s.uncertainAction !== "confirm")
        )
            return;
        if (
            remainingSeconds(s.receipt, this.clock() + this.offset) === 0 &&
            !(s.uncertain && s.uncertainAction === "confirm")
        ) {
            this.update({ error: "좌석 보류 시간이 끝났습니다. 좌석을 다시 선택해 주세요." });
            return;
        }
        if (!s.accepted) {
            this.update({ error: "선택 내용을 확인한 뒤 확인란을 선택해 주세요." });
            return;
        }
        const reservationId = s.receipt.id,
            requestKey = this.requestKey(`confirm:${reservationId}`);
        await this.mutate(
            "confirm",
            () => this.gateway.confirm({ reservationId, requestKey }),
            (receipt) => this.update({ receipt, step: "complete" }),
        );
    }
    async back(): Promise<void> {
        if (
            this.state.busy ||
            (this.state.uncertain &&
                (this.state.uncertainAction !== "cancel" || !this.state.receipt))
        )
            return;
        if (this.state.receipt) {
            await this.mutate(
                "cancel",
                () => this.gateway.cancel(this.state.receipt!.id),
                () => {
                    this.invalidate();
                    this.update({ receipt: null, accepted: false, step: "seats", seatIds: [] });
                },
            );
            if (!this.state.receipt) await this.refreshInventory();
        } else {
            this.invalidate();
            this.update({ step: "selection", inventory: null, inventoryLoading: false, error: "" });
        }
    }
    async restart(): Promise<void> {
        if (
            this.state.busy ||
            (this.state.uncertain &&
                (this.state.uncertainAction !== "cancel" || !this.state.receipt))
        )
            return;
        if (this.state.receipt) {
            await this.mutate(
                "cancel",
                () => this.gateway.cancel(this.state.receipt!.id),
                () => this.update({ receipt: null }),
            );
            if (this.state.receipt) return;
        }
        this.invalidate();
        const catalog = this.state.catalog;
        this.update({ ...initial(), catalog, loading: false, now: this.clock() + this.offset });
    }
}
