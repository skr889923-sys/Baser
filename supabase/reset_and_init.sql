-- DROP OLD TABLES TO RESET SCHEMA
drop table if exists public.voice_recordings cascade;
drop table if exists public.voice_characters cascade;
drop table if exists public.qr_scan_logs cascade;
drop table if exists public.route_sessions cascade;
drop table if exists public.emergency_requests cascade;
drop table if exists public.reports cascade;
drop table if exists public.route_steps cascade;
drop table if exists public.routes cascade;
drop table if exists public.qr_codes cascade;
drop table if exists public.navigation_points cascade;
drop table if exists public.floors cascade;
drop table if exists public.buildings cascade;
drop table if exists public.profiles cascade;

-- 1. profiles table (maps to Supabase Auth users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text not null,
  email text not null,
  phone text not null,
  role text not null check(role in ('super_admin', 'university_admin', 'building_manager', 'support_agent', 'security_staff', 'student')) default 'student',
  disability_type text,
  emergency_contact_name text,
  emergency_contact_phone text,
  language text not null default 'ar' check(language in ('ar', 'en')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.profiles enable row level security;

-- 2. buildings table
create table public.buildings (
  id uuid default gen_random_uuid() primary key,
  name_ar text not null,
  name_en text not null,
  description_ar text not null,
  description_en text not null,
  type text not null check(type in ('college', 'deanship', 'service', 'administration', 'library', 'restaurant', 'dormitory', 'parking')),
  latitude double precision not null,
  longitude double precision not null,
  address_text text,
  is_accessible boolean not null default true,
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.buildings enable row level security;

-- 3. floors table
create table public.floors (
  id uuid default gen_random_uuid() primary key,
  building_id uuid references public.buildings(id) on delete cascade not null,
  floor_number integer not null,
  name_ar text not null,
  name_en text not null,
  map_image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.floors enable row level security;

-- 4. navigation_points table
create table public.navigation_points (
  id uuid default gen_random_uuid() primary key,
  building_id uuid references public.buildings(id) on delete set null,
  floor_id uuid references public.floors(id) on delete set null,
  name_ar text not null,
  name_en text not null,
  type text not null check(type in ('entrance', 'exit', 'elevator', 'stairs', 'ramp', 'corridor', 'intersection', 'restroom', 'office', 'hall', 'qr_spot', 'hazard')),
  latitude double precision,
  longitude double precision,
  indoor_x double precision,
  indoor_y double precision,
  description_ar text not null,
  description_en text not null,
  audio_instruction_ar text not null,
  audio_instruction_en text not null,
  is_accessible boolean not null default true,
  is_hazard boolean not null default false,
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.navigation_points enable row level security;

-- 5. routes table
create table public.routes (
  id uuid default gen_random_uuid() primary key,
  start_point_id uuid references public.navigation_points(id) on delete cascade not null,
  end_point_id uuid references public.navigation_points(id) on delete cascade not null,
  route_type text not null check(route_type in ('fastest', 'safe_accessible', 'wheelchair', 'blind_friendly')) default 'fastest',
  distance_meters double precision not null,
  estimated_minutes integer not null,
  name_ar text,
  name_en text,
  status text not null check(status in ('active', 'closed', 'maintenance')) default 'active',
  has_stairs boolean not null default false,
  has_ramp boolean not null default false,
  wheelchair_accessible boolean not null default false,
  visually_impaired_friendly boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.routes enable row level security;

-- 6. route_steps table
create table public.route_steps (
  id uuid default gen_random_uuid() primary key,
  route_id uuid references public.routes(id) on delete cascade not null,
  step_order integer not null,
  from_point_id uuid references public.navigation_points(id) on delete cascade not null,
  to_point_id uuid references public.navigation_points(id) on delete cascade not null,
  instruction_ar text not null,
  instruction_en text not null,
  distance_meters double precision not null,
  direction text not null check(direction in ('straight', 'left', 'right', 'slight_left', 'slight_right', 'u_turn', 'stairs_up', 'stairs_down', 'elevator_up', 'elevator_down')),
  haptic_pattern text not null check(haptic_pattern in ('continue', 'turn_left', 'turn_right', 'warning', 'arrived', 'emergency')),
  warning_level text not null check(warning_level in ('none', 'caution', 'danger')) default 'none',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.route_steps enable row level security;

-- 7. qr_codes table
create table public.qr_codes (
  id uuid default gen_random_uuid() primary key,
  navigation_point_id uuid references public.navigation_points(id) on delete cascade not null,
  code_content text not null unique,
  qr_image_url text,
  scan_count integer not null default 0,
  last_scanned_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.qr_codes enable row level security;

-- 8. reports table
create table public.reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  report_type text not null check(report_type in ('obstacle', 'closed_door', 'broken_elevator', 'maintenance_work', 'crowded', 'qr_issue', 'routing_issue')),
  title text not null,
  description text not null,
  latitude double precision,
  longitude double precision,
  navigation_point_id uuid references public.navigation_points(id) on delete set null,
  building_id uuid references public.buildings(id) on delete set null,
  status text not null check(status in ('new', 'investigating', 'resolved', 'rejected')) default 'new',
  admin_note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.reports enable row level security;

-- SECURITY POLICIES (Bypassing RLS for Anon to allow local admin testing)
create policy "Allow anyone to read profiles" on public.profiles for select using (true);
create policy "Allow anyone to insert profiles" on public.profiles for insert to anon with check (true);
create policy "Allow anyone to delete profiles" on public.profiles for delete to anon using (true);

create policy "Allow anyone to read buildings" on public.buildings for select using (true);
create policy "Allow anyone to insert buildings" on public.buildings for insert to anon with check (true);
create policy "Allow anyone to update buildings" on public.buildings for update to anon using (true) with check (true);

create policy "Allow anyone to read floors" on public.floors for select using (true);
create policy "Allow anyone to insert floors" on public.floors for insert to anon with check (true);

create policy "Allow anyone to read navigation points" on public.navigation_points for select using (true);
create policy "Allow anyone to insert navigation points" on public.navigation_points for insert to anon with check (true);
create policy "Allow anyone to update navigation points" on public.navigation_points for update to anon using (true) with check (true);

create policy "Allow anyone to read routes" on public.routes for select using (true);
create policy "Allow anyone to insert routes" on public.routes for insert to anon with check (true);
create policy "Allow anyone to update routes" on public.routes for update to anon using (true) with check (true);

create policy "Allow anyone to read route steps" on public.route_steps for select using (true);
create policy "Allow anyone to insert route steps" on public.route_steps for insert to anon with check (true);

create policy "Allow anyone to read qr codes" on public.qr_codes for select using (true);
create policy "Allow anyone to insert qr codes" on public.qr_codes for insert to anon with check (true);
create policy "Allow anyone to update qr codes" on public.qr_codes for update to anon using (true) with check (true);
create policy "Allow anyone to delete qr codes" on public.qr_codes for delete to anon using (true);

create policy "Allow anyone to read reports" on public.reports for select using (true);
create policy "Allow anyone to insert reports" on public.reports for insert to anon with check (true);
create policy "Allow anyone to update reports" on public.reports for update to anon using (true) with check (true);

-- 9. emergency_requests table
create table public.emergency_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  latitude double precision,
  longitude double precision,
  nearest_point_id uuid references public.navigation_points(id) on delete set null,
  nearest_building_id uuid references public.buildings(id) on delete set null,
  message text,
  status text not null check(status in ('new', 'contacted', 'arrived', 'resolved')) default 'new',
  handled_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.emergency_requests enable row level security;

create policy "Allow anyone to read emergency requests" on public.emergency_requests for select using (true);
create policy "Allow anyone to insert emergency requests" on public.emergency_requests for insert to anon with check (true);
create policy "Allow anyone to update emergency requests" on public.emergency_requests for update to anon using (true) with check (true);

-- 10. route_sessions table
create table public.route_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  route_id uuid references public.routes(id) on delete cascade not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone,
  status text not null check(status in ('in_progress', 'completed', 'abandoned')) default 'in_progress',
  current_step integer not null default 0,
  deviation_count integer not null default 0,
  completed_successfully boolean not null default false
);
alter table public.route_sessions enable row level security;

-- 11. qr_scan_logs table
create table public.qr_scan_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  qr_code_id uuid references public.qr_codes(id) on delete cascade not null,
  scanned_at timestamp with time zone default timezone('utc'::text, now()) not null,
  latitude double precision,
  longitude double precision
);
alter table public.qr_scan_logs enable row level security;

-- 12. voice_characters table
create table public.voice_characters (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  gender text not null check(gender in ('female', 'male')) default 'female',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.voice_characters enable row level security;

-- 13. voice_recordings table
create table public.voice_recordings (
  id uuid default gen_random_uuid() primary key,
  character_id uuid references public.voice_characters(id) on delete cascade not null,
  phrase_key text not null,
  audio_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(character_id, phrase_key)
);
alter table public.voice_recordings enable row level security;

insert into storage.buckets (id, name, public)
values ('voiceovers', 'voiceovers', true)
on conflict (id) do nothing;

create policy "Allow anyone to read route sessions" on public.route_sessions for select using (true);
create policy "Allow anyone to insert route sessions" on public.route_sessions for insert to anon with check (true);
create policy "Allow anyone to read qr scan logs" on public.qr_scan_logs for select using (true);
create policy "Allow anyone to insert qr scan logs" on public.qr_scan_logs for insert to anon with check (true);
create policy "Allow anyone to read voice characters" on public.voice_characters for select using (true);
create policy "Allow anyone to insert voice characters" on public.voice_characters for insert to anon with check (true);
create policy "Allow anyone to read voice recordings" on public.voice_recordings for select using (true);
create policy "Allow anyone to insert voice recordings" on public.voice_recordings for insert to anon with check (true);
create policy "Allow anyone to update voice recordings" on public.voice_recordings for update to anon using (true) with check (true);
create policy "Allow anyone to read voiceover files" on storage.objects for select using (bucket_id = 'voiceovers');
create policy "Allow anyone to upload voiceover files" on storage.objects for insert to anon with check (bucket_id = 'voiceovers');
create policy "Allow anyone to update voiceover files" on storage.objects for update to anon using (bucket_id = 'voiceovers') with check (bucket_id = 'voiceovers');

-- Enable Realtime for the table
alter publication supabase_realtime add table public.emergency_requests;
