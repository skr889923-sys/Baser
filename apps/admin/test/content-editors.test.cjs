const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
function load(name) {
  const scope = { exports: {}, crypto: webcrypto, TextEncoder, Blob };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib', name), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, scope);
  return scope.exports;
}
const { emptyBuildingDraft, buildingPayload, detectBuildingSchema, saveBuilding, setBuildingActive } = load('building-editor.ts');
const { createRecordingDraft, saveVoiceRecording, recordingId } = load('voice-recording.ts');
const draft = () => ({ ...emptyBuildingDraft(), name_ar: ' مبنى ', name_en: ' Building ', code: ' B1 ' });

test('deployed building form sends its required code and never invents coordinates or unsupported attributes', () => {
  const payload = buildingPayload(draft(), 'coded');
  assert.equal(payload.code, 'B1');
  assert.equal(payload.latitude, null); assert.equal(payload.longitude, null);
  assert.equal('type' in payload, false); assert.equal('is_accessible' in payload, false);
  for (const fields of [{ latitude: '12' }, { latitude: 'NaN', longitude: '1' },
    { latitude: '91', longitude: '1' }, { latitude: '1', longitude: '-181' }, { code: '  ' }]) {
    assert.throws(() => buildingPayload({ ...draft(), ...fields }, 'coded'));
  }
  assert.equal(buildingPayload({ ...draft(), latitude: '0', longitude: '0' }, 'coded').latitude, 0);
});
test('original building schema requires real coordinates and explicit type/accessibility choices', () => {
  assert.throws(() => buildingPayload(draft(), 'classic'));
  assert.throws(() => buildingPayload({ ...draft(), latitude: '1', longitude: '2' }, 'classic'));
  const payload = buildingPayload({ ...draft(), latitude: '1', longitude: '2', type: 'library', accessibility: 'no' }, 'classic');
  assert.equal('code' in payload, false); assert.equal(payload.is_accessible, false);
});
test('schema discovery is read-only and never treats authorization/network errors as a legacy schema', async () => {
  const client = error => ({ from: () => ({ select: field => {
    assert.equal(field, 'code'); return { limit: async value => { assert.equal(value, 0); return { error }; } };
  } }) });
  assert.equal(await detectBuildingSchema(client(null)), 'coded');
  assert.equal(await detectBuildingSchema(client({ code: '42703' })), 'classic');
  for (const code of ['42501', 'PGRST301', 'NETWORK']) await assert.rejects(detectBuildingSchema(client({ code })));
});
test('building edits and activation reject silent RLS/stale-row failures and match the previous version', async () => {
  const filters = [];
  const query = { eq(key, value) { filters.push([key, value]); return query; },
    select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
  const client = { from: () => ({ update: () => query }) };
  const previous = { id: 'building', updated_at: 'previous-time', is_active: true };
  await assert.rejects(saveBuilding(client, draft(), 'coded', previous));
  assert.ok(filters.some(([key, value]) => key === 'updated_at' && value === 'previous-time'));
  await assert.rejects(setBuildingActive(client, previous));
  assert.ok(filters.some(([key, value]) => key === 'is_active' && value === true));
});

function voiceBackend(initial = []) {
  const rows = new Map(initial.map(row => [row.id, { ...row }]));
  const files = new Map(), uploads = [], writes = [];
  const controls = { failUpload: false, failWrite: false, loseWriteResponse: false, beforeWrite: null };
  const storage = {
    getPublicUrl: name => ({ data: { publicUrl: 'https://example.test/voiceovers/' + name } }),
    upload: async (name, blob, options) => {
      uploads.push({ name, blob, options }); files.set(name, blob);
      if (controls.failUpload) { controls.failUpload = false; return { error: { code: 'NETWORK' } }; }
      return { data: { path: name }, error: null };
    },
    remove: () => { throw new Error('Must not delete possibly referenced audio'); },
  };
  const client = { storage: { from: () => storage }, from: table => {
    assert.equal(table, 'voice_recordings');
    let operation = 'read', payload = null;
    const filters = [];
    const query = {
      select: () => query,
      eq(key, value) { filters.push([key, value]); return query; },
      insert(data) { operation = 'insert'; payload = data; return query; },
      update(data) { operation = 'update'; payload = data; return query; },
      async maybeSingle() {
        if (operation !== 'read') {
          writes.push({ operation, payload });
          assert.equal('updated_at' in payload, false);
          if (controls.failWrite) { controls.failWrite = false; return { data: null, error: { code: '42501' } }; }
          if (controls.beforeWrite) controls.beforeWrite(rows);
        }
        const matches = [...rows.values()].filter(row => filters.every(([key, value]) => row[key] === value));
        if (matches.length > 1) return { data: null, error: { code: 'PGRST116' } };
        let row = matches[0] || null;
        if (operation === 'insert') {
          if (rows.has(payload.id)) return { data: null, error: { code: '23505' } };
          row = { ...payload }; rows.set(row.id, row);
        } else if (operation === 'update' && row) {
          row = { ...row, ...payload }; rows.set(row.id, row);
        }
        if (operation !== 'read' && controls.loseWriteResponse) {
          controls.loseWriteResponse = false; throw new Error('Response lost after commit');
        }
        return { data: row ? { ...row } : null, error: null };
      },
    };
    return query;
  } };
  return { client, rows, files, uploads, writes, controls };
}
const audio = () => new Blob(['local audio fixture'], { type: 'audio/mp4' });
test('voice upload preserves the actual MIME type and binds the selected character and phrase', async () => {
  const backend = voiceBackend();
  const job = createRecordingDraft('character-1', 'qr.intro', audio());
  const result = await saveVoiceRecording(backend.client, job);
  assert.equal(result.character_id, 'character-1'); assert.equal(result.phrase_key, 'qr.intro');
  assert.ok(job.path.endsWith('.m4a')); assert.equal(backend.uploads[0].options.contentType, 'audio/mp4');
  assert.equal(backend.rows.size, 1);
});
test('metadata failure retains the same uploaded file and retries without uploading another copy', async () => {
  const backend = voiceBackend(); backend.controls.failWrite = true;
  const job = createRecordingDraft('character-1', 'qr.intro', audio());
  await assert.rejects(saveVoiceRecording(backend.client, job));
  assert.equal(backend.rows.size, 0); assert.equal(backend.files.size, 1);
  await saveVoiceRecording(backend.client, job);
  assert.equal(backend.rows.size, 1); assert.equal(backend.uploads.length, 1);
});
test('lost upload and metadata responses recover without duplicate files or duplicate rows', async () => {
  const backend = voiceBackend(); backend.controls.failUpload = true;
  const job = createRecordingDraft('character-1', 'qr.intro', audio());
  await assert.rejects(saveVoiceRecording(backend.client, job));
  backend.controls.loseWriteResponse = true;
  await assert.rejects(saveVoiceRecording(backend.client, job));
  const saved = await saveVoiceRecording(backend.client, job);
  assert.equal(saved.id, job.recordId); assert.equal(backend.files.size, 1); assert.equal(backend.rows.size, 1);
  assert.equal(backend.writes.length, 1); assert.equal(backend.uploads.length, 2);
  assert.equal(backend.uploads[0].name, backend.uploads[1].name);
});
test('existing legacy random ids are retained and stale edits never overwrite another employee', async () => {
  const old = { id: 'legacy-random-id', character_id: 'character-1', phrase_key: 'qr.intro', audio_url: 'old-file' };
  const backend = voiceBackend([old]);
  const job = createRecordingDraft('character-1', 'qr.intro', audio());
  backend.controls.beforeWrite = rows => rows.set(old.id, { ...old, audio_url: 'someone-elses-file' });
  await assert.rejects(saveVoiceRecording(backend.client, job));
  assert.equal(backend.rows.get(old.id).audio_url, 'someone-elses-file');
  await assert.rejects(saveVoiceRecording(backend.client, job));
  const next = createRecordingDraft('character-1', 'qr.intro', audio());
  backend.controls.beforeWrite = null;
  assert.equal((await saveVoiceRecording(backend.client, next)).id, old.id);
  assert.equal(backend.rows.size, 1);
});
test('concurrent first recordings cannot create two metadata rows without a compound unique constraint', async () => {
  const backend = voiceBackend();
  const results = await Promise.allSettled([1, 2].map(() => saveVoiceRecording(backend.client,
    createRecordingDraft('character-1', 'qr.intro', audio()))));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(backend.rows.size, 1);
  assert.equal(await recordingId('character-1', 'qr.intro'), await recordingId('character-1', 'qr.intro'));
  assert.notEqual(await recordingId('character-1', 'qr.intro'), await recordingId('character-2', 'qr.intro'));
});
test('duplicate legacy metadata and empty audio fail before uploading or replacing anything', async () => {
  assert.throws(() => createRecordingDraft('character', 'phrase', new Blob([], { type: 'audio/mp4' })));
  const backend = voiceBackend([1, 2].map(id => ({ id: String(id), character_id: 'character-1', phrase_key: 'qr.intro', audio_url: 'old' })));
  await assert.rejects(saveVoiceRecording(backend.client, createRecordingDraft('character-1', 'qr.intro', audio())));
  assert.equal(backend.uploads.length, 0); assert.equal(backend.writes.length, 0);
});
