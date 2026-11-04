import test from 'node:test';
import assert from 'node:assert/strict';
import { seoulSolarPosition, sunDirection } from '../src/area/solar.ts';

test('서울 하지의 정오는 밝고 자정에는 해가 지평선 아래에 있다', () => {
    const noon = seoulSolarPosition(new Date('2026-06-21T03:00:00Z'));
    const midnight = seoulSolarPosition(new Date('2026-06-20T15:00:00Z'));
    assert.ok(noon.elevation > 1.1 && noon.elevation < 1.4);
    assert.ok(midnight.elevation < 0);
});

test('같은 태양을 서울과 회관의 서로 다른 북쪽 축에 맞춘다', () => {
    const solar = { azimuth: 0, elevation: 0 };
    const city = sunDirection(solar, 'seoul');
    const local = sunDirection(solar, 'local');
    assert.ok(Math.abs(city.x) < 1e-9 && city.z < -0.999);
    assert.ok(local.x > 0.999 && Math.abs(local.z) < 1e-9);
});
