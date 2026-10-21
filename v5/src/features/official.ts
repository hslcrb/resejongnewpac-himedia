import { OFFICIAL_REVIEWED, OFFICIAL_SERVICES, OFFICIAL_TICKET_NOTICES } from "../data/official.ts";
import type { OfficialService } from "../data/official.ts";
import { PAGES, VENUES } from "../data/catalog.ts";
import { esc, href, icon } from "../lib/core.ts";
import { pageHeader } from "../components/ui.ts";

const groupLabels: Record<string, string> = { programs: "공연·전시·교육", visit: "방문·관람", rental: "대관·대여", news: "소식·혜택", about: "기관·나눔", account: "나의 세종", utility: "이용 안내" };
const sourceLink = (url: string, label: string, className = "button button--dark") => `<a class="${className}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ${icon("diagonal", 19)}<span class="sr-only"> (새 창)</span></a>`;
const internalLink = (path: string, label: string) => `<a class="text-link" href="${href(path)}">${esc(label)} ${icon("arrow", 18)}</a>`;

// [서비스 찾기 / Searchable service directory]
// 제목·설명·분야로 검색하고 같은 결과를 키보드와 터치에서 사용합니다.
// Search titles, descriptions and groups with the same keyboard and touch controls.
export function serviceDirectoryEntries(search = "", group = "") {
    const needle = search.trim().toLocaleLowerCase();
    return PAGES.filter((page) => page.path !== "/" && page.path !== "/services" && page.group !== "rules"
        && (!group || page.group === group)
        && (!needle || `${page.title} ${page.description} ${groupLabels[page.group] || ""}`.toLocaleLowerCase().includes(needle)));
}

function directoryResults(search = "", group = "") {
    const entries = serviceDirectoryEntries(search, group);
    return `<p class="official-result-count" role="status">${entries.length}개의 안내</p>${entries.length ? `<div class="official-directory-list">${entries.map((page) => `<a href="${href(page.path)}"><div><span>${esc(groupLabels[page.group] || "이용 안내")}</span><h2>${esc(page.title)}</h2>${page.description ? `<p>${esc(page.description)}</p>` : ""}</div>${icon("arrow", 22)}</a>`).join("")}</div>` : '<div class="empty-state"><h2>일치하는 안내가 없습니다</h2><p>다른 검색어를 입력하거나 전체 분야를 선택해 주세요.</p></div>'}`;
}

function renderDirectory(query: URLSearchParams) {
    const search = query.get("q") || "";
    const group = query.get("group") || "";
    return `${pageHeader(PAGES.find((page) => page.path === "/services"))}<div class="container page-content official-page official-directory"><form class="official-directory-search" data-service-search role="search"><label for="service-query">무엇을 찾으세요?<input id="service-query" name="q" type="search" value="${esc(search)}" placeholder="데이티켓, 주차, 대관, 아카데미…" autocomplete="off"></label><label for="service-group">분야<select id="service-group" name="group"><option value="">전체 분야</option>${Object.entries(groupLabels).map(([id, title]) => `<option value="${id}"${group === id ? " selected" : ""}>${title}</option>`).join("")}</select></label><button class="button button--dark" type="submit">안내 찾기 ${icon("search", 20)}</button><button class="text-link" type="reset">초기화</button></form><div data-service-results>${directoryResults(search, group)}</div></div>`;
}

export function getDayTicketEligibility(year: number): "youth" | "senior" | "other" | "invalid" {
    if (!Number.isInteger(year) || year < 1900 || year > 2026) return "invalid";
    if (year >= 2002 && year <= 2019) return "youth";
    if (year <= 1961) return "senior";
    return "other";
}

function ticketFinder() {
    return `<section class="official-tool" aria-labelledby="day-check-heading"><div><span class="official-tool-label">2026년 기준</span><h2 id="day-check-heading">내가 받을 수 있는 혜택은?</h2><p>출생연도만으로 대상 여부를 확인해 보세요. 입력값은 저장되지 않습니다.</p></div><form data-day-ticket-check><label for="ticket-birth-year">출생연도<input id="ticket-birth-year" name="birthYear" type="number" inputmode="numeric" min="1900" max="2026" placeholder="예: 2005" required></label><button class="button button--dark" type="submit">대상 확인 ${icon("arrow", 18)}</button></form><p class="official-tool-result" data-day-ticket-result role="status">출생연도를 입력하면 적용 대상과 준비할 사항을 알려드려요.</p></section>`;
}

