"use client";

import { useState } from "react";
import { COMPONENT_REGISTRY, CONTROL_EXCEPTIONS } from "../src/data/component-registry";
import { COMPONENT_COUNTS, COMPONENT_USAGE } from "../src/data/component-usage";
import { HOME_FEATURES } from "../src/data/home-features";
import { PROGRAMS } from "../src/data/catalog";
import { mediaPath } from "../src/lib/media";
import HeroSlide from "./HeroSlide";
import HeroCompanion from "./HeroCompanion";
import SeasonBanner from "./SeasonBanner";
import { BookingCalendar, BookingProgramChoice } from "./HomeBookingControls";
import { SystemButton, SystemCheckbox, SystemField, SystemIconButton, SystemLink } from "./SystemPrimitives";
import Icon from "./Icon";
import AccountMiniRoom from "./AccountMiniRoom";
import { AccountDiary, AccountMembershipCard, AccountTicket } from "./AccountPanels";
import { validateAccountNote } from "../src/lib/account-space.ts";
import type { AccountNote, AccountTheme } from "../src/lib/account-space.ts";
import { showSmallNotification } from "./SmallNotificationModal";

const kinds = { ui: "재사용 UI", structure: "구조·페이지 연결", internal: "내부 지원", demo: "문서 도구" };
const statuses = { product: "제품 연결", "guide-only": "가이드 전용", unused: "미사용" };

