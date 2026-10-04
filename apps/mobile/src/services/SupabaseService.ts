import { Building, NavigationPoint, Route, RouteStep, QRCode } from '@baser/types';
import { supabase } from '../lib/supabase';

class SupabaseService {
  public async getBuildings(): Promise<Building[]> {
    const { data, error } = await supabase.from('buildings').select('*').eq('is_active', true);
    if (error) {
      console.error('[SupabaseService] Error fetching buildings:', error);
      return [];
    }
    return data || [];
  }

  public async getNavigationPoints(buildingId?: string | null): Promise<NavigationPoint[]> {
    let query = supabase.from('navigation_points').select('*').eq('is_active', true);
    if (buildingId) {
      query = query.eq('building_id', buildingId);
    }
    const { data, error } = await query;
    if (error) {
      console.error('[SupabaseService] Error fetching navigation points:', error);
      return [];
    }
    return data || [];
  }

  public async getRoutes(): Promise<Route[]> {
    const { data, error } = await supabase.from('routes').select('*').eq('status', 'active');
    if (error) {
      console.error('[SupabaseService] Error fetching routes:', error);
      return [];
    }
    return data || [];
  }

  public async getRouteSteps(routeId: string): Promise<RouteStep[]> {
    const { data, error } = await supabase.from('route_steps').select('*').eq('route_id', routeId).order('step_order', { ascending: true });
    if (error) {
      console.error('[SupabaseService] Error fetching route steps:', error);
      return [];
    }
    return data || [];
  }

  // To build Dijkstra's graph, we might want ALL steps for ALL routes
  public async getAllRouteSteps(): Promise<RouteStep[]> {
    const { data, error } = await supabase.from('route_steps').select('*');
    if (error) {
      console.error('[SupabaseService] Error fetching all route steps:', error);
      return [];
    }
    return data || [];
  }

  public async getQRCode(pointId: string): Promise<QRCode | undefined> {
    const { data, error } = await supabase.from('qr_codes').select('*').eq('navigation_point_id', pointId).single();
    if (error) {
      console.error('[SupabaseService] Error fetching QR:', error);
      return undefined;
    }
    return data || undefined;
  }

  public async getQRCodeByContent(content: string): Promise<QRCode | undefined> {
    const { data, error } = await supabase.from('qr_codes').select('*').eq('code_content', content).single();
    if (error) {
      console.error('[SupabaseService] Error fetching QR by content:', error);
      return undefined;
    }
    return data || undefined;
  }

  public async getNavigationPointById(pointId: string): Promise<NavigationPoint | undefined> {
    const { data, error } = await supabase.from('navigation_points').select('*').eq('id', pointId).eq('is_active', true).single();
    if (error) {
      console.error('[SupabaseService] Error fetching navigation point by id:', error);
      return undefined;
    }
    return data || undefined;
  }


  public async logQRScan(content: string): Promise<void> {
    const { error } = await supabase.rpc('record_qr_scan', { qr_content: content });
    // Scan telemetry must not prevent valid positioning, and must never change a QR binding.
    if (error) console.warn('[SupabaseService] QR scan could not be recorded');
  }
}

export default new SupabaseService();
