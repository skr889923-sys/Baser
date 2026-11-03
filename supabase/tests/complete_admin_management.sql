-- LOCAL TEST ONLY. The runner rolls back every fixture and role change.
begin;
do $$ begin
  if current_setting('baser.test_database',true) is distinct from 'disposable-local-runner' then raise exception 'LOCAL_TEST_ONLY'; end if;
end $$;

do $$ declare a uuid; b uuid; r uuid; s uuid; snapshot jsonb; edited jsonb; payload jsonb; actor text;
begin
  update public.profiles set role='super_admin' where id='00000000-0000-0000-0000-000000000001';
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
    values('أ','Admin A','entrance','','','','') returning id into a;
  insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
    values('ب','Admin B','entrance','','','','') returning id into b;
  insert into public.routes(start_point_id,end_point_id,name_ar,name_en,route_type,distance_meters,estimated_minutes)
    values(a,b,'مسار','Route','fastest',10,1) returning id into r;
  insert into public.route_steps(route_id,step_order,from_point_id,to_point_id,instruction_ar,instruction_en,distance_meters,direction,haptic_pattern,warning_level)
    values(r,1,a,b,'تابع','Proceed',10,'straight','continue','none') returning id into s;
  set local role authenticated;
  snapshot:=public.get_route_for_edit(r);
  payload:=(snapshot->'steps'->0)-array['route_id','step_order','created_at','audio_url_ar','audio_url_en'];
  edited:=public.save_route_edit(r,(snapshot->'route'->>'updated_at')::timestamptz,snapshot->'steps',
    snapshot->'route'||'{"name_ar":"مسار معدل","distance_meters":12,"estimated_minutes":2}',
    jsonb_build_array(payload||'{"instruction_ar":"انعطف يسارًا","direction":"left","haptic_pattern":"turn_left","distance_meters":12}'));
  if edited->'route'->>'name_ar'<>'مسار معدل' or edited->'steps'->0->>'id'<>s::text
    or edited->'steps'->0->>'instruction_ar'<>'انعطف يسارًا' then raise exception 'Route/step edit or identity retention failed'; end if;
  begin
    perform public.save_route_edit(r,(snapshot->'route'->>'updated_at')::timestamptz,snapshot->'steps',snapshot->'route',snapshot->'steps');
    raise exception 'Stale route edit succeeded';
  exception when sqlstate 'PT409' then null; end;
  snapshot:=edited;
  payload:=(snapshot->'steps'->0)-array['route_id','step_order','created_at','audio_url_ar','audio_url_en'];
  -- A late failure after UPDATE/DELETE must restore the route and all steps.
  begin
    perform public.save_route_edit(r,(snapshot->'route'->>'updated_at')::timestamptz,snapshot->'steps',snapshot->'route',
      jsonb_build_array(payload||jsonb_build_object('id',gen_random_uuid())));
    raise exception 'Foreign step identity was accepted';
  exception when invalid_parameter_value then null; end;
  if public.get_route_for_edit(r)<>snapshot then raise exception 'Failed save partially changed route or guidance'; end if;
  begin
    perform public.save_route_edit(r,(snapshot->'route'->>'updated_at')::timestamptz,snapshot->'steps',snapshot->'route',
      jsonb_build_array(payload||jsonb_build_object('from_point_id',b)));
    raise exception 'Disconnected steps accepted';
  exception when invalid_parameter_value then null; end;
  reset role;
  -- Changing a step outside the editor must still invalidate the snapshot.
  update public.route_steps set instruction_en='Concurrent editor' where id=s;
  set local role authenticated;
  begin
    perform public.save_route_edit(r,(snapshot->'route'->>'updated_at')::timestamptz,snapshot->'steps',snapshot->'route',snapshot->'steps');
    raise exception 'Concurrent step change was overwritten';
  exception when sqlstate 'PT409' then null; end;
  reset role;
  foreach actor in array array['student','support_agent','security_staff'] loop
    update public.profiles set role=actor where id='00000000-0000-0000-0000-000000000001';
    set local role authenticated;
    begin perform public.get_route_for_edit(r); raise exception 'Non-editor opened route editor'; exception when insufficient_privilege then null; end;
    begin perform public.admin_manage_record('reports','anything','{}',null,true); raise exception 'Non-admin reached management'; exception when insufficient_privilege then null; end;
    reset role;
  end loop;
