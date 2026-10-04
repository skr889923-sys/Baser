-- READ-ONLY: run only after confirming navigation_points and qr_codes exist.
-- A matching id is a review candidate, never authorization to delete its row.
begin transaction read only;
select jsonb_build_object(
  'navigation_point',exists(select 1 from public.navigation_points
    where id='10000000-0000-0000-0000-000000000001'),
  'qr_code',exists(select 1 from public.qr_codes
    where id='20000000-0000-0000-0000-000000000001')
) as known_test_ids_present;
rollback;
