#!/usr/bin/env node
// Package three GeoJSON files as a Baser draft; never invent survey evidence.
const fs = require('node:fs');
const path = require('node:path');
const [directory, output, id = 'campus-draft', arabicName = 'مسودة شبكة الحرم', englishName = 'Campus network draft'] = process.argv.slice(2);
if (!directory || !output || !/^[a-zA-Z0-9_-]+$/.test(id)) {
  console.error('Usage: node scripts/prepare-campus-import.cjs INPUT_DIRECTORY OUTPUT.json ID [ARABIC_NAME] [ENGLISH_NAME]'); process.exit(1);
}
const groups = Object.fromEntries(['nodes', 'edges', 'buildings'].map(name => [name, JSON.parse(fs.readFileSync(path.join(directory, name+'.geojson'), 'utf8'))]));
const fixture = groups.nodes.fixture === true;
for (const [name, collection] of Object.entries(groups)) {
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features) || collection.reference_only || collection.routable === false) throw new Error(name+': not routing data');
  if ((collection.fixture === true) !== fixture) throw new Error('Mixed fixture and real data');
  collection.fixture = fixture;
  if (name === 'buildings') continue;
  for (const feature of collection.features) {
    const p = feature.properties;
    if (p.survey_status !== 'verified' && p.wheelchair !== 'unknown') {
      console.warn('Cleared unverified access claim:', p.id); p.wheelchair = 'unknown';
    }
    for (const field of ['survey_source', 'surveyed_at', 'surveyed_by', 'valid_until', 'closure_reason', 'closed_at']) p[field] ??= null;
    p.photo_refs ??= p.photo_ref ? [p.photo_ref] : [];
    p.status ??= fixture ? 'active' : 'unknown';
    if (name === 'edges') {
      p.guidance_forward ??= null;
      p.guidance_reverse ??= null;
      p.surface ??= 'unknown'; p.lighting ??= 'unknown';
    }
  }
}
const network = { schema_version: 1, id, name_ar: arabicName, name_en: englishName, fixture, revision: 1,
  source: fixture ? 'Synthetic campus-map fixture; not a real campus or field survey' : 'Imported draft; source and field evidence require review', ...groups };
fs.writeFileSync(output, JSON.stringify(network, null, 2)+'\n', { flag: 'wx' });
console.log('Created draft:', output);
