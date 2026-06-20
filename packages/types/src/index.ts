export type UserRole = 'super_admin' | 'university_admin' | 'building_manager' | 'support_agent' | 'security_staff' | 'student';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  disability_type?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  language: 'ar' | 'en';
  created_at: string;
}

export type BuildingType = 'college' | 'deanship' | 'service' | 'administration' | 'library' | 'restaurant' | 'dormitory' | 'parking';

export interface Building {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  type: BuildingType;
  latitude: number;
  longitude: number;
  address_text?: string;
  is_accessible: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Floor {
  id: string;
  building_id: string;
  floor_number: number;
  name_ar: string;
  name_en: string;
  map_image_url?: string;
  created_at: string;
}

export type PointType = 
  | 'entrance' 
  | 'exit' 
  | 'elevator' 
  | 'stairs' 
  | 'ramp' 
  | 'corridor' 
  | 'intersection' 
  | 'restroom' 
  | 'office' 
  | 'hall' 
  | 'qr_spot' 
  | 'hazard';

export interface NavigationPoint {
  id: string;
  building_id?: string | null;
  floor_id?: string | null;
  name_ar: string;
  name_en: string;
  type: PointType;
  latitude?: number | null;
  longitude?: number | null;
  indoor_x?: number | null;
  indoor_y?: number | null;
  description_ar: string;
  description_en: string;
  audio_instruction_ar: string;
  audio_instruction_en: string;
  is_accessible: boolean;
  is_hazard: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type RouteType = 'fastest' | 'safe_accessible' | 'wheelchair' | 'blind_friendly';
export type RouteStatus = 'active' | 'closed' | 'maintenance';

export interface Route {
  id: string;
  start_point_id: string;
  end_point_id: string;
  name_ar: string;
  name_en: string;
  route_type: RouteType;
  distance_meters: number;
  estimated_minutes: number;
  has_stairs: boolean;
  has_ramp: boolean;
  wheelchair_accessible: boolean;
  visually_impaired_friendly: boolean;
  status: RouteStatus;
  created_at: string;
  updated_at: string;
}

export type HapticPatternType = 'continue' | 'turn_left' | 'turn_right' | 'warning' | 'arrived' | 'emergency';
export type DirectionType = 'straight' | 'left' | 'right' | 'slight_left' | 'slight_right' | 'u_turn' | 'stairs_up' | 'stairs_down' | 'elevator_up' | 'elevator_down';

export interface RouteStep {
  id: string;
  route_id: string;
  step_order: number;
  from_point_id: string;
  to_point_id: string;
  instruction_ar: string;
  instruction_en: string;
  distance_meters: number;
  direction: DirectionType;
  haptic_pattern: HapticPatternType;
  warning_level: 'none' | 'caution' | 'danger';
  created_at: string;
}

export interface QRCode {
  id: string;
  navigation_point_id: string;
  code: string;
  qr_image_url?: string;
  scan_count: number;
  last_scanned_at?: string;
  created_at: string;
}

export type ReportType = 'obstacle' | 'closed_door' | 'broken_elevator' | 'maintenance_work' | 'crowded' | 'qr_issue' | 'routing_issue';
export type ReportStatus = 'new' | 'investigating' | 'resolved' | 'rejected';

export interface Report {
  id: string;
  user_id?: string | null;
  report_type: ReportType;
  title: string;
  description: string;
  latitude?: number | null;
  longitude?: number | null;
  navigation_point_id?: string | null;
  building_id?: string | null;
  status: ReportStatus;
  admin_note?: string;
  created_at: string;
  updated_at: string;
}

export type EmergencyStatus = 'new' | 'contacted' | 'arrived' | 'resolved';

export interface EmergencyRequest {
  id: string;
  user_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  nearest_point_id?: string | null;
  nearest_building_id?: string | null;
  message?: string;
  status: EmergencyStatus;
  handled_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RouteSession {
  id: string;
  user_id?: string | null;
  route_id: string;
  started_at: string;
  ended_at?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  current_step: number;
  deviation_count: number;
  completed_successfully: boolean;
}

export interface QRScanLog {
  id: string;
  user_id?: string | null;
  qr_code_id: string;
  scanned_at: string;
  latitude?: number | null;
  longitude?: number | null;
}
