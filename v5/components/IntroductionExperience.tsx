"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./introduction.css";

const moments=[
 {id:"opening",kicker:"PROLOGUE · SEOUL",title:"도시가 무대가 되는 순간",subtitle:"예술은 벽 안에 머무르지 않는다.",tone:"a"},
 {id:"pulse",kicker:"ACT 01 · RHYTHM",title:"우리의 선, 오늘의 비트",subtitle:"한국의 색과 리듬을 지금의 감각으로.",tone:"b"},
 {id:"space",kicker:"ACT 02 · SPACE",title:"일상이 예술과 마주하는 곳",subtitle:"광화문에서 시작되는 새로운 장면.",tone:"c"},
 {id:"together",kicker:"ACT 03 · PEOPLE",title:"다음 장면은 당신과 함께",subtitle:"관객과 창작자가 함께 완성하는 문화의 공간.",tone:"d"},
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
  <nav className="intro-rail" aria-label="기관 소개 장면">
   {moments.map((m,i)=><button key={m.id} type="button" aria-label={`${i+1}번째 장면: ${m.title}`} aria-current={active===m.id?"step":undefined} onClick={()=>jump(m.id)}><span className={active===m.id?"on":""}/><small>0{i+1}</small></button>)}
  </nav>
  <section id="intro-opening" data-intro-scene="opening" className="intro-panel intro-cover">
   <div className="intro-grid" aria-hidden="true"/><div className="intro-wash" aria-hidden="true"/>
   <div className="intro-title-wrap"><span className="intro-kicker">SEJONG CENTER · SINCE 1978</span><p className="intro-stamp">KOREA / SEOUL / CULTURE</p><h1>서울의 심장,<br/><em>예술의 박동.</em></h1><p>도시가 무대가 되고,<br/>당신이 그 장면의 주인공이 되는 곳.</p><button className="intro-down" onClick={()=>jump("pulse")}>SCROLL TO FEEL <span aria-hidden="true">↓</span></button></div>
   <div className="intro-vertical" aria-hidden="true">ART IS EVERYWHERE - SEOUL</div>
  </section>
  <section id="intro-pulse" data-intro-scene="pulse" className="intro-panel intro-pulse">
   <div className="intro-marquee" aria-hidden="true"><span>흥 · 멋 · 빛 · 움직임 · 흥 · 멋 · 빛 · 움직임 · </span></div>
   <div className="intro-ribbons" aria-hidden="true">{["gold","red","blue","green","cream"].map((x,i)=><i key={x} className={`ribbon ribbon-${x}`} style={{animationDelay:(i*-.45)+"s"}}/>)}</div>
   <div className="intro-copy"><span className="intro-kicker">01 - KOREAN RHYTHM</span><h2>전통은<br/><em>멈춰 있지 않다.</em></h2><p>색동의 유연한 선과 동시대의 선명한 박자. 옛 감각을 새롭게 바라보는 실험, 문화의 내일을 상상합니다.</p><a href="#intro-space" onClick={e=>{e.preventDefault();jump("space")}}>다음 장면 보기 ↗</a></div>
  </section>
  <section id="intro-space" data-intro-scene="space" className="intro-panel intro-space">
   <div className="intro-photo" role="img" aria-label="세종문화회관에서 선보인 공연의 이미지"/><div className="intro-photo-shade"/>
   <div className="intro-copy"><span className="intro-kicker">02 - OPEN SPACE</span><h2>서울 한가운데,<br/><em>다른 세계로.</em></h2><p>광화문에서 공연과 전시, 교육과 만남이 교차하는 예술의 거점. 무대의 막이 오르기 전에도 이야기는 이미 시작됩니다.</p><Link href="/visit/spaces">공간 둘러보기 ↗</Link></div>
  </section>
  <section id="intro-together" data-intro-scene="together" className="intro-panel intro-last">
   <div className="intro-orbit" aria-hidden="true"><i/><i/><i/></div>
   <div className="intro-copy"><span className="intro-kicker">03 - THE NEXT SCENE</span><h2>다음 장면은<br/><em>우리의 것.</em></h2><p>예술가가 만들고 관객이 완성하는 도시. 세종문화회관의 다음 페이지에 당신을 초대합니다.</p>
    <div className="intro-actions"><Link href="/programs">공연·전시 만나기 ↗</Link><Link href="/about/introduction/history">걸어온 역사 ↗</Link></div>
   </div><p className="intro-credit">UNOFFICIAL REDESIGN CONCEPT · NOT AN OFFICIAL WEBSITE</p>
  </section>
 </div>;
}
