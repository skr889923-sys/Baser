-- Enable UUID generation extension
create extension if not exists "uuid-ossp";

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

-- Enable RLS for profiles
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
  name_ar text not null,
  name_en text not null,
  route_type text not null check(route_type in ('fastest', 'safe_accessible', 'wheelchair', 'blind_friendly')),
  distance_meters double precision not null,
  estimated_minutes double precision not null,
  has_stairs boolean not null default false,
  has_ramp boolean not null default false,
  wheelchair_accessible boolean not null default true,
  visually_impaired_friendly boolean not null default true,
  status text not null check(status in ('active', 'closed', 'maintenance')) default 'active',
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


----------------- Row Level Security (RLS) Policies -----------------

-- PROFILE POLICIES
create policy "Allow profile owners to read their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Allow profile owners to update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Allow system admins and staff to read all profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'support_agent', 'security_staff')
    )
  );

-- PUBLIC READ-ONLY GEOMETRY POLICIES (Buildings, Floors, Points, Routes, Steps, QRs)
create policy "Allow anyone to read buildings" on public.buildings
  for select using (is_active = true);

create policy "Allow staff to manage buildings" on public.buildings
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'building_manager')
    )
  );

create policy "Allow anyone to read floors" on public.floors
  for select using (true);

create policy "Allow staff to manage floors" on public.floors
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'building_manager')
    )
  );

create policy "Allow anyone to read navigation points" on public.navigation_points
  for select using (is_active = true);

create policy "Allow staff to manage navigation points" on public.navigation_points
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'building_manager')
    )
  );

create policy "Allow anyone to read routes" on public.routes
  for select using (status = 'active' or status = 'maintenance');

create policy "Allow staff to manage routes" on public.routes
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'building_manager')
    )
  );

create policy "Allow anyone to read route steps" on public.route_steps
  for select using (true);

create policy "Allow staff to manage route steps" on public.route_steps
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'building_manager')
    )
  );

create policy "Allow anyone to read qr codes" on public.qr_codes
  for select using (true);

create policy "Allow anyone to update qr scan metadata" on public.qr_codes
  for update using (true) with check (true);

create policy "Allow staff to manage qr codes" on public.qr_codes
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'building_manager')
    )
  );

-- SUBMISSION POLICIES (Reports and Emergency Requests)
create policy "Allow anyone to create reports" on public.reports
  for insert with check (true);

create policy "Allow owners to read their reports" on public.reports
  for select using (auth.uid() = user_id);

create policy "Allow staff to manage and review reports" on public.reports
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'support_agent', 'building_manager')
    )
  );

create policy "Allow anyone to create emergency requests" on public.emergency_requests
  for insert with check (true);

create policy "Allow owners to read their emergency requests" on public.emergency_requests
  for select using (auth.uid() = user_id);

create policy "Allow security and staff to manage emergency requests" on public.emergency_requests
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'security_staff', 'support_agent')
    )
  );

-- LOGGING POLICIES (Sessions, QR Scan Logs)
create policy "Allow owners to read and write route sessions" on public.route_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Allow staff to read all route sessions" on public.route_sessions
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'support_agent')
    )
  );

create policy "Allow authenticated users to write scan logs" on public.qr_scan_logs
  for insert with check (auth.uid() = user_id or user_id is null);

create policy "Allow staff to read scan logs" on public.qr_scan_logs
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'support_agent')
    )
  );

-- VOICEOVER POLICIES
create policy "Allow anyone to read voice characters" on public.voice_characters
  for select using (true);

create policy "Allow staff to manage voice characters" on public.voice_characters
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'building_manager', 'support_agent')
    )
  );

create policy "Allow anyone to read voice recordings" on public.voice_recordings
  for select using (true);

create policy "Allow staff to manage voice recordings" on public.voice_recordings
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'building_manager', 'support_agent')
    )
  );

-- VOICEOVER STORAGE POLICIES
create policy "Allow anyone to read voiceover files" on storage.objects
  for select using (bucket_id = 'voiceovers');

create policy "Allow staff to manage voiceover files" on storage.objects
  for all using (
    bucket_id = 'voiceovers'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'building_manager', 'support_agent')
    )
  )
  with check (
    bucket_id = 'voiceovers'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('super_admin', 'university_admin', 'building_manager', 'support_agent')
    )
  );