end $$;

do $$ declare c uuid; result jsonb; previous jsonb; request_id uuid; identity uuid; role_name text;
begin
  update public.profiles set role='super_admin' where id='00000000-0000-0000-0000-000000000001';
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  insert into public.voice_characters(name,gender) values('Local voice','female') returning id into c;
  select to_jsonb(v) into previous from public.voice_characters v where id=c;
  set local role authenticated;
  result:=public.admin_manage_record('voice_characters',c::text,previous,'{"name":"Edited voice","gender":"male"}',false);
  if result->>'name'<>'Edited voice' then raise exception 'Voice edit failed'; end if;
  begin perform public.admin_manage_record('voice_characters',c::text,previous,null,true); raise exception 'Stale delete succeeded'; exception when sqlstate 'PT409' then null; end;
  begin perform public.admin_manage_record('voice_characters',c::text,result,'{"id":"forged"}',false); raise exception 'Identity mutation accepted'; exception when invalid_parameter_value then null; end;
  result:=public.admin_manage_record('voice_characters',c::text,result,null,true);
  if exists(select 1 from public.voice_characters where id=c) then raise exception 'Delete failed'; end if;
  begin perform public.admin_manage_record('auth.users','x','{"id":"x"}',null,true); raise exception 'Arbitrary table accepted'; exception when invalid_parameter_value then null; end;
  reset role;

  insert into public.emergency_requests(message,status) values('Local active request','new') returning id into request_id;
  select to_jsonb(e) into previous from public.emergency_requests e where id=request_id;
  set local role authenticated;
  begin perform public.admin_manage_record('emergency_requests',request_id::text,previous,null,true); raise exception 'Active emergency deleted'; exception when sqlstate 'PT422' then null; end;
  result:=public.admin_manage_record('emergency_requests',request_id::text,previous,'{"admin_note":"Responded","status":"resolved"}',false);
  if result->>'handled_by'<>auth.uid()::text then raise exception 'Responder identity not recorded'; end if;
  begin perform public.admin_manage_record('emergency_requests',request_id::text,result,'{"status":"new"}',false); raise exception 'Closed request reopened'; exception when check_violation then null; end;
  perform public.admin_manage_record('emergency_requests',request_id::text,result,null,true);
  reset role;

  identity:=gen_random_uuid(); insert into auth.users(id,email) values(identity,'admin-local-fixture@example.test');
  set local role authenticated;
  result:=public.admin_attach_user_profile('admin-local-fixture@example.test','Local account','student');
  if result->>'id'<>identity::text then raise exception 'Fabricated identity created'; end if;
  result:=public.admin_manage_record('profiles',identity::text,result,'{"role":"building_manager","full_name":"Edited account"}',false);
  perform public.admin_manage_record('profiles',identity::text,result,null,true);
  begin
    select to_jsonb(p) into previous from public.profiles p where id=auth.uid();
    perform public.admin_manage_record('profiles',auth.uid()::text,previous,null,true); raise exception 'Self deletion succeeded';
  exception when sqlstate 'PT422' then null; end;
  begin perform public.admin_manage_record('profiles',auth.uid()::text,previous,'{"role":"student"}',false); raise exception 'Self demotion succeeded'; exception when sqlstate 'PT422' then null; end;
  reset role;
  if exists(select 1 from auth.users where id=identity) or exists(select 1 from public.profiles where id=identity) then raise exception 'Account remains after deletion'; end if;
  update public.profiles set role='university_admin' where id='00000000-0000-0000-0000-000000000001';
  select to_jsonb(p) into previous from public.profiles p where id='00000000-0000-0000-0000-000000000002';
  set local role authenticated;
  begin perform public.admin_manage_record('profiles',previous->>'id',previous,'{"role":"super_admin"}',false); raise exception 'University admin escalated role'; exception when insufficient_privilege then null; end;
  reset role;
