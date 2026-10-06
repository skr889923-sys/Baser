const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const scope = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/live-map-location.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, scope);
const { readMapLocation, isLocationFresh, canCaptureLocation, locationErrorMessage } = scope.exports;
const now = 1_800_000_000_000;
const sample = (coords = {}, timestamp = now) => ({ timestamp, coords: { latitude: 30.622971, longitude: 32.269073, accuracy: 6, ...coords } });

test('field capture requires a recent reading within ten meters; low precision can still be displayed', () => {
  assert.equal(canCaptureLocation(readMapLocation(sample(), now), now), true);
  assert.equal(canCaptureLocation(readMapLocation(sample({ accuracy: 10 }), now), now), true);
  const approximate = readMapLocation(sample({ accuracy: 10.1 }), now);
  assert.ok(approximate);
  assert.equal(canCaptureLocation(approximate, now), false);
  assert.equal(canCaptureLocation(null, now), false);
});

test('expired readings lose capture eligibility even without another GPS callback', () => {
  const reading = readMapLocation(sample(), now);
  assert.equal(isLocationFresh(reading, now + 15_000), true);
  assert.equal(isLocationFresh(reading, now + 15_001), false);
  assert.equal(canCaptureLocation(reading, now + 15_001), false);
  assert.equal(readMapLocation(sample({}, now - 15_001), now), null);
  assert.equal(readMapLocation(sample({}, now + 5_001), now), null);
});

test('invalid coordinates, accuracy and timestamps never produce a usable location', () => {
  for (const coords of [{ latitude: NaN }, { latitude: 91 }, { latitude: -91 }, { longitude: Infinity }, { longitude: 181 }, { longitude: -181 }, { accuracy: NaN }, { accuracy: Infinity }, { accuracy: -1 }, { accuracy: null }]) {
    assert.equal(readMapLocation(sample(coords), now), null);
  }
  for (const timestamp of [NaN, Infinity, -Infinity]) assert.equal(readMapLocation(sample({}, timestamp), now), null);
  const zero = readMapLocation(sample({ latitude: 0, longitude: 0, accuracy: 0 }), now);
  assert.ok(zero);
  assert.equal(canCaptureLocation(zero, now), true);
});

test('location failures explain permission, signal and timeout recovery in Arabic', () => {
  assert.match(locationErrorMessage(1), /إذن الموقع/);
  assert.match(locationErrorMessage(2), /خدمات الموقع/);
  assert.match(locationErrorMessage(3), /سيواصل الجهاز المحاولة/);
});
