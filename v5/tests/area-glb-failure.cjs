const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
    try {
        const page = await browser.newPage();
        await page.route('**/area/sejong-area.glb', route => route.abort());
        await page.goto((process.env.AREA_TEST_ORIGIN || 'http://127.0.0.1:8137') + '/v5/visit/area/');
        await page.getByRole('status').filter({ hasText: '세종문화회관 모형을 불러오지 못했습니다' }).waitFor({ timeout: 30000 });
        await page.getByRole('button', { name: '서울 전역' }).click();
        await page.getByRole('button', { name: '다시 불러오기' }).waitFor({ timeout: 8000 });
        assert.match(await page.getByRole('status').innerText(), /세종문화회관 모형을 불러오지 못했습니다/);
        await page.unroute('**/area/sejong-area.glb');
        await page.getByRole('button', { name: '다시 불러오기' }).click();
        await page.getByRole('status').filter({ hasText: '서울 전역과 광화문 주변' }).waitFor({ timeout: 120000 });
        console.log('PASS: detailed model failure survives mode change and recovers');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
