const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const scope = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/save-route.ts'),'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, scope);
const { saveRouteWithFirstStep } = scope.exports;
test('route and step are sent in one RPC, with a single returned route', async () => {
  const route = { name_en: 'Route' }, step = { direction: 'left' }, saved = { id: 'r' };
  let calls = 0;
  const client = { rpc(name, payload) {
    calls++;
    assert.equal(name, 'create_route_with_first_step');
    assert.equal(payload.route_data, route);
    assert.equal(payload.step_data, step);
    return { single: async () => ({ data: saved, error: null }) };
  } };
  assert.equal(await saveRouteWithFirstStep(client, route, step), saved);
  assert.equal(calls, 1);
});
test('a failed step surfaces the database error without retrying a separate route insert', async () => {
  const error = { code: '23514', message: 'Step rejected' };
  await assert.rejects(saveRouteWithFirstStep({ rpc: () => ({ single: async () => ({ data: null, error }) }) }, {}, {}), e => e === error);
});
