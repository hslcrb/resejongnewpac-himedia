import test from 'node:test';
import assert from 'node:assert/strict';
import { gridCellPosition, isDetailedArea, SEJONG_IN_SEOUL } from '../src/area/coordinates.ts';

test('서울 GIS 격자와 회관 모형을 같은 미터 좌표에 배치한다', () => {
    assert.deepEqual(gridCellPosition(3958, 11050, 20), { x: -2076.5, y: 10, z: -2523.5 });
    assert.deepEqual(SEJONG_IN_SEOUL, { x: -2103, z: -2531, rotationY: Math.PI / 2 });
});

test('회관 상세 범위의 격자만 제외하고 바깥 서울 격자를 유지한다', () => {
    assert.equal(isDetailedArea(-2103, -2531), true);
    assert.equal(isDetailedArea(-1000, -2531), false);
    assert.equal(isDetailedArea(-2103, -1000), false);
});