const classrooms = [
    { id: "square", title: "스퀘어홀", capacity: "48명", type: "강의·워크숍", equipment: "포디움, PC, 프로젝터, 스크린, 음향, 무선마이크 2대, 무선인터넷", rate: "평일 주간 일반대관 100,000원 / 시간" },
    { id: "circle", title: "서클홀", capacity: "60명", type: "강의·세미나", equipment: "포디움, PC, 프로젝터, 스크린, 음향, 무선마이크 2대, 무선인터넷", rate: "평일 주간 일반대관 100,000원 / 시간" },
    { id: "open", title: "오픈스테이지", capacity: "좌석 배치 시 80명", type: "전면거울·마루형 공간", equipment: "프로젝터, 음향, 무선마이크 2대, 무선인터넷", rate: "평일 주간 일반대관 70,000원 / 시간" },
];
function classroomDetails(id: string) {
    const room = classrooms.find((item) => item.id === id) || classrooms[0];
    return `<span class="official-tool-label">${room.type}</span><h3>${room.title}</h3><dl class="official-facts"><div><dt>수용 인원</dt><dd>${room.capacity}</dd></div><div><dt>보유 장비</dt><dd>${room.equipment}</dd></div><div><dt>참고 요금</dt><dd>${room.rate}</dd></div></dl><p class="official-fine">부가세 별도. 야간·주말·행사대관 요금은 공식 요금표를 확인하세요.</p>`;
}

function specialContent(service: OfficialService) {
    if (service.kind === "day") return ticketFinder();
    if (service.kind === "noon") return `<section class="official-tool official-noon"><div><span class="official-clock" aria-hidden="true">12:00</span><h2>한 시간의 기회</h2><p>서비스플라자에서 오늘의 공연을 확인하세요.</p></div><div><p>온라인 예약 없이 현장에서 구매합니다.</p>${internalLink("/visit/directions", "서비스플라자 찾아오기")}${internalLink("/programs/day-ticket", "데이티켓과 비교하기")}</div></section>`;
    if (service.kind === "classroom") return `<section class="official-tool"><h2>우리 모임에 맞는 공간</h2><div class="official-selector" role="group" aria-label="강의실 선택">${classrooms.map((item, index) => `<button type="button" data-classroom="${item.id}" aria-pressed="${index === 0}">${item.title}</button>`).join("")}</div><div data-classroom-result aria-live="polite">${classroomDetails("square")}</div></section>`;
    if (service.kind === "seats") return `<section class="official-seat-list" aria-label="공연장별 객석 안내">${VENUES.filter((venue) => venue.kind === "공연장").map((venue) => `<article><img src="${esc(venue.image)}" alt="${esc(venue.name)}" loading="lazy"><div><h2>${esc(venue.name)}</h2><p>${esc(venue.description)}</p><div class="official-inline-actions">${internalLink(`/visit/spaces/${venue.id}`, "공간 살펴보기")}${sourceLink(service.source, "좌석배치도", "text-link")}</div></div></article>`).join("")}</section>`;
    if (service.kind === "tickets") return `<section class="official-ticket-list" aria-label="최근 확인한 티켓오픈 공지"><p class="official-fine">${OFFICIAL_REVIEWED.replaceAll("-", ".")} 공식 홈페이지 확인 자료 · 실시간 목록이 아닙니다.</p>${OFFICIAL_TICKET_NOTICES.map((notice) => `<a href="${esc(notice.url)}" target="_blank" rel="noopener noreferrer"><time>${notice.date}<strong>${notice.time}</strong></time><h2>${esc(notice.title)}</h2>${icon("diagonal", 23)}<span class="sr-only">공식 공지 새 창으로 열기</span></a>`).join("")}</section>`;
    if (service.kind === "repertory") return `<section class="official-repertory"><h2>2026 / 2027 레퍼토리</h2>${[
        ["다시, 봄", "서울시뮤지컬단", "부산·경남 공동제작 버전. 80분, 400~1,000석 규모, 설치·리허설 3일 기준.", "02-399-1015"],
        ["데카당스", "서울시발레단", "70분, 500~1,000석 규모, 설치·리허설 2일 기준.", "02-399-1072"],
        ["퉁소소리", "서울시극단", "인터미션 포함 140분, 500~1,500석 규모, 설치·리허설 3~4일 기준.", "02-399-1616"],
    ].map(([title, company, description, phone]) => `<details><summary><span>${company}</span><h3>${title}</h3>${icon("plus", 22)}</summary><div><p>${description}</p><a class="text-link" href="tel:${phone}">투어 문의 ${phone}</a></div></details>`).join("")}</section>`;
    return "";
}

