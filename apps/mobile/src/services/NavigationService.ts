import { NavigationPoint, Route, RouteStep, RouteType } from '@dallni/types';
import SupabaseService from './SupabaseService';
import VoiceService from './VoiceService';
import HapticsService from './HapticsService';
import * as Location from 'expo-location';

class NavigationService {
  // Helper to calculate geospatial distance in meters using the Haversine formula
  public getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Cross-Track Error (distance from point to a line segment) in meters
  public getCrossTrackDistance(
    userLat: number, userLon: number,
    startLat: number, startLon: number,
    endLat: number, endLon: number
  ): number {
    const R = 6371e3;
    const d13 = this.getDistance(startLat, startLon, userLat, userLon) / R;
    const theta13 = this.getBearing(startLat, startLon, userLat, userLon);
    const theta12 = this.getBearing(startLat, startLon, endLat, endLon);
    const dxt = Math.asin(Math.sin(d13) * Math.sin(theta13 - theta12));
    return Math.abs(dxt * R);
  }

  public getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const lambda1 = lon1 * Math.PI / 180;
    const lambda2 = lon2 * Math.PI / 180;
    const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) -
              Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
    return Math.atan2(y, x);
  }

  // Find the nearest navigation point based on GPS coordinates
  public async getNearestPoint(latitude: number, longitude: number): Promise<NavigationPoint | null> {
    const points = await SupabaseService.getNavigationPoints();
    if (points.length === 0) return null;
    
    let nearestPoint = points[0];
    let minDistance = Infinity;

    for (const point of points) {
      if (point.latitude && point.longitude) {
        const dist = this.getDistance(latitude, longitude, point.latitude, point.longitude);
        if (dist < minDistance) {
          minDistance = dist;
          nearestPoint = point;
        }
      }
    }
    return nearestPoint;
  }

  // Graph Fallback: using Supabase real points
  public async getRoutesToDestination(startPointId: string, destinationPointId: string): Promise<Route[]> {
    const routes = await SupabaseService.getRoutes();
    const points = await SupabaseService.getNavigationPoints();
    
    const directRoutes = routes.filter(r => r.start_point_id === startPointId && r.end_point_id === destinationPointId);
    if (directRoutes.length > 0) return directRoutes;

    const destinationPoint = points.find(p => p.id === destinationPointId);
    if (destinationPoint?.building_id) {
      const entrancePoint = points.find(p => p.building_id === destinationPoint.building_id && p.type === 'entrance');
      if (entrancePoint && entrancePoint.id !== startPointId) {
        return routes.filter(r => r.start_point_id === startPointId && r.end_point_id === entrancePoint.id);
      }
    }

    return routes.slice(0, 1);
  }

  // Selects the best route based on user preference
  public selectBestRoute(routes: Route[], preference: RouteType): Route {
    if (routes.length <= 1) return routes[0];

    const sorted = [...routes].sort((a, b) => {
      if (preference === 'blind_friendly') {
        if (a.visually_impaired_friendly && !b.visually_impaired_friendly) return -1;
        if (!a.visually_impaired_friendly && b.visually_impaired_friendly) return 1;
      }
      if (preference === 'wheelchair' || preference === 'safe_accessible') {
        if (a.wheelchair_accessible && !b.wheelchair_accessible) return -1;
        if (!a.wheelchair_accessible && b.wheelchair_accessible) return 1;
      }
      return a.distance_meters - b.distance_meters;
    });

    return sorted[0];
  }

  // Speak the step direction and text
  public async speakStep(step: RouteStep, isAr: boolean = true): Promise<void> {
    let text = isAr ? step.instruction_ar : step.instruction_en;
    
    if (step.direction === 'elevator_up' || step.direction === 'elevator_down') {
      text += isAr 
        ? " - انتبه، أبواب المصعد تفتح. يرجى ركوب المصعد، وعند خروجك في الطابق المطلوب اضغط على زر تأكيد الوصول في الشاشة." 
        : " - Attention, elevator doors opening. Please enter, and press the confirm arrival button on your screen when you exit at the desired floor.";
    } else if (step.direction === 'stairs_up' || step.direction === 'stairs_down') {
      text += isAr
        ? " - يرجى الحذر أثناء استخدام السلالم. واضغط على زر تأكيد الوصول عند بلوغ الطابق الجديد."
        : " - Please be careful using the stairs. Press the confirm button when you reach the new floor.";
    }

    await VoiceService.speak(text);
  }

  public async triggerHaptic(step: RouteStep): Promise<void> {
    await HapticsService.trigger(step.haptic_pattern);
  }

  public async announceDeviation(isAr: boolean = true): Promise<void> {
    const text = isAr 
      ? 'تنبيه: يبدو أنك انحرفت عن المسار المحدد. يرجى التوقف قليلاً وسنعيد توجيهك.' 
      : 'Warning: It seems you have deviated from the path. Please stop and we will redirect you.';
    
    await HapticsService.trigger('warning');
    await VoiceService.speak(text);
  }

  public async announceArrival(isAr: boolean = true): Promise<void> {
    const text = isAr 
      ? 'لقد وصلت إلى وجهتك بأمان. شكراً لاستخدامك تطبيق دلّني.' 
      : 'You have successfully arrived at your destination. Thank you for using Dallni.';
    
    await HapticsService.trigger('arrived');
    await VoiceService.speak(text);
  }
}

export default new NavigationService();
