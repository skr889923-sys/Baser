const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/map-permissions.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const scope = { exports: {} };
vm.runInNewContext(compiled.outputText, scope);
const { requireMapEditorAccess, mapWriteError } = scope.exports;

function client({ signedIn = true, role = 'university_admin', profileError = null, authError = null } = {}) {
  return {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'current-user' } : null }, error: authError }) },
    from(table) {
      assert.equal(table, 'profiles');
      assert.ok(signedIn && !authError, 'Do not query profiles before verifying the session');
      return { select(columns) {
        assert.equal(columns, 'role');
        return { eq(key, value) {
          assert.equal(key, 'id');
          assert.equal(value, 'current-user');
          return { maybeSingle: async () => ({ data: role ? { role } : null, error: profileError }) };
        } };
      } };
    },
  };
}

test('map save rejects a missing or expired session before querying roles', async () => {
  await assert.rejects(requireMapEditorAccess(client({ signedIn: false })), /جلسة الدخول/);
  await assert.rejects(requireMapEditorAccess(client({ authError: { message: 'Expired' } })), /جلسة الدخول/);
});
test('map save accepts each configured editor role', async () => {
  for (const role of ['super_admin', 'university_admin', 'building_manager']) {
    await requireMapEditorAccess(client({ role }));
  }
});
test('map save rejects students, non-editor staff, and missing profiles', async () => {
  for (const role of ['student', 'security_staff', 'support_agent', null]) {
    await assert.rejects(requireMapEditorAccess(client({ role })), /لا يملك صلاحية/);
  }
});
test('profile policy errors fail closed and explain the next step', async () => {
  await assert.rejects(requireMapEditorAccess(client({ profileError: { code: '42P17' } })), /تعذر التحقق/);
});
test('map save explains RLS and recursive policy errors in Arabic', () => {
  for (const code of ['42501', '42P17']) {
    assert.match(mapWriteError({ code, message: 'raw database error' }), /إعدادات الصلاحيات/);
    assert.doesNotMatch(mapWriteError({ code, message: 'raw database error' }), /raw database error/);
  }
});
test('unrelated write failures retain their diagnostic message', () => {
  assert.match(mapWriteError({ code: '23503', message: 'Invalid building' }), /Invalid building/);
});
test('schema-cache failures explain that the database update is needed', () => {
  for (const code of ['PGRST202', 'PGRST204', '42703', '42883']) {
    assert.match(mapWriteError({ code, message: 'Schema mismatch' }), /تحديث قاعدة البيانات/);
  }
});
