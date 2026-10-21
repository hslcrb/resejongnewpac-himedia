import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";
import { accountToday } from "../src/lib/account-space.ts";
import { PROGRAMS } from "../src/data/catalog.ts";

// [실제 개인 공간과 보관 상태 / Real personal space and persistence states]
const base = (process.argv[2] || "http://127.0.0.1:3000/v5/").replace(/\/?$/, "/");
const directory = ".local-reports/account-space";
fs.mkdirSync(directory, {recursive:true});
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
const context = await browser.newContext({viewport:{width:1440,height:1000}});
const page = await context.newPage();
const errors: string[] = [];
const results: {name:string;passed:boolean;error?:string}[] = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(10000);
const date = new Date(`${accountToday()}T12:00:00Z`);
date.setUTCDate(date.getUTCDate() + 7);
const program = PROGRAMS.find(item => item.id === "winter")!;
await context.addInitScript(({title,future}) => {
    try {
        if (localStorage.getItem("account-test-seeded")) return;
        localStorage.setItem("account-test-seeded","true");
        localStorage.setItem("sejong-v4:profile",JSON.stringify({name:"이호",email:"account@example.com",phone:""}));
        localStorage.setItem("sejong-v4:session",'{"active":true}');
        localStorage.setItem("sejong-v4:favorites",'["dance","winter","carmen"]');
        localStorage.setItem("sejong-v4:bookings",JSON.stringify([{id:"BKG-TEST",programId:"winter",title,date:future,time:"19:30",venue:"세종대극장",seats:["A1","A2"],total:140000}]));
    } catch { /* 불투명 origin 건너뛰기 / Skip opaque origins. */ }
}, {title:program.title,future:date.toISOString().slice(0,10)});
const ready = () => page.locator('.account-layout[aria-busy="false"]').waitFor();
const go = async (route = "account/") => {await page.goto(new URL(route,base).href,{waitUntil:"networkidle"});await ready();};
const tab = (name: string) => page.getByRole("tab",{name,exact:true});
async function check(name:string, run:()=>Promise<void>) {
    try {await run();results.push({name,passed:true});console.log("PASS",name);}
    catch(error){results.push({name,passed:false,error:String(error)});console.error("FAIL",name,String(error));await page.screenshot({path:`${directory}/failure-${results.length}.png`});}
}
try {
    await check("account guide examples use the real components at all five widths",async()=>{
        await page.goto(new URL("design-rules/#components/registry",base).href,{waitUntil:"networkidle"});
        await page.locator(".component-catalog .account-mini-room").waitFor();
        for(const width of [320,390,768,1024,1440]) {
            await page.setViewportSize({width,height:1000});
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
            for(const name of ["AccountMiniRoom","AccountMembershipCard","AccountTicket","AccountDiary"]) assert.equal(await page.locator(`.component-catalog [data-component="${name}"]`).count(),1);
        }
        await page.locator(".component-catalog").getByRole("button",{name:"하늘빛",exact:true}).click();
        assert.equal(await page.locator(".component-catalog .account-mini-room").getAttribute("data-theme"),"sky");
        await page.locator(".component-catalog .account-mini-room").getByRole("button",{name:/조명 끄기/}).click();
        assert.equal(await page.locator(".component-catalog .account-mini-room").getAttribute("data-light"),"off");
        await page.locator(".component-catalog .account-mini-room").screenshot({path:`${directory}/guide-room.png`});
    });
    await go();
    for (const width of [320,390,768,1024,1440]) await check(`personal space fits ${width}px with loaded posters and readable controls`,async()=>{
        await page.setViewportSize({width,height:1000});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        assert.equal(await page.locator(".mini-room-art image").count(),3);
        assert.equal(await page.locator(".account-main .account-ticket[data-variant=compact]").count(),1);
        const small = await page.locator(".account-experience").evaluate(root=>[...root.querySelectorAll("p,a,button,label,input,textarea,span,dt,dd,time")].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=="hidden"&&Number.parseFloat(getComputedStyle(el).fontSize)<15.9).map(el=>({tag:el.tagName,text:el.textContent,size:getComputedStyle(el).fontSize})));
        assert.deepEqual(small,[]);
        await page.screenshot({path:`${directory}/verified-${width}.png`,fullPage:width===1440||width===390});
    });
    await check("room drafts cancel safely and applied themes, names and light survive reload",async()=>{
        await page.setViewportSize({width:1440,height:1000});
        const trigger=page.locator(".mini-room-actions").getByRole("button",{name:"공간 꾸미기",exact:true});
        await trigger.click();
        await page.locator("#account-space-name").fill("저장하지 않을 이름");
        await page.keyboard.press("Escape");
        assert.ok(await trigger.evaluate(el=>document.activeElement===el));
        assert.doesNotMatch(await page.locator(".mini-room-note cite").innerText(),/저장하지/);
        await trigger.click();
        await page.locator("#account-space-name").fill("공연을 좋아하는 아주 긴 이름입니다");
        assert.ok((await page.locator("#account-space-name").inputValue()).length<=24);
        await page.locator("#account-space-message").fill("마음에 오래 남는 무대를 기록하며 다음 공연을 기다리고 있어요. ".repeat(3));
        await page.locator(".account-space-dialog").getByRole("button",{name:"하늘빛",exact:true}).click();
        await page.getByRole("button",{name:"공간에 적용",exact:true}).click();
        await page.locator('.account-mini-room[data-theme="sky"]').waitFor();
        const light=page.locator(".mini-room-actions").getByRole("button",{name:/공연장 조명/});
        await light.click();
        assert.equal(await page.locator(".account-mini-room").getAttribute("data-light"),"off");
        await page.reload({waitUntil:"networkidle"});await ready();
        assert.equal(await page.locator(".account-mini-room").getAttribute("data-theme"),"sky");
        assert.equal(await page.locator(".account-mini-room").getAttribute("data-light"),"off");
        for(const width of [320,390,768,1440]){
            await page.setViewportSize({width,height:1000});
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
            const note=await page.locator(".mini-room-note").boundingBox();
            const art=await page.locator(".mini-room-art").boundingBox();
            assert.ok(note&&art&&note.y+note.height<=art.y+1,"Long notes must flow above the room artwork");
        }
        await page.screenshot({path:`${directory}/long-name-note.png`});
    });
    await check("actual tabs support arrow keys, hash entry and the direct account destinations",async()=>{
        await page.setViewportSize({width:1440,height:1000});
        await tab("나의 공간").focus();await page.keyboard.press("ArrowRight");
        assert.equal(await tab("예매내역 (1)").getAttribute("aria-selected"),"true");
        assert.ok(page.url().endsWith("#account-panel-bookings"));
        for(const [route,label] of [["bookings","예매내역 (1)"],["favorites","관심 프로그램 (3)"],["profile","회원정보"],["applications","신청·혜택"]]){
            await go(`account/${route}/`);
            assert.equal(await tab(label).getAttribute("aria-selected"),"true");
        }
        await go("account/#account-panel-notes");
        assert.equal(await tab("관람노트").getAttribute("aria-selected"),"true");
        await tab("나의 공간").click();
        await page.getByRole("link",{name:"관람노트 쓰기"}).focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction(()=>document.activeElement?.id==="account-panel-notes");
    });
    await check("dated notes persist real user text and can be removed",async()=>{
        await tab("관람노트").click();
        await page.locator("#account-note-program").selectOption("winter");
        await page.locator("#account-note-date").fill(accountToday());
        await page.locator("#account-note-body").fill("<script>가 아닌, 무대의 여운을 한 줄로 남깁니다.</script>");
        await page.getByRole("button",{name:"노트 남기기",exact:true}).click();
        assert.equal(await page.locator(".account-note-list .account-note").count(),1);
        await page.reload({waitUntil:"networkidle"});await ready();
        assert.match(await page.locator(".account-note-list").innerText(),/<script>가 아닌/);
        assert.equal(await page.locator(".account-note-list script").count(),0);
        await page.locator(".account-note-list").getByRole("button",{name:/노트 삭제/}).click();
        assert.equal(await page.locator(".account-note-list .account-note").count(),0);
        await page.reload({waitUntil:"networkidle"});await ready();
        assert.equal(await page.locator(".account-note-list .account-note").count(),0);
        await page.locator("#account-note-body").fill("다른 계정에서 보이지 않아야 하는 개인 기록입니다.");
        await page.getByRole("button",{name:"노트 남기기",exact:true}).click();
    });
    await check("favorite cards and the posters in the room use the same saved state",async()=>{
        await tab("관심 프로그램 (3)").click();
        const card=page.locator("#account-panel-favorites .program-card").first();
        await card.hover();await card.locator("button").click();
        await tab("관심 프로그램 (2)").waitFor();
        await tab("나의 공간").click();
        assert.equal(await page.locator(".mini-room-art image").count(),2);
    });
    await check("ticket cancellation has dismiss, Escape and confirmed persistence with useful focus return",async()=>{
        await tab("예매내역 (1)").click();
        const trigger=page.locator("#account-panel-bookings .account-ticket-action button");
        await trigger.click();await page.locator(".account-cancel-dialog").getByRole("button",{name:"돌아가기"}).click();
        assert.equal(await page.locator("[data-cancelled=true]").count(),0);
        await trigger.click();await page.keyboard.press("Escape");
        assert.ok(await trigger.evaluate(el=>document.activeElement===el));
        await trigger.click();await page.locator(".account-cancel-dialog").getByRole("button",{name:"예매 기록 취소",exact:true}).click();
        await page.locator('.account-ticket[data-cancelled="true"]').waitFor();
        assert.equal(await page.evaluate(()=>document.activeElement?.id),"account-bookings-heading");
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("sejong-v4:bookings")||"[]")[0].status),"cancelled");
    });
    await check("profile editing and logout preserve the demo boundary and isolate guest notes",async()=>{
        await tab("회원정보").click();
        await page.locator("#account-profile-name").fill("수정한 관람객");
        await page.locator("#account-profile-email").fill("changed@example.com");
        await page.locator("#account-profile-phone").fill("010-1234-5678");
        await page.locator(".account-profile-form").getByRole("button",{name:/저장/}).click();
        await page.waitForFunction(()=>JSON.parse(localStorage.getItem("sejong-v4:profile")||"{}").name==="수정한 관람객");
        await tab("관람노트").click();
        assert.equal(await page.locator(".account-note-list .account-note").count(),1);
        await tab("나의 공간").click();
        assert.equal(await page.locator(".account-mini-room").getAttribute("data-theme"),"sky");
        await page.locator(".account-identity").getByRole("button",{name:/로그아웃/}).click();
        await page.locator("#header").getByRole("link",{name:"로그인",exact:true}).waitFor();
        await tab("관람노트").click();
        assert.equal(await page.locator(".account-note-list .account-note").count(),0);
    });
    await check("reduced motion leaves the room readable with no lamp transition",async()=>{
        await tab("나의 공간").click();await page.emulateMedia({reducedMotion:"reduce"});
        const duration = await page.locator(".mini-room-glow").first().evaluate(el=>getComputedStyle(el).transitionDuration);
        assert.ok(parseFloat(duration) <= 0.001, `Reduced-motion transition must be effectively instant, received ${duration}`);
    });
    await check("no browser runtime or hydration errors",async()=>assert.deepEqual(errors,[]));
} finally {
    fs.writeFileSync(`${directory}/report.json`,JSON.stringify({base,verifiedAt:new Date().toISOString(),results,errors},null,2));
    await context.close();await browser.close();
}
if(results.some(result=>!result.passed))process.exitCode=1;
