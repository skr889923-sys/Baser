begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$
declare a uuid; b uuid; r public.routes; payload jsonb; step jsonb; before_count integer;
begin
  insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
  values('أ','Atomic A','entrance','','','','') returning id into a;
  insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
  values('ب','Atomic B','entrance','','','','') returning id into b;
  payload := jsonb_build_object('start_point_id',a,'end_point_id',b,'name_ar','اختبار','name_en','Atomic route',
    'route_type','blind_friendly','distance_meters',20,'estimated_minutes',1,'has_stairs',false,'has_ramp',false,
    'wheelchair_accessible',true,'visually_impaired_friendly',true,'status','active');
  step := '{"instruction_ar":"تابع","instruction_en":"Proceed","direction":"straight","haptic_pattern":"continue","warning_level":"none"}';
  select * into r from public.create_route_with_first_step(payload,step);
  if not exists(select 1 from public.route_steps where route_id=r.id and from_point_id=a and to_point_id=b
    and step_order=1 and direction='straight' and haptic_pattern='continue' and warning_level='none') then
    raise exception 'Complete route save failed';
  end if;
  select count(*) into before_count from public.routes;
  -- This failure happens in the SECOND insert, after a route was inserted.
  begin
    perform public.create_route_with_first_step(payload,step || '{"direction":"invalid"}'::jsonb);
    raise exception 'Invalid step was accepted';
  exception when check_violation then null; end;
  if (select count(*) from public.routes) <> before_count then
    raise exception 'Failed step left an orphan route';
  end if;
  begin
    perform public.create_route_with_first_step(payload,step - 'direction');
    raise exception 'Missing direction was accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.create_route_with_first_step(payload,step || '{"haptic_pattern":"short"}'::jsonb);
    raise exception 'Legacy haptic pattern accepted for new route';
  exception when invalid_parameter_value then null; end;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  begin
    perform public.create_route_with_first_step(payload,step);
    raise exception 'Student created a route';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
begin;
set local role anon;
do $$ begin
  begin
    perform public.create_route_with_first_step('{}','{}');
    raise exception 'Anonymous user executed route creation';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
