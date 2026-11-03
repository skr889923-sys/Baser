-- Read-only post-deployment check. No account or application records are read.
select p.proname as function_name,
  p.prosecdef as runs_as_owner,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_call,
  has_function_privilege('anon',p.oid,'EXECUTE') as anonymous_can_call,
  exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='emergency_requests' and column_name='admin_note') as emergency_note_ready
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'admin_manage_record','admin_attach_user_profile','get_route_for_edit',
  'save_route_edit','delete_navigation_point')
order by p.proname;
