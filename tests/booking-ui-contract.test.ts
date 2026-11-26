import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('registered booking composition reaches a product route and a guide preview', () => {
    const registry=read('src/data/component-registry.ts');
    assert.match(registry,/id: "booking-experience"[^\n]*source: "components\/BookingExperience.tsx"[^\n]*previewRoute: "\/booking\/experience\/"/);
    assert.match(read('app/booking/experience/page.tsx'),/<BookingExperience\s*\/>/);
    assert.match(read('components/HomePathways.tsx'),/href="\/booking\/experience\/"/);
    for (const path of ['/programs','/visit/group','/rental']) assert.ok(read('components/HomePathways.tsx').includes(`href: "${path}"`));
});
test('screen composes system UI and keeps RPC calls out of presentation',()=>{
    const source=read('components/BookingExperience.tsx');
    for(const name of ['SystemButton','SystemField','SystemSurface','SystemCheckbox','SystemNotice','SystemLink'])assert.ok(source.includes(`<${name}`));
    assert.doesNotMatch(source,/<(?:button|input|select|textarea)\b/);
    assert.doesNotMatch(source,/localStorage|sessionStorage|\.rpc\(|fetch\(/);
    assert.match(source,/data-component-id="booking-experience"/);
    assert.match(source,/실제 예약·결제·발권은 생성되지 않았습니다/);
    assert.match(source,/aria-pressed=\{selected\}/);
    assert.match(source,/aria-current=/);
});
test('layout adds no private colors, typography sizes or border/radius overrides',()=>{
    const css=read('components/BookingExperience.module.css');
    assert.doesNotMatch(css,/(?:color|background|font-size|border|border-radius)\s*:/);
    assert.match(css,/@media \(max-width: 640px\)/);
    assert.match(css,/minmax\(0, 1fr\)/);
});
