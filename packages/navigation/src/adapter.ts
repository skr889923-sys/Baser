import type { NavigationPoint, Route, RouteStep } from '@baser/types';
import { NetworkPath, traversalInstruction } from './router';
import { CampusNetwork, NodeFeature } from './network';
import { edgeCost } from './router';

export interface NetworkPlan { route: Route; steps: RouteStep[]; destination: NavigationPoint; network: { id: string; revision: number; edgeIds: string[] } }
export function networkPoint(network: CampusNetwork, node: NodeFeature): NavigationPoint {
  const p = node.properties;
  return { id: `${network.id}:${p.id}`, name_ar: p.name_ar || p.id, name_en: p.name_en || p.id,
    building_id: p.building_id ? `${network.id}:${p.building_id}` : null,
    type: p.type === 'building_entrance' || p.type === 'campus_gate' ? 'entrance' : 'intersection',
    latitude: node.geometry.coordinates[1], longitude: node.geometry.coordinates[0],
    description_ar: '', description_en: '', audio_instruction_ar: '', audio_instruction_en: '',
    is_accessible: p.wheelchair === 'yes', is_hazard: false, is_active: p.status === 'active', created_at: '', updated_at: '' };
}

/** Only live paths enter Baser's guidance store. Simulation stays in the admin preview. */
export function toNavigationPlan(network: CampusNetwork, path: NetworkPath): NetworkPlan {
  if (network.fixture || path.fixture || !path.legs.length || path.networkId !== network.id || path.revision !== network.revision) {
    throw new Error('Cannot start guidance for a fixture, empty or stale path');
  }
  const id = `network:${network.id}:${network.revision}:${path.legs.map(l => `${l.edge.properties.id}${l.forward ? '+' : '-'}`).join(',')}`;
  const pointId = (n: NodeFeature) => `${network.id}:${n.properties.id}`;
  const wheelchair = path.legs.every(l => l.from.properties.wheelchair === 'yes' && l.to.properties.wheelchair === 'yes' && edgeCost(l.edge.properties, 'wheelchair') !== null);
  const route: Route = {
    id, start_point_id: pointId(path.legs[0].from), end_point_id: pointId(path.legs[path.legs.length - 1].to),
    name_ar: network.name_ar, name_en: network.name_en, route_type: path.profile,
    distance_meters: path.distance_m, estimated_minutes: Math.max(1, Math.ceil(path.distance_m / 45)),
    has_stairs: path.legs.some(l => l.edge.properties.steps! > 0),
    has_ramp: path.legs.some(l => l.from.properties.type.startsWith('ramp_') || l.to.properties.type.startsWith('ramp_')),
    wheelchair_accessible: wheelchair, visually_impaired_friendly: path.profile === 'blind_friendly' || path.profile === 'safe_accessible',
    status: 'active', created_at: '', updated_at: '',
  };
  const steps: RouteStep[] = path.legs.map((leg, i) => ({
    id: `${id}:${i}`, route_id: id, step_order: i + 1,
    from_point_id: pointId(leg.from), to_point_id: pointId(leg.to),
    instruction_ar: traversalInstruction(leg, 'ar'), instruction_en: traversalInstruction(leg, 'en'),
    distance_meters: leg.edge.properties.length_m,
    // The surveyed instruction contains actual turns; do not invent a stair direction or turn from metadata.
    direction: 'straight', haptic_pattern: leg.edge.properties.steps! > 0 || leg.edge.properties.hazards_ar.length ? 'warning' : 'continue',
    warning_level: leg.edge.properties.steps! > 0 || leg.edge.properties.hazards_ar.length ? 'caution' : 'none', created_at: '',
  }));
  return { route, steps, destination: networkPoint(network, path.legs[path.legs.length - 1].to),
    network: { id: network.id, revision: network.revision, edgeIds: path.legs.map(l => l.edge.properties.id) } };
}
