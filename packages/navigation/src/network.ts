export type SurveyStatus = 'verified' | 'imagery' | 'unknown';
export type Access = 'yes' | 'limited' | 'no' | 'unknown';
export type Availability = 'active' | 'closed' | 'maintenance' | 'unknown';
export type Position = [number, number];
export interface SurveyFields {
  survey_status: SurveyStatus;
  survey_source: string | null;
  surveyed_at: string | null;
  surveyed_by: string | null;
  valid_until: string | null;
  photo_refs: string[];
  status: Availability;
  closure_reason: string | null;
  closed_at: string | null;
}
export interface CampusNode extends SurveyFields {
  id: string;
  type: string;
  name_ar: string;
  name_en: string;
  building_id: string | null;
  wheelchair: Access;
  landmark_ar: string | null;
}
export interface Guidance { instruction_ar: string; instruction_en: string }
export interface CampusEdge extends SurveyFields {
  id: string;
  from: string;
  to: string;
  length_m: number;
  wheelchair: Access;
  surface: string;
  width_m: number | null;
  steps: number | null;
  step_height_cm: number | null;
  incline_pct: number | null; // Maximum absolute grade; never interpreted as uphill/downhill.
  handrail: boolean | null;
  tactile_paving: boolean | null;
  covered: boolean | null;
  lighting: 'good' | 'poor' | 'none' | 'unknown';
  oneway: boolean;
  landmarks_ar: string[];
  hazards_ar: string[];
  guidance_forward: Guidance | null;
  guidance_reverse: Guidance | null;
}
export interface CampusBuilding { id: string; name_ar: string; name_en: string; entrance_nodes: string[] }
export interface Feature<P, G> { type: 'Feature'; properties: P; geometry: G }
export interface Collection<P, G> { type: 'FeatureCollection'; fixture: boolean; features: Feature<P, G>[] }
export type NodeFeature = Feature<CampusNode, { type: 'Point'; coordinates: Position }>;
export type EdgeFeature = Feature<CampusEdge, { type: 'LineString'; coordinates: Position[] }>;
export interface CampusNetwork {
  schema_version: 1;
  id: string;
  name_ar: string;
  name_en: string;
  fixture: boolean;
  revision: number;
  source: string;
  nodes: Collection<CampusNode, NodeFeature['geometry']>;
  edges: Collection<CampusEdge, EdgeFeature['geometry']>;
  buildings: Collection<CampusBuilding, { type: 'Polygon'; coordinates: Position[][] }>;
}

export function distance(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function hasSurveyEvidence(p: SurveyFields, now = Date.now()): boolean {
  const at = Date.parse(p.surveyed_at ?? ''), until = Date.parse(p.valid_until ?? '');
  return p.survey_status === 'verified' && !!p.survey_source?.trim() && !!p.surveyed_by?.trim() &&
    Number.isFinite(at) && at <= now && Number.isFinite(until) && until > now && until > at &&
    p.photo_refs.length > 0 && p.photo_refs.every(photo => !!photo.trim());
}

export function hasCompleteAccess(e: CampusEdge): boolean {
  return e.steps !== null && e.width_m !== null && (e.steps > 0 || e.incline_pct !== null) &&
    e.surface !== 'unknown' && e.lighting !== 'unknown' &&
    (e.steps === 0 || (e.handrail !== null && e.step_height_cm !== null));
}

export class NetworkValidationError extends Error {
  constructor(public readonly issues: string[]) { super(issues.join('\n')); this.name = 'NetworkValidationError'; }
}

type ObjectValue = Record<string, any>;
const object = (v: unknown): v is ObjectValue => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text);
const coordinate = (v: unknown): v is Position => Array.isArray(v) && v.length === 2 && v.every(finite) && Math.abs(v[0]) <= 180 && Math.abs(v[1]) <= 90;
const guidance = (v: unknown): v is Guidance => object(v) && text(v.instruction_ar) && text(v.instruction_en);
const nodeTypes = ['campus_gate', 'building_entrance', 'junction', 'ramp_top', 'ramp_bottom', 'stairs_top', 'stairs_bottom', 'crossing', 'landmark', 'poi'];
const surfaces = ['paved', 'tiled', 'concrete', 'cobblestone', 'gravel', 'sand', 'grass', 'dirt', 'unknown'];

