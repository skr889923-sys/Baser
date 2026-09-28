const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectBestRoute, canStartNavigation } = require('../../../.test-build/packages/navigation/src');
const route = (extra = {}) => ({ id: 'r', start_point_id: 'a', end_point_id: 'b', status: 'active', distance_meters: 100, wheelchair_accessible: true, visually_impaired_friendly: true, has_stairs: false, ...extra });
const steps = [{ id: 's', route_id: 'r', step_order: 1, from_point_id: 'a', to_point_id: 'b', distance_meters: 100, instruction_ar: 'تابع الممر', instruction_en: 'Follow the path', direction: 'straight', haptic_pattern: 'continue', warning_level: 'none' }];
test('rejects the only inaccessible route instead of silently falling back', () => {
  assert.equal(selectBestRoute([route({ wheelchair_accessible: false })], 'wheelchair'), null);
  assert.equal(selectBestRoute([route({ has_stairs: true })], 'wheelchair'), null);
  assert.equal(selectBestRoute([route({ visually_impaired_friendly: false })], 'blind_friendly'), null);
  assert.equal(selectBestRoute([route({ visually_impaired_friendly: false })], 'safe_accessible'), null);
});
test('closed and maintenance paths are never eligible, including fastest', () => {
  for (const status of ['closed', 'maintenance']) assert.equal(selectBestRoute([route({ status })], 'fastest'), null);
});
test('longer accessible path wins without mutating input', () => {
  const routes = [route({ id: 'short', has_stairs: true }), route({ id: 'long', distance_meters: 200 })];
  assert.equal(selectBestRoute(routes, 'wheelchair').id, 'long');
  assert.equal(routes[0].id, 'short');
  assert.equal(selectBestRoute(routes, 'fastest').id, 'short');
});
test('guidance rejects missing, disconnected, contradictory or wrong-route steps', () => {
  assert.equal(canStartNavigation(route(), steps, 'wheelchair'), true);
  for (const bad of [[], [{ ...steps[0], from_point_id: 'z' }], [{ ...steps[0], route_id: 'other' }], [{ ...steps[0], direction: 'stairs_up' }], [{ ...steps[0], step_order: 2 }]]) {
    assert.equal(canStartNavigation(route(), bad, 'wheelchair'), false);
  }
});
test('legacy steps without verified direction, warning or semantic haptics cannot guide', () => {
  for (const extra of [{ direction: null }, { direction: '' }, { warning_level: null }, { haptic_pattern: 'short' }]) {
    assert.equal(canStartNavigation(route(), [{ ...steps[0], ...extra }], 'fastest'), false);
  }
});
