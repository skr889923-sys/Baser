const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const scope = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/point-editor.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, scope);
const { emptyPointDraft, pointDraft, pointPayload, saveNavigationPoint, setNavigationPointActive,
  deleteNavigationPoint, pointWriteError } = scope.exports;
const draft = () => ({ ...emptyPointDraft(), name_ar: ' نقطة ', name_en: ' Point ' });
const previous = { ...pointPayload(draft()), id: 'point-1', updated_at: '2026-10-01T00:00:00Z' };

test('outdoor and indoor edits retain null coordinates, floor identity, descriptions and flags', () => {
  const indoor = { ...previous, building_id: 'building', floor_id: 'floor', indoor_x: 0, indoor_y: 20,
    is_active: false, is_hazard: true, is_accessible: false, description_ar: 'وصف', audio_instruction_en: 'Turn left' };
  const payload = pointPayload(pointDraft(indoor));
  assert.equal(payload.latitude, null); assert.equal(payload.longitude, null);
  assert.equal(payload.indoor_x, 0); assert.equal(payload.indoor_y, 20);
  for (const field of ['building_id', 'floor_id', 'is_active', 'is_hazard', 'is_accessible', 'description_ar', 'audio_instruction_en']) {
    assert.equal(payload[field], indoor[field]);
  }
  const outdoor = pointPayload(draft());
  assert.equal(outdoor.building_id, null); assert.equal(outdoor.name_ar, 'نقطة');
  assert.equal(outdoor.latitude, null); assert.equal('id' in outdoor, false);
});

test('blank names, partial/non-finite coordinates, out-of-range positions and invalid types are rejected', () => {
  for (const fields of [{ name_ar: ' ' }, { name_en: '' }, { latitude: '1' }, { indoor_x: '2' },
    { latitude: 'NaN', longitude: '1' }, { latitude: '91', longitude: '1' },
    { latitude: '1', longitude: '-181' }, { indoor_x: 'Infinity', indoor_y: '1' },
    { type: 'invalid' }, { floor_id: 'floor' }]) {
    assert.throws(() => pointPayload({ ...draft(), ...fields }));
  }
  assert.equal(pointPayload({ ...draft(), latitude: '0', longitude: '0' }).latitude, 0);
});

function backend(result) {
  const calls = [], filters = [];
  const query = {
    eq(key, value) { filters.push([key, value]); return query; },
    select(columns) { assert.equal(columns, '*'); return query; },
    maybeSingle: async () => result,
  };
  const client = { from(table) {
    assert.equal(table, 'navigation_points');
    return { insert(payload) { calls.push({ operation: 'insert', payload }); return query; },
      update(payload) { calls.push({ operation: 'update', payload }); return query; } };
  } };
  return { client, calls, filters };
}

test('saving an existing point updates its id/version rather than creating another point', async () => {
  const edited = { ...previous, name_ar: 'معدلة', updated_at: 'new-version' };
  const db = backend({ data: edited, error: null });
  assert.equal(await saveNavigationPoint(db.client, { ...draft(), name_ar: edited.name_ar }, previous), edited);
  assert.equal(db.calls.length, 1); assert.equal(db.calls[0].operation, 'update');
  assert.deepEqual(db.filters, [['id', previous.id], ['updated_at', previous.updated_at]]);
  assert.equal(db.calls[0].payload.name_ar, edited.name_ar);
  assert.notEqual(db.calls[0].payload.updated_at, previous.updated_at);
  const insert = backend({ data: previous, error: null });
  await saveNavigationPoint(insert.client, draft(), null);
  assert.equal(insert.calls[0].operation, 'insert'); assert.equal(insert.filters.length, 0);
});

test('save and activation never accept RLS failures or stale/missing rows as successful', async () => {
  for (const result of [{ data: null, error: null }, { data: null, error: { code: '42501' } }]) {
    const db = backend(result);
    await assert.rejects(saveNavigationPoint(db.client, draft(), previous));
    await assert.rejects(setNavigationPointActive(db.client, previous));
  }
  const db = backend({ data: { ...previous, is_active: false }, error: null });
  assert.equal((await setNavigationPointActive(db.client, previous)).is_active, false);
  assert.ok(db.filters.some(([field, value]) => field === 'is_active' && value === true));
});

test('delete requires the guarded RPC, previous version and an exact server receipt', async () => {
  const client = result => ({ rpc: async (name, args) => {
    assert.equal(name, 'delete_navigation_point');
    assert.equal(args.point_id, previous.id); assert.equal(args.expected_updated_at, previous.updated_at);
    return result;
  }, from: () => { throw new Error('Unsafe direct cascade delete'); } });
  assert.equal(await deleteNavigationPoint(client({ data: previous.id, error: null }), previous), previous.id);
  for (const result of [{ data: null, error: null }, { data: 'another-point', error: null },
    { data: null, error: { code: 'PT422' } }, { data: null, error: { code: 'PT409' } },
    { data: null, error: { code: 'PGRST202' } }, { data: null, error: { code: '42501' } }]) {
    await assert.rejects(deleteNavigationPoint(client(result), previous));
  }
  assert.match(pointWriteError({ code: 'PT422' }), /مرتبطة/);
  assert.match(pointWriteError({ code: 'PGRST202' }), /تحديث قاعدة البيانات/);
});
