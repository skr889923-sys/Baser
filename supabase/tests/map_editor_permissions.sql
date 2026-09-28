-- Runs only inside scripts/test-map-permissions.py's disposable cluster.
insert into auth.users values
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003');
insert into public.profiles(id,full_name,email,phone,role)
values ('00000000-0000-0000-0000-000000000002','Student','student@example.test','','student');

-- All existing editor roles can create a point, including INSERT RETURNING.
do $$
declare editor_role text; point_id uuid;
begin
  foreach editor_role in array array['super_admin','university_admin','building_manager'] loop
    update public.profiles set role=editor_role where id='00000000-0000-0000-0000-000000000001';
    perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
    set local role authenticated;
    insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
    values ('نقطة','Point','entrance','','','','') returning id into point_id;
    update public.navigation_points set is_active=false where id=point_id;
    if not exists(select 1 from public.navigation_points where id=point_id and not is_active) then
      raise exception 'Editor cannot update/read an inactive point';
    end if;
    delete from public.navigation_points where id=point_id;
    if exists(select 1 from public.navigation_points where id=point_id) then
      raise exception 'Editor cannot delete a point';
    end if;
    reset role;
  end loop;
end $$;

-- The complete map save: two points, a route, and its generated step.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$
declare first_point uuid; second_point uuid; saved_route uuid;
begin
  insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
  values ('بداية','Start','entrance','','','','') returning id into first_point;
  insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
  values ('نهاية','End','entrance','','','','') returning id into second_point;
  insert into public.routes(start_point_id,end_point_id,name_ar,name_en,route_type,distance_meters,estimated_minutes,has_stairs,has_ramp)
  values(first_point,second_point,'مسار','Route','blind_friendly',20,1,false,false) returning id into saved_route;
  insert into public.route_steps(route_id,step_order,from_point_id,to_point_id,instruction_ar,instruction_en,distance_meters,direction,haptic_pattern,warning_level)
  values(saved_route,1,first_point,second_point,'تابع','Proceed',20,'straight','continue','none');
  if (select count(*) from public.route_steps where route_id=saved_route) <> 1 then
    raise exception 'Map route step was not saved';
  end if;
end $$;
rollback;

-- Deny students and authenticated accounts with no profile.
do $$
declare subject text; target_table text; affected integer;
begin
  foreach subject in array array['00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003'] loop
    perform set_config('request.jwt.claim.sub',subject,true);
    set local role authenticated;
    foreach target_table in array array['navigation_points','routes','route_steps'] loop
      if public.has_profile_role(array['super_admin','university_admin','building_manager']) then
        raise exception 'Unauthorized user passed editor role check';
      end if;
      -- Copy a real point so validation errors cannot mask RLS denial.
      if target_table='navigation_points' then
        begin
          insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
          values ('مرفوض','Denied','entrance','','','','');
          raise exception 'Unauthorized point insertion succeeded';
        exception when insufficient_privilege then null;
        end;
      end if;
      execute format('delete from public.%I',target_table);
      get diagnostics affected = row_count;
      if affected <> 0 then raise exception 'Unauthorized deletion succeeded'; end if;
    end loop;
    reset role;
  end loop;
end $$;

-- An owner can update contact information, but cannot become an editor.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$ begin
  update public.profiles set phone='123' where id=auth.uid();
  if not exists(select 1 from public.profiles where id=auth.uid() and phone='123') then
    raise exception 'Owner contact update failed';
  end if;
  begin
    update public.profiles set role='super_admin' where id=auth.uid();
    raise exception 'Self-promotion succeeded';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'Student can read other profiles';
  end if;
end $$;
rollback;

-- Anonymous map writes and anonymous role/profile creation remain forbidden.
begin;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  perform count(*) from public.navigation_points;
  begin
    insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
    values ('مرفوض','Denied','entrance','','','','');
    raise exception 'Anonymous point insertion succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.profiles(id,full_name,email,phone,role)
    values('00000000-0000-0000-0000-000000000003','Impostor','impostor@example.test','','super_admin');
    raise exception 'Anonymous admin profile creation succeeded';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
