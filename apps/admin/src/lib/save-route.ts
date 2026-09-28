import type { SupabaseClient } from '@supabase/supabase-js';
import type { Route, RouteStep } from '@baser/types';

export type NewRoute = Omit<Route, 'id' | 'created_at' | 'updated_at'>;
export type FirstStep = Pick<RouteStep, 'instruction_ar' | 'instruction_en' | 'direction' | 'haptic_pattern' | 'warning_level'>;

export async function saveRouteWithFirstStep(client: SupabaseClient, route: NewRoute, step: FirstStep): Promise<Route> {
  const { data, error } = await client.rpc('create_route_with_first_step', {
    route_data: route,
    step_data: step,
  }).single();
  if (error) throw error;
  if (!data) throw new Error('لم تُرجع قاعدة البيانات المسار المحفوظ.');
  return data as Route;
}
