const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(name) {
  const scope = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib', name), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, scope);
  return scope.exports;
}
const { canAccessPage, getAdminIdentity } = load('admin-access.ts');
const { saveRequestStatus } = load('request-status.ts');
test('admin navigation matches operational roles and denies unknown paths', () => {
  for (const role of [null, 'student', 'invented']) assert.equal(canAccessPage(role, '/'), false);
  assert.equal(canAccessPage('security_staff', '/emergency'), true);
  assert.equal(canAccessPage('security_staff', '/maps'), false);
  assert.equal(canAccessPage('building_manager', '/emergency'), false);
  assert.equal(canAccessPage('building_manager', '/maps'), true);
  assert.equal(canAccessPage('support_agent', '/reports'), true);
  assert.equal(canAccessPage('support_agent', '/users'), false);
  assert.equal(canAccessPage('super_admin', '/unknown'), false);
});
test('missing/expired sessions never reach profile data', async () => {
  for (const auth of [{ data: { user: null }, error: null }, { data: { user: { id: 'expired' } }, error: { message: 'expired' } }]) {
    assert.equal(await getAdminIdentity({ auth: { getUser: async () => auth }, from: () => { throw new Error('Unexpected profile read'); } }), null);
  }
});
test('status update rejects database errors and silent zero-row RLS/conflict updates', async () => {
  for (const result of [{ data: null, error: null }, { data: null, error: { code: '42501' } }]) {
    const client = { from: () => ({ update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => result }) }) }) }) }) };
    await assert.rejects(saveRequestStatus(client, 'emergency_requests', 'id', 'new', 'contacted'));
  }
});
test('status update requires the displayed previous status and returns the confirmed row', async () => {
  const row = { id: 'id', status: 'contacted' }, filters = [];
  const query = { eq(key, value) { filters.push([key, value]); return query; }, select: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) };
  const client = { from: () => ({ update: () => query }) };
  assert.equal(await saveRequestStatus(client, 'emergency_requests', 'id', 'new', 'contacted'), row);
  assert.deepEqual(filters, [['id', 'id'], ['status', 'new']]);
});
