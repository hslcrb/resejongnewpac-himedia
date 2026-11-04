const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    try {
        const page=await browser.newPage({viewport:{width:1200,height:900}});
        await page.goto((process.env.AREA_TEST_ORIGIN || 'http://127.0.0.1:3137') + '/v5/visit/area/');
        await page.getByRole('status').filter({hasText:'세종문화회관과 광화문 주변'}).waitFor({timeout:120000});
        await page.getByRole('button',{name:'전시천리안 (全視千里眼)'}).click();
        await page.getByRole('status').filter({hasText:'중심 주변 건물'}).waitFor({timeout:60000});
        await page.getByLabel('서울 전체 주소·건물명 검색').fill('종로');
        await page.getByRole('button',{name:'전체 검색',exact:true}).click();
        await page.getByRole('status').filter({hasText:'200건까지 표시'}).waitFor({timeout:120000});
        const a=page.locator('.area-search-results button[data-tile="195_555"]').first();
        const b=page.locator('.area-search-results button[data-tile="195_557"]').first();
        assert.equal(await a.count(),1);assert.equal(await b.count(),1);
        const expected=await b.getAttribute('data-building-id');
        await page.route('**/area/buildings/195_555.json.gz',async route=>{await new Promise(resolve=>setTimeout(resolve,1800));await route.continue()});
        await a.click(); await b.click();
        await page.getByRole('status').filter({hasText:'선택한 건물의 모든 필드'}).waitFor({timeout:30000});
        await page.waitForTimeout(2300);
        assert.match(await page.locator('.area-building').first().innerText(),new RegExp(`원본 도형 행 번호 ${expected}\\b`));
        const canvas=page.locator('.area-stage canvas').first();
        await canvas.scrollIntoViewIfNeeded();
        const box=await canvas.boundingBox();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
        await page.mouse.down({button:'right'});
        await page.mouse.move(box.x+box.width/2+80,box.y+box.height/2+40,{steps:4});
        await page.mouse.up({button:'right'});
        await page.waitForTimeout(2000);
        assert.match(await page.locator('.area-building').first().innerText(),new RegExp(`원본 도형 행 번호 ${expected}\\b`));
        console.log('PASS: latest search selection survives delayed prior response and projection refresh');
    } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
