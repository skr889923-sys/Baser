const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const test = require('node:test');
const project = path.resolve(__dirname, '../../..');
const requireProject = createRequire(path.join(project, 'package.json'));
const ts = requireProject('typescript');
const React = requireProject('react');
const { JSDOM } = requireProject('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/routes' });
global.window = dom.window; global.document = dom.window.document;
global.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = requireProject('react-dom/client');
const route = id => ({ id, name_ar: id, name_en: id, start_point_id: 'p1', end_point_id: 'p2',
  route_type: 'safe_accessible', distance_meters: 20, estimated_minutes: 1, status: 'active', updated_at: 'v1' });
let routes = [route('route-a'), route('route-b')];
let steps = routes.map(r => ({ id: 'step-' + r.id, route_id: r.id, step_order: 1,
  instruction_ar: 'guide-' + r.id, distance_meters: 20 }));
const controls = { confirmed: false, confirmations: 0, deletes: 0, failDelete: false,
  emptyDelete: false, failRead: false, role: 'university_admin', holdDelete: null };
dom.window.confirm = () => { controls.confirmations++; return controls.confirmed; };
const client = {
  auth: { getUser: async () => ({ data: { user: { id: 'editor' } }, error: null }) },
  from(table) {
    let operation = 'read', payload; const filters = [];
    const query = {
      select: () => query, eq(key, value) { filters.push([key, value]); return query; }, order: () => query,
      delete() { operation = 'delete'; return query; },
      update(value) { operation = 'update'; payload = value; return query; },
      async execute(single) {
        if (table === 'profiles') return { data: { role: controls.role }, error: null };
        if (operation === 'delete') {
          controls.deletes++;
          if (controls.holdDelete) await controls.holdDelete;
          if (controls.failDelete) return { data: null, error: { code: '42501', message: 'Denied' } };
          if (controls.emptyDelete) return { data: null, error: null };
        } else if (controls.failRead && operation === 'read') return { data: null, error: { code: 'NETWORK' } };
        const rows = table === 'routes' ? routes : table === 'route_steps' ? steps : [];
        const matches = rows.filter(row => filters.every(([key, value]) => row[key] === value));
        if (operation === 'delete') {
          const ids = new Set(matches.map(row => row.id));
          routes = routes.filter(row => !ids.has(row.id)); steps = steps.filter(row => !ids.has(row.route_id));
        } else if (operation === 'update') matches.forEach(row => Object.assign(row, payload));
        return { data: single ? matches[0] || null : matches.map(row => ({ ...row })), error: null };
      },
      maybeSingle() { return query.execute(true); },
      then(resolve, reject) { return query.execute(false).then(resolve, reject); },
    }; return query;
  },
};
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const context = { exports: {}, window: dom.window, console, setTimeout, clearTimeout, URLSearchParams,
    require(name) {
      if (name === '@/lib/supabase') return { supabase: client };
      if (name.startsWith('@/')) return load(path.join(project, 'apps/admin/src', name.slice(2) + '.ts'));
      return requireProject(name);
    } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, context);
  modules.set(file, context.exports); return context.exports;
}
const { default: RoutesPage } = load(path.join(project, 'apps/admin/src/app/routes/page.tsx'));
const root = createRoot(document.getElementById('root'));
const settle = () => new Promise(resolve => setImmediate(resolve));
const click = async node => { await React.act(async () => { node.click(); await settle(); }); };
const deleteButtons = id => [...document.querySelectorAll('button')].filter(b => b.getAttribute('aria-label') === 'حذف ' + id);
const guideCount = id => document.body.textContent.split('guide-' + id).length - 1;

test('routes page deletes from desktop/mobile only after confirmation and a matching server receipt', async t => {
  t.after(async () => { await React.act(async () => root.unmount()); dom.window.close(); });
  await React.act(async () => { root.render(React.createElement(RoutesPage)); await settle(); });
  assert.equal(deleteButtons('route-a').length, 2, 'Route deletion must be available on desktop and mobile');
  assert.equal(guideCount('route-a'), 1);
  await click(deleteButtons('route-a')[0]);
  assert.equal(controls.deletes, 0, 'Cancel must not write');
  controls.confirmed = true; controls.role = 'student';
  await click(deleteButtons('route-a')[0]);
  assert.equal(controls.deletes, 0, 'A non-editor must be denied before any delete');
  assert.equal(deleteButtons('route-a').length, 2);
  controls.role = 'university_admin'; controls.failDelete = true;
  await click(deleteButtons('route-a')[0]);
  assert.equal(deleteButtons('route-a').length, 2, 'Permission failure must keep route');
  assert.equal(guideCount('route-a'), 1, 'Permission failure must keep selected steps');
  assert.ok(document.querySelector('[role="alert"]'), 'Failure must be visible');
  controls.failDelete = false; controls.emptyDelete = true;
  await click(deleteButtons('route-a')[0]);
  assert.equal(deleteButtons('route-a').length, 2, 'An empty receipt must not claim deletion');
  controls.emptyDelete = false;
  let release; controls.holdDelete = new Promise(resolve => { release = resolve; });
  const before = controls.deletes;
  await click(deleteButtons('route-a')[0]);
  await click(deleteButtons('route-a')[1]);
  assert.equal(controls.deletes, before + 1, 'A pending delete must not submit twice');
  assert.equal(deleteButtons('route-a').length, 2, 'Row stays until server receipt');
  await React.act(async () => { release(); await settle(); }); controls.holdDelete = null;
  assert.equal(deleteButtons('route-a').length, 0);
  assert.equal(guideCount('route-a'), 0, 'Deleted route guidance must be removed');
  assert.equal(guideCount('route-b'), 1, 'Selection moves to a remaining route');
  assert.ok(document.querySelector('[role="status"]')?.textContent.includes('حذف'));
  await click(deleteButtons('route-b')[1]);
  assert.equal(document.querySelectorAll('button[title="حذف المسار"]').length, 0);
  assert.equal(guideCount('route-b'), 0);
  controls.failRead = true;
  await click(document.querySelector('button[aria-label="تحديث المسارات"]'));
  assert.ok(document.querySelector('[role="alert"]'), 'Read failures must be shown');
  assert.ok(!document.querySelector('button[aria-label="تحديث المسارات"]').disabled, 'Retry remains available');
  controls.failRead = false; routes = [route('route-c')];
  await click(document.querySelector('button[aria-label="تحديث المسارات"]'));
  assert.equal(deleteButtons('route-c').length, 2, 'Refreshing can recover after a failed read');
});
