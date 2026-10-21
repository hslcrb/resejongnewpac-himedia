"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import type { Program } from "../types/sejong.ts";
import type { AccountBooking, AccountNote, AccountNoteDraft } from "../src/lib/account-space.ts";
import { mediaPath } from "../src/lib/media";
import { SystemBadge, SystemButton, SystemField, SystemIconButton, SystemLink, SystemNotice } from "./SystemPrimitives";
import Icon from "./Icon";

// [개인 프로필과 멤버십 길잡이 / Personal profile and membership navigation]
export function AccountMembershipCard({ name, message, mode, counts, onEdit, onLogout }: {
    name: string; message: string; mode: "loading" | "guest" | "demo" | "oauth";
    counts: { upcoming: number; favorites: number; notes: number };
    onEdit: () => void; onLogout: () => void;
}) {
    const signedIn = mode === "demo" || mode === "oauth";
    return (
        <section className="account-identity" data-component="AccountMembershipCard" aria-label="나의 프로필">
            <div className="account-identity-top"><span className="account-avatar" aria-hidden="true">{Array.from(name)[0] || "나"}</span><SystemBadge tone={mode === "oauth" ? "info" : "neutral"}>{mode === "oauth" ? "로그인됨" : mode === "demo" ? "내 프로필" : "방문자 공간"}</SystemBadge></div>
            <h2>{name}<span>님의 세종</span></h2>
            <p className="account-status-message">{message || "나만의 한 줄을 남겨 보세요."}</p>
            <SystemButton variant="secondary" onClick={onEdit}>나의 공간 꾸미기 <Icon name="plus" size={20} /></SystemButton>
            <dl className="account-profile-counts">
                <div><dt>다가올 관람</dt><dd>{counts.upcoming}<span>건</span></dd></div>
                <div><dt>관심 프로그램</dt><dd>{counts.favorites}<span>편</span></dd></div>
                <div><dt>남긴 관람노트</dt><dd>{counts.notes}<span>개</span></dd></div>
            </dl>
            <div className="account-membership-guide">
                <h3>나의 멤버십</h3>
                <p>세종문화회관의 회원 등급·포인트·쿠폰을 확인하세요.</p>
                <SystemLink variant="quiet" href="https://www.sejongpac.or.kr/portal/myPage/individual/list.do?menuNo=200479" target="_blank">멤버십 확인 <Icon name="diagonal" size={20} /></SystemLink>
            </div>
            <div className="account-identity-session">{signedIn ? <SystemButton variant="quiet" onClick={onLogout}>로그아웃 <Icon name="arrow" size={20} /></SystemButton> : <SystemLink href="/account/login/" variant="quiet">로그인 / 프로필 만들기 <Icon name="arrow" size={20} /></SystemLink>}</div>
        </section>
    );
}

// [같은 티켓의 요약형과 상세형 / Compact and detailed views of the same ticket]
export function AccountTicket({ booking, program, variant = "full", onCancel }: {
    booking: AccountBooking; program?: Program; variant?: "compact" | "full";
    onCancel?: (booking: AccountBooking, trigger: HTMLButtonElement) => void;
}) {
    const cancelled = booking.status === "cancelled";
    return (
        <article className="account-ticket" data-component="AccountTicket" data-variant={variant} data-cancelled={cancelled || undefined}>
            <div className="account-ticket-date"><strong>{booking.date.slice(5).replace("-", ".")}</strong><span>{booking.time}</span></div>
            <img className="account-ticket-poster" src={mediaPath(program?.image)} alt={booking.title} width={450} height={600} loading="lazy" />
            <div className="account-ticket-body">
                <SystemBadge tone={cancelled ? "neutral" : "info"}>{cancelled ? "취소 완료" : "저장한 예매"}</SystemBadge>
                <h3><Link href={`/programs/${booking.programId}/`}>{booking.title}</Link></h3>
                <p>{booking.venue}</p>
                <p>{booking.seats.join(", ")} · {booking.seats.length}매</p>
                {variant === "full" && <p className="account-ticket-reference">{booking.id} · {booking.total.toLocaleString()}원</p>}
            </div>
            <div className="account-ticket-action">{variant === "compact" ? <SystemLink variant="secondary" href={`/programs/${booking.programId}/`}>공연 상세 <Icon name="arrow" size={20} /></SystemLink> : !cancelled && onCancel ? <SystemButton variant="quiet" onClick={event => onCancel(booking, event.currentTarget)}>예매 기록 취소</SystemButton> : null}</div>
        </article>
    );
}

// [관람 후 한 줄과 날짜를 보관하는 노트 / Dated personal performance notes]
export function AccountDiary({ programs, notes, today, onSave, onDelete }: {
    programs: readonly Program[]; notes: readonly AccountNote[]; today: string;
    onSave: (draft: AccountNoteDraft) => boolean; onDelete: (id: string) => void;
}) {
    const [programId, setProgramId] = useState(programs[0]?.id || "");
    const [date, setDate] = useState(today);
    const [body, setBody] = useState("");
    const [error, setError] = useState("");
    function submit(event: FormEvent) {
        event.preventDefault();
        if (!onSave({ programId, date, body })) { setError("공연과 오늘 이전의 관람일, 1~500자의 감상을 확인해 주세요."); return; }
        setError(""); setBody("");
    }
    return (
        <section className="account-diary" data-component="AccountDiary" aria-labelledby="account-diary-heading">
            <div className="account-section-heading"><div><p className="account-section-kicker">공연이 끝난 뒤에도</p><h2 id="account-diary-heading">나의 관람노트</h2></div><span>{notes.length}개의 기록</span></div>
            <form className="account-note-form" onSubmit={submit}>
                <div className="account-form-pair"><SystemField as="select" label="기록할 프로그램" id="account-note-program" value={programId} onChange={event => setProgramId(event.target.value)} required>{programs.map(program => <option key={program.id} value={program.id}>{program.title}</option>)}</SystemField><SystemField label="관람일" type="date" id="account-note-date" value={date} max={today} onChange={event => setDate(event.target.value)} required /></div>
                <SystemField as="textarea" id="account-note-body" label="오래 남기고 싶은 장면" value={body} onChange={event => setBody(event.target.value)} rows={4} maxLength={500} required placeholder="오늘의 무대에서 마음에 남은 순간은 무엇인가요?" />
                {error && <SystemNotice error title="노트를 저장하지 못했어요">{error}</SystemNotice>}
                <div className="account-note-form-footer"><p>{body.length}/500 · 이 브라우저에만 보관되는 개인 노트입니다.</p><SystemButton type="submit">노트 남기기 <Icon name="plus" size={20} /></SystemButton></div>
            </form>
            <div className="account-note-list">{notes.length ? notes.map(note => {
                const program = programs.find(item => item.id === note.programId);
                return <article className="account-note" key={note.id}><div><time dateTime={note.date}>{note.date.replaceAll("-", ".")}</time><h3>{program?.title || "나의 관람 기록"}</h3><p>{note.body}</p></div><SystemIconButton aria-label={`${program?.title || "관람"} 노트 삭제`} onClick={() => onDelete(note.id)}><Icon name="close" size={20} /></SystemIconButton></article>;
            }) : <p className="account-empty-note">첫 관람노트를 기다리고 있어요. 짧은 한 줄이어도 좋아요.</p>}</div>
        </section>
    );
}
