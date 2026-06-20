import { Building, NavigationPoint, Route, RouteStep, Report, EmergencyRequest, QRCode } from '@baser/types';
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
    const { data, error } = await supabase.from('navigation_points').select('*').eq('id', pointId).single();
    if (error) {
      console.error('[SupabaseService] Error fetching navigation point by id:', error);
      return undefined;
    }
    return data || undefined;
  }

  public async submitReport(report: Omit<Report, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<Report | null> {
    const { data, error } = await supabase.from('reports').insert([{ ...report, status: 'new' }]).select().single();
    if (error) {
      console.error('[SupabaseService] Error submitting report:', error);
      return null;
    }
    return data;
  }

  public async submitEmergency(emergency: Omit<EmergencyRequest, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<EmergencyRequest | null> {
    const { data, error } = await supabase.from('emergency_requests').insert([{ ...emergency, status: 'new' }]).select().single();
    if (error) {
      console.error('[SupabaseService] Error submitting emergency:', error);
      return null;
    }
    return data;
  }

  public async logQRScan(pointId: string, userId?: string | null): Promise<void> {
    const qrCode = await this.getQRCode(pointId);
    if (!qrCode) return;

    const { error: logError } = await supabase.from('qr_scan_logs').insert([{
      user_id: userId || null,
      qr_code_id: qrCode.id,
    }]);

    if (logError) {
      console.error('[SupabaseService] Error logging QR scan:', logError);
    }

    const { error: updateError } = await supabase
      .from('qr_codes')
      .update({
        scan_count: (qrCode.scan_count || 0) + 1,
        last_scanned_at: new Date().toISOString(),
      })
      .eq('id', qrCode.id);

    if (updateError) {
      console.error('[SupabaseService] Error updating QR scan count:', updateError);
    }
  }
}

export default new SupabaseService();
