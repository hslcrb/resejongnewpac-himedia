const { chromium } = require('playwright');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
    try {
        const shots=[];
        for (const [name, instant] of [['day','2026-06-21T03:00:00Z'],['night','2026-06-20T15:00:00Z']]) {
            const page=await browser.newPage({viewport:{width:1280,height:900}});
            await page.addInitScript(value => {
                const OriginalDate=Date; const time=OriginalDate.parse(value);
                class FixedDate extends OriginalDate { constructor(...args) { super(...(args.length ? args : [time])); } static now() { return time; } }
                globalThis.Date=FixedDate;
            }, instant);
            await page.goto((process.env.AREA_TEST_ORIGIN || 'http://127.0.0.1:3137') + '/v5/visit/area/');
            await page.getByRole('status').filter({ hasText:'세종문화회관과 광화문 주변' }).waitFor({timeout:120000});
            await page.getByText(name==='day'?'서울 시간 12:00':'서울 시간 00:00').waitFor();
            const image=await page.locator('.area-stage').screenshot({path:path.resolve('../gis-sejong/sky/web-'+name+'.png')});
            shots.push(crypto.createHash('sha256').update(image).digest('hex'));
            await page.close();
        }
        assert.notEqual(shots[0],shots[1]);
        console.log('PASS: Seoul noon and midnight clock, distinct sky and lighting');
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
