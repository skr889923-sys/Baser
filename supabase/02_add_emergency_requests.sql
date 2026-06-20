-- Create emergency_requests table
create table if not exists public.emergency_requests (
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

-- Enable RLS
alter table public.emergency_requests enable row level security;

-- Policies for public MVP usage
create policy "Allow anyone to read emergency requests" on public.emergency_requests for select using (true);
create policy "Allow anyone to insert emergency requests" on public.emergency_requests for insert to anon with check (true);
create policy "Allow anyone to update emergency requests" on public.emergency_requests for update to anon using (true) with check (true);
create policy "Allow authenticated to update emergency requests" on public.emergency_requests for update to authenticated using (true) with check (true);

-- Enable Realtime for the table
alter publication supabase_realtime add table public.emergency_requests;
