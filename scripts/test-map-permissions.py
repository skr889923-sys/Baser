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
        if args.migration:
            phases.append(('fix',args.migration.read_text()))
        phases.append(('authenticated map editor inserts a point',editor_insert))
        if args.migration:
            phases.append(('idempotent reapplication',args.migration.read_text()))
            phases.append(('role and full map-save regressions',(ROOT / 'supabase/tests/map_editor_permissions.sql').read_text()))
        for name, sql in phases:
            result = subprocess.run(command,input=sql,capture_output=True,text=True)
            if result.returncode:
                print(result.stderr)
                raise SystemExit(f'FAIL {args.baseline}: {name}')
            print(f'PASS {args.baseline}: {name}')
    finally:
        if started:
            subprocess.run(['pg_ctl','-D',cluster,'-m','fast','-w','stop'],check=True,capture_output=True)
