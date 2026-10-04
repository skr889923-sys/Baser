-- LOCAL REGRESSION TEST, NOT A MIGRATION. Never paste into Supabase SQL Editor.
-- Run only through scripts/test-map-permissions.py in its disposable cluster.
-- The runner supplies the session marker; all test changes are rolled back.
begin;
do $$ begin
  if current_setting('baser.test_database', true) is distinct from 'disposable-local-runner' then
    raise exception 'LOCAL_TEST_ONLY: use scripts/test-map-permissions.py; this is not a Supabase migration';
  end if;
end $$;

insert into public.navigation_points(id,name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
values('10000000-0000-0000-0000-000000000001','تجربة','Safety fixture','entrance','','','','');
-- Some deployed schemas require location descriptions; supply actual fixture
-- text when those columns exist, without changing constraints or defaults.
do $$ declare field text; columns_sql text := 'id,navigation_point_id,code_content';
  values_sql text := '''20000000-0000-0000-0000-000000000001'',''10000000-0000-0000-0000-000000000001'',''SAFETY-QR''';
begin
  foreach field in array array['location_description_ar','location_description_en'] loop
    if exists(select 1 from information_schema.columns
      where table_schema='public' and table_name='qr_codes' and column_name=field) then
      columns_sql := columns_sql || format(',%I',field);
      values_sql := values_sql || format(',%L',case when field='location_description_ar'
        then 'وصف موقع للاختبار المحلي فقط' else 'Disposable local test location' end);
    end if;
  end loop;
  execute format('insert into public.qr_codes(%s) values(%s)',columns_sql,values_sql);
end $$;

set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$ declare first_receipt jsonb; retry jsonb; report jsonb; t text; begin
  first_receipt:=public.submit_mobile_request('emergency',repeat('a',64),
    '{"message":"Need help","latitude":null,"longitude":null,"status":"resolved","user_id":"00000000-0000-0000-0000-000000000001"}');
  if first_receipt->>'id' is null or first_receipt->>'status'<>'new' or (first_receipt->>'location_available')::boolean then
    raise exception 'No truthful receipt for an unknown location';
  end if;
  retry:=public.submit_mobile_request('emergency',repeat('a',64),'{"message":"Changed payload","latitude":12,"longitude":23}');
  if retry<>first_receipt then raise exception 'Retry changed the request'; end if;
  if public.mobile_request_receipt('emergency',repeat('b',64)) is not null then raise exception 'Wrong token exposed a request'; end if;
  if first_receipt ? 'message' or first_receipt ? 'latitude' or first_receipt ? 'client_token_hash' then
    raise exception 'Receipt leaks sensitive data';
  end if;
  report:=public.submit_mobile_request('report',repeat('b',64),
    '{"report_type":"obstacle","title":"Blocked","description":"Box at entrance","latitude":0,"longitude":0}');
  if report->>'status'<>'new' or not (report->>'location_available')::boolean then raise exception 'Zero coordinate was treated as absent'; end if;
  if public.submit_mobile_request('report',repeat('b',64),'{}')<>report then raise exception 'Report retry duplicated or changed data'; end if;
  foreach t in array array['reports','emergency_requests','qr_scan_logs','route_sessions'] loop
    begin execute format('select count(*) from public.%I',t); raise exception 'Anonymous read succeeded: %',t;
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    update public.qr_codes set navigation_point_id='10000000-0000-0000-0000-000000000001';
    raise exception 'Anonymous QR update succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.emergency_requests(message) values('Direct bypass');
    raise exception 'Direct emergency insertion succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.submit_mobile_request('emergency',repeat('c',64),'{"message":"x","latitude":999,"longitude":0}');
    raise exception 'Invalid GPS accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.submit_mobile_request('emergency',repeat('c',64),'{"message":"x","latitude":1}');
    raise exception 'Half coordinates accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.submit_mobile_request('emergency','short','{"message":"x"}');
    raise exception 'Weak token accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.cancel_mobile_emergency(repeat('c',64));
    raise exception 'Unknown cancellation accepted';
  exception when no_data_found then null; end;
  perform public.record_qr_scan('SAFETY-QR');
  perform public.record_qr_scan('SAFETY-QR');
end $$;
reset role;
do $$ begin
  if (select count(*) from public.emergency_requests where client_token_hash is not null)<>1 then raise exception 'Duplicate emergency'; end if;
  if exists(select 1 from public.emergency_requests where client_token_hash is not null and (user_id is not null or latitude is not null)) then raise exception 'Spoofed owner or location'; end if;
  if (select count(*) from public.reports where client_token_hash is not null)<>1 then raise exception 'Duplicate report'; end if;
  if (select scan_count from public.qr_codes where code_content='SAFETY-QR')<>2 then raise exception 'Lost QR count'; end if;
  if (select count(*) from public.qr_scan_logs where qr_code_id='20000000-0000-0000-0000-000000000001')<>2 then raise exception 'Missing QR logs'; end if;
end $$;

-- Account roles see only their own operational area; students see neither queue.
do $$ declare role_name text; emergency_count integer; report_count integer; changed integer; begin
  foreach role_name in array array['student','building_manager','security_staff','support_agent','university_admin','super_admin'] loop
    update public.profiles set role=role_name where id='00000000-0000-0000-0000-000000000001';
    perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
    set local role authenticated;
    select count(*) into emergency_count from public.emergency_requests;
    select count(*) into report_count from public.reports;
    if (emergency_count>0)<>(role_name in ('security_staff','support_agent','university_admin','super_admin')) then raise exception 'Incorrect emergency access for %',role_name; end if;
    if (report_count>0)<>(role_name in ('building_manager','support_agent','university_admin','super_admin')) then raise exception 'Incorrect report access for %',role_name; end if;
    update public.emergency_requests set status='contacted' where status in ('new','contacted');
    get diagnostics changed=row_count;
    if (changed>0)<>(role_name in ('security_staff','support_agent','university_admin','super_admin')) then raise exception 'Incorrect emergency update for %',role_name; end if;
    update public.reports set status='investigating' where title='Blocked' and status in ('new','investigating');
    get diagnostics changed=row_count;
    if (changed>0)<>(role_name in ('building_manager','support_agent','university_admin','super_admin')) then raise exception 'Incorrect report update for %',role_name; end if;
    begin
      update public.emergency_requests set latitude=0;
      raise exception 'Staff can change submitted coordinates';
    exception when insufficient_privilege then null; end;
    reset role;
  end loop;
end $$;

-- The mobile receipt follows a staff-confirmed report transition. A stale
-- dashboard write must affect zero rows, then a current write may resolve it.
set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
  if public.mobile_request_receipt('report',repeat('b',64))->>'status'<>'investigating' then
    raise exception 'Report acknowledgement not visible to its mobile receipt';
  end if;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare changed integer; begin
  update public.reports set status='rejected' where title='Blocked' and status='new';
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Stale report status update succeeded'; end if;
  update public.reports set status='resolved',updated_at=now() where title='Blocked' and status='investigating';
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Staff report resolution was not confirmed'; end if;
  begin
    update public.reports set description='Changed submission' where title='Blocked';
    raise exception 'Staff can rewrite the submitted report';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$ declare receipt jsonb; begin
  receipt:=public.mobile_request_receipt('report',repeat('b',64));
  if receipt->>'status'<>'resolved' then raise exception 'Report resolution not visible to its mobile receipt'; end if;
  if public.submit_mobile_request('report',repeat('b',64),'{}')<>receipt then
    raise exception 'Report retry changed a resolved report';
  end if;
end $$;
reset role;

-- Exercise actual content writes against both known schema shapes. No invented
-- coordinates in the deployed schema and no updated_at/compound upsert on voice.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare building_id uuid; version timestamptz; changed integer; character uuid; recording uuid; begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='buildings' and column_name='code') then
    insert into public.buildings(name_ar,name_en,code,description_ar,description_en,latitude,longitude,is_active)
      values('مبنى للاختبار المحلي','Local fixture','LOCAL-CONTENT-TEST','','',null,null,true) returning id,updated_at into building_id,version;
  else
    insert into public.buildings(name_ar,name_en,type,description_ar,description_en,latitude,longitude,is_accessible,is_active)
      values('مبنى للاختبار المحلي','Local fixture','college','','',0,0,false,true) returning id,updated_at into building_id,version;
  end if;
  update public.buildings set name_en='Edited local fixture',updated_at=version+interval '1 second'
    where id=building_id and updated_at=version;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Building edit did not return a row'; end if;
  update public.buildings set name_en='Stale edit' where id=building_id and updated_at=version;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Stale building edit succeeded'; end if;
  update public.buildings set is_active=false,updated_at=version+interval '2 seconds'
    where id=building_id and is_active and updated_at=version+interval '1 second';
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Building deactivation not confirmed'; end if;
  insert into public.voice_characters(name,gender) values('شخصية اختبار محلي','female') returning id into character;
  insert into public.voice_recordings(character_id,phrase_key,audio_url)
    values(character,'local.test','https://example.test/local-first.webm') returning id into recording;
  update public.voice_recordings set audio_url='https://example.test/local-confirmed.webm'
    where id=recording and audio_url='https://example.test/local-first.webm';
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Voice replacement not confirmed'; end if;
  update public.voice_recordings set audio_url='https://example.test/local-stale.webm'
    where id=recording and audio_url='https://example.test/local-first.webm';
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Stale voice replacement succeeded'; end if;
end $$;
reset role;
set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
  if exists(select 1 from public.buildings where name_en='Edited local fixture') then
    raise exception 'Disabled building remains publicly visible';
  end if;
  if not exists(select 1 from public.voice_recordings where audio_url='https://example.test/local-confirmed.webm') then
    raise exception 'Published voice is not publicly readable';
  end if;
