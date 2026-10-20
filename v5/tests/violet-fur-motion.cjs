const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

// Exercise the shipped deterministic physics without a DOM, clock, or build output.
const filename = path.resolve(__dirname, '../components/violetFurPhysics.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { createTufts, stepTufts, drawTufts } = compiled.exports;

const restingInput = () => ({ x: .55, y: .2, velocityX: 0, velocityY: 0, spin: 0, energy: 0, active: false, lastInput: 0 });
function displacement(field, baseline) {
  let maximum = 0;
  for (let index = 0; index < field.springs.length; index += 4) {
    maximum = Math.max(maximum, Math.hypot(
      field.springs[index] - (baseline?.springs[index] || 0),
      field.springs[index + 1] - (baseline?.springs[index + 1] || 0),
    ));
  }
  return maximum;
}

function drawGeometry(field) {
  const roots = [];
  const tips = [];
  let segment = 0;
  let fills = 0;
  const context = {
    beginPath() {}, closePath() {},
    moveTo(x, y) { roots.push([x, y]); segment = 0; },
    quadraticCurveTo(_controlX, _controlY, x, y) {
      if (segment++ === 0) tips.push([x, y]);
      else roots.push([x, y]);
    },
    fill() { fills++; },
    fillStyle: '',
  };
  drawTufts(context, field);
  return { roots, tips, fills };
}

test('idle tuft flutter stays small and preserves every cached root', () => {
  const field = createTufts(true, false);
  const anchors = field.anchors.slice();
  const fibers = field.fibers.map(bucket => bucket.slice());
  const before = drawGeometry(field);
  let maximum = 0;
  for (let frame = 1; frame <= 240; frame++) {
    stepTufts(field, restingInput(), 10 + frame / 24, 1 / 24);
    maximum = Math.max(maximum, displacement(field));
  }
  assert.ok(maximum > .1 && maximum < .55, `Idle movement should be tiny but present: ${maximum}`);
  assert.deepEqual(field.anchors, anchors);
  assert.deepEqual(field.fibers, fibers);
  assert.deepEqual(drawGeometry(field).roots, before.roots);
});

test('pointer and signed spin bend tips locally, then settle back to idle', () => {
  const field = createTufts(true, false);
  const idle = createTufts(true, false);
  const input = restingInput();
  const roots = drawGeometry(field).roots;
  let response = 0;
  let maximum = 0;
  for (let frame = 1; frame <= 144; frame++) {
    const time = 20 + frame / 24;
    if (frame >= 24 && frame <= 48) {
      Object.assign(input, { velocityX: 7, velocityY: 2, spin: .85, energy: 1, active: true, lastInput: time * 1000 });
    } else input.active = false;
    stepTufts(field, input, time, 1 / 24);
    stepTufts(idle, restingInput(), time, 1 / 24);
    maximum = Math.max(maximum, displacement(field));
    response = Math.max(response, displacement(field, idle));
  }
  assert.ok(response > 1, `Movement must visibly exceed idle: ${response}`);
  assert.ok(maximum <= 4.3, `Bend must remain restrained: ${maximum}`);
  assert.ok(displacement(field, idle) < .04, 'Released tufts must settle back to their moving idle rest state');
  assert.deepEqual(drawGeometry(field).roots, roots, 'Both edges of every root remain fixed after interaction');
});

test('opposite touch rotation produces opposite tangential response', () => {
  const clockwise = createTufts(true, true);
  const counterclockwise = createTufts(true, true);
  const idle = createTufts(true, true);
  for (let frame = 1; frame <= 30; frame++) {
    const time = 30 + frame / 20;
    const input = { ...restingInput(), lastInput: time * 1000 };
    stepTufts(clockwise, { ...input, spin: .8 }, time, 1 / 20);
    stepTufts(counterclockwise, { ...input, spin: -.8 }, time, 1 / 20);
    stepTufts(idle, input, time, 1 / 20);
  }
  let tangential = 0;
  for (let index = 0; index < idle.anchors.length; index += 4) {
    const nx = idle.anchors[index];
    const ny = idle.anchors[index + 1];
    const dx = clockwise.springs[index] - counterclockwise.springs[index];
    const dy = clockwise.springs[index + 1] - counterclockwise.springs[index + 1];
    tangential += -ny * dx + nx * dy;
  }
  assert.ok(tangential > 10, 'Signed rotation must brush tufts in the corresponding direction');
});

test('a delayed frame uses a bounded timestep and cannot jump the pile', () => {
  const delayed = createTufts(true, false);
  const bounded = createTufts(true, false);
  const input = { ...restingInput(), active: true, velocityX: 8, velocityY: 8, spin: 1, lastInput: 1000 };
  stepTufts(delayed, input, 1, 10);
  stepTufts(bounded, input, 1, .05);
  assert.deepEqual(delayed.springs, bounded.springs);
  assert.ok([...delayed.springs].every(Number.isFinite));
});

test('live painting has a fixed small budget on desktop, mobile and the closed orb', () => {
  const desktop = drawGeometry(createTufts(true, false));
  const mobile = drawGeometry(createTufts(true, true));
  const resting = drawGeometry(createTufts(false, true));
  assert.ok(desktop.tips.length <= 600 && desktop.fills <= 12);
  assert.ok(mobile.tips.length < desktop.tips.length);
  assert.ok(resting.tips.length < mobile.tips.length);
  assert.ok(resting.tips.length > 0, 'The closed orb retains an anchored idle layer');
});
