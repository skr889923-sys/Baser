-- Apply after operational_safety. Adds only administrative functions/metadata.
-- No application records are deleted or seeded by this migration.
begin;
do $$ begin
  if not has_table_privilege(current_user,'auth.users','SELECT') or not has_table_privilege(current_user,'auth.users','DELETE') then
    raise exception 'Run this migration as the database owner with Auth administration privileges';
  end if;
end $$;
alter table public.emergency_requests add column if not exists admin_note text not null default '';

create or replace function public.admin_manage_record(target_table text, record_id text, expected jsonb, patch jsonb, remove boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row jsonb; saved jsonb; allowed text[]; key text; assignments text; caller_role text;
begin
  if target_table = 'profiles' then perform pg_advisory_xact_lock(726191031); end if;
  select role into caller_role from public.profiles where id=auth.uid();
  if caller_role is null or caller_role not in ('super_admin','university_admin') then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  allowed:=case target_table
    when 'buildings' then array[]::text[]
    when 'qr_codes' then array['navigation_point_id','code_content','location_description_ar','location_description_en']
    when 'reports' then array['report_type','title','description','status','admin_note']
    when 'emergency_requests' then array['status','admin_note']
    when 'profiles' then array['full_name','phone','role','language']
    when 'voice_characters' then array['name','gender']
    when 'voice_recordings' then array['audio_url']
    when 'campus_networks' then array[]::text[]
    else null end;
  if allowed is null or record_id is null or jsonb_typeof(expected) is distinct from 'object'
    or expected->>'id' is distinct from record_id or remove is null then
    raise exception 'Invalid administrative request' using errcode='22023';
  end if;
  execute format('select to_jsonb(t) from public.%I t where id::text=$1 for update',target_table) into current_row using record_id;
  if current_row is null or not current_row @> expected then raise exception 'Record changed' using errcode='PT409'; end if;
  if target_table='profiles' then
    if remove and record_id=auth.uid()::text then raise exception 'لا يمكن حذف حسابك الحالي.' using errcode='PT422'; end if;
    if not remove and patch ? 'role' and patch->>'role' is distinct from current_row->>'role' and record_id=auth.uid()::text then
      raise exception 'لا يمكن تغيير صلاحية حسابك الحالي.' using errcode='PT422';
    end if;
    if caller_role<>'super_admin' and ((record_id<>auth.uid()::text and (current_row->>'role') in ('super_admin','university_admin'))
      or ((patch->>'role') is distinct from (current_row->>'role') and (patch->>'role') in ('super_admin','university_admin'))) then
      raise exception 'Only system administrators manage administrator accounts' using errcode='42501';
    end if;
  end if;
  if remove then
    if target_table='buildings' then
      perform 1 from public.floors where building_id::text=record_id for update;
    end if;
    if target_table='buildings' and exists(select 1 from public.navigation_points p left join public.floors f on f.id=p.floor_id
      where p.building_id::text=record_id or f.building_id::text=record_id) then
      raise exception 'انقل نقاط المبنى أو احذفها قبل حذف المبنى وطوابقه.' using errcode='PT422';
    end if;
    if target_table='emergency_requests' and current_row->>'status' not in ('resolved','cancelled') then
      raise exception 'أغلق طلب الطوارئ بعد معالجته قبل حذفه.' using errcode='PT422';
    end if;
    if target_table='profiles' then
      -- Auth deletion cascades to the profile and invalidates its sessions.
      -- References with restrictive FKs (e.g. owned storage) fail atomically.
      delete from auth.users where id::text=record_id;
      if exists(select 1 from public.profiles where id::text=record_id) then
        raise exception 'Account deletion was not confirmed' using errcode='PT409';
      end if;
      return jsonb_build_object('id',record_id);
    end if;
    execute format('delete from public.%I where id::text=$1 returning to_jsonb(%I.*)',target_table,target_table) into saved using record_id;
  else
    if jsonb_typeof(patch) is distinct from 'object' or patch='{}'::jsonb then raise exception 'Empty edit' using errcode='22023'; end if;
    for key in select jsonb_object_keys(patch) loop
      if not key=any(allowed) then raise exception 'Field is not editable: %',key using errcode='22023'; end if;
      if key in ('name','full_name','title','description','code_content','location_description_ar','location_description_en','audio_url')
        and nullif(btrim(patch->>key),'') is null then raise exception 'Required text is empty: %',key using errcode='22023'; end if;
    end loop;
    if target_table='voice_recordings' and patch->>'audio_url' !~ '^https://' then raise exception 'HTTPS audio URL required' using errcode='22023'; end if;
    if target_table='emergency_requests' and patch ? 'status' and patch->>'status' is distinct from current_row->>'status' then
      patch:=patch || jsonb_build_object('handled_by',auth.uid());
    end if;
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name=target_table and column_name='updated_at') then
      patch:=patch || jsonb_build_object('updated_at',clock_timestamp());
    end if;
    select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',k,target_table,k),',') into assignments from jsonb_object_keys(patch) k;
    execute format('update public.%I set %s where id::text=$2 returning to_jsonb(%I.*)',target_table,assignments,target_table) into saved using patch,record_id;
  end if;
  if saved is null then raise exception 'Record not found' using errcode='PT409'; end if;
  return saved;
