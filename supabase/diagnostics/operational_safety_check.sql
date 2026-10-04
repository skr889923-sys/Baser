-- READ-ONLY: safe to run in Supabase SQL Editor. No requests or test data created.
-- Presence checks help diagnose setup; they do not prove all policies are correct.
-- Uses catalogs only, so this also works when application tables are missing.
begin transaction read only;
with expected_tables(table_name) as (
  values ('profiles'),('buildings'),('floors'),('navigation_points'),('routes'),('route_steps'),
    ('qr_codes'),('reports'),('emergency_requests'),('route_sessions'),('qr_scan_logs'),
    ('voice_characters'),('voice_recordings')
)
select jsonb_build_object(
  'tables', (
    select jsonb_agg(jsonb_build_object(
      'table',e.table_name,'exists',c.oid is not null,'kind',c.relkind,'rls',c.relrowsecurity,
      'columns',coalesce((select jsonb_agg(jsonb_build_object(
        'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
        'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
        from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'[]'::jsonb),
      'constraints',coalesce((select jsonb_agg(jsonb_build_object(
        'name',conname,'definition',pg_get_constraintdef(oid)) order by conname)
        from pg_constraint where conrelid=c.oid),'[]'::jsonb)
    ) order by e.table_name)
    from expected_tables e left join pg_class c on c.oid=to_regclass(format('public.%I',e.table_name))
  ),
  'other_public_tables', (select coalesce(jsonb_agg(tablename order by tablename),'[]'::jsonb)
    from pg_tables where schemaname='public' and tablename not in (select table_name from expected_tables)),
  'prerequisites_present', jsonb_build_object(
    'map_permissions',to_regprocedure('public.has_profile_role(text[])') is not null,
    'atomic_route_save',to_regprocedure('public.create_route_with_first_step(jsonb,jsonb)') is not null
  ),
  'request_functions_present', jsonb_build_object(
    'receipt',to_regprocedure('public.mobile_request_receipt(text,text)') is not null,
    'submit',to_regprocedure('public.submit_mobile_request(text,text,jsonb)') is not null,
    'cancel',to_regprocedure('public.cancel_mobile_emergency(text)') is not null,
    'qr_scan',to_regprocedure('public.record_qr_scan(text)') is not null
  )
) as diagnostic;
rollback;
