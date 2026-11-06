"use client";

import React, { useEffect, useId, useMemo, useRef, useSyncExternalStore } from "react";
import { SystemBadge, SystemButton, SystemCheckbox, SystemField, SystemLink, SystemNotice } from "./SystemPrimitives";
import SystemSurface from "./SystemSurface";
import { BookingController } from "../src/booking/controller.ts";
import { createExperienceGateway } from "../src/booking/experience-gateway.ts";
import { remainingSeconds, sessionParts } from "../src/booking/contracts.ts";
import type { BookingGateway } from "../src/booking/contracts.ts";
import styles from "./BookingExperience.module.css";

const steps = ["일정과 인원", "좌석 선택", "내용 확인", "완료"];
const stepIds = ["selection", "seats", "review", "complete"];
const price = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const dateLabel = (date: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" }).format(new Date(`${date}T12:00:00+09:00`));

/** 제품과 가이드가 공유하는 예약 흐름. live 공급자는 인증별로 별도 생성합니다. */
export default function BookingExperience({ gateway }: { gateway?: BookingGateway }) {
    const source = useMemo(() => gateway || createExperienceGateway(), [gateway]);
    const controller = useMemo(() => new BookingController(source), [source]);
    const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    const uid = useId();
    const heading = useRef<HTMLHeadingElement>(null);
    const errorFocus = useRef<HTMLDivElement>(null);
    const previousStep = useRef(state.step);
    useEffect(() => {
        void controller.start();
        const timer = window.setInterval(() => controller.tick(), 1000);
        return () => { window.clearInterval(timer); controller.dispose(); };
    }, [controller]);
    useEffect(() => {
        if (previousStep.current !== state.step) { heading.current?.focus(); previousStep.current = state.step; }
    }, [state.step]);
    useEffect(() => { if (state.error) errorFocus.current?.focus(); }, [state.error]);

    const demo = source.mode === "experience";
    const index = stepIds.indexOf(state.step);
    const sessions = state.catalog?.sessions || [];
    const dates = [...new Set(sessions.map(session => sessionParts(session.startsAt).date))].sort();
    const daySessions = sessions.filter(session => sessionParts(session.startsAt).date === state.date);
    const programs = (state.catalog?.programs || []).filter(program => daySessions.some(session => session.programId === program.id));
    const program = state.catalog?.programs.find(program => program.id === state.programId);
    const session = sessions.find(session => session.id === state.sessionId);
    const seats = state.inventory?.seats || [];
    const chosen = seats.filter(seat => state.seatIds.includes(seat.id));
    const receipt = state.receipt;
    const remaining = receipt ? remainingSeconds(receipt, state.now) : 0;
    const locked = state.busy || state.uncertain;
    const selectedTotal = chosen.reduce((sum, seat) => sum + seat.price, 0);

    return <div className={`container page-layout ${styles.root}`} data-component-id="booking-experience" data-booking-mode={source.mode} data-booking-step={state.step}>
        <nav aria-label="현재 위치" className={styles.actions}>
            <SystemLink variant="quiet" href="/">홈</SystemLink>
            <span data-text="body" aria-hidden="true">/</span><span data-text="body">관람예약{demo ? " 체험" : ""}</span>
        </nav>
        <header className={styles.stack}>
            <SystemBadge tone="info">{demo ? "관람예약 체험" : "관람예약"}</SystemBadge>
            <h1 data-text="title">무대와 만나는 첫걸음</h1>
            <p data-text="lead">일정을 고르고, 마음에 드는 자리를 찾아보세요.</p>
            {demo && <p data-text="body">예시 일정과 좌석으로 예약 과정을 경험합니다. 로그인이나 결제 정보는 필요하지 않습니다.</p>}
        </header>
        <ol className={styles.steps} aria-label="예약 진행 단계">
            {steps.map((label, step) => <li key={label} data-text="label" aria-current={step === index ? "step" : undefined}>
                <span data-text="meta" aria-hidden="true">{String(step + 1).padStart(2, "0")}</span><span data-text="label">{label}</span>
            </li>)}
        </ol>
        {state.error && <div ref={errorFocus} tabIndex={-1} className={styles.focus}>
            <SystemNotice error title="확인이 필요합니다">{state.error}</SystemNotice>
        </div>}
        {state.uncertain && <SystemNotice title="처리 결과를 확인하고 있습니다">다른 선택으로 바꾸지 말고 현재 단계의 버튼으로 다시 시도해 주세요. 같은 요청으로 결과를 확인합니다.</SystemNotice>}
        <div className={styles.layout}>
            <SystemSurface as="section" padding="lg" className={styles.panel} aria-labelledby={`${uid}-step`} aria-busy={state.busy || state.loading || state.inventoryLoading}>
                <h2 id={`${uid}-step`} ref={heading} tabIndex={-1} data-text="heading" className={styles.focus}>
                    {state.step === "complete" ? (demo ? "관람예약 체험 완료" : "예약 접수 · 미결제") : steps[index]}
                </h2>
                {state.step === "selection" && <>
                    {state.loading ? <p data-text="body" role="status">관람 일정을 불러오는 중입니다.</p> : !state.catalog || !sessions.length ? <>
                        <SystemNotice title="현재 선택할 수 있는 일정이 없습니다">일정을 다시 확인하거나 프로그램 목록을 살펴보세요.</SystemNotice>
                        <div className={styles.actions}><SystemButton variant="secondary" onClick={() => void controller.start()}>일정 다시 불러오기</SystemButton><SystemLink href="/programs/">프로그램 목록</SystemLink></div>
                    </> : <form className={styles.stack} onSubmit={event => { event.preventDefault(); void controller.openSeats(); }}>
                        <div className={styles.fields}>
                            <SystemField as="select" variant="flow" id={`${uid}-date`} label="관람 날짜" value={state.date} onChange={event => controller.setDate(event.target.value)} required>
                                <option data-text="label" value="">날짜를 선택하세요</option>{dates.map(date => <option data-text="label" key={date} value={date}>{dateLabel(date)}</option>)}
                            </SystemField>
                            <SystemField as="select" variant="flow" id={`${uid}-program`} label="프로그램" value={state.programId} disabled={!state.date} onChange={event => controller.setProgram(event.target.value)} required>
                                <option data-text="label" value="">프로그램을 선택하세요</option>{programs.map(program => <option data-text="label" key={program.id} value={program.id}>{program.title}</option>)}
                            </SystemField>
                            <SystemField as="select" variant="flow" id={`${uid}-session`} label="관람 회차" value={state.sessionId} disabled={!state.programId} onChange={event => controller.setSession(event.target.value)} required>
                                <option data-text="label" value="">시간을 선택하세요</option>{daySessions.filter(session => session.programId === state.programId).map(session => <option data-text="label" key={session.id} value={session.id} disabled={!session.bookingEnabled || Date.parse(session.startsAt) <= state.now}>{sessionParts(session.startsAt).time}{!session.bookingEnabled ? " · 선택 불가" : ""}</option>)}
                            </SystemField>
                            <SystemField as="select" variant="flow" id={`${uid}-participants`} label="관람 인원" value={state.participants} onChange={event => controller.setParticipants(Number(event.target.value))}>
                                {[1, 2, 3, 4].map(count => <option data-text="label" key={count} value={count}>{count}명</option>)}
                            </SystemField>
                        </div>
                        <p data-text="body">한 번에 최대 4명까지 선택할 수 있습니다.</p>
                        <div className={styles.actions}><SystemButton type="submit" disabled={!state.sessionId}>좌석 선택으로</SystemButton></div>
                    </form>}
                </>}
                {state.step === "seats" && <>
                    <p data-text="body">{state.participants}석을 선택해 주세요. 다음 단계로 이동하면 선택한 좌석을 5분간 보류합니다.</p>
                    {state.inventoryLoading ? <p data-text="body" role="status">좌석을 불러오는 중입니다.</p> : state.inventory && !state.inventory.bookingEnabled ? <SystemNotice title="예약할 수 없는 회차입니다">다른 회차를 선택해 주세요.</SystemNotice> : state.inventory && <>
                        {!seats.some(seat => seat.available) && <SystemNotice title="선택 가능한 좌석이 없습니다">좌석을 새로 불러오거나 다른 회차를 선택해 주세요.</SystemNotice>}
                        <SystemSurface variant="inset" padding="sm" className={styles.stage}><span data-text="label">무대</span></SystemSurface>
                        <p data-text="caption">좌석의 번호·선택 상태를 함께 확인하세요. {demo ? "실제 공연장 배치가 아닌 예시 좌석입니다." : ""}</p>
                        <div className={styles.stack} role="group" aria-label="좌석 선택">
                            {[...new Set(seats.map(seat => seat.row))].map(row => <div key={row} className={styles.stack}>
                                <h3 data-text="subheading">{row}열</h3>
                                <div className={styles.seatRow}>{seats.filter(seat => seat.row === row).map(seat => {
                                    const selected = state.seatIds.includes(seat.id);
                                    return <SystemButton key={seat.id} className={styles.seat} variant={selected ? "primary" : "secondary"} aria-pressed={selected} aria-label={`${seat.label}, ${price(seat.price)}, ${!seat.available ? "선택 불가" : selected ? "선택됨" : "선택 가능"}`} disabled={locked || !seat.available} onClick={() => controller.toggleSeat(seat.id)}>
                                        <span data-text="label">{seat.label}</span><span data-text="caption">{!seat.available ? "불가" : selected ? "선택됨" : "가능"}</span>
                                    </SystemButton>;
                                })}</div>
                            </div>)}
                        </div>
                    </>}
                    <p data-text="body" role="status" aria-live="polite">{state.seatIds.length} / {state.participants}석 선택 · {price(selectedTotal)}</p>
                    <div className={styles.actions}>
                        <SystemButton variant="secondary" disabled={locked} onClick={() => void controller.back()}>일정 다시 선택</SystemButton>
                        <SystemButton variant="quiet" disabled={locked || state.inventoryLoading} onClick={() => void controller.refreshInventory()}>좌석 새로고침</SystemButton>
                        <SystemButton disabled={state.busy || state.inventoryLoading || state.seatIds.length !== state.participants || !state.inventory?.bookingEnabled} onClick={() => void controller.review()}>{state.busy ? "확인 중…" : state.uncertain ? "선택한 좌석 다시 확인" : "선택 내용 확인"}</SystemButton>
                    </div>
                </>}
                {state.step === "review" && receipt && <>
                    <p data-text="body">오른쪽 또는 아래의 선택 내용을 확인해 주세요. 결제는 진행하지 않습니다.</p>
                    <p data-text="body" role="timer" aria-live="off">{remaining ? `남은 시간 ${Math.floor(remaining / 60)}분 ${remaining % 60}초` : "좌석 보류 시간이 끝났습니다."}</p>
                    {!remaining && <SystemNotice title="좌석을 다시 선택해 주세요">보류 시간이 지나 좌석을 다시 확인해야 합니다.</SystemNotice>}
                    <SystemCheckbox checked={state.accepted} disabled={locked || !remaining} onChange={event => controller.setAccepted(event.target.checked)} label="관람 일정과 인원, 좌석을 확인했습니다." />
                    <div className={styles.actions}>
                        <SystemButton variant="secondary" disabled={state.busy || (state.uncertain && state.uncertainAction !== "cancel")} onClick={() => void controller.back()}>보류 해제 후 좌석 변경</SystemButton>
                        <SystemButton disabled={state.busy || !state.accepted || (!remaining && !(state.uncertain && state.uncertainAction === "confirm")) || (state.uncertain && state.uncertainAction !== "confirm")} onClick={() => void controller.confirm()}>{state.busy ? "처리 중…" : state.uncertain ? "접수 결과 다시 확인" : demo ? "체험 완료하기" : "미결제 예약 접수"}</SystemButton>
                    </div>
                </>}
                {state.step === "complete" && receipt && <>
                    <SystemNotice title={demo ? "예약 과정을 모두 경험했어요" : remaining ? "예약이 접수되었습니다" : "예약 기한이 만료되었습니다"}>
                        {demo ? "실제 예약·결제·발권은 생성되지 않았습니다. 선택 결과는 이 화면에서만 확인할 수 있습니다." : remaining ? "결제와 발권은 완료되지 않았습니다. 기한 안에 다음 절차를 진행하지 않으면 좌석이 해제됩니다." : "보류 기한이 지나 좌석이 해제됩니다. 예약 내역에서 최신 상태를 확인해 주세요."}
                    </SystemNotice>
                    <div className={styles.actions}>
                        <SystemButton variant="secondary" disabled={state.busy} onClick={() => void controller.restart()}>{state.busy ? "정리 중…" : demo ? "다시 체험하기" : "현재 예약 취소 후 다시 선택"}</SystemButton>
                        <SystemLink href={demo ? "/programs/" : "/account/bookings/"}>{demo ? "실제 프로그램 살펴보기" : "예약 내역 확인"}</SystemLink>
                    </div>
                </>}
            </SystemSurface>
            <SystemSurface as="aside" variant="subtle" padding="lg" className={styles.summary} aria-labelledby={`${uid}-summary`}>
                <h2 data-text="subheading" id={`${uid}-summary`}>나의 관람 선택</h2>
                <dl className={styles.details}>
                    <div><dt data-text="label">프로그램</dt><dd data-text="body">{receipt?.title || program?.title || "아직 선택하지 않았어요"}</dd></div>
                    <div><dt data-text="label">장소</dt><dd data-text="body">{receipt?.venue || program?.venue || "선택 후 표시"}</dd></div>
                    <div><dt data-text="label">일시</dt><dd data-text="body">{receipt ? `${dateLabel(receipt.date)} ${receipt.time}` : session ? `${dateLabel(state.date)} ${sessionParts(session.startsAt).time}` : "선택 후 표시"}</dd></div>
                    <div><dt data-text="label">인원</dt><dd data-text="body">{receipt?.seats.length || state.participants}명</dd></div>
                    <div><dt data-text="label">좌석</dt><dd data-text="body">{receipt?.seats.join(", ") || chosen.map(seat => seat.label).join(", ") || "선택 후 표시"}</dd></div>
                    <div><dt data-text="label">{demo ? "예시 합계" : receipt ? "서버 확인 금액" : "선택 예상 금액"}</dt><dd data-text="subheading">{price(receipt?.total ?? selectedTotal)}</dd></div>
                </dl>
                <p data-text="caption">{demo ? "체험 선택은 새로고침하면 초기화됩니다." : "최종 금액과 좌석 상태는 서버에서 확인합니다."}</p>
            </SystemSurface>
        </div>
    </div>;
}
