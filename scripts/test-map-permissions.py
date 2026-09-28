#!/usr/bin/env python3
"""Exercise map-editor RLS in disposable local PostgreSQL; never use project credentials."""
import argparse
import pathlib
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--baseline', choices=['reset', 'init'], default='reset')
parser.add_argument('--migration', type=pathlib.Path)
parser.add_argument('--legacy-route-steps', action='store_true')
parser.add_argument('--route-migration', type=pathlib.Path)
args = parser.parse_args()
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
        for name, sql in phases:
            result = subprocess.run(command,input=sql,capture_output=True,text=True)
            if result.returncode:
                print(result.stderr)
                raise SystemExit(f'FAIL {args.baseline}: {name}')
            print(f'PASS {args.baseline}: {name}')
    finally:
        if started:
            subprocess.run(['pg_ctl','-D',cluster,'-m','fast','-w','stop'],check=True,capture_output=True)
