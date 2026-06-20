-- DROP OLD TABLES TO RESET SCHEMA
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
  code text not null unique,
  description_ar text,
  description_en text,
  latitude double precision,
  longitude double precision,
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
  distance_meters double precision not null,
  instruction_ar text not null,
  instruction_en text not null,
  audio_url_ar text,
  audio_url_en text,
  haptic_pattern text check(haptic_pattern in ('none', 'short', 'long', 'double', 'sos')) default 'none',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.route_steps enable row level security;

-- 7. qr_codes table
create table public.qr_codes (
  id uuid default gen_random_uuid() primary key,
  code_content text not null unique,
  navigation_point_id uuid references public.navigation_points(id) on delete set null,
  location_description_ar text not null,
  location_description_en text not null,
  physical_placement_ar text,
  physical_placement_en text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.qr_codes enable row level security;

-- SECURITY POLICIES (Bypassing RLS for Anon to allow local admin testing)
create policy "Allow anyone to read navigation points" on public.navigation_points for select using (true);
create policy "Allow anyone to insert navigation points" on public.navigation_points for insert to anon with check (true);

create policy "Allow anyone to read routes" on public.routes for select using (true);
create policy "Allow anyone to insert routes" on public.routes for insert to anon with check (true);

create policy "Allow anyone to read route steps" on public.route_steps for select using (true);
create policy "Allow anyone to insert route steps" on public.route_steps for insert to anon with check (true);

-- 8. emergency_requests table
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

-- Enable Realtime for the table
alter publication supabase_realtime add table public.emergency_requests;
