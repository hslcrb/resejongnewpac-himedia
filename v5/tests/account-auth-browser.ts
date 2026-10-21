import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";

// [실제 SDK와 모의 제공자로 검증 / Real SDK with a simulated auth provider]
// Google 동의를 대신하지 않고 요청·교환·복귀·오류·로그아웃의 앱 연결을 검사합니다.
// Verify app wiring without signing in to a real person's Google account.
const base = (process.argv[2]||"http://127.0.0.1:3000/v5/").replace(/\/?$/,"/");
const env = fs.readFileSync(".env.local","utf8");
const backend = env.match(/^NEXT_PUBLIC_SUPABASE_URL=["']?([^\r\n"']+)/m)?.[1];
if(!backend)throw new Error("Public Supabase URL is required for the SDK integration fixture");
const origin = new URL(base).origin;
const ref = new URL(backend).hostname.split(".")[0];
const browser = await chromium.launch();
const context = await browser.newContext({viewport:{width:1440,height:1000}});
const page = await context.newPage();
const directory=".local-reports/account-space";
fs.mkdirSync(directory,{recursive:true});
const results:{name:string;passed:boolean;error?:string}[]=[];
const errors:string[]=[];
page.on("pageerror",error=>errors.push(error.message));
page.setDefaultTimeout(12000);
let enabled=false;
let authorizeUrl="";
let exchanges=0;
const id="123e4567-e89b-42d3-a456-426614174000";
let user={id,aud:"authenticated",role:"authenticated",email:"oauth-fixture@example.com",app_metadata:{provider:"google",providers:["google"]},user_metadata:{full_name:"OAuth 검증",name:"OAuth 검증",phone:""},identities:[],created_at:new Date().toISOString()};
const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString("base64url");
const accessToken=`${encode({alg:"HS256",typ:"JWT"})}.${encode({sub:id,aud:"authenticated",role:"authenticated",exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),iss:`${backend}/auth/v1`})}.fixture-signature`;
await context.route(`${backend}/auth/v1/settings`,route=>route.fulfill({json:{external:{google:enabled}}}));
await context.route(url=>url.origin===backend&&url.pathname==="/auth/v1/authorize",route=>{authorizeUrl=route.request().url();return route.fulfill({contentType:"text/html",body:"<!doctype html><html><body>Simulated OAuth authorization</body></html>"});});
await context.route(url=>url.origin===backend&&url.pathname==="/auth/v1/token",async route=>{
    exchanges++;
    const body=route.request().postDataJSON();
    assert.ok(body.code_verifier);
    await route.fulfill({json:{access_token:accessToken,token_type:"bearer",expires_in:3600,refresh_token:"fixture-refresh-token",user}});
});
await context.route(`${backend}/auth/v1/user`,async route=>{
    if(route.request().method()==="PUT"){
        const body=route.request().postDataJSON();
        user={...user,user_metadata:{...user.user_metadata,...body.data}};
    }
    await route.fulfill({json:user});
});
await context.route(url=>url.origin===backend&&url.pathname==="/auth/v1/logout",route=>route.fulfill({status:204}));
async function check(name:string,run:()=>Promise<void>){try{await run();results.push({name,passed:true});console.log("PASS",name);}catch(error){results.push({name,passed:false,error:String(error)});console.error("FAIL",name,String(error));await page.screenshot({path:`${directory}/auth-failure-${results.length}.png`});}}
let signedInState: Awaited<ReturnType<typeof context.storageState>>|undefined;
try{
    await check("provider availability controls the real Google button",async()=>{
        await page.goto(new URL("account/login/",base).href,{waitUntil:"networkidle"});
        const google=page.getByRole("button",{name:/Google/});
        await page.waitForFunction(()=>[...document.querySelectorAll("button")].some(button=>button.textContent?.includes("Google")&&button.disabled));
        assert.ok(await google.isDisabled());
        enabled=true;
        await page.reload({waitUntil:"networkidle"});
        await google.waitFor();
        await page.waitForFunction(()=>[...document.querySelectorAll("button")].some(button=>button.textContent?.includes("Google")&&!button.disabled));
        await google.click();
        await page.waitForURL(url=>url.origin===backend);
        const url=new URL(authorizeUrl);
        assert.equal(url.searchParams.get("provider"),"google");
        assert.equal(url.searchParams.get("redirect_to"),`${origin}/v5/account/callback/`);
        assert.equal(url.searchParams.get("code_challenge_method"),"s256");
        assert.ok(url.searchParams.get("code_challenge"));
    });
    await check("PKCE exchanges once and restores the real identity in page and header",async()=>{
        await page.goto(new URL("account/callback/?code=fixture-code",base).href,{waitUntil:"networkidle"});
        await page.waitForURL(new URL("account/",base).href);
        await page.locator('.account-layout[aria-busy="false"]').waitFor();
        assert.equal(exchanges,1);
        assert.match(await page.locator(".account-identity h2").innerText(),/OAuth 검증/);
        assert.match(await page.locator(".account-identity").innerText(),/로그인됨/);
        await page.locator("#header").getByRole("link",{name:"마이페이지",exact:true}).waitFor();
        assert.equal(await page.locator("#header").getByRole("link",{name:"로그인",exact:true}).count(),0);
        assert.equal(new URL(page.url()).search,"");
        signedInState=await context.storageState();
        await page.reload({waitUntil:"networkidle"});
        await page.locator('.account-layout[aria-busy="false"]').waitFor();
        assert.match(await page.locator(".account-identity h2").innerText(),/OAuth 검증/);
    });
    await check("authenticated profile updates use the SDK and keep the provider email read-only",async()=>{
        await page.getByRole("tab",{name:"회원정보",exact:true}).click();
        assert.ok(await page.locator("#account-profile-email").evaluate((element:HTMLInputElement)=>element.readOnly));
        await page.locator("#account-profile-name").fill("연결된 새 이름");
        await page.locator("#account-profile-phone").fill("010-0000-0000");
        await page.locator(".account-profile-form").getByRole("button",{name:/저장/}).click();
        await page.waitForFunction(()=>document.querySelector(".account-identity h2")?.textContent?.includes("연결된 새 이름"));
        assert.equal(user.user_metadata.phone,"010-0000-0000");
    });
    await check("a failed new code cannot succeed through an older stored real session",async()=>{
        assert.ok(signedInState);
        const previous=await browser.newContext({storageState:signedInState});
        const tab=await previous.newPage();
        await tab.addInitScript(({origin,key})=>{if(location.origin===origin)localStorage.setItem(key,JSON.stringify("fixture-old-code-verifier"));},{origin,key:`sb-${ref}-auth-token-code-verifier`});
        await previous.route(url=>url.origin===backend&&url.pathname==="/auth/v1/token",route=>route.fulfill({status:400,json:{error:"invalid_grant",error_code:"bad_code_verifier",error_description:"The authorization code is invalid"}}));
        try{
            await tab.goto(new URL("account/callback/?code=invalid-new-code",base).href,{waitUntil:"networkidle"});
            await tab.locator('.ds-notice[role="alert"]').waitFor();
            assert.ok(new URL(tab.url()).pathname.endsWith("/account/callback/"), `Failed-code recovery landed on ${new URL(tab.url()).pathname}`);
        }finally{await previous.close();}
    });
    await check("a missing or corrupt PKCE verifier cannot reuse an older session",async()=>{
        assert.ok(signedInState);
        for (const code of ["missing-verifier", "corrupt-verifier", ""]) {
            const previous=await browser.newContext({storageState:signedInState});
            const tab=await previous.newPage();
            await tab.addInitScript(({origin,key,corrupt})=>{if(location.origin===origin){if(corrupt)localStorage.setItem(key,"corrupt-verifier");else localStorage.removeItem(key);}},{origin,key:`sb-${ref}-auth-token-code-verifier`,corrupt:code==="corrupt-verifier"});
            await previous.route(url=>url.origin===backend&&url.pathname==="/auth/v1/token",route=>route.fulfill({status:400,json:{error:"invalid_grant",error_description:"Missing verifier"}}));
            try {
                await tab.goto(new URL(`account/callback/${code?`?code=${code}`:""}`,base).href,{waitUntil:"networkidle"});
                await tab.locator('.ds-notice[role="alert"]').waitFor();
                assert.ok(new URL(tab.url()).pathname.endsWith("/account/callback/"));
            } finally {await previous.close();}
        }
    });
    await check("sign-out ends the SDK session and returns page and header to the guest state",async()=>{
        await page.locator(".account-identity").getByRole("button",{name:/로그아웃/}).click();
        await page.locator("#header").getByRole("link",{name:"로그인",exact:true}).waitFor();
        assert.match(await page.locator(".account-identity").innerText(),/방문자 공간/);
    });
    await check("denied or empty callbacks have a usable recovery path and never trust a next URL",async()=>{
        await page.goto(new URL("account/callback/?error=access_denied&next=https://example.com/",base).href,{waitUntil:"networkidle"});
        await page.locator('.ds-notice[role="alert"]').waitFor();
        assert.match(await page.locator('.ds-notice[role="alert"]').innerText(),/취소/);
        const back=page.getByRole("link",{name:"로그인으로 돌아가기"});
        assert.equal(new URL((await back.getAttribute("href"))!,origin).pathname,"/v5/account/login/");
        assert.equal(new URL(page.url()).origin,origin);
    });
    await check("blocked storage still logs out the demo across remounts and explicit sign-in restores it",async()=>{
        const isolated=await browser.newContext();
        const tab=await isolated.newPage();
        await tab.addInitScript(()=>{
            const fixture=window as Window & {accountWritesBlocked?:boolean};
            if(!localStorage.getItem("blocked-logout-seeded")){
                localStorage.setItem("blocked-logout-seeded","true");
                localStorage.setItem("sejong-v4:profile",JSON.stringify({name:"저장소 체험",email:"storage@example.com",phone:""}));
                localStorage.setItem("sejong-v4:session",'{"active":true}');
            }
            const original=Storage.prototype.setItem;
            Storage.prototype.setItem=function(key,value){if(fixture.accountWritesBlocked&&key==="sejong-v4:session")throw new DOMException("Blocked fixture","QuotaExceededError");return original.call(this,key,value);};
        });
        try {
            await tab.goto(new URL("account/",base).href,{waitUntil:"networkidle"});
            await tab.locator('.account-layout[aria-busy="false"]').waitFor();
            await tab.evaluate(()=>{(window as Window & {accountWritesBlocked?:boolean}).accountWritesBlocked=true;});
            await tab.locator(".account-identity").getByRole("button",{name:/로그아웃/}).click();
            await tab.locator("#header").getByRole("link",{name:"로그인",exact:true}).waitFor();
            assert.match(await tab.locator('.account-main .ds-notice').innerText(),/로그아웃했습니다/);
            await tab.locator("#header").getByRole("link",{name:"로그인",exact:true}).click();
            await tab.waitForURL(new URL("account/login/",base).href);
            await tab.goBack({waitUntil:"networkidle"});
            await tab.waitForURL(new URL("account/",base).href);
            await tab.locator('.account-layout[aria-busy="false"]').waitFor();
            assert.match(await tab.locator(".account-identity").innerText(),/방문자 공간/);
            await tab.locator("#header").getByRole("link",{name:"로그인",exact:true}).click();
            await tab.evaluate(()=>{(window as Window & {accountWritesBlocked?:boolean}).accountWritesBlocked=false;});
            await tab.locator("#flow-name").fill("다시 체험");
            await tab.locator("#flow-email").fill("storage@example.com");
            await tab.locator('[data-account-auth="login"] input[type="checkbox"]').check();
            await tab.getByRole("button",{name:/프로필로 계속하기/}).click();
            await tab.waitForURL(new URL("account/",base).href);
            await tab.locator('.account-layout[aria-busy="false"]').waitFor();
            assert.match(await tab.locator(".account-identity h2").innerText(),/다시 체험/);
        } finally {await isolated.close();}
    });
    await check("malformed stored login fields recover without a runtime error",async()=>{
        await page.evaluate(()=>localStorage.setItem("sejong-v4:profile",JSON.stringify({name:123,email:{invalid:true}})));
        await page.goto(new URL("account/login/",base).href,{waitUntil:"networkidle"});
        assert.equal(await page.locator("#flow-name").inputValue(),"관람객");
        assert.equal(await page.locator("#flow-email").inputValue(),"visitor@example.com");
        assert.equal(await page.locator('[data-account-auth="login"] input[type="checkbox"]').isChecked(),false);
        await page.getByRole("button",{name:/프로필로 계속하기/}).click();
        await page.locator('.ds-notice[role="alert"]').waitFor();
    });
    await check("no browser runtime errors",async()=>assert.deepEqual(errors,[]));
}finally{
    fs.writeFileSync(`${directory}/auth-report.json`,JSON.stringify({base,verifiedAt:new Date().toISOString(),mode:"real SDK with mocked provider; not Google consent verification",results,errors},null,2));
    await context.close();await browser.close();
}
if(results.some(result=>!result.passed))process.exitCode=1;
