-- Apply after the September map-permission/atomic-route migrations.
-- Replaces policies only on Baseera-owned tables; does not delete user data.
-- This is the deployment file. supabase/tests/*.sql are LOCAL TESTS ONLY.
begin;

-- Check every dependency before changing schema or policies. An older
-- deployment may have only part of the original init migration. The known
-- missing operational tables/visibility column are created below; unknown
-- differences need a schema review, not reset.
do $$
declare dependency record; relation_id regclass; field text; problems text[] := array[]::text[];
begin
  for dependency in select * from (values
    ('public','profiles',array['id','role']),
    ('public','buildings',array['id','is_active']),
    ('public','floors',array['building_id']),
    ('public','navigation_points',array['id','is_active']),
    ('public','routes',array['id','status']),
    ('public','route_steps',array['route_id']),
    ('public','qr_codes',array['id','navigation_point_id','code_content']),
    ('public','reports',array['id','user_id','report_type','title','description','latitude','longitude',
      'navigation_point_id','building_id','status','admin_note','created_at','updated_at']),
    ('public','emergency_requests',array['id','user_id','latitude','longitude','message','status',
      'handled_by','created_at','updated_at']),
    ('public','route_sessions',array['user_id']),
    ('public','qr_scan_logs',array['qr_code_id','user_id']),
    ('public','voice_characters',array['id']),
    ('public','voice_recordings',array['id']),
    ('storage','objects',array['bucket_id'])
  ) as requirements(schema_name,table_name,columns_needed) loop
    relation_id := to_regclass(format('%I.%I',dependency.schema_name,dependency.table_name));
    if relation_id is null then
      if dependency.schema_name <> 'public' or dependency.table_name not in ('reports','route_sessions','qr_scan_logs') then
        problems := array_append(problems,format('missing table %I.%I',dependency.schema_name,dependency.table_name));
      end if;
      continue;
    end if;
    if not exists(select 1 from pg_class where oid=relation_id and relkind in ('r','p')) then
      problems := array_append(problems,format('%I.%I is not a table',dependency.schema_name,dependency.table_name));
      continue;
    end if;
    foreach field in array dependency.columns_needed loop
      if not exists(select 1 from pg_attribute where attrelid=relation_id and attname=field
        and attnum>0 and not attisdropped) then
        if not(dependency.schema_name='public' and dependency.table_name='buildings' and field='is_active') then
          problems := array_append(problems,format('missing column %I.%I.%I',dependency.schema_name,dependency.table_name,field));
        end if;
      end if;
    end loop;
  end loop;
  -- Anonymous requests and unknown locations must remain representable. Also
  -- reject required legacy fields that the RPC payload cannot supply, before
  -- installing functions that would only fail when a real user submits.
  for dependency in select * from (values
    ('reports',array['user_id','report_type','title','description','latitude','longitude','client_token_hash','status'],
      array['user_id','latitude','longitude']),
    ('emergency_requests',array['user_id','latitude','longitude','message','client_token_hash','status'],
      array['user_id','latitude','longitude']),
    ('qr_scan_logs',array['qr_code_id','user_id'],array['user_id'])
  ) as submissions(table_name,supplied_columns,nullable_columns) loop
    relation_id := to_regclass(format('public.%I',dependency.table_name));
    for field in select a.attname from pg_attribute a
      where a.attrelid=relation_id and a.attnum>0 and not a.attisdropped and a.attnotnull
        and a.attgenerated='' and a.attidentity=''
        and not(a.attname=any(dependency.supplied_columns))
        and not exists(select 1 from pg_attrdef d where d.adrelid=a.attrelid and d.adnum=a.attnum)
    loop
      problems := array_append(problems,format('required column without RPC value/default: public.%I.%I',dependency.table_name,field));
    end loop;
    for field in select attname from pg_attribute where attrelid=relation_id
      and attnum>0 and not attisdropped and attnotnull and attname=any(dependency.nullable_columns)
    loop
      problems := array_append(problems,format('anonymous/unknown-location requests require nullable column: public.%I.%I',dependency.table_name,field));
    end loop;
  end loop;
  if to_regprocedure('public.has_profile_role(text[])') is null then
    problems := array_append(problems,'missing prerequisite: 20260928090000_map_editor_permissions.sql');
  end if;
  if to_regprocedure('auth.uid()') is null then
    problems := array_append(problems,'missing Supabase auth.uid()');
  end if;
  if cardinality(problems)>0 then
    raise exception using errcode='P0001', message='SCHEMA_PREFLIGHT_FAILED: ' || array_to_string(problems,'; '),
      hint='Run supabase/diagnostics/operational_safety_check.sql and review all differences before retrying. Do not reset the database.';
  end if;
end $$;

-- Match the existing schema's lack of a building visibility filter. This is
-- an administrative display flag, not a claim of accessibility/route safety.
alter table public.buildings add column if not exists is_active boolean not null default true;

-- Some deployed databases never created reports. Add the empty application
-- table with its canonical constraints; leave existing tables and rows intact.
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  report_type text not null check(report_type in ('obstacle','closed_door','broken_elevator',
    'maintenance_work','crowded','qr_issue','routing_issue')),
  title text not null,
  description text not null,
  latitude double precision,
  longitude double precision,
  navigation_point_id uuid references public.navigation_points(id) on delete set null,
  building_id uuid references public.buildings(id) on delete set null,
  status text not null default 'new' check(status in ('new','investigating','resolved','rejected')),
  admin_note text,
  created_at timestamp with time zone not null default timezone('utc'::text,now()),
  updated_at timestamp with time zone not null default timezone('utc'::text,now())
);
alter table public.reports enable row level security;

create table if not exists public.route_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  route_id uuid references public.routes(id) on delete cascade not null,
  started_at timestamp with time zone not null default timezone('utc'::text,now()),
  ended_at timestamp with time zone,
  status text not null default 'in_progress' check(status in ('in_progress','completed','abandoned')),
  current_step integer not null default 0,
  deviation_count integer not null default 0,
  completed_successfully boolean not null default false
);
alter table public.route_sessions enable row level security;

create table if not exists public.qr_scan_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  qr_code_id uuid references public.qr_codes(id) on delete cascade not null,
  scanned_at timestamp with time zone not null default timezone('utc'::text,now()),
  latitude double precision,
  longitude double precision
);
alter table public.qr_scan_logs enable row level security;

-- Legacy deployed QR tables require bilingual descriptions but lack scan
-- telemetry. Preserve their constraints and text. On schemas without these
-- descriptions, existing rows remain NULL until staff supply real descriptions.
alter table public.qr_codes add column if not exists location_description_ar text;
alter table public.qr_codes add column if not exists location_description_en text;
alter table public.qr_codes add column if not exists scan_count integer not null default 0;
alter table public.qr_codes add column if not exists last_scanned_at timestamp with time zone;

alter table public.emergency_requests add column if not exists client_token_hash text;
alter table public.reports add column if not exists client_token_hash text;
create unique index if not exists emergency_client_token on public.emergency_requests(client_token_hash);
create unique index if not exists report_client_token on public.reports(client_token_hash);
alter table public.emergency_requests drop constraint if exists emergency_requests_status_check;
alter table public.emergency_requests add constraint emergency_requests_status_check
  check (status in ('new','contacted','arrived','resolved','cancelled'));

-- Operational queues do not require exposing every user's full profile.
drop policy if exists "Allow system admins and staff to read all profiles" on public.profiles;
create policy "Allow system admins and staff to read all profiles" on public.profiles
  for select to authenticated using(public.has_profile_role(array['super_admin','university_admin']));

-- Clear permissive demo policies. A restrictive new policy alone would not
-- override an existing permissive one (Postgres combines them with OR).
do $$ declare p record; t text; begin
  for p in select tablename, policyname from pg_policies where schemaname='public'
    and tablename in ('buildings','floors','navigation_points','routes','route_steps',
      'qr_codes','reports','emergency_requests','route_sessions','qr_scan_logs',
      'voice_characters','voice_recordings')
  loop execute format('drop policy %I on public.%I',p.policyname,p.tablename); end loop;
  foreach t in array array['buildings','floors','navigation_points','routes','route_steps',
    'qr_codes','reports','emergency_requests','route_sessions','qr_scan_logs','voice_characters','voice_recordings']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
  end loop;
end $$;

-- Geometry remains public; only active points may become QR starting positions.
create policy public_buildings on public.buildings for select to anon,authenticated using(is_active);
create policy public_floors on public.floors for select to anon,authenticated using(
  exists(select 1 from public.buildings b where b.id=building_id and b.is_active));
create policy public_points on public.navigation_points for select to anon,authenticated using(is_active);
create policy public_routes on public.routes for select to anon,authenticated using(status='active');
create policy public_steps on public.route_steps for select to anon,authenticated using(
  exists(select 1 from public.routes r where r.id=route_id and r.status='active'));
create policy public_qrs on public.qr_codes for select to anon,authenticated using(
  exists(select 1 from public.navigation_points p where p.id=navigation_point_id and p.is_active));
do $$ declare t text; begin
  foreach t in array array['buildings','floors','navigation_points','routes','route_steps','qr_codes'] loop
    execute format('grant select on public.%I to anon,authenticated',t);
    execute format('grant insert,update,delete on public.%I to authenticated',t);
    execute format('create policy map_editors on public.%I for all to authenticated
      using(public.has_profile_role(array[''super_admin'',''university_admin'',''building_manager'']))
      with check(public.has_profile_role(array[''super_admin'',''university_admin'',''building_manager'']))',t);
  end loop;
end $$;

grant select on public.reports,public.emergency_requests to authenticated;
grant update(status,admin_note,updated_at) on public.reports to authenticated;
grant update(status,updated_at) on public.emergency_requests to authenticated;
create policy report_staff_read on public.reports for select to authenticated using(
  public.has_profile_role(array['super_admin','university_admin','building_manager','support_agent']));
create policy report_staff_update on public.reports for update to authenticated using(
  public.has_profile_role(array['super_admin','university_admin','building_manager','support_agent']))
  with check(public.has_profile_role(array['super_admin','university_admin','building_manager','support_agent']));
create policy emergency_staff_read on public.emergency_requests for select to authenticated using(
  public.has_profile_role(array['super_admin','university_admin','security_staff','support_agent']));
create policy emergency_staff_update on public.emergency_requests for update to authenticated using(
  public.has_profile_role(array['super_admin','university_admin','security_staff','support_agent']))
  with check(public.has_profile_role(array['super_admin','university_admin','security_staff','support_agent']));

grant select,insert,update on public.route_sessions to authenticated;
create policy session_owner on public.route_sessions for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy session_staff_read on public.route_sessions for select to authenticated using(
  public.has_profile_role(array['super_admin','university_admin','support_agent']));
grant select on public.qr_scan_logs to authenticated;
create policy scan_staff_read on public.qr_scan_logs for select to authenticated using(
  public.has_profile_role(array['super_admin','university_admin','support_agent']));

do $$ declare t text; begin
  foreach t in array array['voice_characters','voice_recordings'] loop
    execute format('grant select on public.%I to anon,authenticated',t);
    execute format('grant insert,update,delete on public.%I to authenticated',t);
    execute format('create policy public_voices on public.%I for select to anon,authenticated using(true)',t);
    execute format('create policy voice_editors on public.%I for all to authenticated
      using(public.has_profile_role(array[''super_admin'',''university_admin'',''building_manager'',''support_agent'']))
      with check(public.has_profile_role(array[''super_admin'',''university_admin'',''building_manager'',''support_agent'']))',t);
  end loop;
end $$;
drop policy if exists "Allow anyone to upload voiceover files" on storage.objects;
drop policy if exists "Allow anyone to update voiceover files" on storage.objects;
drop policy if exists "Allow staff to manage voiceover files" on storage.objects;
create policy "Allow staff to manage voiceover files" on storage.objects for all to authenticated
  using(bucket_id='voiceovers' and public.has_profile_role(array['super_admin','university_admin','building_manager','support_agent']))
  with check(bucket_id='voiceovers' and public.has_profile_role(array['super_admin','university_admin','building_manager','support_agent']));

-- Tokens are random 256-bit client capabilities. Only their SHA-256 hashes are
-- stored. Receipt RPCs never return coordinates, messages or another request.
create or replace function public.mobile_request_receipt(request_kind text, request_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare token_hash text; receipt jsonb;
begin
  if request_token is null or request_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid request token' using errcode='22023';
  end if;
  token_hash:=encode(sha256(convert_to(request_token,'UTF8')),'hex');
  if request_kind='emergency' then
    select jsonb_build_object('id',id,'status',status,'created_at',created_at,'updated_at',updated_at,
      'location_available',latitude is not null and longitude is not null)
      into receipt from public.emergency_requests where client_token_hash=token_hash;
  elsif request_kind='report' then
    select jsonb_build_object('id',id,'status',status,'created_at',created_at,'updated_at',updated_at,
      'location_available',latitude is not null and longitude is not null)
      into receipt from public.reports where client_token_hash=token_hash;
  else raise exception 'Invalid request kind' using errcode='22023'; end if;
  return receipt;
end $$;

create or replace function public.submit_mobile_request(request_kind text, request_token text, request_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare token_hash text; receipt jsonb; lat double precision; lon double precision; owner_id uuid;
begin
  receipt:=public.mobile_request_receipt(request_kind,request_token);
  if receipt is not null then return receipt; end if;
  if request_data is null or jsonb_typeof(request_data)<>'object' then
    raise exception 'Invalid request data' using errcode='22023';
  end if;
  lat:=(request_data->>'latitude')::double precision;
  lon:=(request_data->>'longitude')::double precision;
  if (lat is null)<>(lon is null) or (lat is not null and not(lat between -90 and 90 and lon between -180 and 180)) then
    raise exception 'Invalid coordinates' using errcode='22023';
  end if;
  token_hash:=encode(sha256(convert_to(request_token,'UTF8')),'hex');
  select id into owner_id from public.profiles where id=auth.uid();
  if request_kind='emergency' then
    if length(btrim(coalesce(request_data->>'message','')))=0 or length(request_data->>'message')>2000 then
      raise exception 'Invalid emergency message' using errcode='22023';
    end if;
    insert into public.emergency_requests(user_id,latitude,longitude,message,client_token_hash,status)
      values(owner_id,lat,lon,request_data->>'message',token_hash,'new')
      on conflict(client_token_hash) do nothing;
  else
    if length(btrim(coalesce(request_data->>'title','')))=0 or length(request_data->>'title')>200
      or length(btrim(coalesce(request_data->>'description','')))=0 or length(request_data->>'description')>4000 then
      raise exception 'Invalid report text' using errcode='22023';
    end if;
    insert into public.reports(user_id,report_type,title,description,latitude,longitude,client_token_hash,status)
      values(owner_id,request_data->>'report_type',request_data->>'title',request_data->>'description',lat,lon,token_hash,'new')
      on conflict(client_token_hash) do nothing;
  end if;
  return public.mobile_request_receipt(request_kind,request_token);
end $$;

create or replace function public.cancel_mobile_emergency(request_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt jsonb;
begin
  receipt:=public.mobile_request_receipt('emergency',request_token);
  if receipt is null then raise exception 'Request not found' using errcode='P0002'; end if;
  update public.emergency_requests set status='cancelled',updated_at=now()
    where client_token_hash=encode(sha256(convert_to(request_token,'UTF8')),'hex')
      and status in ('new','contacted','arrived');
  return public.mobile_request_receipt('emergency',request_token);
end $$;

-- Cancelled/resolved requests cannot be silently reopened by a stale dashboard.
create or replace function public.check_emergency_transition()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.status in ('resolved','cancelled') and new.status<>old.status then
    raise exception 'Request is already closed' using errcode='23514';
  end if;
  if (old.status='contacted' and new.status='new') or
     (old.status='arrived' and new.status in ('new','contacted')) then
    raise exception 'Request status cannot move backwards' using errcode='23514';
  end if;
  if new.status<>old.status then
    new.updated_at:=now();
    if current_user='authenticated' then new.handled_by:=auth.uid(); end if;
  end if;
  return new;
end $$;
drop trigger if exists emergency_transition on public.emergency_requests;
create trigger emergency_transition before update on public.emergency_requests
  for each row execute function public.check_emergency_transition();

-- Atomic scan logging replaces public UPDATE access to the QR binding itself.
create or replace function public.record_qr_scan(qr_content text)
returns void language plpgsql security definer set search_path='' as $$
declare qr_id uuid; owner_id uuid;
begin
  if qr_content is null or length(qr_content)>512 then raise exception 'Invalid QR' using errcode='22023'; end if;
  select q.id into qr_id from public.qr_codes q join public.navigation_points p on p.id=q.navigation_point_id
    where q.code_content=qr_content and p.is_active;
  if qr_id is null then raise exception 'QR unavailable' using errcode='P0002'; end if;
  select id into owner_id from public.profiles where id=auth.uid();
  insert into public.qr_scan_logs(qr_code_id,user_id) values(qr_id,owner_id);
  update public.qr_codes set scan_count=scan_count+1,last_scanned_at=now() where id=qr_id;
end $$;

revoke all on function public.mobile_request_receipt(text,text),public.submit_mobile_request(text,text,jsonb),
  public.cancel_mobile_emergency(text),public.record_qr_scan(text) from public;
grant execute on function public.mobile_request_receipt(text,text),public.submit_mobile_request(text,text,jsonb),
  public.cancel_mobile_emergency(text),public.record_qr_scan(text) to anon,authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='emergency_requests') then
    alter publication supabase_realtime add table public.emergency_requests;
  end if;
end $$;
notify pgrst,'reload schema';
commit;