end $$;
do $$ declare a uuid; b uuid; q uuid; v uuid; recording uuid; report_id uuid; record jsonb; result jsonb; columns_sql text; values_sql text; field text;
begin
  update public.profiles set role='super_admin' where id='00000000-0000-0000-0000-000000000001';
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='buildings' and column_name='code') then
    insert into public.buildings(name_ar,name_en,code) values('مبنى اختبار','Test building','MANAGEMENT-TEST') returning id into b;
  else
    insert into public.buildings(name_ar,name_en,description_ar,description_en,type,latitude,longitude) values('مبنى اختبار','Test building','','','college',1,2) returning id into b;
  end if;
  insert into public.navigation_points(building_id,name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
    values(b,'نقطة','Point','entrance','','','','') returning id into a;
  select to_jsonb(t) into record from public.buildings t where id=b;
  set local role authenticated;
  begin perform public.admin_manage_record('buildings',b::text,record,null,true); raise exception 'Occupied building deleted'; exception when sqlstate 'PT422' then null; end;
  reset role;
  update public.navigation_points set building_id=null where id=a;
  set local role authenticated;
  perform public.admin_manage_record('buildings',b::text,record,null,true);
  reset role;
  columns_sql:='navigation_point_id,code_content,location_description_ar,location_description_en';
  values_sql:=format('%L,%L,%L,%L',a,'MANAGEMENT-QR','مكان محلي','Local fixture');
  execute format('insert into public.qr_codes(%s) values(%s) returning id',columns_sql,values_sql) into q;
  select to_jsonb(t) into record from public.qr_codes t where id=q;
  set local role authenticated;
  result:=public.admin_manage_record('qr_codes',q::text,record,'{"code_content":"MANAGEMENT-QR-EDITED","location_description_ar":"معدل"}',false);
  if result->>'code_content'<>'MANAGEMENT-QR-EDITED' then raise exception 'QR edit failed'; end if;
  perform public.admin_manage_record('qr_codes',q::text,result,null,true);
  reset role;
  insert into public.reports(report_type,title,description) values('obstacle','Local report','Description') returning id into report_id;
  select to_jsonb(t) into record from public.reports t where id=report_id;
  set local role authenticated;
  result:=public.admin_manage_record('reports',report_id::text,record,'{"title":"Edited report","admin_note":"Reviewed","status":"resolved"}',false);
  if result->>'title'<>'Edited report' then raise exception 'Report edit failed'; end if;
  perform public.admin_manage_record('reports',report_id::text,result,null,true);
  reset role;
  insert into public.voice_characters(name,gender) values('Local speaker','female') returning id into v;
  insert into public.voice_recordings(character_id,phrase_key,audio_url) values(v,'local.test','https://example.test/old.webm') returning id into recording;
  select to_jsonb(t) into record from public.voice_recordings t where id=recording;
  set local role authenticated;
  result:=public.admin_manage_record('voice_recordings',recording::text,record,'{"audio_url":"https://example.test/new.webm"}',false);
  if result->>'audio_url'<>'https://example.test/new.webm' then raise exception 'Recording edit failed'; end if;
  perform public.admin_manage_record('voice_recordings',recording::text,result,null,true);
  reset role;
  insert into public.campus_networks(id,document) values('management_test_network',
    '{"id":"management_test_network","schema_version":1,"revision":1,"fixture":true,"nodes":{"fixture":true,"features":[{}]},"edges":{"fixture":true,"features":[{}]},"buildings":{"fixture":true,"features":[{}]}}');
  select to_jsonb(t) into record from public.campus_networks t where id='management_test_network';
  set local role authenticated;
  perform public.admin_manage_record('campus_networks','management_test_network',record,null,true);
  reset role;
end $$;
set local role anon;
do $$ begin
  begin perform public.admin_manage_record('reports','x','{}',null,true); raise exception 'Anonymous management allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
