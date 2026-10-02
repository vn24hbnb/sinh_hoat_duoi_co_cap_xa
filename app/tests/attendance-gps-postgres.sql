-- Run ONLY against an isolated disposable local database, never Supabase production.
create role anon;
create role authenticated;
create schema private;
create schema storage;
create table public.app_users(id uuid primary key, organization_id uuid, member_id uuid, role text);
create table public.members(id uuid primary key, organization_id uuid, unique(organization_id,id));
create table public.meeting_sessions(id uuid primary key, organization_id uuid, status text, unique(organization_id,id));
create table public.meeting_ui_settings(meeting_session_id uuid, organization_id uuid, attendance_methods text, gps_lat double precision, gps_lng double precision, gps_radius_m integer, pin_code text, qr_code_token text);
create table storage.objects(bucket_id text,name text);
create table public.meeting_attendance(id uuid default gen_random_uuid() primary key, organization_id uuid, meeting_session_id uuid,member_id uuid,status text check(status in('present','warning','excused','absent','manual')),method text,marked_at timestamptz,gps_lat double precision,gps_lng double precision,gps_distance_m numeric,gps_valid boolean,warning_reason text,marked_by uuid,evidence_path text,unique(meeting_session_id,member_id),foreign key(organization_id,meeting_session_id) references public.meeting_sessions(organization_id,id),foreign key(organization_id,member_id) references public.members(organization_id,id));
create function private.profile() returns public.app_users language sql stable as $$select u from public.app_users u where id=nullif(current_setting('qa.user',true),'')::uuid$$;
insert into public.members values ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000002');
insert into public.app_users values ('00000000-0000-0000-0000-000000000111','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','member'),('00000000-0000-0000-0000-000000000222','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000022','member'),('00000000-0000-0000-0000-000000000333','00000000-0000-0000-0000-000000000001',null,'admin');
insert into public.meeting_sessions values ('00000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000000001','attendance_open'),('00000000-0000-0000-0000-000000002002','00000000-0000-0000-0000-000000000002','attendance_open'),('00000000-0000-0000-0000-000000001003','00000000-0000-0000-0000-000000000001','attendance_closed');
insert into public.meeting_ui_settings values ('00000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000000001','gps',21,104,200,'1234','test-qr');
\ir ../../supabase/migrations/20261002010616_attendance_gps_advisory.sql

create function pg_temp.expect_error(command text, pattern text) returns void language plpgsql as $$
declare caught text;
begin
 begin execute command; exception when others then get stacked diagnostics caught=message_text; end;
 if caught is null or caught not like pattern then raise exception 'Expected error %, got %',pattern,caught; end if;
end $$;

select set_config('qa.user','00000000-0000-0000-0000-000000000111',false);
do $$declare r public.meeting_attendance; begin
 r:=public.attendance_mark('00000000-0000-0000-0000-000000001001',p_method=>'button');
 assert r.status='warning' and r.gps_valid=false and r.gps_lat is null and r.gps_lng is null and r.gps_distance_m is null;
 assert r.warning_reason like 'Không có tọa độ GPS%';
 assert r.organization_id='00000000-0000-0000-0000-000000000001'::uuid and r.member_id='00000000-0000-0000-0000-000000000011'::uuid;
end $$;
select pg_temp.expect_error($$select public.attendance_mark('00000000-0000-0000-0000-000000001001')$$,'Đã ghi nhận%');
select pg_temp.expect_error($$select public.attendance_mark('00000000-0000-0000-0000-000000002002')$$,'Không tìm thấy%');
select pg_temp.expect_error($$select public.attendance_mark('00000000-0000-0000-0000-000000001003')$$,'Cổng điểm danh%');
select set_config('qa.user','00000000-0000-0000-0000-000000000222',false);
do $$declare r public.meeting_attendance; begin
 r:=public.attendance_mark('00000000-0000-0000-0000-000000002002');
 assert r.status='warning' and r.organization_id='00000000-0000-0000-0000-000000000002'::uuid;
 assert (select count(*) from public.meeting_attendance where status in('present','warning','manual'))=2;
 assert (select count(*) from public.meeting_attendance where organization_id='00000000-0000-0000-0000-000000000001' and meeting_session_id='00000000-0000-0000-0000-000000001001')=1;
