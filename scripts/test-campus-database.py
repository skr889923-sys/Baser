#!/usr/bin/env python3
"""Test campus-network migration in an isolated PostgreSQL cluster (never production)."""
import json
import pathlib
import shutil
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[1]
for executable in ('initdb', 'pg_ctl', 'psql'):
    if not shutil.which(executable):
        raise SystemExit(f'{executable} is required for the isolated database check')
fixture = json.loads((root / 'data/campus-fixture/network.json').read_text())
quoted = json.dumps(fixture, ensure_ascii=False).replace("'", "''")
setup = """
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
create table public.profiles(id uuid primary key,role text);
insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.profiles values ('00000000-0000-0000-0000-000000000001','university_admin'),('00000000-0000-0000-0000-000000000002','student');
"""
tests = f"""
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into public.campus_networks(id,document) values('synthetic-campus','{quoted}'::jsonb);
do $$ begin
  begin
    update public.campus_networks set is_published=true,revision=2,document=jsonb_set(document,'{{revision}}','2') where id='synthetic-campus';
    raise exception 'TEST FAILED: fixture published';
  exception when others then if sqlerrm not like '%Fixture publication forbidden%' then raise; end if; end;
  begin
    update public.campus_networks set revision=2,document=jsonb_set(jsonb_set(document,'{{revision}}','2'),'{{edges,features}}','[]') where id='synthetic-campus';
    raise exception 'TEST FAILED: empty dataset accepted';
  exception when others then if sqlerrm not like '%Empty feature collection%' then raise; end if; end;
  begin
    update public.campus_networks set document=document where id='synthetic-campus';
    raise exception 'TEST FAILED: stale revision accepted';
  exception when others then if sqlerrm not like '%revision must increment%' then raise; end if; end;
end $$;
reset role;
set role anon;
do $$ begin
  if (select count(*) from public.campus_networks) <> 0 then raise exception 'TEST FAILED: anonymous draft exposure'; end if;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
  if (select count(*) from public.campus_networks) <> 0 then raise exception 'TEST FAILED: student draft exposure'; end if;
  begin
    insert into public.campus_networks(id,document) values('forbidden',jsonb_set('{quoted}'::jsonb,'{{id}}','"forbidden"'));
    raise exception 'TEST FAILED: student write accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
"""
with tempfile.TemporaryDirectory(prefix='baser-pg-') as tmp:
    directory = pathlib.Path(tmp)
    cluster = directory / 'cluster'
    init = subprocess.run(['initdb','-D',str(cluster),'-A','trust','-U','postgres','--no-locale','--encoding=UTF8'],capture_output=True,text=True)
    if init.returncode:
        print(init.stderr)
        raise SystemExit('initdb failed')
    started = False
    try:
        result = subprocess.run(['pg_ctl','-D',str(cluster),'-l',str(directory/'server.log'),'-o',f"-k {tmp} -h '' -p 55439",'-w','start'],capture_output=True,text=True)
        if result.returncode:
            print((directory/'server.log').read_text())
            result.check_returncode()
        started = True
        command = ['psql','-X','-h',tmp,'-p','55439','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q']
        for name, sql in [('bootstrap',setup),('migration',(root/'supabase/migrations/20260906090000_campus_networks.sql').read_text()),('security-regressions',tests)]:
            result=subprocess.run(command,input=sql,capture_output=True,text=True)
            if result.returncode:
                print(result.stderr)
                raise SystemExit(f'{name} failed')
            print(f'PASS {name}')
    finally:
        if started: subprocess.run(['pg_ctl','-D',str(cluster),'-m','fast','-w','stop'],check=True,capture_output=True)
