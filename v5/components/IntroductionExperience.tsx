"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./introduction.css";

const moments=[
 {id:"opening",kicker:"PROLOGUE · SEOUL",title:"광화문, 무대가 열리는 곳",subtitle:"1978년부터 공연·전시·교육이 한 건물에.",tone:"a"},
 {id:"pulse",kicker:"ACT 01 · RHYTHM",title:"옛 춤과 노래를 오늘의 무대로",subtitle:"국악과 전통춤 공연이 시즌마다 상연됩니다.",tone:"b"},
 {id:"space",kicker:"ACT 02 · SPACE",title:"한 건물에, 여러 개의 무대",subtitle:"대극장부터 소극장, 미술관까지 공간을 구경합니다.",tone:"c"},
 {id:"together",kicker:"ACT 03 · PEOPLE",title:"다음 무대의 자리가 비어 있습니다",subtitle:"프로그램 일정을 확인해 보세요.",tone:"d"},
];
export default function IntroductionExperience(){
 const root=useRef<HTMLDivElement>(null);
 const [current,setCurrent]=useState(0);
 const [soundless,setSoundless]=useState(true);
 const [active,setActive]=useState("opening");
 useEffect(()=>{
  document.body.classList.add("sejong-intro-active");
  const reduce=window.matchMedia("(prefers-reduced-motion: reduce)");
  const update=()=>{
   const top=window.scrollY;
   document.body.classList.toggle("sejong-intro-scrolled",top>80);
   const footer=document.querySelector(".renewal-footer");
   if(footer){const rect=footer.getBoundingClientRect();document.body.classList.toggle("sejong-intro-end",rect.top < window.innerHeight*0.9)}
  };
  let raf=0;
  const onScroll=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;update();});};
  window.addEventListener("scroll",onScroll,{passive:true});update();
  const sections=root.current?.querySelectorAll("[data-intro-scene]")||[];
  const observer=new IntersectionObserver(entries=>{
   entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio).slice(0,1).forEach(e=>{
    const id=(e.target as HTMLElement).dataset.introScene||"opening";
    setActive(id); const index=moments.findIndex(m=>m.id===id);if(index>=0)setCurrent(index);
   });
  },{threshold:[0.2,0.4,0.6]});
  sections.forEach(e=>observer.observe(e));
  return()=>{window.removeEventListener("scroll",onScroll);if(raf)cancelAnimationFrame(raf);observer.disconnect();document.body.classList.remove("sejong-intro-active","sejong-intro-scrolled","sejong-intro-end");};
 },[]);
 const jump=(id:string)=>document.getElementById("intro-"+id)?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
 return <div ref={root} className="sejong-intro">
  <div className="intro-progress" role="progressbar" aria-label="소개 페이지 진행" aria-valuemin={0} aria-valuemax={4} aria-valuenow={current+1}>
   <div style={{width:((current+1)/4*100)+"%"}}/>
  </div>
  <nav data-text="body" className="intro-rail" aria-label="기관 소개 장면">
   {moments.map((m,i)=><button data-text="action" data-system-part="intro-step" key={m.id} type="button" aria-label={`${i+1}번째 장면: ${m.title}`} aria-current={active===m.id?"step":undefined} onClick={()=>jump(m.id)}><span className={active===m.id?"on":""}/><small data-text="caption">0{i+1}</small></button>)}
  </nav>
  <section id="intro-opening" data-intro-scene="opening" className="intro-panel intro-cover">
   <div className="intro-grid" aria-hidden="true"/><div className="intro-wash" aria-hidden="true"/>
   <div className="intro-title-wrap"><h1 data-text="title">광화문에서<br/><em data-text="body">무대가 열리는 곳.</em></h1><p data-text="body">공연장과 전시장, 예술교육<br/>한 건물에 모았습니다.</p><button data-text="action" data-system-part="intro-next" className="intro-down" onClick={()=>jump("pulse")}>다음 장면 보기 <span data-text="body" aria-hidden="true">↓</span></button></div>
  </section>
  <section id="intro-pulse" data-intro-scene="pulse" className="intro-panel intro-pulse">
   <div className="intro-marquee" aria-hidden="true"><span data-text="body">흥 · 멋 · 빛 · 움직임 · 흥 · 멋 · 빛 · 움직임 · </span></div>
   <div data-text="body" className="intro-ribbons" aria-hidden="true">{["gold","red","blue","green","cream"].map((x,i)=><i key={x} className={`ribbon ribbon-${x}`} style={{animationDelay:(i*-.45)+"s"}}/>)}</div>
   <div className="intro-copy"><h2 data-text="heading">전통은<br/><em data-text="body">멈춰 있지 않다.</em></h2><p data-text="body">국악관현악과 전통춤, 탈춤 공연이 시즌마다 다시 무대에 오릅니다. 옛 무대를 오늘의 무대 위에 올려둔 것이 세종의 방식입니다.</p><a data-text="action" href="#intro-space" onClick={e=>{e.preventDefault();jump("space")}}>다음 장면 보기 ↗</a></div>
  </section>
  <section id="intro-space" data-intro-scene="space" className="intro-panel intro-space">
   <div className="intro-photo" role="img" aria-label="세종문화회관에서 선보인 공연의 이미지"/><div className="intro-photo-shade"/>
   <div className="intro-copy"><h2 data-text="heading">한 건물에<br/><em data-text="body">여러 개의 무대.</em></h2><p data-text="body">대극장부터 소공연장, 미술관까지 무대마다 분위기와 좌석이 다릅니다. 막이 오르기 전에 공간을 먼저 둘러보세요.</p><Link data-text="action" href="/visit/spaces">공간 둘러보기 ↗</Link></div>
  </section>
  <section id="intro-together" data-intro-scene="together" className="intro-panel intro-last">
   <div className="intro-orbit" aria-hidden="true"><i/><i/><i/></div>
   <div className="intro-copy"><h2 data-text="heading">다음 무대의<br/><em data-text="body">자리가 비어 있습니다.</em></h2><p data-text="body">무대는 예술가가 차리고, 관람은 관객이 완성합니다. 다음 회차 일정을 확인해 보세요.</p>
    <div className="intro-actions"><Link data-text="action" href="/programs">공연·전시 일정 ↗</Link><Link data-text="action" href="/about/introduction/history">걸어온 역사 ↗</Link></div>
   </div>
  </section>
 </div>;
}
