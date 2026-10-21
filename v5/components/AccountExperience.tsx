"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import type { UserProfile } from "../types/sejong.ts";
import { PROGRAMS } from "../src/data/catalog";
import {
    ACCOUNT_THEMES, DEFAULT_ACCOUNT_SPACE, accountBookingSummary, accountStorageKey, accountToday,
    parseAccountBookings, parseAccountNotes, parseAccountSpace, persistAccountValue, validateAccountNote,
} from "../src/lib/account-space.ts";
import type { AccountBooking, AccountNote, AccountNoteDraft, AccountSpace } from "../src/lib/account-space.ts";
import AccountMiniRoom from "./AccountMiniRoom";
import { AccountDiary, AccountMembershipCard, AccountTicket } from "./AccountPanels";
import Icon from "./Icon";
import ProgramCard from "./ProgramCard";
import { showSmallNotification } from "./SmallNotificationModal";
import SystemDialog from "./SystemDialog";
import { SystemTabs } from "./SystemNavigation";
import { SystemButton, SystemField, SystemFilterButton, SystemLink, SystemNotice } from "./SystemPrimitives";
import useAccountIdentity from "./useAccountIdentity";
import useFavorites from "./useFavorites";

export type AccountTab = "space" | "bookings" | "favorites" | "notes" | "services" | "profile";
const ACCOUNT_TABS: readonly AccountTab[] = ["space", "bookings", "favorites", "notes", "services", "profile"];
const OFFICIAL_ACCOUNT = "https://www.sejongpac.or.kr/portal/myPage/individual/list.do?menuNo=200479";
const BOOKING_KEY = "sejong-v4:bookings";
const RECOMMENDATIONS = PROGRAMS.filter(program => program.category === "공연").slice(0, 3);
const PROGRAM_IDS = new Set(PROGRAMS.map(program => program.id));

