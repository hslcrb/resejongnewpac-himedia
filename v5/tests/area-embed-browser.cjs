const { chromium }=require('playwright'); const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1200,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.env.AREA_TEST_ORIGIN||'http://127.0.0.1:8137')+'/v5/visit/area/');
 const frame=p.locator('iframe[title="세종문화회관과 광화문 3D 공간 탐색"]');await frame.waitFor();assert.equal(await frame.getAttribute('src'),'https://live.renewsejongpac.rhee.life/explore/?embed=1');
 const inner=p.frameLocator('iframe[title="세종문화회관과 광화문 3D 공간 탐색"]');await inner.getByRole('button',{name:'직접 걷기'}).waitFor({timeout:120000});
 assert.equal(await p.getByRole('link',{name:'지도와 전시천리안 열기'}).getAttribute('href'),'https://live.renewsejongpac.rhee.life/map/');
 assert.equal(await inner.getByRole('button',{name:'전시천리안 (全視千里眼)'}).count(),0);
 await p.waitForFunction(()=>parseFloat(document.querySelector('iframe[title="세종문화회관과 광화문 3D 공간 탐색"]').style.height)>=700,null,{timeout:30000});
 const before=await frame.evaluate(el=>el.style.height);await p.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://evil.example',data:{type:'sejong3d:height',version:1,height:19999}})));assert.equal(await frame.evaluate(el=>el.style.height),before);
 await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS: 내장 광화문 화면, 별도 지도 링크, 높이 메시지, 모바일');
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