/** Validate the actual payload at every import and live read boundary. No coercion. */
export function parseNetwork(input: unknown, options: { live?: boolean; now?: number } = {}): CampusNetwork {
  const errors: string[] = [];
  const check = (ok: unknown, message: string) => { if (!ok) errors.push(message); };
  if (!object(input)) throw new NetworkValidationError(['network: expected an object']);
  check(input.schema_version === 1, 'schema_version: expected 1');
  check(text(input.id) && /^[a-zA-Z0-9_-]+$/.test(input.id), 'network.id: expected a stable identifier');
  for (const key of ['name_ar', 'name_en', 'source']) check(text(input[key]), `${key}: required`);
  check(Number.isInteger(input.revision) && input.revision > 0, 'revision: expected positive integer');
  check(typeof input.fixture === 'boolean', 'fixture: required boolean');
  check(!input.reference_only && input.routable !== false, 'reference pins cannot be routed');
  if (options.live) check(input.fixture === false, 'fixture data cannot be published or used for live guidance');

  const groups: Record<string, ObjectValue[]> = {};
  for (const name of ['nodes', 'edges', 'buildings']) {
    const c = input[name];
    if (!object(c) || c.type !== 'FeatureCollection' || !Array.isArray(c.features)) {
      errors.push(`${name}: expected FeatureCollection`); groups[name] = []; continue;
    }
    check(c.fixture === input.fixture, `${name}: fixture marker must match dataset`);
    check(!c.reference_only && c.routable !== false, `${name}: reference-only data is forbidden`);
    check(c.features.length > 0, `${name}: collection must not be empty`);
    check(c.features.length <= 10000, `${name}: exceeds pilot size limit`);
    groups[name] = [];
    const ids = new Set();
    for (const f of c.features) {
      if (!object(f) || f.type !== 'Feature' || !object(f.properties) || !object(f.geometry)) { errors.push(`${name}: invalid feature`); continue; }
      const p = f.properties;
      check(text(p.id), `${name}: id required`);
      check(!ids.has(p.id), `${name}: duplicate id ${p.id}`); ids.add(p.id);
      groups[name].push(f);
    }
  }
  const nodes = new Map(groups.nodes.map(f => [f.properties.id, f]));
  const buildings = new Map(groups.buildings.map(f => [f.properties.id, f]));
  for (const name of ['nodes', 'edges']) for (const f of groups[name]) {
    const p = f.properties, label = `${name}.${p.id}`;
    check(['verified', 'imagery', 'unknown'].includes(p.survey_status), `${label}: survey_status required`);
    check(['yes', 'limited', 'no', 'unknown'].includes(p.wheelchair), `${label}: invalid wheelchair access`);
    check(['active', 'closed', 'maintenance', 'unknown'].includes(p.status), `${label}: status required`);
    check(strings(p.photo_refs), `${label}: photo_refs must be a string array`);
    for (const key of ['survey_source', 'surveyed_at', 'surveyed_by', 'valid_until', 'closure_reason', 'closed_at']) {
      check(p[key] === null || text(p[key]), `${label}.${key}: expected text or null`);
    }
    for (const key of ['surveyed_at', 'valid_until', 'closed_at']) {
      if (p[key] !== null) check(text(p[key]) && Number.isFinite(Date.parse(p[key])), `${label}.${key}: invalid timestamp`);
    }
    if (p.status === 'closed' || p.status === 'maintenance') check(text(p.closure_reason) && text(p.closed_at), `${label}: closure reason and time required`);
    if (p.survey_status !== 'verified') {
      check(p.wheelchair === 'unknown', `${label}: unverified accessibility claim`);
      if (name === 'edges') check(p.steps !== 0, `${label}: unknown steps must not be zero`);
    }
    if (options.live) {
      check(strings(p.photo_refs) && hasSurveyEvidence(p as SurveyFields, options.now), `${label}: current field evidence is required`);
      check(p.status !== 'unknown', `${label}: availability must be checked`);
    }
  }
  for (const f of groups.nodes) {
    const p = f.properties, g = f.geometry, label = `node.${p.id}`;
    check(g.type === 'Point' && coordinate(g.coordinates), `${label}: invalid Point coordinates`);
    check(nodeTypes.includes(p.type), `${label}: invalid node type`);
    check(typeof p.name_ar === 'string' && typeof p.name_en === 'string', `${label}: names must be strings`);
    if (options.live && ['campus_gate', 'building_entrance'].includes(p.type)) check(text(p.name_ar) && text(p.name_en), `${label}: gate and entrance names required in both languages`);
    check(p.building_id === null || buildings.has(p.building_id), `${label}: missing building`);
    if (p.type === 'building_entrance') check(buildings.has(p.building_id), `${label}: entrance requires building`);
  }
  const adj = new Map<string, Set<string>>(Array.from(nodes.keys(), id => [id, new Set<string>()]));
  for (const f of groups.edges) {
    const p = f.properties, g = f.geometry, label = `edge.${p.id}`;
    check(nodes.has(p.from) && nodes.has(p.to) && p.from !== p.to, `${label}: invalid endpoints`);
    if (nodes.has(p.from) && nodes.has(p.to)) { adj.get(p.from)!.add(p.to); adj.get(p.to)!.add(p.from); }
    check(finite(p.length_m) && p.length_m > 0, `${label}: length_m must be positive`);
    for (const key of ['width_m', 'steps', 'step_height_cm', 'incline_pct']) {
      check(p[key] === null || (finite(p[key]) && (key === 'steps' || key === 'incline_pct' ? p[key] >= 0 : p[key] > 0)), `${label}.${key}: invalid measurement`);
    }
    check(p.steps === null || Number.isInteger(p.steps), `${label}: steps must be an integer`);
    for (const key of ['handrail', 'tactile_paving', 'covered']) check(p[key] === null || typeof p[key] === 'boolean', `${label}.${key}: boolean or null required`);
    check(typeof p.oneway === 'boolean', `${label}: oneway must be boolean`);
    check(surfaces.includes(p.surface), `${label}: invalid surface`);
    check(['good', 'poor', 'none', 'unknown'].includes(p.lighting), `${label}: invalid lighting`);
    check(strings(p.landmarks_ar) && strings(p.hazards_ar), `${label}: invalid landmarks/hazards`);
    for (const key of ['guidance_forward', 'guidance_reverse']) check(p[key] === null || guidance(p[key]), `${label}.${key}: bilingual guidance or null required`);
    if (options.live) {
      check(hasCompleteAccess(p as CampusEdge), `${label}: accessibility measurements incomplete`);
      check(guidance(p.guidance_forward) && (p.oneway === true || guidance(p.guidance_reverse)), `${label}: record guidance for each permitted direction`);
    }
    if (g.type !== 'LineString' || !Array.isArray(g.coordinates) || g.coordinates.length < 2 || !g.coordinates.every(coordinate)) {
      errors.push(`${label}: invalid LineString`); continue;
    }
    const coords = g.coordinates as Position[];
    const length = coords.slice(1).reduce((sum, c, i) => sum + distance(coords[i], c), 0);
    check(length > 0 && Math.abs(p.length_m - length) <= Math.max(1, length * 0.1), `${label}: length does not match geometry`);
    for (const [id, c] of [[p.from, coords[0]], [p.to, coords[coords.length - 1]]] as [string, Position][]) {
      const n = nodes.get(id);
      if (n && coordinate(n.geometry.coordinates)) check(distance(c, n.geometry.coordinates) <= 1, `${label}: endpoint is more than 1 m from node ${id}`);
    }
  }
  for (const f of groups.buildings) {
    const p = f.properties, g = f.geometry, label = `building.${p.id}`;
    check(text(p.name_ar) && text(p.name_en), `${label}: names required`);
    check(strings(p.entrance_nodes) && p.entrance_nodes.length > 0, `${label}: entrances required`);
    if (strings(p.entrance_nodes)) for (const id of p.entrance_nodes) {
      const n = nodes.get(id)?.properties;
      check(n && n.type === 'building_entrance' && n.building_id === p.id, `${label}: entrance ${id} belongs to another building or is missing`);
    }
    const rings = g.coordinates;
    check(g.type === 'Polygon' && Array.isArray(rings) && rings.length > 0 && rings.every((r: unknown) =>
      Array.isArray(r) && r.length >= 4 && r.every(coordinate) && JSON.stringify(r[0]) === JSON.stringify(r[r.length - 1])), `${label}: invalid or unclosed polygon`);
  }
  for (const f of groups.nodes) {
    const p = f.properties;
    if (p.type === 'building_entrance') check(buildings.get(p.building_id)?.properties.entrance_nodes?.includes(p.id), `node.${p.id}: missing from building entrance list`);
  }
  if (nodes.size) {
    const seen = new Set<string>(); const queue = [nodes.keys().next().value!];
    while (queue.length) { const n = queue.pop()!; if (seen.has(n)) continue; seen.add(n); queue.push(...Array.from(adj.get(n) ?? [])); }
    check(seen.size === nodes.size, 'network: disconnected or isolated nodes');
  }
  if (errors.length) throw new NetworkValidationError(errors);
  return input as CampusNetwork;
}
