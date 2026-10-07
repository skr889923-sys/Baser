-- Apply after the map-editor permissions and operational-safety migrations.
-- Existing point FKs cascade into routes, individual steps and QR scan history.
-- Lock the point before checking references so concurrent FK inserts cannot
-- attach a route/QR between the check and delete. Keep RLS in force.
begin;

create or replace function public.delete_navigation_point(point_id uuid, expected_updated_at timestamptz)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare deleted_id uuid;
begin
  if not public.has_profile_role(array['super_admin','university_admin','building_manager']) then
    raise exception 'Map editor access required' using errcode = '42501';
  end if;

  perform 1 from public.navigation_points p
    where p.id = point_id and p.updated_at = expected_updated_at for update;
  if not found then
    raise exception 'Point changed or no longer exists' using errcode = 'PT409';
  end if;

  if exists(select 1 from public.routes r where r.start_point_id = point_id or r.end_point_id = point_id)
    or exists(select 1 from public.route_steps s where s.from_point_id = point_id or s.to_point_id = point_id)
    or exists(select 1 from public.qr_codes q where q.navigation_point_id = point_id) then
    raise exception 'Point is referenced by a route or QR code' using errcode = 'PT422';
  end if;

  delete from public.navigation_points p where p.id = point_id returning p.id into deleted_id;
  return deleted_id;
end;
$$;
revoke all on function public.delete_navigation_point(uuid,timestamptz) from public, anon;
grant execute on function public.delete_navigation_point(uuid,timestamptz) to authenticated;

notify pgrst, 'reload schema';

commit;