function accountTabFromHash(hash: string): AccountTab | null {
    const id = hash.replace(/^#account-panel-/, "");
    return ACCOUNT_TABS.includes(id as AccountTab) ? id as AccountTab : null;
}

// [하나의 마이페이지와 직접 접근 경로 / One account experience with direct panel routes]
export default function AccountExperience({ initialTab = "space" }: { initialTab?: AccountTab }) {
    const identity = useAccountIdentity();
    const favorites = useFavorites();
    const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
    const [space, setSpace] = useState<AccountSpace>({ ...DEFAULT_ACCOUNT_SPACE });
    const [notes, setNotes] = useState<AccountNote[]>([]);
    const [bookings, setBookings] = useState<AccountBooking[]>([]);
    const [loadedIdentity, setLoadedIdentity] = useState("");
    const [today, setToday] = useState("");
    const [bookingFilter, setBookingFilter] = useState("all");
    const [sessionError, setSessionError] = useState("");
    const [profileDraft, setProfileDraft] = useState<UserProfile>({ name: "", email: "", phone: "" });
    const [profileError, setProfileError] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [spaceDraft, setSpaceDraft] = useState<AccountSpace>({ ...DEFAULT_ACCOUNT_SPACE });
    const [cancelOpen, setCancelOpen] = useState(false);
    const [pendingCancellation, setPendingCancellation] = useState<AccountBooking | null>(null);
    const editTriggerRef = useRef<HTMLElement | null>(null);
    const cancelTriggerRef = useRef<HTMLElement | null>(null);
    const cancelCloseRef = useRef<HTMLButtonElement>(null);
    const dataReady = identity.ready && loadedIdentity === identity.identityId && Boolean(today);

    // [회원 식별 후 읽기만 수행 / Read persisted values only after identity is known]
    useEffect(() => {
        setToday(accountToday());
        let focusFrame = 0;
        const syncTab = (event?: Event) => {
            const destination = accountTabFromHash(window.location.hash);
            setActiveTab(destination || initialTab);
            if (event && destination) {
                cancelAnimationFrame(focusFrame);
                focusFrame = requestAnimationFrame(() => document.getElementById(`account-panel-${destination}`)?.focus());
            }
        };
        syncTab();
        window.addEventListener("hashchange", syncTab);
        window.addEventListener("popstate", syncTab);
        return () => {
            cancelAnimationFrame(focusFrame);
            window.removeEventListener("hashchange", syncTab);
            window.removeEventListener("popstate", syncTab);
        };
    }, [initialTab]);

    useEffect(() => {
        if (!identity.ready) return;
        try {
            setSpace(parseAccountSpace(localStorage.getItem(accountStorageKey(identity.identityId))));
            setNotes(parseAccountNotes(localStorage.getItem(accountStorageKey(identity.identityId, "notes"))));
            setBookings(parseAccountBookings(localStorage.getItem(BOOKING_KEY)));
        } catch {
            setSpace({ ...DEFAULT_ACCOUNT_SPACE });
            setNotes([]);
            setBookings([]);
        }
        setLoadedIdentity(identity.identityId);
        setEditOpen(false);
        setCancelOpen(false);
        setSessionError("");
        const refreshBookings = (event: StorageEvent) => {
            if (event.key !== BOOKING_KEY && event.key !== null) return;
            try { setBookings(parseAccountBookings(localStorage.getItem(BOOKING_KEY))); } catch { /* 현재 창의 기록 유지 / Preserve in-memory records. */ }
        };
        window.addEventListener("storage", refreshBookings);
        return () => window.removeEventListener("storage", refreshBookings);
    }, [identity.ready, identity.identityId]);

    useEffect(() => {
        setProfileDraft({ ...identity.profile });
        setProfileError("");
    }, [identity.profile.name, identity.profile.email, identity.profile.phone]);

    const favoritePrograms = favorites.flatMap(id => {
        const program = PROGRAMS.find(item => item.id === id);
        return program ? [program] : [];
    });
    const displayedPrograms = favoritePrograms.length ? favoritePrograms.slice(0, 3) : RECOMMENDATIONS;
    const summary = accountBookingSummary(bookings, today);
    const visibleBookings = bookings.filter(booking => bookingFilter === "cancelled" ? booking.status === "cancelled" : bookingFilter === "upcoming" ? booking.status !== "cancelled" && booking.date >= today : true);
    const displayName = (dataReady ? space.nickname : "") || identity.profile.name || "관람객";
    const latestNote = notes[0];

    function selectTab(value: string) {
        if (!ACCOUNT_TABS.includes(value as AccountTab)) return;
        setActiveTab(value as AccountTab);
        const hash = `#account-panel-${value}`;
        if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    }

    // [명시적인 공간 저장과 즉시 조명 조작 / Explicit room save and immediate light control]
    function openSpaceEditor() {
        if (!dataReady) return;
        editTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setSpaceDraft({ ...space, nickname: (space.nickname || identity.profile.name || "관람객").slice(0, 24) });
        setEditOpen(true);
    }

    function saveSpace(event: FormEvent) {
        event.preventDefault();
        if (!dataReady) return;
        const next = { ...spaceDraft, nickname: spaceDraft.nickname.trim().slice(0, 24), message: spaceDraft.message.trim().slice(0, 100) };
        if (!next.nickname) return;
        const persisted = persistAccountValue(accountStorageKey(identity.identityId), next);
        setSpace(next);
        setEditOpen(false);
        showSmallNotification(persisted ? "나의 공간을 이 브라우저에 저장했어요." : "나의 공간을 바꿨어요. 저장소를 사용할 수 없어 이번 창에서만 유지돼요.");
    }

    function toggleLight() {
        if (!dataReady) return;
        const next = { ...space, lightOn: !space.lightOn };
        const persisted = persistAccountValue(accountStorageKey(identity.identityId), next);
        setSpace(next);
        showSmallNotification(`공연장 조명을 ${next.lightOn ? "켰어요" : "껐어요"}.${persisted ? " 이 브라우저에 저장했어요." : " 이번 창에서만 유지돼요."}`);
    }

    // [기존 체험 예매의 확인 후 취소 / Confirm before cancelling an existing demo booking]
    function openCancellation(booking: AccountBooking, trigger: HTMLButtonElement) {
        cancelTriggerRef.current = trigger;
        setPendingCancellation(booking);
        setCancelOpen(true);
    }

    function cancelBooking() {
        if (!dataReady || !pendingCancellation) return;
        const next = bookings.map(booking => booking.id === pendingCancellation.id ? { ...booking, status: "cancelled" as const } : booking);
        const persisted = persistAccountValue(BOOKING_KEY, next);
        cancelTriggerRef.current = document.getElementById("account-bookings-heading");
        setBookings(next);
        setCancelOpen(false);
        showSmallNotification(persisted ? "이 브라우저의 체험 예매를 취소했어요." : "체험 예매를 이 창에서 취소했어요. 저장소를 사용할 수 없어 새로고침하면 복원될 수 있어요.");
    }

    // [회원별 브라우저 관람노트 / Identity-scoped browser diary]
    function saveNote(draft: AccountNoteDraft): boolean {
        if (!dataReady) return false;
        const valid = validateAccountNote(draft, PROGRAM_IDS, today);
        if (!valid) return false;
        const id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        const next = [{ ...valid, id }, ...notes].slice(0, 100);
        const persisted = persistAccountValue(accountStorageKey(identity.identityId, "notes"), next);
        setNotes(next);
        showSmallNotification(persisted ? "관람노트를 이 브라우저에 남겼어요." : "관람노트를 남겼어요. 저장소를 사용할 수 없어 이번 창에서만 유지돼요.");
        return true;
    }

    function deleteNote(id: string) {
        if (!dataReady) return;
        const next = notes.filter(note => note.id !== id);
        const persisted = persistAccountValue(accountStorageKey(identity.identityId, "notes"), next);
        setNotes(next);
        showSmallNotification(persisted ? "관람노트를 삭제했어요." : "관람노트를 이 창에서 삭제했어요. 저장소를 사용할 수 없어 새로고침하면 복원될 수 있어요.");
    }

    // [실제 세션의 프로필과 로그아웃 / Profile and sign-out for the actual identity]
    async function saveProfile(event: FormEvent) {
        event.preventDefault();
        if (profileSaving || !identity.isLoggedIn) return;
        setProfileError("");
        setProfileSaving(true);
        try {
            await identity.updateProfile(profileDraft);
            showSmallNotification(identity.mode === "demo" ? "체험 계정 정보를 이 브라우저에 저장했어요." : "회원정보를 저장했어요.");
        } catch (error) {
            setProfileError(error instanceof Error ? error.message : "회원정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
        } finally { setProfileSaving(false); }
    }

    async function logout() {
        setSessionError("");
        try {
            await identity.logout();
            showSmallNotification("로그아웃했어요.");
        } catch (error) {
            setSessionError(error instanceof Error ? error.message : "로그아웃하지 못했어요. 다시 시도해 주세요.");
        }
    }

    const spacePanel = (
        <div className="account-space-panel">
            <AccountMiniRoom name={displayName} message={space.message} theme={space.theme} lightOn={space.lightOn} programs={displayedPrograms} hasFavorites={favoritePrograms.length > 0} onEdit={openSpaceEditor} onToggleLight={toggleLight} />

            <section className="account-next-visit" aria-labelledby="account-next-heading">
                <div className="account-section-heading"><h2 id="account-next-heading">다음에 만날 무대</h2><a href="#account-panel-bookings">예매내역 보기 <Icon name="arrow" size={20} /></a></div>
                {summary.next ? <AccountTicket booking={summary.next} program={PROGRAMS.find(program => program.id === summary.next?.programId)} variant="compact" /> : <div className="account-empty-inline"><div><h3>기다리는 공연이 생기면 여기에.</h3><p>아직 예정된 체험 예매가 없어요. 다음에 만나고 싶은 무대를 골라 보세요.</p></div><SystemLink variant="secondary" href="/programs/">공연 둘러보기 <Icon name="arrow" size={20} /></SystemLink></div>}
                <p className="account-local-note">이 브라우저에 저장한 체험 예매입니다. 실제 예매·결제 내역은 공식 홈페이지에서 확인해 주세요.</p>
            </section>

            <section aria-labelledby="account-curation-heading">
                <div className="account-section-heading"><div><h2 id="account-curation-heading">{favoritePrograms.length ? "내 마음에 담은 공연" : "새로운 취향을 만나 보세요"}</h2><p>{favoritePrograms.length ? "좋아하는 공연이 나의 공간을 채워요." : "세종의 공연 중 세 편을 먼저 골라 두었어요."}</p></div>{favoritePrograms.length ? <a href="#account-panel-favorites">전체 보기 <Icon name="arrow" size={20} /></a> : <Link href="/programs/">전체 보기 <Icon name="arrow" size={20} /></Link>}</div>
                <div className="account-program-grid">{displayedPrograms.map(program => <ProgramCard key={program.id} program={program} />)}</div>
            </section>

            <section className="account-latest-note" aria-labelledby="account-latest-note-heading">
                <div className="account-section-heading"><h2 id="account-latest-note-heading">무대가 남긴 한 줄</h2><a href="#account-panel-notes">관람노트 쓰기 <Icon name="plus" size={20} /></a></div>
                {latestNote ? <div className="account-note-preview"><time dateTime={latestNote.date}>{latestNote.date.replaceAll("-", ".")}</time><h3>{PROGRAMS.find(program => program.id === latestNote.programId)?.title || "나의 관람 기록"}</h3><p>{latestNote.body}</p></div> : <p className="account-empty-note">아직 기록하지 않은 여운이 있나요? 오래 기억하고 싶은 장면을 남겨 보세요.</p>}
            </section>
        </div>
    );

    const bookingsPanel = (
        <section className="account-bookings-panel" aria-labelledby="account-bookings-heading">
            <div className="account-section-heading"><div><h2 id="account-bookings-heading" tabIndex={-1}>나의 예매내역</h2><p>이 브라우저에서 진행한 체험 예매를 모았어요.</p></div><SystemLink variant="quiet" href={OFFICIAL_ACCOUNT} target="_blank">실제 예매 확인 <Icon name="diagonal" size={20} /></SystemLink></div>
            <div className="account-booking-filters" aria-label="예매내역 필터">{[{ id: "all", label: `전체 ${bookings.length}` }, { id: "upcoming", label: `관람 예정 ${summary.upcoming}` }, { id: "cancelled", label: `취소 ${summary.cancelled}` }].map(filter => <SystemFilterButton key={filter.id} selected={bookingFilter === filter.id} onClick={() => setBookingFilter(filter.id)}>{filter.label}</SystemFilterButton>)}</div>
            {visibleBookings.length ? <div className="account-ticket-list">{visibleBookings.map(booking => <AccountTicket key={booking.id} booking={booking} program={PROGRAMS.find(program => program.id === booking.programId)} onCancel={openCancellation} />)}</div> : <div className="account-empty"><h3>{bookingFilter === "all" ? "아직 체험 예매가 없어요." : "이 조건에 맞는 체험 예매가 없어요."}</h3><p>공연을 둘러보고 나에게 맞는 다음 무대를 찾아보세요.</p><SystemLink href="/programs/" variant="secondary">공연 둘러보기 <Icon name="arrow" size={20} /></SystemLink></div>}
            <p className="account-local-note">체험 예매 취소는 이 브라우저의 기록만 변경하며, 실제 티켓이나 결제에는 영향을 주지 않습니다.</p>
        </section>
    );

    const favoritesPanel = (
        <section aria-labelledby="account-favorites-heading">
            <div className="account-section-heading"><div><h2 id="account-favorites-heading">내 마음에 담은 프로그램</h2><p>관심 표시한 공연·전시·교육을 다시 만나 보세요.</p></div><span>{favoritePrograms.length}편</span></div>
            {favoritePrograms.length ? <div className="account-list account-program-grid">{favoritePrograms.map(program => <ProgramCard key={program.id} program={program} />)}</div> : <div className="account-empty"><h3>어떤 공연에 마음이 가나요?</h3><p>프로그램의 하트를 누르면 나의 작은 공연장에도 포스터가 걸려요.</p><SystemLink href="/programs/" variant="secondary">프로그램 둘러보기 <Icon name="heart" size={20} /></SystemLink></div>}
        </section>
    );

    const servicesPanel = (
        <section aria-labelledby="account-services-heading">
            <div className="account-section-heading"><div><h2 id="account-services-heading">나의 신청과 회원 혜택</h2><p>정확한 신청 현황과 멤버십 혜택은 세종문화회관 공식 홈페이지에서 확인하세요.</p></div></div>
            <div className="account-service-list">
                <article><div><h3>회원 등급·포인트·쿠폰</h3><p>공식 계정에 연결된 나의 멤버십과 사용 가능한 혜택을 확인하세요.</p></div><SystemLink href={OFFICIAL_ACCOUNT} target="_blank" variant="secondary">공식 마이페이지 <Icon name="diagonal" size={20} /></SystemLink></article>
                <article><div><h3>교육·행사 신청내역</h3><p>신청과 결제 현황, 참여 안내를 공식 마이페이지에서 확인하세요.</p></div><SystemLink href={OFFICIAL_ACCOUNT} target="_blank" variant="quiet">신청내역 확인 <Icon name="diagonal" size={20} /></SystemLink></article>
                <article><div><h3>취향을 넓히는 예술 수업</h3><p>새로운 배움과 만남을 위한 교육 프로그램을 살펴보세요.</p></div><SystemLink href="/programs/education/" variant="quiet">교육 프로그램 보기 <Icon name="arrow" size={20} /></SystemLink></article>
            </div>
        </section>
    );

    const profilePanel = (
        <section className="account-profile-panel" aria-labelledby="account-profile-heading">
            <div className="account-section-heading"><div><h2 id="account-profile-heading">회원정보</h2><p>{identity.mode === "oauth" ? "로그인한 계정의 이름과 연락처를 관리해요." : "이 브라우저에 저장한 체험 계정 정보를 관리해요."}</p></div></div>
            {identity.isLoggedIn ? <form className="account-profile-form" onSubmit={saveProfile}>
                <SystemField variant="flow" label="이름" id="account-profile-name" name="name" autoComplete="name" value={profileDraft.name} onChange={event => setProfileDraft(current => ({ ...current, name: event.target.value }))} maxLength={50} required />
                <SystemField variant="flow" label="이메일" id="account-profile-email" name="email" type="email" autoComplete="email" value={profileDraft.email} readOnly={identity.mode === "oauth"} hint={identity.mode === "oauth" ? "Google 로그인 이메일은 Google 계정에서 변경할 수 있어요." : undefined} onChange={event => setProfileDraft(current => ({ ...current, email: event.target.value }))} required />
                <SystemField variant="flow" label="연락처" id="account-profile-phone" name="phone" type="tel" autoComplete="tel" value={profileDraft.phone} onChange={event => setProfileDraft(current => ({ ...current, phone: event.target.value }))} maxLength={24} />
                {profileError && <SystemNotice error title="회원정보를 저장하지 못했어요">{profileError}</SystemNotice>}
                <div className="account-form-actions"><SystemButton type="submit" context="flow" disabled={profileSaving}>{profileSaving ? "저장 중…" : "회원정보 저장"}</SystemButton></div>
            </form> : <div className="account-empty"><h3>로그인하고 나의 정보를 관리하세요.</h3><p>로그인한 회원의 이름과 연락처를 이곳에서 확인할 수 있어요.</p><SystemLink href="/account/login/">로그인 / 회원가입 <Icon name="arrow" size={20} /></SystemLink></div>}
        </section>
    );

    return (
        <div className="account-page account-experience">
            {/* [개인 공간으로 들어가는 페이지 제목 / Page heading for a personal space] */}
            <section className="account-page-heading" id="account-page-heading">
                <div className="container">
                    <nav className="account-breadcrumbs" aria-label="현재 위치"><Link href="/">홈</Link><span aria-hidden="true">/</span><span aria-current="page">마이페이지</span></nav>
                    <h1>마이페이지</h1>
                    <p>내가 고른 공연과 한 줄의 기록, 나만의 세종을 채워가요.</p>
                </div>
            </section>

            <div className="container account-layout" aria-busy={!dataReady}>
                <aside className="account-profile-aside"><AccountMembershipCard name={displayName} message={dataReady ? space.message : DEFAULT_ACCOUNT_SPACE.message} mode={identity.mode} counts={{ upcoming: dataReady ? summary.upcoming : 0, favorites: favoritePrograms.length, notes: dataReady ? notes.length : 0 }} onEdit={openSpaceEditor} onLogout={() => void logout()} /></aside>
                <div className="account-main">
                    {sessionError && <SystemNotice error title="계정 상태를 확인해 주세요">{sessionError}</SystemNotice>}
                    {!dataReady ? <p className="account-loading" role="status">나의 공간을 불러오고 있어요.</p> : <SystemTabs
                        idPrefix="account"
                        aria-label="마이페이지 메뉴"
                        className="account-tabs"
                        tabListClassName="account-tab-list"
                        panelClassName="account-tab-panel"
                        value={activeTab}
                        onValueChange={selectTab}
                        items={[
                            { id: "space", label: "나의 공간", content: spacePanel },
                            { id: "bookings", label: `예매내역 (${bookings.length})`, content: bookingsPanel },
                            { id: "favorites", label: `관심 프로그램 (${favoritePrograms.length})`, content: favoritesPanel },
                            { id: "notes", label: "관람노트", content: <AccountDiary programs={PROGRAMS} notes={notes} today={today} onSave={saveNote} onDelete={deleteNote} /> },
                            { id: "services", label: "신청·혜택", content: servicesPanel },
                            { id: "profile", label: "회원정보", content: profilePanel },
                        ]}
                    />}
                </div>
            </div>

            {/* [적용 전에는 원본을 바꾸지 않는 공간 편집 / Draft-only room editing until explicit apply] */}
            <SystemDialog className="account-space-dialog" open={editOpen} triggerRef={editTriggerRef} aria-labelledby="account-space-dialog-heading" aria-describedby="account-space-dialog-description" onClose={() => setEditOpen(false)}>
                <form className="account-space-form" onSubmit={saveSpace}>
                    <div className="account-dialog-heading"><h2 id="account-space-dialog-heading">나의 공간 꾸미기</h2><p id="account-space-dialog-description">이름과 한마디, 공연장의 빛을 골라 보세요. 이 브라우저에만 저장됩니다.</p></div>
                    <SystemField label="공간에서 사용할 이름" id="account-space-name" value={spaceDraft.nickname} onChange={event => setSpaceDraft(current => ({ ...current, nickname: event.target.value }))} maxLength={24} required autoFocus />
                    <SystemField as="textarea" label="나의 한마디" id="account-space-message" value={spaceDraft.message} onChange={event => setSpaceDraft(current => ({ ...current, message: event.target.value }))} maxLength={100} rows={3} />
                    <fieldset className="account-theme-picker"><legend>공연장 분위기</legend><div>{ACCOUNT_THEMES.map(theme => <SystemFilterButton key={theme.id} selected={spaceDraft.theme === theme.id} onClick={() => setSpaceDraft(current => ({ ...current, theme: theme.id }))}>{theme.label}</SystemFilterButton>)}</div></fieldset>
                    <div className="account-dialog-actions"><SystemButton variant="secondary" onClick={() => setEditOpen(false)}>취소</SystemButton><SystemButton type="submit">공간에 적용</SystemButton></div>
                </form>
            </SystemDialog>

            {/* [닫기와 취소는 기록을 변경하지 않음 / Dismissal never changes booking records] */}
            <SystemDialog className="account-cancel-dialog" open={cancelOpen} triggerRef={cancelTriggerRef} initialFocusRef={cancelCloseRef} aria-labelledby="account-cancel-heading" aria-describedby="account-cancel-description" onClose={() => { setCancelOpen(false); setPendingCancellation(null); }}>
                <div className="account-dialog-heading"><h2 id="account-cancel-heading">체험 예매를 취소할까요?</h2><p id="account-cancel-description">{pendingCancellation?.title}<br />이 브라우저의 체험 기록만 취소됩니다. 실제 티켓이나 결제에는 영향을 주지 않습니다.</p></div>
                <div className="account-dialog-actions"><SystemButton ref={cancelCloseRef} variant="secondary" onClick={() => setCancelOpen(false)}>돌아가기</SystemButton><SystemButton onClick={cancelBooking}>체험 예매 취소</SystemButton></div>
            </SystemDialog>
        </div>
    );
}
