#!/usr/bin/env python3
"""Exercise map-editor RLS in disposable local PostgreSQL; never use project credentials."""
import argparse
import concurrent.futures
import json
import pathlib
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--baseline', choices=['reset', 'init'], default='reset')
parser.add_argument('--migration', type=pathlib.Path)
parser.add_argument('--legacy-route-steps', action='store_true')
parser.add_argument('--legacy-qr-schema', action='store_true')
parser.add_argument('--missing-reports', action='store_true')
parser.add_argument('--deployed-schema', action='store_true',
                    help='Reproduce the legacy column shapes and missing tables reported on 2026-10-04')
parser.add_argument('--route-migration', type=pathlib.Path)
parser.add_argument('--safety-migration', type=pathlib.Path)
parser.add_argument('--point-migration', type=pathlib.Path)
args = parser.parse_args()
if args.deployed_schema:
    args.legacy_qr_schema = True
    args.legacy_route_steps = True
    args.missing_reports = True
if args.missing_reports and not args.safety_migration:
    parser.error('--missing-reports requires --safety-migration')
for executable in ('initdb', 'pg_ctl', 'psql'):
    if not shutil.which(executable):
        raise SystemExit(f'{executable} is required')

bootstrap = """
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean);
create table storage.objects(id uuid primary key, bucket_id text);
alter table storage.objects enable row level security;
create publication supabase_realtime;
alter default privileges in schema public grant all on tables to anon, authenticated;
"""
fixtures = """
insert into auth.users values ('00000000-0000-0000-0000-000000000001');
insert into public.profiles(id,full_name,email,phone,role)
values ('00000000-0000-0000-0000-000000000001','Editor','editor@example.test','','university_admin');
"""
editor_insert = """
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into public.navigation_points
  (name_ar,name_en,type,latitude,longitude,description_ar,description_en,audio_instruction_ar,audio_instruction_en,is_accessible,is_hazard,is_active)
values ('نقطة اختبار','Test point','entrance',30.622971,32.269073,'وصف','Description','','',true,false,true)
returning id;
"""
baseline = ROOT / ('supabase/reset_and_init.sql' if args.baseline == 'reset' else 'supabase/migrations/20260620090000_init.sql')
with tempfile.TemporaryDirectory(prefix='baser-map-rls-') as tmp:
    cluster = str(pathlib.Path(tmp) / 'cluster')
    subprocess.run(['initdb','-D',cluster,'-A','trust','-U','postgres','--no-locale','--encoding=UTF8'], check=True, capture_output=True)
    started = False
    try:
        subprocess.run(['pg_ctl','-D',cluster,'-l',str(pathlib.Path(tmp)/'server.log'),'-o',f"-k {tmp} -h '' -p 55440",'-w','start'], check=True, capture_output=True)
        started = True
        command = ['psql','-X','-h',tmp,'-p','55440','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q']
        phases = [('bootstrap',bootstrap),('baseline',baseline.read_text()),('fixtures',fixtures)]
        diagnostic_sql = (ROOT / 'supabase/diagnostics/operational_safety_check.sql').read_text()
        phases.insert(1, ('schema diagnostics without application tables', diagnostic_sql))
        if args.deployed_schema:
            # These transformations occur ONLY in the disposable cluster. They
            # model the provided schema; they are not deployment instructions.
            phases.append(('reported building, route and voice column shapes', '''
              alter table public.buildings drop column type;
              alter table public.buildings drop column address_text;
              alter table public.buildings drop column is_accessible;
              alter table public.buildings drop column is_active cascade;
              alter table public.buildings add column code text not null;
              alter table public.buildings alter column description_ar drop not null;
              alter table public.buildings alter column description_en drop not null;
              alter table public.buildings alter column latitude drop not null;
              alter table public.buildings alter column longitude drop not null;
              insert into public.buildings(id,name_ar,name_en,code)
                values('40000000-0000-0000-0000-000000000099','مبنى قائم','Existing building','EXISTING');
              alter table public.routes alter column estimated_minutes type integer using estimated_minutes::integer;
              alter table public.routes alter column route_type set default 'fastest';
              alter table public.routes alter column name_ar drop not null;
              alter table public.routes alter column name_en drop not null;
              alter table public.routes alter column wheelchair_accessible set default false;
              alter table public.voice_characters alter column gender drop default;
              alter table public.voice_characters add column is_active boolean default true;
              alter table public.voice_characters alter column created_at drop not null;
              alter table public.voice_recordings alter column character_id drop not null;
              alter table public.voice_recordings alter column created_at drop not null;
              alter table public.voice_recordings drop column updated_at;
              drop table public.route_sessions;
              drop table public.qr_scan_logs;
            '''))
        if args.legacy_qr_schema:
            phases.append(('deployed QR schema with required descriptions', '''
              alter table public.qr_codes drop column qr_image_url;
              alter table public.qr_codes drop column scan_count;
              alter table public.qr_codes drop column last_scanned_at;
              alter table public.qr_codes alter column navigation_point_id drop not null;
              alter table public.qr_codes add column location_description_ar text not null;
              alter table public.qr_codes add column location_description_en text not null;
              alter table public.qr_codes add column physical_placement_ar text;
              alter table public.qr_codes add column physical_placement_en text;
              insert into public.qr_codes(id,code_content,location_description_ar,location_description_en,
                physical_placement_ar,physical_placement_en)
              values('20000000-0000-0000-0000-000000000099','LEGACY-RETAINED','وصف قائم','Existing description',
                'موضع قائم','Existing placement');
            '''))
        if args.legacy_route_steps:
            phases.append(('deployed legacy route schema', '''
              alter table public.route_steps drop column direction;
              alter table public.route_steps drop column warning_level;
              alter table public.route_steps add column audio_url_ar text;
              alter table public.route_steps add column audio_url_en text;
              alter table public.route_steps alter column haptic_pattern drop not null;
              alter table public.route_steps alter column haptic_pattern set default 'none';
              alter table public.route_steps drop constraint route_steps_haptic_pattern_check;
              alter table public.route_steps add constraint route_steps_haptic_pattern_check
                check(haptic_pattern in ('none','short','long','double','sos'));
              do $$ declare a uuid; b uuid; r uuid; begin
                insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
                values('أ','Legacy A','entrance','','','','') returning id into a;
                insert into public.navigation_points(name_ar,name_en,type,description_ar,description_en,audio_instruction_ar,audio_instruction_en)
                values('ب','Legacy B','entrance','','','','') returning id into b;
                insert into public.routes(start_point_id,end_point_id,name_ar,name_en,route_type,distance_meters,estimated_minutes,has_stairs,has_ramp)
                values(a,b,'قديم','Legacy retained route','fastest',10,1,false,false) returning id into r;
                insert into public.route_steps(route_id,step_order,from_point_id,to_point_id,instruction_ar,instruction_en,distance_meters,haptic_pattern,audio_url_ar)
                values(r,1,a,b,'تعليمات قديمة','Legacy retained step',10,'short','https://example.test/audio.mp3');
              end $$;
            '''))
        if args.migration:
            phases.append(('fix',args.migration.read_text()))
        if args.route_migration:
            phases.append(('route schema fix',args.route_migration.read_text()))
            phases.append(('route schema idempotence',args.route_migration.read_text()))
        phases.append(('authenticated map editor inserts a point',editor_insert))
        if args.migration:
            phases.append(('idempotent reapplication',args.migration.read_text()))
            phases.append(('role and full map-save regressions',(ROOT / 'supabase/tests/map_editor_permissions.sql').read_text()))
        if args.route_migration:
            phases.append(('atomic route saving',(ROOT / 'supabase/tests/atomic_route_save.sql').read_text()))
            if args.legacy_route_steps:
                phases.append(('historical data preserved', '''
                  do $$ begin
                    if not exists(select 1 from public.route_steps where instruction_en='Legacy retained step'
                      and direction is null and warning_level is null and haptic_pattern='short'
                      and audio_url_ar='https://example.test/audio.mp3') then
                      raise exception 'Legacy guidance was lost or fabricated';
                    end if;
                  end $$;
                '''))
        if args.safety_migration:
            if args.missing_reports:
                phases.append(('deployed schema without reports', 'drop table public.reports;'))
            else:
                phases.append(('historical report fixture', '''
                  insert into public.reports(id,user_id,report_type,title,description,latitude,longitude,status,admin_note)
                  values('30000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000001',
                    'maintenance_work','Existing report','Existing description',12,23,'investigating','Existing note');
                '''))
            phases.append(('schema diagnostics before repair', diagnostic_sql))
            phases.append(('operational safety migration', args.safety_migration.read_text()))
            if args.legacy_qr_schema:
                phases.append(('legacy QR accepts new scan telemetry', '''
                  do $$ begin
                    if not exists(select 1 from public.qr_codes where code_content='LEGACY-RETAINED'
                      and scan_count=0 and last_scanned_at is null) then
                      raise exception 'Missing initial QR telemetry';
                    end if;
                  end $$;
                  update public.qr_codes set scan_count=7,last_scanned_at='2026-10-01T12:00:00Z'
                    where code_content='LEGACY-RETAINED';
                '''))
            phases.append(('operational safety idempotence', args.safety_migration.read_text()))
            if args.deployed_schema:
                phases.append(('reported legacy data and new operational tables preserved', '''
                  do $$ begin
                    if not exists(select 1 from public.buildings where id='40000000-0000-0000-0000-000000000099'
                      and code='EXISTING' and name_ar='مبنى قائم' and name_en='Existing building'
                      and description_ar is null and description_en is null and latitude is null
                      and longitude is null and is_active) then
                      raise exception 'Legacy building data lost or fabricated';
                    end if;
                    if exists(select 1 from public.reports) or exists(select 1 from public.route_sessions)
                      or exists(select 1 from public.qr_scan_logs) then
                      raise exception 'Migration inserted operational test data';
                    end if;
                    if (select count(*) from pg_class where oid in ('public.reports'::regclass,
                      'public.route_sessions'::regclass,'public.qr_scan_logs'::regclass) and relrowsecurity)<>3 then
                      raise exception 'Missing RLS on newly created operational tables';
                    end if;
                  end $$;
                '''))
            if not args.missing_reports:
                phases.append(('historical report preserved', '''
                  do $$ begin
                    if not exists(select 1 from public.reports where id='30000000-0000-0000-0000-000000000099'
                      and user_id='00000000-0000-0000-0000-000000000001' and report_type='maintenance_work'
                      and title='Existing report' and description='Existing description' and latitude=12
                      and longitude=23 and status='investigating' and admin_note='Existing note'
                      and client_token_hash is null) then
                      raise exception 'Historical report data changed on migration or reapplication';
                    end if;
                  end $$;
                '''))
            if args.legacy_qr_schema:
                phases.append(('legacy QR data and constraints preserved', '''
                  do $$ begin
                    if not exists(select 1 from public.qr_codes where code_content='LEGACY-RETAINED'
                      and navigation_point_id is null and location_description_ar='وصف قائم'
                      and location_description_en='Existing description' and physical_placement_ar='موضع قائم'
                      and physical_placement_en='Existing placement' and scan_count=7
                      and last_scanned_at='2026-10-01T12:00:00Z') then
                      raise exception 'Legacy QR data changed on migration or reapplication';
                    end if;
                    if (select count(*) from information_schema.columns where table_schema='public'
                      and table_name='qr_codes' and column_name in ('location_description_ar','location_description_en')
                      and is_nullable='NO' and column_default is null)<>2 then
                      raise exception 'Required QR descriptions were weakened or fabricated';
                    end if;
                  end $$;
                '''))
            phases.append(('operational safety regressions', (ROOT / 'supabase/tests/operational_safety.sql').read_text()))
            phases.append(('read-only deployment diagnostics', diagnostic_sql))
            phases.append(('read-only previous test id checks', (ROOT / 'supabase/diagnostics/previous_test_ids.sql').read_text()))
        if args.point_migration:
            phases.append(('point management migration', args.point_migration.read_text()))
            phases.append(('point management idempotence', args.point_migration.read_text()))
            phases.append(('point management regressions', "select set_config('baser.test_database','disposable-local-runner',false);\n" +
                           (ROOT / 'supabase/tests/navigation_point_management.sql').read_text()))
        safety_snapshot = '''
          select jsonb_build_object(
            'buildings',(select count(*) from public.buildings),
            'voice_characters',(select count(*) from public.voice_characters),
            'voice_recordings',(select count(*) from public.voice_recordings),
            'points',(select count(*) from public.navigation_points),
            'qrs',(select count(*) from public.qr_codes),
            'emergencies',(select count(*) from public.emergency_requests),
            'reports',(select count(*) from public.reports),
            'scans',(select count(*) from public.qr_scan_logs),
            'roles',(select jsonb_agg(jsonb_build_array(id,role) order by id) from public.profiles));
        '''
        def snapshot():
            return subprocess.run(command + ['-At'], input=safety_snapshot,
                                  capture_output=True, text=True, check=True).stdout.strip()
        def schema_snapshot():
            result = subprocess.run(command + ['-At'], input=diagnostic_sql,
                                    capture_output=True, text=True, check=True)
            return json.loads(result.stdout.strip())
        for name, sql in phases:
            if name == 'operational safety migration':
                before_schema = schema_snapshot()
                # Break multiple dependencies only within the attempted transaction.
                # The preflight must report them together and leave the database intact.
                incompatible_sql = sql.replace('begin;', '''begin;
                  alter table public.voice_recordings rename to test_saved_voice_recordings;
                  alter table public.emergency_requests rename column message to test_saved_message;
                  alter table public.emergency_requests alter column latitude set not null;
                  alter table public.emergency_requests add column required_legacy_text text not null;
                ''', 1)
                failed = subprocess.run(command,input=incompatible_sql,capture_output=True,text=True)
                expected_errors = ['SCHEMA_PREFLIGHT_FAILED', 'missing table public.voice_recordings',
                                   'missing column public.emergency_requests.message',
                                   'anonymous/unknown-location requests require nullable column: public.emergency_requests.latitude',
                                   'required column without RPC value/default: public.emergency_requests.required_legacy_text']
                if failed.returncode == 0 or not all(error in failed.stderr for error in expected_errors):
                    raise SystemExit('Preflight did not collect all incompatible schema dependencies')
                if schema_snapshot() != before_schema:
                    raise SystemExit('Failed preflight left schema changes')
                print(f'PASS {args.baseline}: preflight reports multiple differences and rolls back')
                if args.missing_reports:
                    # A late failure must also undo creation of the missing table.
                    failed = subprocess.run(command,input=sql.replace("notify pgrst,'reload schema';",
                        "select 1/0;", 1),capture_output=True,text=True)
                    if failed.returncode == 0 or 'division by zero' not in failed.stderr or schema_snapshot() != before_schema:
                        raise SystemExit('Late migration failure did not roll back reports creation and schema changes')
                    print(f'PASS {args.baseline}: late failure rolls back reports creation')
            if name in ('operational safety regressions', 'point management regressions'):
                before_test = snapshot()
                unmarked_sql = sql.replace("select set_config('baser.test_database','disposable-local-runner',false);\n", '', 1)
                blocked = subprocess.run(command,input=unmarked_sql,capture_output=True,text=True)
                if blocked.returncode == 0 or 'LOCAL_TEST_ONLY' not in blocked.stderr or snapshot() != before_test:
                    raise SystemExit('SQL regression file did not reject an unmarked session without changing data')
                print(f'PASS {args.baseline}: regression file rejects accidental direct execution')
                sql = "select set_config('baser.test_database','disposable-local-runner',false);\n" + sql
            result = subprocess.run(command,input=sql,capture_output=True,text=True)
            if result.returncode:
                print(result.stderr)
                raise SystemExit(f'FAIL {args.baseline}: {name}')
            print(f'PASS {args.baseline}: {name}')
            if name == 'schema diagnostics without application tables':
                if any(table['exists'] for table in schema_snapshot()['tables']):
                    raise SystemExit('Diagnostics did not correctly identify absent application tables')
            if name == 'schema diagnostics before repair':
                reports = next(table for table in schema_snapshot()['tables'] if table['table'] == 'reports')
                if reports['exists'] == args.missing_reports:
                    raise SystemExit('Diagnostics did not correctly identify reports presence')
            if name in ('operational safety regressions', 'point management regressions'):
                if snapshot() != before_test:
                    raise SystemExit('Regression file left test data or changed account roles')
                print(f'PASS {args.baseline}: regression changes rolled back')
        if args.safety_migration:
            # Independent sessions race the same capability, as retries from
            # concurrent clients can. PostgreSQL must commit exactly one row.
            retry_sql = """
              set role anon;
              select set_config('request.jwt.claim.sub','',false);
              select public.submit_mobile_request('report', repeat('d',64),
                '{"report_type":"obstacle","title":"Concurrent","description":"Concurrent retry"}'::jsonb)->>'id';
            """
            def concurrent_retry(_):
                result = subprocess.run(command + ['-At'], input=retry_sql, capture_output=True, text=True, check=True)
                return result.stdout.strip()
            with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
                ids = list(pool.map(concurrent_retry, range(6)))
            if len(set(ids)) != 1 or not ids[0]:
                raise SystemExit('Concurrent retries returned different request ids')
            count = subprocess.run(command + ['-At'], input="select count(*) from public.reports where title='Concurrent';", capture_output=True, text=True, check=True)
            if count.stdout.strip() != '1':
                raise SystemExit('Concurrent retries created duplicate reports')
            print(f'PASS {args.baseline}: six concurrent retries create one request')
    finally:
        if started:
            subprocess.run(['pg_ctl','-D',cluster,'-m','fast','-w','stop'],check=True,capture_output=True)
