import type { Route, RouteStep, RouteType } from '@baser/types';

/** Eligibility is a constraint, never just a sorting preference. */
export function isRouteEligible(route: Route, preference: RouteType): boolean {
  if (route.status !== 'active' || !Number.isFinite(route.distance_meters) || route.distance_meters <= 0) return false;
  if (preference === 'wheelchair' || preference === 'safe_accessible') {
    if (route.wheelchair_accessible !== true || route.has_stairs !== false) return false;
  }
  if (preference === 'blind_friendly' || preference === 'safe_accessible') {
    if (route.visually_impaired_friendly !== true) return false;
  }
  return true;
}

export function selectBestRoute(routes: Route[], preference: RouteType): Route | null {
  return routes.filter(route => isRouteEligible(route, preference))
    .sort((a, b) => a.distance_meters - b.distance_meters || a.id.localeCompare(b.id))[0] ?? null;
}

export function canStartNavigation(route: Route, steps: RouteStep[], preference: RouteType): boolean {
  if (!isRouteEligible(route, preference) || !steps.length) return false;
  if (steps[0].from_point_id !== route.start_point_id || steps[steps.length - 1].to_point_id !== route.end_point_id) return false;
  const ids = new Set<string>();
  return steps.every((step, index) => {
    if (ids.has(step.id)) return false;
    ids.add(step.id);
    return step.route_id === route.id && step.step_order === index + 1 &&
      step.from_point_id !== step.to_point_id &&
      Number.isFinite(step.distance_meters) && step.distance_meters > 0 &&
      typeof step.instruction_ar === 'string' && !!step.instruction_ar.trim() &&
      typeof step.instruction_en === 'string' && !!step.instruction_en.trim() &&
      typeof step.direction === 'string' &&
      ['straight','left','right','slight_left','slight_right','u_turn','stairs_up','stairs_down','elevator_up','elevator_down'].includes(step.direction) &&
      ['continue','turn_left','turn_right','warning','arrived','emergency'].includes(step.haptic_pattern) &&
      ['none','caution','danger'].includes(step.warning_level) &&
      (index === 0 || steps[index - 1].to_point_id === step.from_point_id) &&
      (!(preference === 'wheelchair' || preference === 'safe_accessible') || !step.direction.startsWith('stairs_'));
  });
}