end $$;
revoke all on function public.admin_manage_record(text,text,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.admin_manage_record(text,text,jsonb,jsonb,boolean) to authenticated;

-- Attach a real Auth identity; never create a fabricated profiles.id.
create or replace function public.admin_attach_user_profile(user_email text, user_name text, user_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; identity_id uuid; identities uuid[]; saved public.profiles;
begin
  perform pg_advisory_xact_lock(726191031);
  select role into actor from public.profiles where id=auth.uid();
  if actor is null or actor not in ('super_admin','university_admin') then raise exception 'Administrator access required' using errcode='42501'; end if;
  if actor<>'super_admin' and user_role in ('super_admin','university_admin') then raise exception 'System administrator required' using errcode='42501'; end if;
  if nullif(btrim(user_name),'') is null then raise exception 'Name required' using errcode='22023'; end if;
  select array_agg(id) into identities from auth.users where lower(email)=lower(btrim(user_email));
  if cardinality(identities)>1 then raise exception 'يوجد أكثر من حساب بالبريد نفسه؛ راجع هويات الحسابات قبل إسناد الصلاحية.' using errcode='PT422'; end if;
  identity_id:=identities[1];
  if identity_id is null then raise exception 'أنشئ حساب الدخول أولًا عبر التطبيق، ثم أضف صلاحياته هنا بالبريد نفسه.' using errcode='PT422'; end if;
  insert into public.profiles(id,full_name,email,phone,role) values(identity_id,btrim(user_name),btrim(user_email),'',user_role) returning * into saved;
  return to_jsonb(saved);
end $$;
revoke all on function public.admin_attach_user_profile(text,text,text) from public,anon;
grant execute on function public.admin_attach_user_profile(text,text,text) to authenticated;

create or replace function public.get_route_for_edit(route_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare snapshot jsonb;
begin
  if not public.has_profile_role(array['super_admin','university_admin','building_manager']) then raise exception 'Map editor required' using errcode='42501'; end if;
  select jsonb_build_object('route',to_jsonb(r),'steps',coalesce((select jsonb_agg(to_jsonb(s) order by s.step_order,s.id) from public.route_steps s where s.route_id=r.id),'[]'::jsonb))
    into snapshot from public.routes r where r.id=route_id;
  if snapshot is null then raise exception 'Route not found' using errcode='PT409'; end if;
  return snapshot;
end $$;
revoke all on function public.get_route_for_edit(uuid) from public,anon;
grant execute on function public.get_route_for_edit(uuid) to authenticated;

create or replace function public.save_route_edit(route_id uuid, expected_updated_at timestamptz, expected_steps jsonb, route_data jsonb, steps_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.routes; old_steps jsonb; item jsonb; old_step jsonb; merged jsonb; step_id uuid; previous_end uuid; step_count integer:=0; total double precision:=0; key text; used_ids uuid[]:=array[]::uuid[];
begin
  if not public.has_profile_role(array['super_admin','university_admin','building_manager']) then raise exception 'Map editor required' using errcode='42501'; end if;
  select * into saved from public.routes r where r.id=route_id and r.updated_at=expected_updated_at for update;
  if not found then raise exception 'Route changed' using errcode='PT409'; end if;
  perform 1 from public.route_steps s where s.route_id=save_route_edit.route_id for update;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.step_order,s.id),'[]'::jsonb) into old_steps from public.route_steps s where s.route_id=save_route_edit.route_id;
  if old_steps is distinct from expected_steps then raise exception 'Steps changed' using errcode='PT409'; end if;
  if jsonb_typeof(route_data) is distinct from 'object' or jsonb_typeof(steps_data) is distinct from 'array'
    or jsonb_array_length(steps_data)<1 or nullif(btrim(route_data->>'name_ar'),'') is null or nullif(btrim(route_data->>'name_en'),'') is null
    or (route_data->>'start_point_id') is not distinct from (route_data->>'end_point_id') then raise exception 'Complete route and guidance required' using errcode='22023'; end if;
  previous_end:=(route_data->>'start_point_id')::uuid;
  for item in select value from jsonb_array_elements(steps_data) loop
    if jsonb_typeof(item) is distinct from 'object' then raise exception 'Invalid step' using errcode='22023'; end if;
    for key in select jsonb_object_keys(item) loop
      if not key=any(array['id','from_point_id','to_point_id','instruction_ar','instruction_en','distance_meters','direction','haptic_pattern','warning_level']) then raise exception 'Unknown step field' using errcode='22023'; end if;
    end loop;
    if (item->>'from_point_id')::uuid is distinct from previous_end or item->>'to_point_id' is null or item->>'to_point_id'=item->>'from_point_id'
      or nullif(btrim(item->>'instruction_ar'),'') is null or nullif(btrim(item->>'instruction_en'),'') is null
      or coalesce(item->>'direction','') not in ('straight','left','right','slight_left','slight_right','u_turn','stairs_up','stairs_down','elevator_up','elevator_down')
      or coalesce(item->>'haptic_pattern','') not in ('continue','turn_left','turn_right','warning','arrived','emergency')
      or coalesce(item->>'warning_level','') not in ('none','caution','danger')
      or coalesce((item->>'distance_meters')::double precision,0)<=0 or (item->>'distance_meters')::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Steps must be connected with complete bilingual guidance and positive distances' using errcode='22023';
    end if;
    previous_end:=(item->>'to_point_id')::uuid; total:=total+(item->>'distance_meters')::double precision;
  end loop;
  if previous_end is distinct from (route_data->>'end_point_id')::uuid or abs(total-coalesce((route_data->>'distance_meters')::double precision,0))>0.01
    or coalesce((route_data->>'estimated_minutes')::numeric,0)<1 or (route_data->>'estimated_minutes')::numeric<>trunc((route_data->>'estimated_minutes')::numeric) then
    raise exception 'Endpoints, total distance or duration do not match' using errcode='22023';
  end if;
  update public.routes r set start_point_id=(route_data->>'start_point_id')::uuid,end_point_id=(route_data->>'end_point_id')::uuid,
    name_ar=route_data->>'name_ar',name_en=route_data->>'name_en',route_type=route_data->>'route_type',distance_meters=total,
    estimated_minutes=(route_data->>'estimated_minutes')::integer,has_stairs=(route_data->>'has_stairs')::boolean,has_ramp=(route_data->>'has_ramp')::boolean,
    wheelchair_accessible=(route_data->>'wheelchair_accessible')::boolean,visually_impaired_friendly=(route_data->>'visually_impaired_friendly')::boolean,
    status=route_data->>'status',updated_at=clock_timestamp() where r.id=save_route_edit.route_id returning * into saved;
  delete from public.route_steps s where s.route_id=save_route_edit.route_id;
  delete from public.voice_recordings v using jsonb_array_elements(old_steps) old_step_data
    where v.phrase_key='route_step.'||(old_step_data->>'id')||'.instruction'
      and not exists(select 1 from jsonb_array_elements(steps_data) next_step where next_step->>'id'=old_step_data->>'id'
        and next_step->>'instruction_ar' is not distinct from old_step_data->>'instruction_ar');
  for item in select value from jsonb_array_elements(steps_data) loop
    old_step:=null;
    if item->>'id' is not null then
      select value into old_step from jsonb_array_elements(old_steps) where value->>'id'=item->>'id';
      if old_step is null then raise exception 'Step does not belong to this route' using errcode='22023'; end if;
    end if;
    step_id:=coalesce((old_step->>'id')::uuid,gen_random_uuid());
    if step_id=any(used_ids) then raise exception 'Duplicate step' using errcode='22023'; end if;
    used_ids:=array_append(used_ids,step_id); step_count:=step_count+1;
    merged:=coalesce(old_step,'{}'::jsonb)||item||jsonb_build_object('id',step_id,'route_id',saved.id,'step_order',step_count,'created_at',coalesce(old_step->'created_at',to_jsonb(clock_timestamp())));
    if old_step->>'instruction_ar' is distinct from item->>'instruction_ar' then merged:=merged||'{"audio_url_ar":null}'; end if;
    if old_step->>'instruction_en' is distinct from item->>'instruction_en' then merged:=merged||'{"audio_url_en":null}'; end if;
    insert into public.route_steps select (jsonb_populate_record(null::public.route_steps,merged)).*;
  end loop;
  return public.get_route_for_edit(saved.id);
end $$;
revoke all on function public.save_route_edit(uuid,timestamptz,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_route_edit(uuid,timestamptz,jsonb,jsonb,jsonb) to authenticated;

-- Include the earlier protected point-delete function for installations that
-- skipped its optional October migration.
create or replace function public.delete_navigation_point(point_id uuid, expected_updated_at timestamptz)
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
  if not public.has_profile_role(array['super_admin','university_admin','building_manager']) then raise exception 'Map editor required' using errcode='42501'; end if;
  perform 1 from public.navigation_points p where p.id=point_id and p.updated_at=expected_updated_at for update;
  if not found then raise exception 'Point changed' using errcode='PT409'; end if;
  if exists(select 1 from public.routes r where r.start_point_id=point_id or r.end_point_id=point_id)
    or exists(select 1 from public.route_steps s where s.from_point_id=point_id or s.to_point_id=point_id)
    or exists(select 1 from public.qr_codes q where q.navigation_point_id=point_id) then raise exception 'Point is referenced' using errcode='PT422'; end if;
  delete from public.navigation_points p where p.id=point_id returning p.id into result; return result;
end $$;
revoke all on function public.delete_navigation_point(uuid,timestamptz) from public,anon;
grant execute on function public.delete_navigation_point(uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
