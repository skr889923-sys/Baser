-- LOCAL TEST ONLY. Run through scripts/test-map-permissions.py, never SQL Editor.
begin;
do $$ begin
  if current_setting('baser.test_database', true) is distinct from 'disposable-local-runner' then
    raise exception 'LOCAL_TEST_ONLY: use the disposable database runner';
  end if;
end $$;

-- Exercise each editor role against inactive points, stale versions and updates.
do $$ declare editor_role text; point_id uuid; version timestamptz; result uuid;
begin
  foreach editor_role in array array['super_admin','university_admin','building_manager'] loop
    update public.profiles set role=editor_role where id='00000000-0000-0000-0000-000000000001';
    perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
    set local role authenticated;
    insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
      values('تجربة محلية','Local fixture','intersection','','','','') returning id,updated_at into point_id,version;
    update public.navigation_points set name_ar='معدلة',is_active=false,updated_at=version + interval '1 second'
      where id=point_id and updated_at=version;
    if not exists(select 1 from public.navigation_points where id=point_id and name_ar='معدلة' and not is_active) then
      raise exception 'Editor failed to update point';
    end if;
    begin
      perform public.delete_navigation_point(point_id,version);
      raise exception 'Stale version deleted point';
    exception when sqlstate 'PT409' then null; end;
    result:=public.delete_navigation_point(point_id,version + interval '1 second');
    if result<>point_id or exists(select 1 from public.navigation_points where id=point_id) then
      raise exception 'Deletion receipt did not match actual deletion';
    end if;
    begin
      perform public.delete_navigation_point(point_id,version + interval '1 second');
      raise exception 'Missing point returned successful deletion';
    exception when sqlstate 'PT409' then null; end;
    reset role;
  end loop;
end $$;

-- Deny every non-editor role, missing profiles and anonymous callers.
do $$ declare denied_role text;
begin
  foreach denied_role in array array['student','support_agent','security_staff'] loop
    update public.profiles set role=denied_role where id='00000000-0000-0000-0000-000000000001';
    perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
    set local role authenticated;
    begin
      perform public.delete_navigation_point(gen_random_uuid(),now());
      raise exception 'Non-editor passed deletion role check';
    exception when insufficient_privilege then null; end;
    reset role;
  end loop;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
  set local role authenticated;
  begin
    perform public.delete_navigation_point(gen_random_uuid(),now());
    raise exception 'Missing profile passed deletion role check';
  exception when insufficient_privilege then null; end;
  reset role;
  set local role anon;
  begin
    perform public.delete_navigation_point(gen_random_uuid(),now());
    raise exception 'Anonymous caller executed deletion RPC';
  exception when insufficient_privilege then null; end;
  reset role;
  update public.profiles set role='university_admin' where id='00000000-0000-0000-0000-000000000001';
end $$;

-- Endpoints, intermediate steps, closed routes and QR references are preserved.
do $$ declare a uuid; b uuid; middle uuid; qr_point uuid; r uuid; target uuid; version timestamptz;
  columns_sql text := 'navigation_point_id,code_content'; values_sql text; field text;
begin
  insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
    values('أ','A','entrance','','','','') returning id into a;
  insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
    values('ب','B','entrance','','','','') returning id into b;
  insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
    values('وسط','Middle','corridor','','','','') returning id into middle;
  insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
    values('رمز','QR','qr_spot','','','','') returning id into qr_point;
  insert into public.routes(start_point_id,end_point_id,name_ar,name_en,route_type,distance_meters,estimated_minutes,status)
    values(a,b,'تجربة','Local route','fastest',10,1,'closed') returning id into r;
  insert into public.route_steps(route_id,step_order,from_point_id,to_point_id,instruction_ar,instruction_en,distance_meters,direction,haptic_pattern,warning_level)
    values(r,1,a,middle,'تابع','Proceed',5,'straight','continue','none'),
      (r,2,middle,b,'تابع','Proceed',5,'straight','continue','none');
  values_sql:=format('%L,%L',qr_point,'POINT-MANAGEMENT-LOCAL');
  foreach field in array array['location_description_ar','location_description_en'] loop
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='qr_codes' and column_name=field) then
      columns_sql:=columns_sql || format(',%I',field);
      values_sql:=values_sql || format(',%L','Local QR test location');
    end if;
  end loop;
  execute format('insert into public.qr_codes(%s) values(%s)',columns_sql,values_sql);

  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  set local role authenticated;
  foreach target in array array[a,b,middle,qr_point] loop
    select p.updated_at into version from public.navigation_points p where p.id=target;
    begin
      perform public.delete_navigation_point(target,version);
      raise exception 'Referenced point was deleted';
    exception when sqlstate 'PT422' then null; end;
  end loop;
  if not exists(select 1 from public.routes where id=r)
    or (select count(*) from public.route_steps where route_id=r)<>2
    or not exists(select 1 from public.qr_codes where navigation_point_id=qr_point) then
    raise exception 'Deletion guard damaged route or QR data';
  end if;
  delete from public.qr_codes where navigation_point_id=qr_point;
  select p.updated_at into version from public.navigation_points p where p.id=qr_point;
  perform public.delete_navigation_point(qr_point,version);
  delete from public.routes where id=r;
  select p.updated_at into version from public.navigation_points p where p.id=middle;
  perform public.delete_navigation_point(middle,version);
  reset role;
end $$;
rollback;
