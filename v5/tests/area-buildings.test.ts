import test from 'node:test';
import assert from 'node:assert/strict';
import { worldToGeo, geoToWorld, pointInBuilding, nearbyBuildings } from '../src/area/buildings.ts';

const building = { id: 77, easting: 197900, northing: 552500, tile: [197,552] as [number,number], polygons: [[[9000,5000, 9200,5000, 9200,5200, 9000,5200, 9000,5000], [9050,5050, 9150,5050, 9150,5150, 9050,5150, 9050,5050]]], fields: Array(29).fill(null) };

test('회관과 서울 좌표를 같은 GIS 기준으로 변환한다', () => {
    assert.deepEqual(worldToGeo('local', -31, 3), { easting: 197900, northing: 552500 });
    assert.deepEqual(worldToGeo('seoul', -2100, -2500), { easting: 197900, northing: 552500 });
    assert.deepEqual(geoToWorld('local', 197900, 552500), { x: -31, z: 3 });
    assert.deepEqual(geoToWorld('seoul', 197900, 552500), { x: -2100, z: -2500 });
});

test('건물 윤곽의 내부 구멍을 포함한 점 판정을 한다', () => {
    assert.equal(pointInBuilding(building, 197902, 552502), true);
    assert.equal(pointInBuilding(building, 197910, 552510), false);
    assert.equal(pointInBuilding(building, 197950, 552550), false);
});

test('근처 후보를 실제 포함 건물 우선으로 표시하고 중복 FID를 제거한다', () => {
    const hits = nearbyBuildings([building, building], 197902, 552502, 50);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].building.id, 77);
    assert.equal(hits[0].contains, true);
});
