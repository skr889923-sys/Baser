import type { RouteType } from '@baser/types';
import { CampusNetwork, CampusEdge, CampusNode, NodeFeature, EdgeFeature, Position, hasCompleteAccess, hasSurveyEvidence, parseNetwork } from './network';

export interface Traversal { from: NodeFeature; to: NodeFeature; edge: EdgeFeature; forward: boolean }
export interface NetworkPath { networkId: string; revision: number; fixture: boolean; profile: RouteType; legs: Traversal[]; distance_m: number; cost: number }
export type Destination = { nodeId: string } | { buildingId: string };
export interface RoutingOptions { simulation?: boolean; now?: number }

function surveyUsable(p: CampusNode | CampusEdge, network: CampusNetwork, options: RoutingOptions): boolean {
  if (p.status !== 'active' || p.survey_status !== 'verified') return false;
  return network.fixture && options.simulation === true || hasSurveyEvidence(p, options.now);
}
function nodeUsable(n: CampusNode, profile: RouteType, network: CampusNetwork, options: RoutingOptions): boolean {
  return surveyUsable(n, network, options) &&
    (!(profile === 'wheelchair' || profile === 'safe_accessible') || n.wheelchair === 'yes');
}

/** Conservative pilot rules, not an accessibility certification or universal standard. */
export function edgeCost(e: CampusEdge, profile: RouteType): number | null {
  if (!hasCompleteAccess(e)) return null;
  let cost = e.length_m;
  if (profile === 'wheelchair' || profile === 'safe_accessible') {
    if (e.wheelchair !== 'yes' || e.steps !== 0 || e.width_m! < 0.9 || e.incline_pct! > 8 ||
        !['paved', 'tiled', 'concrete'].includes(e.surface)) return null;
    if (e.incline_pct! > 5) cost *= 1.3;
  }
  if (profile === 'blind_friendly' || profile === 'safe_accessible') {
    if (e.tactile_paving) cost *= 0.7;
    if (e.landmarks_ar.length) cost *= 0.85;
    if (e.steps! > 0) cost *= e.handrail ? 1.4 : 2.2;
    if (e.hazards_ar.length) cost *= 1.5;
    if (e.lighting === 'poor') cost *= 1.3;
    if (e.lighting === 'none') cost *= 1.8;
  }
  return cost;
}

/** Dijkstra: costs may be below physical distance, so no distance heuristic is used. */
export function findNetworkPath(input: unknown, startId: string, destination: Destination, profile: RouteType, options: RoutingOptions = {}): NetworkPath | null {
  const network = parseNetwork(input, { live: !options.simulation, now: options.now });
  if (network.fixture && !options.simulation) return null;
  const nodes = new Map(network.nodes.features.map(n => [n.properties.id, n]));
  const goals = new Set('nodeId' in destination ? [destination.nodeId] :
    network.buildings.features.find(b => b.properties.id === destination.buildingId)?.properties.entrance_nodes ?? []);
  const usable = (id: string) => { const n = nodes.get(id); return n && nodeUsable(n.properties, profile, network, options); };
  if (!usable(startId) || !Array.from(goals).some(usable)) return null;
  const adj = new Map<string, { to: string; edge: EdgeFeature; forward: boolean; cost: number }[]>();
  const add = (from: string, to: string, edge: EdgeFeature, forward: boolean, cost: number) => {
    const arcs = adj.get(from) ?? []; arcs.push({ to, edge, forward, cost }); adj.set(from, arcs);
  };
  for (const edge of network.edges.features) {
    const e = edge.properties;
    if (!surveyUsable(e, network, options) || !usable(e.from) || !usable(e.to)) continue;
    const cost = edgeCost(e, profile);
    if (cost === null) continue;
    add(e.from, e.to, edge, true, cost);
    if (!e.oneway) add(e.to, e.from, edge, false, cost);
  }
  const costs = new Map<string, number>([[startId, 0]]), pending = new Set([startId]);
  const previous = new Map<string, Traversal>();
  while (pending.size) {
    let u = Array.from(pending).sort((a, b) => costs.get(a)! - costs.get(b)! || a.localeCompare(b))[0];
    pending.delete(u);
    if (goals.has(u)) {
      const cost = costs.get(u)!, legs: Traversal[] = [];
      while (u !== startId) { const leg = previous.get(u)!; legs.unshift(leg); u = leg.from.properties.id; }
      return { networkId: network.id, revision: network.revision, fixture: network.fixture, profile, legs,
        distance_m: legs.reduce((sum, leg) => sum + leg.edge.properties.length_m, 0), cost };
    }
    for (const arc of adj.get(u) ?? []) {
      const next = costs.get(u)! + arc.cost;
      if (next < (costs.get(arc.to) ?? Infinity)) {
        costs.set(arc.to, next);
        previous.set(arc.to, { from: nodes.get(u)!, to: nodes.get(arc.to)!, edge: arc.edge, forward: arc.forward });
        pending.add(arc.to);
      }
    }
  }
  return null;
}

export function traversalCoordinates(leg: Traversal): Position[] {
  return leg.forward ? [...leg.edge.geometry.coordinates] : [...leg.edge.geometry.coordinates].reverse();
}

/** Free text is never 'reversed': use surveyed instructions for that travel direction. */
export function traversalInstruction(leg: Traversal, language: 'ar' | 'en'): string {
  const e = leg.edge.properties;
  const guidance = leg.forward ? e.guidance_forward : e.guidance_reverse;
  if (guidance) return language === 'ar' ? guidance.instruction_ar : guidance.instruction_en;
  // Draft/simulation preview only. Live publication requires both directions' guidance.
  const name = language === 'ar' ? leg.to.properties.name_ar : leg.to.properties.name_en;
  return language === 'ar'
    ? `معاينة فقط: مقطع بطول ${e.length_m} متر إلى ${name || leg.to.properties.id}. تعليمات هذا الاتجاه غير مسجلة.`
    : `Preview only: ${e.length_m} metre segment to ${name || leg.to.properties.id}. Guidance for this direction has not been recorded.`;
}