end $$;
select set_config('qa.user','00000000-0000-0000-0000-000000000111',false);
delete from public.meeting_attendance;
do $$declare r public.meeting_attendance; begin
 r:=public.attendance_mark('00000000-0000-0000-0000-000000001001',21,104);
 assert r.status='present' and r.gps_valid and r.warning_reason is null and r.gps_distance_m=0;
end $$;
delete from public.meeting_attendance;
do $$declare r public.meeting_attendance; begin
 r:=public.attendance_mark('00000000-0000-0000-0000-000000001001',22,105);
 assert r.status='warning' and r.gps_valid=false and r.gps_distance_m>200 and r.warning_reason='Ngoài bán kính GPS cho phép.';
end $$;
delete from public.meeting_attendance;
do $$declare r public.meeting_attendance; begin
 r:=public.attendance_mark('00000000-0000-0000-0000-000000001001','NaN'::double precision,104);
 assert r.status='warning' and r.gps_lat is null and r.gps_distance_m is null and r.warning_reason like 'Tọa độ GPS không hợp lệ%';
end $$;
delete from public.meeting_attendance;
update public.meeting_ui_settings set gps_lat=null,gps_lng=null;
do $$declare r public.meeting_attendance; begin
 r:=public.attendance_mark('00000000-0000-0000-0000-000000001001',21,104);
 assert r.status='warning' and r.gps_lat=21 and r.gps_distance_m is null and r.warning_reason like 'Chưa cấu hình%';
end $$;
delete from public.meeting_attendance;
update public.meeting_ui_settings set attendance_methods='gps,qr,pin';
select pg_temp.expect_error($$select public.attendance_mark('00000000-0000-0000-0000-000000001001',p_method=>'button')$$,'Mã PIN%');
select pg_temp.expect_error($$select public.attendance_mark('00000000-0000-0000-0000-000000001001',p_method=>'button',p_pin_code=>'1234')$$,'Mã QR%');
do $$declare r public.meeting_attendance; begin
 r:=public.attendance_mark('00000000-0000-0000-0000-000000001001',p_method=>'qr',p_pin_code=>'1234',p_qr_token=>'test-qr');
 assert r.status='warning' and r.gps_lat is null;
end $$;
delete from public.meeting_attendance;
update public.meeting_ui_settings set attendance_methods='gps,photo';
select pg_temp.expect_error($$select public.attendance_mark('00000000-0000-0000-0000-000000001001')$$,'Cần tải ảnh%');
do $$declare r public.meeting_attendance; begin
 r:=public.attendance_mark('00000000-0000-0000-0000-000000001001',p_absence_reason=>'Vắng có lý do');
 assert r.status='excused' and r.gps_valid is null and r.warning_reason='Vắng có lý do';
end $$;
select set_config('qa.user','00000000-0000-0000-0000-000000000333',false);
select pg_temp.expect_error($$select public.attendance_mark('00000000-0000-0000-0000-000000001001')$$,'Tài khoản%');
select set_config('qa.user','',false);
select pg_temp.expect_error($$select public.attendance_mark('00000000-0000-0000-0000-000000001001')$$,'Tài khoản%');
do $$begin
 assert not has_function_privilege('anon','public.attendance_mark(uuid,double precision,double precision,double precision,text,text,text,text,text)','execute');
 assert has_function_privilege('authenticated','public.attendance_mark(uuid,double precision,double precision,double precision,text,text,text,text,text)','execute');
 assert (select proconfig @> array['search_path=""'] from pg_proc where oid='public.attendance_mark(uuid,double precision,double precision,double precision,text,text,text,text,text)'::regprocedure);
end $$;
select 'PASS: attendance GPS advisory, tenant/session/auth/code/history checks' as result;
