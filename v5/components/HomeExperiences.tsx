"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "./Icon";

// [공연 밖의 경험 탐색 / Discover experiences beyond a performance]
const experiences = [
    { id: "backstage", title: "무대 뒤를 걷다", category: "백스테이지 투어", description: "객석에서는 보이지 않던 또 하나의 세종. 무대와 공연장에 담긴 이야기를 만나보세요.", image: "sejong-grand-interior.png", alt: "세종대극장 무대 옆에서 바라본 객석", href: "/programs/tour", action: "투어 알아보기", icon: "ticket" },
    { id: "history", title: "광화문 아래, 이야기 속으로", category: "세종·충무공 이야기", description: "세종대왕과 이순신 장군의 이야기를 가까이에서. 전시와 체험으로 만나는 열린 문화 공간입니다.", image: "sejong-grand-facade.png", alt: "광화문 광장에 자리한 세종문화회관 외관", href: "/programs/history", action: "전시관 둘러보기", icon: "building" },
    { id: "academy", title: "보는 예술에서, 하는 예술로", category: "세종예술아카데미", description: "음악을 듣는 새로운 방법, 예술을 이해하는 즐거움. 일상에 오래 남을 배움을 시작해 보세요.", image: "sejong-grand-auditorium.png", alt: "음악을 만나는 공간, 세종대극장", href: "/programs/education", action: "교육 프로그램 찾기", icon: "calendar" },
    { id: "everyone", title: "예술 앞에서, 모든 누구나", category: "모든 누구나", description: "더 많은 사람이 예술을 누릴 수 있도록. 누구나 클래식부터 함께 만드는 무대까지 만나보세요.", image: "sejong-grand-facade.png", alt: "모두에게 열려 있는 세종문화회관", href: "/programs/season/everyone", action: "참여 프로그램 보기", icon: "heart" },
];

export default function HomeExperiences() {
    const [selected, setSelected] = useState(0);
    const item = experiences[selected];

    return (
        <section className="home-experiences" id="beyond-the-stage" aria-labelledby="experiences-heading">
            <div className="container">
                <div className="experience-section-heading"><h2 id="experiences-heading">무대 너머의 세종.</h2><p>공연을 보는 날에도,<br />그렇지 않은 날에도.</p></div>
                <div className="experience-switcher">
                    <div className="experience-tabs" role="tablist" aria-label="문화 경험 선택" aria-orientation="vertical">
                        {experiences.map((experience, index) => (
                            <button key={experience.id} type="button" role="tab" id={`experience-tab-${experience.id}`} aria-controls="experience-panel" aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={(event) => {
                                let next = index;
                                if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % experiences.length;
                                else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (index - 1 + experiences.length) % experiences.length;
                                else if (event.key === "Home") next = 0;
                                else if (event.key === "End") next = experiences.length - 1;
                                else return;
                                event.preventDefault();
                                setSelected(next);
                                document.getElementById(`experience-tab-${experiences[next].id}`)?.focus();
                            }}>
                                <span className="experience-tab-number">0{index + 1}</span><span>{experience.category}</span><Icon name="diagonal" size={22} />
                            </button>
                        ))}
                    </div>
                    <div className="experience-panel" id="experience-panel" role="tabpanel" aria-labelledby={`experience-tab-${item.id}`} tabIndex={0}>
                        <img key={item.image} src={`/v5/assets/images/${item.image}`} alt={item.alt} width={1160} height={680} loading="lazy" />
                        <div className="experience-panel-copy" key={item.id}>
                            <Icon name={item.icon} size={28} /><h3>{item.title}</h3><p>{item.description}</p><Link href={item.href}>{item.action}<Icon name="arrow" size={22} /></Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