export function renderOfficialPage(path: string, query = new URLSearchParams()): string | null {
    if (path === "/services") return renderDirectory(query);
    const service = OFFICIAL_SERVICES.find((item) => item.path === path);
    if (!service) return null;
    const related = OFFICIAL_SERVICES.filter((item) => item.collection === service.collection && item.path !== path);
    return `${pageHeader(service)}<div class="container page-content official-page"><article class="official-service"><div class="official-service-main">${service.facts ? `<dl class="official-facts">${service.facts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>` : ""}${specialContent(service)}${service.sections?.map((section) => `<section class="official-section"><h2>${esc(section.title)}</h2>${section.text ? `<p>${esc(section.text)}</p>` : ""}${section.items ? `<ul>${section.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}</section>`).join("") || ""}<section class="official-source"><div><h2>이어서 이용하기</h2><p>운영 일정과 신청 조건은 공식 서비스에서 확인하세요.</p></div>${sourceLink(service.source, service.action)}<p class="official-fine">공식 안내 확인: ${OFFICIAL_REVIEWED.replaceAll("-", ".")} · 실제 예매·접수는 연결된 공식 사이트에서 진행됩니다.</p></section></div><aside class="official-related" aria-label="함께 확인할 안내"><p>${esc(service.collection)}</p>${related.map((item) => internalLink(item.path, item.title)).join("")}${service.group === "rental" ? sourceLink("https://frontrent.sejongpac.or.kr/SejongRentFront", "공식 대관시스템", "text-link") : ""}${internalLink("/services", "모든 이용 안내")}${internalLink("/visit/support/faq", "자주 묻는 질문")}<a class="official-contact" href="tel:02-399-1000"><span>전화예매·문의</span><strong>02.399.1000</strong></a></aside></article></div>`;
}

export function bindOfficialPage(root: HTMLElement) {
    const form = root.querySelector<HTMLFormElement>("[data-service-search]");
    const update = () => {
        if (!form) return;
        const fields = new FormData(form);
        const search = String(fields.get("q") || "");
        const group = String(fields.get("group") || "");
        const results = root.querySelector<HTMLElement>("[data-service-results]");
        if (results) results.innerHTML = directoryResults(search, group);
    };
    form?.addEventListener("submit", (event) => { event.preventDefault(); update(); });
    form?.addEventListener("input", update);
    form?.addEventListener("change", update);
    form?.addEventListener("reset", (event) => {
        event.preventDefault();
        // 기본 reset 완료 전의 값으로 검색하지 않도록 두 조건을 함께 비웁니다.
        // Clear both fields before rendering, independent of native reset-event timing.
        const search = form.querySelector<HTMLInputElement>('input[name="q"]');
        const group = form.querySelector<HTMLSelectElement>('select[name="group"]');
        if (search) search.value = "";
        if (group) group.value = "";
        update();
    });
    root.querySelector<HTMLFormElement>("[data-day-ticket-check]")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const result = getDayTicketEligibility(Number(new FormData(form).get("birthYear")));
        const target = root.querySelector<HTMLElement>("[data-day-ticket-result]");
        if (!target) return;
        target.textContent = {
            youth: "청소년 데이티켓 대상입니다. 해당 공연의 최저 등급 잔여석과 본인 연령 증빙을 확인해 주세요.",
            senior: "어르신 데이티켓 대상입니다. 최고 등급을 제외한 잔여석과 출생연도 확인이 가능한 실물 신분증을 준비해 주세요.",
            other: "2026년 데이티켓 연령 대상에 해당하지 않습니다. 누구나 현장에서 구매할 수 있는 정오티켓을 함께 살펴보세요.",
            invalid: "1900년부터 2026년 사이의 출생연도를 입력해 주세요.",
        }[result];
    });
    root.querySelectorAll<HTMLButtonElement>("[data-classroom]").forEach((button) => button.addEventListener("click", () => {
        root.querySelectorAll<HTMLElement>("[data-classroom]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        const result = root.querySelector<HTMLElement>("[data-classroom-result]");
        if (result) result.innerHTML = classroomDetails(button.dataset.classroom || "square");
    }));
}
