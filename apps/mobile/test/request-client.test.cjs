const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const scope = { exports: {}, AbortController, setTimeout, clearTimeout };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, scope);
  return scope.exports;
}
const { RequestClient, RequestFailure, requestErrorMessage } = load('request-client.ts');
const { verifiedCoordinates, requestCoordinates } = load('request-location.ts');
const token = 'a'.repeat(64);
const receipt = { id: '00000000-0000-0000-0000-000000000001', status: 'new', created_at: '2026-10-03T00:00:00Z', updated_at: '2026-10-03T00:00:00Z', location_available: false };
function storage() {
  const values = new Map();
  return { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key) };
}
const payload = { message: 'Help', latitude: null, longitude: null };

test('database failures and empty or malformed receipts never confirm submission', async () => {
  for (const response of [{ data: null, error: { code: '42501' } }, { data: null, error: null }, { data: {}, error: null }, { data: { ...receipt, status: 'invented' }, error: null }]) {
    const client = new RequestClient(async () => response, storage(), async () => token);
    await assert.rejects(client.submit('emergency', payload), error => error.reason === 'unconfirmed');
  }
});
test('missing RPC is explained as service unavailable without leaking backend data', async () => {
  const client = new RequestClient(async () => ({ data: null, error: { code: 'PGRST202' } }), storage(), async () => token);
  await assert.rejects(client.submit('emergency', payload), error => {
    assert.equal(error.reason, 'setup_required');
    assert.match(requestErrorMessage(error, 'ar'), /غير جاهزة/);
    return true;
  });
});
test('simultaneous submissions share a persisted token and exactly one RPC', async () => {
  let calls = 0, release;
  const client = new RequestClient(async (name, args) => {
    calls++;
    assert.equal(name, 'submit_mobile_request'); assert.equal(args.request_token, token);
    await new Promise(resolve => { release = resolve; });
    return { data: receipt, error: null };
  }, storage(), async () => token);
  const one = client.submit('emergency', payload), two = client.submit('emergency', payload);
  assert.equal(one, two);
  await new Promise(resolve => setImmediate(resolve));
  release();
  assert.equal(await one, receipt); assert.equal(await two, receipt); assert.equal(calls, 1);
});
test('a lost response can be resumed after recreation and retries do not create another request', async () => {
  const savedStorage = storage();
  let committed = false, created = 0;
  const rpc = async (name, args) => {
    assert.equal(args.request_token, token);
    if (name === 'mobile_request_receipt') return { data: committed ? receipt : null, error: null };
    if (!committed) { committed = true; created++; throw new Error('Response lost'); }
    return { data: receipt, error: null };
  };
  const first = new RequestClient(rpc, savedStorage, async () => token);
  await assert.rejects(first.submit('emergency', payload));
  const resumed = new RequestClient(rpc, savedStorage, async () => { throw new Error('Must not replace token'); });
  assert.equal(await resumed.resume('emergency'), receipt);
  assert.equal(await resumed.submit('emergency', payload), receipt);
  assert.equal(created, 1);
});
test('a failed durable token write prevents any network submission', async () => {
  let calls = 0;
  const client = new RequestClient(async () => { calls++; }, { ...storage(), setItem: async () => { throw new Error('No storage'); } }, async () => token);
  await assert.rejects(client.submit('emergency', payload), error => error.reason === 'storage');
  assert.equal(calls, 0);
});
test('report refresh follows staff status with the same token and never resubmits on failure', async () => {
  const calls = [];
  let status = 'new', offline = false;
  const client = new RequestClient(async (name, args) => {
    calls.push(name);
    assert.equal(args.request_kind, 'report');
    assert.equal(args.request_token, token);
    if (offline) throw new Error('Offline');
    return { data: { ...receipt, status }, error: null };
  }, storage(), async () => token);
  await client.submit('report', { report_type: 'obstacle', title: 'Local test', description: 'Fixture' });
  status = 'investigating';
  assert.equal((await client.resume('report')).status, 'investigating');
  offline = true;
  await assert.rejects(client.resume('report'), error => error.reason === 'unconfirmed');
  offline = false; status = 'resolved';
  assert.equal((await client.resume('report')).status, 'resolved');
  assert.deepEqual(calls, ['submit_mobile_request', 'mobile_request_receipt', 'mobile_request_receipt', 'mobile_request_receipt']);
});
test('timeout is unconfirmed, aborts the call, and preserves the retry token', async () => {
  let signal, seen;
  const client = new RequestClient(async (name, args, requestSignal) => {
    signal = requestSignal; seen = args.request_token; return new Promise(() => {});
  }, storage(), async () => token, 5);
  await assert.rejects(client.submit('emergency', payload), error => error.reason === 'unconfirmed');
  assert.equal(signal.aborted, true); assert.equal(seen, token);
});
test('an active SOS cannot be forgotten and cancellation failure never reports cancelled', async () => {
  const client = new RequestClient(async name => name === 'cancel_mobile_emergency'
    ? { data: null, error: { code: '42501' } } : { data: receipt, error: null }, storage(), async () => token);
  await client.submit('emergency', payload);
  await assert.rejects(client.newRequest('emergency'));
  await assert.rejects(client.cancelEmergency());
  assert.equal((await client.resume('emergency')).status, 'new');
});
test('confirmed cancellation permits a new request with a new token', async () => {
  let status = 'new', generated = 0;
  const client = new RequestClient(async name => {
    if (name === 'cancel_mobile_emergency') status = 'cancelled';
    return { data: { ...receipt, status }, error: null };
  }, storage(), async () => (++generated === 1 ? 'a' : 'b').repeat(64));
  await client.submit('emergency', payload);
  assert.equal((await client.cancelEmergency()).status, 'cancelled');
  await client.newRequest('emergency');
  assert.equal(await client.resume('emergency'), null);
  await client.submit('emergency', payload); assert.equal(generated, 2);
});
test('GPS refuses stale, inaccurate, invalid and missing readings while preserving zero coordinates', async () => {
  const position = { timestamp: 100000, coords: { latitude: 0, longitude: 0, accuracy: 10 } };
  assert.equal(verifiedCoordinates(position, 100000).latitude, 0);
  for (const changed of [
    { ...position, timestamp: 0 }, { ...position, timestamp: 200000 },
    { ...position, coords: { ...position.coords, accuracy: null } },
    { ...position, coords: { ...position.coords, accuracy: 101 } },
    { ...position, coords: { ...position.coords, latitude: NaN } },
    { ...position, coords: { ...position.coords, longitude: 181 } },
  ]) assert.equal(verifiedCoordinates(changed, 100000).latitude, null);
  let called = false;
  assert.equal((await requestCoordinates({ requestForegroundPermissionsAsync: async () => ({ status: 'denied' }), getCurrentPositionAsync: async () => { called = true; } })).latitude, null);
  assert.equal(called, false);
  assert.equal((await requestCoordinates({ requestForegroundPermissionsAsync: async () => ({ status: 'granted' }), getCurrentPositionAsync: async () => { throw new Error('No fix'); } })).longitude, null);
  assert.equal((await requestCoordinates({ requestForegroundPermissionsAsync: async () => new Promise(() => {}), getCurrentPositionAsync: async () => position }, 5)).latitude, null);
});
