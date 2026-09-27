-- Versioned survey snapshots. Drafts and fixtures never appear in public mobile reads.
begin;

create table public.campus_networks (
  id text primary key check (id ~ '^[a-zA-Z0-9_-]+$'),
  revision integer not null default 1 check (revision > 0),
  document jsonb not null,
  is_published boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  check (document->>'id' = id),
  check ((document->>'schema_version')::integer = 1),
  check ((document->>'revision')::integer = revision)
);

-- SECURITY DEFINER avoids recursive profiles RLS during this narrowly scoped role lookup.
create function public.can_manage_campus_networks() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid()
    and p.role in ('super_admin', 'university_admin', 'building_manager'));
$$;
revoke all on function public.can_manage_campus_networks() from public;
grant execute on function public.can_manage_campus_networks() to authenticated;

create function public.check_campus_network_write() returns trigger
language plpgsql set search_path = '' as $$
declare
  group_name text;
  feature jsonb;
  p jsonb;
  entries jsonb;
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id then raise exception 'Network id is immutable'; end if;
    if new.revision <> old.revision + 1 then raise exception 'Network revision must increment by one'; end if;
  elsif new.revision <> 1 then
    raise exception 'New networks start at revision one';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  if jsonb_typeof(new.document) is distinct from 'object'
    or new.document->>'id' is distinct from new.id
    or new.document->>'schema_version' is distinct from '1'
    or new.document->>'revision' is distinct from new.revision::text
    or jsonb_typeof(new.document->'fixture') is distinct from 'boolean'
  then raise exception 'Invalid network identity or schema'; end if;

  foreach group_name in array array['nodes','edges','buildings'] loop
    entries := new.document->group_name->'features';
    if jsonb_typeof(entries) is distinct from 'array' then raise exception 'Invalid feature collection %', group_name; end if;
    if jsonb_array_length(entries) = 0 then raise exception 'Empty feature collection %', group_name; end if;
    if new.document->group_name->'fixture' is distinct from new.document->'fixture' then raise exception 'Mixed fixture markers'; end if;
  end loop;

  if new.is_published then
    if new.document->'fixture' is distinct from 'false'::jsonb then raise exception 'Fixture publication forbidden'; end if;
    foreach group_name in array array['nodes','edges'] loop
      for feature in select value from jsonb_array_elements(new.document->group_name->'features') loop
        p := feature->'properties';
        if p->>'survey_status' is distinct from 'verified'
          or nullif(trim(p->>'survey_source'), '') is null
          or nullif(trim(p->>'surveyed_by'), '') is null
          or nullif(p->>'surveyed_at', '') is null
          or nullif(p->>'valid_until', '') is null
          or (p->>'surveyed_at')::timestamptz > now()
          or (p->>'valid_until')::timestamptz <= now()
          or (p->>'valid_until')::timestamptz <= (p->>'surveyed_at')::timestamptz
        then raise exception 'Current field evidence required for %', p->>'id'; end if;
        if jsonb_typeof(p->'photo_refs') is distinct from 'array' then raise exception 'Photo references required'; end if;
        if jsonb_array_length(p->'photo_refs') = 0 then raise exception 'Photo references required'; end if;
        if coalesce(p->>'status','unknown') not in ('active','closed','maintenance') then raise exception 'Availability must be checked'; end if;
        if p->>'status' in ('closed','maintenance') and
          (nullif(trim(p->>'closure_reason'), '') is null or nullif(p->>'closed_at', '') is null)
        then raise exception 'Closure reason and time required'; end if;
        if group_name = 'edges' then
          if jsonb_typeof(p->'steps') is distinct from 'number'
            or jsonb_typeof(p->'width_m') is distinct from 'number'
          then raise exception 'Steps and width must be measured'; end if;
          if (p->>'steps')::numeric < 0 or (p->>'steps')::numeric <> trunc((p->>'steps')::numeric)
            or (p->>'width_m')::numeric <= 0 then raise exception 'Invalid measurements'; end if;
          if (p->>'steps')::numeric = 0 and (jsonb_typeof(p->'incline_pct') is distinct from 'number'
            or (p->>'incline_pct')::numeric < 0) then raise exception 'Grade must be measured'; end if;
          if nullif(trim(p->'guidance_forward'->>'instruction_ar'), '') is null
            or nullif(trim(p->'guidance_forward'->>'instruction_en'), '') is null
          then raise exception 'Forward guidance required'; end if;
          if p->'oneway' is distinct from 'true'::jsonb and
            (nullif(trim(p->'guidance_reverse'->>'instruction_ar'), '') is null
              or nullif(trim(p->'guidance_reverse'->>'instruction_en'), '') is null)
          then raise exception 'Reverse guidance required'; end if;
        end if;
      end loop;
    end loop;
  end if;
  return new;
end;
$$;
create trigger check_campus_network_write before insert or update on public.campus_networks
  for each row execute function public.check_campus_network_write();

alter table public.campus_networks enable row level security;
create policy "Published networks are readable" on public.campus_networks for select
  to anon, authenticated using (is_published = true);
create policy "Survey editors manage network snapshots" on public.campus_networks for all
  to authenticated using (public.can_manage_campus_networks()) with check (public.can_manage_campus_networks());
grant select on public.campus_networks to anon, authenticated;
grant insert, update, delete on public.campus_networks to authenticated;

commit;
