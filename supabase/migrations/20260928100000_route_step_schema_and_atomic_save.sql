-- Upgrade the deployed legacy route_steps schema without inventing guidance
-- for historical steps. Unknown directions/warnings stay NULL for review.
begin;

alter table public.route_steps add column if not exists direction text;
alter table public.route_steps add column if not exists warning_level text;

alter table public.route_steps drop constraint if exists route_steps_direction_check;
alter table public.route_steps add constraint route_steps_direction_check check
  (direction in ('straight','left','right','slight_left','slight_right','u_turn','stairs_up','stairs_down','elevator_up','elevator_down'));
alter table public.route_steps drop constraint if exists route_steps_warning_level_check;
alter table public.route_steps add constraint route_steps_warning_level_check check
  (warning_level in ('none','caution','danger'));

-- Retain legacy haptic values on old rows; all new editor saves use the
-- application's semantic patterns. Do not reinterpret old vibration signals.
alter table public.route_steps drop constraint if exists route_steps_haptic_pattern_check;
alter table public.route_steps add constraint route_steps_haptic_pattern_check check
  (haptic_pattern in ('none','short','long','double','sos','continue','turn_left','turn_right','warning','arrived','emergency'));

-- One database transaction: failure to insert the step also rolls back the route.
-- SECURITY INVOKER keeps the caller's existing grants and RLS in force.
create or replace function public.create_route_with_first_step(route_data jsonb, step_data jsonb)
returns public.routes language plpgsql security invoker set search_path = '' as $$
declare saved_route public.routes;
begin
  if not public.has_profile_role(array['super_admin','university_admin','building_manager']) then
    raise exception 'Map editor access required' using errcode = '42501';
  end if;
  if jsonb_typeof(route_data) is distinct from 'object' or jsonb_typeof(step_data) is distinct from 'object'
     or nullif(step_data->>'direction','') is null
     or (step_data->>'haptic_pattern') is null
     or (step_data->>'haptic_pattern') not in ('continue','turn_left','turn_right','warning','arrived','emergency')
     or nullif(step_data->>'warning_level','') is null
     or nullif(btrim(step_data->>'instruction_ar'),'') is null
     or nullif(btrim(step_data->>'instruction_en'),'') is null then
    raise exception 'Complete first-step guidance is required' using errcode = '22023';
  end if;
  if (route_data->>'start_point_id') is not distinct from (route_data->>'end_point_id')
     or (route_data->>'distance_meters') is null
     or (route_data->>'distance_meters')::double precision <= 0 then
    raise exception 'Distinct endpoints and a positive distance are required' using errcode = '22023';
  end if;
  insert into public.routes(start_point_id,end_point_id,name_ar,name_en,route_type,distance_meters,estimated_minutes,has_stairs,has_ramp,wheelchair_accessible,visually_impaired_friendly,status)
  values ((route_data->>'start_point_id')::uuid,(route_data->>'end_point_id')::uuid,
    route_data->>'name_ar',route_data->>'name_en',route_data->>'route_type',
    (route_data->>'distance_meters')::double precision,(route_data->>'estimated_minutes')::double precision,
    (route_data->>'has_stairs')::boolean,(route_data->>'has_ramp')::boolean,
    (route_data->>'wheelchair_accessible')::boolean,(route_data->>'visually_impaired_friendly')::boolean,
    route_data->>'status') returning * into saved_route;
  insert into public.route_steps(route_id,step_order,from_point_id,to_point_id,instruction_ar,instruction_en,distance_meters,direction,haptic_pattern,warning_level)
  values (saved_route.id,1,saved_route.start_point_id,saved_route.end_point_id,
    step_data->>'instruction_ar',step_data->>'instruction_en',saved_route.distance_meters,
    step_data->>'direction',step_data->>'haptic_pattern',step_data->>'warning_level');
  return saved_route;
end;
$$;
revoke all on function public.create_route_with_first_step(jsonb,jsonb) from public;
grant execute on function public.create_route_with_first_step(jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
