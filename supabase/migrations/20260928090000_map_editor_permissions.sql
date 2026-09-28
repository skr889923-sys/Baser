-- Repair both the original schema and the legacy reset/demo policies without
-- resetting data. Run as the database owner, then use an existing staff account.
begin;

-- Role checks must not query profiles through its own SELECT policies.
create or replace function public.has_profile_role(allowed_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = any(allowed_roles)
  );
$$;
revoke all on function public.has_profile_role(text[]) from public;
grant execute on function public.has_profile_role(text[]) to authenticated;

drop policy if exists "Allow anyone to read profiles" on public.profiles;
drop policy if exists "Allow anyone to insert profiles" on public.profiles;
drop policy if exists "Allow anyone to delete profiles" on public.profiles;
drop policy if exists "Allow profile owners to read their own profile" on public.profiles;
drop policy if exists "Allow profile owners to update their own profile" on public.profiles;
drop policy if exists "Allow system admins and staff to read all profiles" on public.profiles;
create policy "Allow profile owners to read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Allow profile owners to update their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy "Allow system admins and staff to read all profiles" on public.profiles
  for select to authenticated using (public.has_profile_role(
    array['super_admin','university_admin','support_agent','security_staff']));
alter table public.profiles enable row level security;
revoke insert, update, delete on public.profiles from anon;
grant select, update on public.profiles to authenticated;

-- Updating one's contact information must never grant oneself editor access.
-- Role assignments remain a trusted database/server administration operation.
create or replace function public.protect_profile_identity_and_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon','authenticated') and
     (new.id is distinct from old.id or new.role is distinct from old.role) then
    raise exception 'Profile identity and role require trusted administration'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_identity_and_role on public.profiles;
create trigger protect_profile_identity_and_role before update on public.profiles
  for each row execute function public.protect_profile_identity_and_role();

-- Map-editor writes include points, routes, and their generated steps.
-- Remove the known legacy anon-only rules; preserve public read policies.
do $$
declare
  table_name text;
  policy_label text;
begin
  for table_name, policy_label in
    values ('navigation_points','navigation points'), ('routes','routes'), ('route_steps','route steps')
  loop
    execute format('drop policy if exists %I on public.%I', 'Allow anyone to insert ' || policy_label, table_name);
    execute format('drop policy if exists %I on public.%I', 'Allow anyone to update ' || policy_label, table_name);
    execute format('drop policy if exists %I on public.%I', 'Allow anyone to delete ' || policy_label, table_name);
    execute format('drop policy if exists %I on public.%I', 'Allow staff to manage ' || policy_label, table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke insert, update, delete on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated
       using (public.has_profile_role(array[''super_admin'',''university_admin'',''building_manager'']))
       with check (public.has_profile_role(array[''super_admin'',''university_admin'',''building_manager'']))',
      'Allow staff to manage ' || policy_label, table_name);
  end loop;
end;
$$;

commit;
