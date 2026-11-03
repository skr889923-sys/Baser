const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const scope = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/route-editor.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, scope);
const { deleteRoute, setRouteStatus, routeWriteError } = scope.exports;
const previous = { id: 'route-1', updated_at: 'previous-version', status: 'active' };

function backend(result) {
  const calls = [], filters = [];
  const query = {
    eq(key, value) { filters.push([key, value]); return query; },
    select(columns) { calls.push(['select', columns]); return query; },
    maybeSingle: async () => result,
  };
  return { calls, filters, client: { from(table) {
    assert.equal(table, 'routes', 'Do not delete route steps, points or QR codes separately');
    return {
      delete() { calls.push(['delete']); return query; },
      update(payload) { calls.push(['update', payload]); return query; },
    };
  } } };
}

test('route deletion targets only the displayed id/version and requires its returned id', async () => {
  const db = backend({ data: { id: previous.id }, error: null });
  assert.equal(await deleteRoute(db.client, previous), previous.id);
  assert.deepEqual(db.filters, [['id', previous.id], ['updated_at', previous.updated_at]]);
  assert.deepEqual(db.calls, [['delete'], ['select', 'id']]);
});

test('RLS/stale rows, wrong receipts, foreign key failures and lost responses never confirm deletion', async () => {
  for (const result of [{ data: null, error: null }, { data: { id: 'another-route' }, error: null },
    { data: null, error: { code: '42501' } }, { data: null, error: { code: '23503' } }]) {
    await assert.rejects(deleteRoute(backend(result).client, previous));
  }
  const db = backend(Promise.reject(new Error('Response lost after commit')));
  await assert.rejects(deleteRoute(db.client, previous));
  assert.equal(db.calls.filter(([operation]) => operation === 'delete').length, 1, 'Never retry a delete automatically');
});

test('status changes advance the version so an older delete cannot erase a newly changed route', async () => {
  const saved = { ...previous, status: 'closed', updated_at: 'next-version' };
  const db = backend({ data: saved, error: null });
  assert.equal(await setRouteStatus(db.client, previous, 'closed'), saved);
  assert.notEqual(db.calls[0][1].updated_at, previous.updated_at);
  assert.equal(db.calls[0][1].status, 'closed');
  assert.deepEqual(db.filters, [['id', previous.id], ['updated_at', previous.updated_at], ['status', 'active']]);
  await assert.rejects(setRouteStatus(backend({ data: null, error: null }).client, previous, 'closed'));
});

test('route write errors explain permission and linked-data failures in Arabic', () => {
  assert.match(routeWriteError({ code: '42501' }), /صلاحيات/);
  assert.match(routeWriteError({ code: '23503' }), /بيانات مرتبطة/);
});