end $$;
reset role;

set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$ declare receipt jsonb; begin
  receipt:=public.mobile_request_receipt('emergency',repeat('a',64));
  if receipt->>'status'<>'contacted' then raise exception 'Acknowledgement not visible to owner token'; end if;
  receipt:=public.cancel_mobile_emergency(repeat('a',64));
  if receipt->>'status'<>'cancelled' then raise exception 'Cancellation not persisted'; end if;
  if public.cancel_mobile_emergency(repeat('a',64))<>receipt then raise exception 'Cancellation not idempotent'; end if;
  if public.submit_mobile_request('emergency',repeat('a',64),'{"message":"retry"}')->>'status'<>'cancelled' then raise exception 'Retry reopened cancelled request'; end if;
end $$;
reset role;
do $$ begin
  begin
    update public.emergency_requests set status='contacted' where status='cancelled';
    raise exception 'Stale staff action reopened request';
  exception when check_violation then null; end;
  update public.navigation_points set is_active=false where id='10000000-0000-0000-0000-000000000001';
end $$;
set role anon;
do $$ begin
  if exists(select 1 from public.qr_codes where code_content='SAFETY-QR') then raise exception 'Inactive point QR exposed'; end if;
  begin perform public.record_qr_scan('SAFETY-QR'); raise exception 'Inactive point scan logged';
  exception when no_data_found then null; end;
end $$;
reset role;
rollback;
