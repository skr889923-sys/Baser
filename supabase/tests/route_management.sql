-- LOCAL TEST ONLY. Run through scripts/test-map-permissions.py, never SQL Editor.
begin;
do $$ begin
  if current_setting('baser.test_database', true) is distinct from 'disposable-local-runner' then
    raise exception 'LOCAL_TEST_ONLY: use the disposable database runner';
  end if;
end $$;

do $$ declare a uuid; b uuid; r uuid; other uuid; version timestamptz; receipt uuid;
  editor_role text; route_status text; affected integer;
begin
  insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
    values('بداية اختبار','Local start','entrance','','','','') returning id into a;
  insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
    values('نهاية اختبار','Local end','entrance','','','','') returning id into b;
  insert into public.routes(start_point_id,end_point_id,name_ar,name_en,route_type,distance_meters,estimated_minutes)
    values(a,b,'مسار آخر','Other route','fastest',20,1) returning id into other;
  insert into public.route_steps(route_id,step_order,from_point_id,to_point_id,instruction_ar,instruction_en,distance_meters,direction,haptic_pattern,warning_level)
    values(other,1,a,b,'تابع','Proceed',20,'straight','continue','none');

  foreach editor_role in array array['super_admin','university_admin','building_manager'] loop
    update public.profiles set role=editor_role where id='00000000-0000-0000-0000-000000000001';
    foreach route_status in array array['active','closed','maintenance'] loop
      insert into public.routes(start_point_id,end_point_id,name_ar,name_en,route_type,distance_meters,estimated_minutes,status)
        values(a,b,'حذف اختبار','Delete fixture','fastest',20,1,route_status) returning id,updated_at into r,version;
      insert into public.route_steps(route_id,step_order,from_point_id,to_point_id,instruction_ar,instruction_en,distance_meters,direction,haptic_pattern,warning_level)
        values(r,1,a,b,'تابع','Proceed',20,'straight','continue','none');
      insert into public.route_sessions(route_id,user_id,status)
        values(r,'00000000-0000-0000-0000-000000000002','in_progress');
      perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
      set local role authenticated;
      delete from public.routes where id=r and updated_at=version - interval '1 second' returning id into receipt;
      if receipt is not null then raise exception 'Stale delete succeeded'; end if;
      if not exists(select 1 from public.route_steps where route_id=r) then
        raise exception 'Failed delete removed guidance';
      end if;
      delete from public.routes where id=r and updated_at=version returning id into receipt;
      if receipt is distinct from r then raise exception 'Editor did not receive deletion receipt'; end if;
      reset role;
      if exists(select 1 from public.routes where id=r)
        or exists(select 1 from public.route_steps where route_id=r)
        or exists(select 1 from public.route_sessions where route_id=r) then
        raise exception 'Parent and dependent rows were not deleted together';
      end if;
      if (select count(*) from public.navigation_points where id in(a,b))<>2
        or not exists(select 1 from public.routes where id=other)
        or not exists(select 1 from public.route_steps where route_id=other) then
        raise exception 'Deleting a route damaged points or another route';
      end if;
    end loop;
  end loop;

  -- Authenticated users have table privileges, but RLS must block non-editors.
  foreach editor_role in array array['student','support_agent','security_staff'] loop
    update public.profiles set role=editor_role where id='00000000-0000-0000-0000-000000000001';
    perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
    set local role authenticated;
    delete from public.routes where id=other returning id into receipt;
    if receipt is not null then raise exception 'Non-editor deleted a route'; end if;
    reset role;
  end loop;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
  set local role authenticated;
  delete from public.routes where id=other;
  get diagnostics affected = row_count;
  if affected<>0 then raise exception 'Missing-profile account deleted a route'; end if;
  reset role;
  set local role anon;
  begin
    delete from public.routes where id=other;
    raise exception 'Anonymous route deletion was allowed';
  exception when insufficient_privilege then null; end;
  reset role;
  if not exists(select 1 from public.routes where id=other)
    or not exists(select 1 from public.route_steps where route_id=other) then
    raise exception 'Denied deletion removed data';
  end if;
end $$;
rollback;
