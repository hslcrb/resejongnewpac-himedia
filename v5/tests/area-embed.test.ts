import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedViewerHeight } from '../src/area/embed.ts';

test('허용된 3D 서비스와 실제 프레임에서 온 올바른 높이만 받는다',()=>{
 const source={};const valid={origin:'https://live.renewsejongpac.rhee.life',source,data:{type:'sejong3d:height',version:1,height:1620}};
 assert.equal(acceptedViewerHeight(valid,source),1620);
 assert.equal(acceptedViewerHeight({...valid,origin:'https://evil.example'},source),null);
 assert.equal(acceptedViewerHeight({...valid,source:{}},source),null);
 assert.equal(acceptedViewerHeight({...valid,data:{...valid.data,height:Infinity}},source),null);
 assert.equal(acceptedViewerHeight({...valid,data:{...valid.data,height:999999}},source),null);
 assert.equal(acceptedViewerHeight({...valid,data:{...valid.data,version:2}},source),null);
});