// [등록된 실제 컴포넌트 / The registered production components]
// 샘플 마크업을 다시 만들지 않고 제품과 같은 구현을 렌더링합니다.
// Render the production implementation instead of copying sample markup.
export default function ComponentCatalog() {
    const [query, setQuery] = useState("");
    const [preview, setPreview] = useState("");
    const [month, setMonth] = useState("2026-10");
    const [date, setDate] = useState("2026-10-21");
    const [selected, setSelected] = useState(false);
    const [consent, setConsent] = useState(false);
    const [roomLight, setRoomLight] = useState(true);
    const [roomTheme, setRoomTheme] = useState<AccountTheme>("paper");
    const [accountNotes, setAccountNotes] = useState<AccountNote[]>([]);
    const entries = COMPONENT_REGISTRY.filter(entry => `${entry.name} ${entry.purpose} ${entry.source}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    const previewEntry = COMPONENT_REGISTRY.find(entry => entry.id === preview);

    return (
        <div data-text="body" className="component-catalog" data-component="ComponentCatalog">
            <p data-text="body">등록부와 실제 import·렌더 경로를 대조한 목록입니다. 페이지 자체와 훅은 수에 포함하지 않으며, 별칭은 같은 구현으로 묶습니다. 내부 지원과 문서 도구는 제품 UI와 구분합니다.</p>
            <dl className="component-counts" aria-label="컴포넌트 연결 현황">
                <div><dt data-text="label">등록된 구현</dt><dd data-text="body" data-count="total">{COMPONENT_COUNTS.total}</dd></div>
                <div><dt data-text="label">제품 연결</dt><dd data-text="body" data-count="product">{COMPONENT_COUNTS.product}</dd></div>
                <div><dt data-text="label">가이드 전용</dt><dd data-text="body" data-count="guide-only">{COMPONENT_COUNTS.documentationOnly}</dd></div>
                <div><dt data-text="label">미사용</dt><dd data-text="body" data-count="unused">{COMPONENT_COUNTS.unused}</dd></div>
            </dl>
            <SystemField data-text="body" type="search" label="컴포넌트 검색" value={query} onChange={event => setQuery(event.target.value)} placeholder="이름, 용도, 소스 파일" />
            <div className="component-table-scroll" role="region" aria-label="전체 컴포넌트 등록부" tabIndex={0}>
                <table className="component-table">
                    <thead><tr><th data-text="label" scope="col">컴포넌트</th><th data-text="label" scope="col">구분·사용</th><th data-text="label" scope="col">규격과 역할</th></tr></thead>
                    <tbody>{entries.map(entry => {
                        const usage = COMPONENT_USAGE[entry.id];
                        return (
                            <tr key={entry.id} data-component-record={entry.id}>
                                <th data-text="label" scope="row"><a data-text="action" href={`#${entry.guide}`}>{entry.name}</a>{entry.lifecycle === "deprecated" && <span data-text="label">Deprecated</span>}<code data-text="meta">{entry.source}</code></th>
                                <td data-text="body">{kinds[entry.kind]}<br /><strong data-text="item-title">{usage ? statuses[usage.status] : "분석 필요"}</strong>{entry.parent && <span data-text="body">상위: {COMPONENT_REGISTRY.find(parent => parent.id === entry.parent)?.name}</span>}</td>
                                <td data-text="body"><p data-text="body">{entry.purpose}</p>{entry.variants && <p data-text="body">베리언트: {entry.variants.join(" · ")}</p>}<details><summary data-text="label">실제 연결 경로</summary><ul>{[...new Set([...(usage?.productUses || []), ...(usage?.guideUses || [])])].map(source => <li data-text="body" key={source}><code data-text="meta">{source}</code></li>)}</ul></details></td>
                            </tr>
                        );
                    })}</tbody>
                </table>
            </div>

            <h3 data-text="subheading">같은 컨트롤, 서로 다른 역할</h3>
            <div className="component-actions">
                <SystemLink data-text="action" href="/programs">프로그램으로 이동 <Icon name="arrow" size={20} /></SystemLink>
                <SystemIconButton data-text="action" aria-label="공통 아이콘 버튼 확인" onClick={() => showSmallNotification("공통 아이콘 버튼으로 실행했어요.")}><Icon name="plus" /></SystemIconButton>
            </div>
            <SystemCheckbox data-text="label" checked={consent} onChange={event => setConsent(event.target.checked)} label="실제 화면과 같은 체크박스입니다" />

            <h3 data-text="subheading">대표 콘텐츠와 시즌 배너</h3>
            <div className="home-v4-wrap component-hero-preview"><HeroSlide feature={HOME_FEATURES[0]} active layout="standalone" /></div>
            <SeasonBanner id="design-season-banner" />

            <h3 data-text="subheading">티켓오픈과 유리 시계</h3>
            <div className="component-companion-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="component-preview-background" src={mediaPath(`assets/images/${HOME_FEATURES[0].image}`)} alt="" width={1672} height={941} loading="lazy" />
                <HeroCompanion />
            </div>

            <h3 data-text="subheading">공간 관계를 유지하는 선택 조작</h3>
            <div className="component-booking-preview">
                <BookingCalendar month={month} selectedDate={date} today="2026-10-21" programs={PROGRAMS} dateLabel={value => value.replaceAll("-", ".")} onMonthChange={setMonth} onDateChange={setDate} />
                <BookingProgramChoice program={PROGRAMS[0]} selected={selected} available past={false} onSelect={() => setSelected(value => !value)} />
            </div>
            <p data-text="caption" className="ds-caption">일반 버튼의 규격을 좌석·달력·복합 선택 타일에 강제로 적용하지 않습니다. 아래 예외는 소유 구현과 이유를 검사하며, 파일 전체를 예외로 두지 않습니다.</p>
            <ul className="component-exceptions">{CONTROL_EXCEPTIONS.map(exception => <li data-text="body" key={`${exception.source}-${exception.part}`}><strong data-text="item-title">{exception.owner} · {exception.part}</strong><span data-text="body">{exception.reason}</span></li>)}</ul>

            {/* [마이페이지의 실제 조합 / Actual account component composition] */}
            <h3 data-text="subheading">개인 공간과 관람 기록</h3>
            <p data-text="body">마이페이지에서 사용하는 동일한 구현입니다. 미리보기에는 예시 데이터를 사용하며, 노트는 페이지를 떠나면 초기화됩니다.</p>
            <div data-text="body" className="component-actions">{([{id:"paper",label:"종이빛"},{id:"sky",label:"하늘빛"},{id:"sun",label:"햇살빛"}] as const).map(theme => <SystemButton data-text="action" variant="secondary" key={theme.id} aria-pressed={roomTheme === theme.id} onClick={() => setRoomTheme(theme.id)}>{theme.label}</SystemButton>)}</div>
            <AccountMiniRoom name="관람객" message="관람의 기록과 좋아하는 것들을 모아요." theme={roomTheme} lightOn={roomLight} programs={PROGRAMS.slice(0, 3)} hasFavorites={false} onToggleLight={() => setRoomLight(value => !value)} />
            <AccountMembershipCard name="관람객" message="나의 취향을 발견하는 중" mode="guest" counts={{upcoming:0,favorites:0,notes:accountNotes.length}} onEdit={() => setPreview("account-experience")} onLogout={() => {}} />
            <AccountTicket variant="compact" program={PROGRAMS[0]} booking={{id:"GUIDE-SAMPLE",programId:PROGRAMS[0].id,title:PROGRAMS[0].title,date:"2026-11-20",time:"19:30",venue:PROGRAMS[0].venue || "세종문화회관",seats:["A1"],total:70000,reference:"GUIDE"}} />
            <AccountDiary programs={PROGRAMS} notes={accountNotes} today="2026-10-21" onSave={draft => { const value = validateAccountNote(draft, new Set(PROGRAMS.map(program => program.id)), "2026-10-21"); if (!value) return false; setAccountNotes(current => [{...value,id:crypto.randomUUID()},...current]); return true; }} onDelete={id => setAccountNotes(current => current.filter(note => note.id !== id))} />

            <h3 data-text="subheading">구조와 전체 페이지 경험</h3>
            <p data-text="body">헤더·푸터·문맥 메뉴·위로 가기·기관 소개는 실제 경로에서 확인합니다. 선택하면 같은 제품 화면을 미리 불러옵니다.</p>
            <div data-text="body" className="component-actions">{COMPONENT_REGISTRY.filter(entry => entry.previewRoute).map(entry => <SystemButton data-text="action" key={entry.id} variant="secondary" aria-pressed={preview === entry.id} onClick={() => setPreview(entry.id)}>{entry.name}</SystemButton>)}</div>
            {previewEntry?.previewRoute && (
                <div className="component-route-preview">
                    <SystemLink data-text="action" variant="quiet" href={previewEntry.previewRoute} target="_blank">{previewEntry.name} 원본 화면 열기 <Icon name="diagonal" size={20} /></SystemLink>
                    <iframe title={`${previewEntry.name} 실제 화면 미리보기`} src={previewEntry.previewRoute} loading="lazy" />
                </div>
            )}
        </div>
    );
}
