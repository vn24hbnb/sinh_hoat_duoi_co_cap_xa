-- New, dedicated project only. No legacy data, credentials, or answer keys are seeded.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon, service_role;
create table public.organizations(id uuid primary key default gen_random_uuid(),slug text unique not null,name text not null,is_active boolean not null default true);
create table public.chi_bos(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,name text not null,chi_bo_number integer,secretary_name text,sort_order int default 0,is_active boolean default true,created_at timestamptz default now(),updated_at timestamptz default now(),unique(organization_id,id),unique(organization_id,name));
create table public.members(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,chi_bo_id uuid not null,full_name text not null check(length(trim(full_name)) between 1 and 200),date_of_birth date not null,position text,phone text,is_active boolean default true,created_at timestamptz default now(),updated_at timestamptz default now(),unique(organization_id,id),unique(organization_id,chi_bo_id,full_name,date_of_birth),foreign key(organization_id,chi_bo_id) references public.chi_bos(organization_id,id));
create table public.app_users(id uuid primary key references auth.users(id) on delete cascade,organization_id uuid references public.organizations,member_id uuid unique,username text unique not null,role text not null check(role in('member','organizer','admin','super_admin')),must_change_password boolean not null default false,is_active boolean not null default true,last_login_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),foreign key(organization_id,member_id) references public.members(organization_id,id),check((role='super_admin' and organization_id is null and member_id is null) or(role<>'super_admin' and organization_id is not null)),check(role<>'member' or member_id is not null));
create table public.meeting_sessions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,title text not null,meeting_type text default 'sinh_hoat_chinh_tri_duoi_co',meeting_date date not null,start_time timestamptz,end_time timestamptz,location text,participants text,agenda text,status text not null default 'draft' check(status in('draft','active','attendance_open','attendance_closed','exam_open','exam_closed','closed','archived')),attendance_opened_at timestamptz,attendance_closed_at timestamptz,exam_opened_at timestamptz,exam_closed_at timestamptz,created_by uuid references public.app_users,created_at timestamptz default now(),updated_at timestamptz default now(),unique(organization_id,id));
create table public.meeting_participants(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,meeting_session_id uuid not null,member_id uuid not null,chi_bo_id uuid not null,required boolean default true,created_at timestamptz default now(),unique(meeting_session_id,member_id),foreign key(organization_id,meeting_session_id) references public.meeting_sessions(organization_id,id) on delete cascade,foreign key(organization_id,member_id) references public.members(organization_id,id),foreign key(organization_id,chi_bo_id) references public.chi_bos(organization_id,id));
create table public.meeting_attendance(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,meeting_session_id uuid not null,member_id uuid not null,status text not null check(status in('present','absent','excused','warning','manual')),method text default 'gps',marked_at timestamptz default now(),gps_lat double precision,gps_lng double precision,gps_distance_m numeric,gps_valid boolean,warning_reason text,marked_by uuid references public.app_users,created_at timestamptz default now(),unique(meeting_session_id,member_id),foreign key(organization_id,meeting_session_id) references public.meeting_sessions(organization_id,id),foreign key(organization_id,member_id) references public.members(organization_id,id));
create table public.question_banks(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,name text not null,description text,is_active boolean default true,created_at timestamptz default now(),updated_at timestamptz default now(),unique(organization_id,id));
create table public.questions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,question_bank_id uuid not null,content text not null,option_a text not null,option_b text not null,option_c text not null,option_d text not null,correct_option text not null check(correct_option in('A','B','C','D')),explanation text,difficulty text default 'easy',is_active boolean default true,created_at timestamptz default now(),updated_at timestamptz default now(),unique(organization_id,id),foreign key(organization_id,question_bank_id) references public.question_banks(organization_id,id));
create table public.meeting_exams(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,meeting_session_id uuid not null unique,title text not null,duration_seconds int not null default 600 check(duration_seconds between 30 and 86400),score_scale int not null default 10 check(score_scale>0),questions_per_user int not null default 10 check(questions_per_user between 1 and 200),start_time timestamptz,end_time timestamptz,status text default 'draft' check(status in('draft','open','closed')),created_at timestamptz default now(),updated_at timestamptz default now(),unique(organization_id,id),unique(organization_id,id,meeting_session_id),foreign key(organization_id,meeting_session_id) references public.meeting_sessions(organization_id,id));
create table public.meeting_exam_banks(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,meeting_exam_id uuid not null,question_bank_id uuid not null,unique(meeting_exam_id,question_bank_id),foreign key(organization_id,meeting_exam_id) references public.meeting_exams(organization_id,id),foreign key(organization_id,question_bank_id) references public.question_banks(organization_id,id));
create table public.exam_attempts(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,meeting_exam_id uuid not null,meeting_session_id uuid not null,member_id uuid not null,started_at timestamptz default now(),deadline_at timestamptz not null,submitted_at timestamptz,score numeric,correct_count int,total_questions int,duration_seconds int,score_scale int not null default 10,status text default 'started' check(status in('started','submitted','expired','cancelled')),allow_retake boolean default false,created_at timestamptz default now(),unique(organization_id,id),unique(meeting_exam_id,member_id),foreign key(organization_id,meeting_exam_id,meeting_session_id) references public.meeting_exams(organization_id,id,meeting_session_id),foreign key(organization_id,member_id) references public.members(organization_id,id));
create table public.exam_attempt_answers(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,exam_attempt_id uuid not null,question_id uuid not null,selected_option text check(selected_option in('A','B','C','D')),correct_option text not null check(correct_option in('A','B','C','D')),is_correct boolean,question_snapshot jsonb not null,sort_order int not null,created_at timestamptz default now(),unique(exam_attempt_id,question_id),foreign key(organization_id,exam_attempt_id) references public.exam_attempts(organization_id,id),foreign key(organization_id,question_id) references public.questions(organization_id,id));
create table public.meeting_documents(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,meeting_session_id uuid not null,title text not null,file_url text,file_type text,created_at timestamptz default now(),foreign key(organization_id,meeting_session_id) references public.meeting_sessions(organization_id,id));
create table public.meeting_reports(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,meeting_session_id uuid not null unique,summary jsonb not null,created_by uuid references public.app_users,created_at timestamptz default now(),foreign key(organization_id,meeting_session_id) references public.meeting_sessions(organization_id,id));
create table public.ui_assets(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,asset_name text not null,asset_type text not null,file_url text not null,file_path text,mime_type text,size_bytes bigint,description text,is_active boolean default false,uploaded_by uuid references public.app_users,created_at timestamptz default now(),unique(organization_id,id));
create table public.ui_settings(id uuid primary key default gen_random_uuid(),organization_id uuid not null unique references public.organizations,site_name text default 'Sinh hoạt chính trị dưới nghi thức chào cờ',organization_name text,login_title text default 'ĐĂNG NHẬP CUỘC HỌP',home_title text default 'Sinh hoạt chính trị dưới nghi thức chào cờ',welcome_message text default 'Chào mừng các đồng chí tham dự phiên sinh hoạt',main_slogan text default 'Trang trọng - Nhanh chóng - Chính xác',primary_button_text text default 'TIẾP TỤC',footer_text text,theme_color text default '#D40000',accent_color text default '#FACC15',font_family text default 'Inter',appearance text default 'light',effects_enabled boolean default true,active_home_background_asset_id uuid,active_login_background_asset_id uuid,active_banner_asset_id uuid,active_logo_asset_id uuid,home_background_opacity int default 88,login_background_opacity int default 88,home_background_spin_speed int default 160,is_active boolean default true,created_at timestamptz default now(),updated_at timestamptz default now(),constraint ui_settings_home_bg_fk foreign key(organization_id,active_home_background_asset_id) references public.ui_assets(organization_id,id),constraint ui_settings_login_bg_fk foreign key(organization_id,active_login_background_asset_id) references public.ui_assets(organization_id,id),constraint ui_settings_banner_fk foreign key(organization_id,active_banner_asset_id) references public.ui_assets(organization_id,id),constraint ui_settings_logo_fk foreign key(organization_id,active_logo_asset_id) references public.ui_assets(organization_id,id));
create table public.ui_templates(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,template_name text not null,template_type text default 'red_revolution',title text,subtitle text,slogan text,theme_color text default '#D40000',background_asset_id uuid,banner_asset_id uuid,animation_style text default 'soft',layout_config jsonb default '{}',is_active boolean default true,created_at timestamptz default now(),updated_at timestamptz default now(),unique(organization_id,id),foreign key(organization_id,background_asset_id) references public.ui_assets(organization_id,id),foreign key(organization_id,banner_asset_id) references public.ui_assets(organization_id,id));
create table public.meeting_ui_settings(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,meeting_session_id uuid not null unique,template_id uuid,custom_title text,custom_subtitle text,custom_slogan text,custom_banner_asset_id uuid,custom_background_asset_id uuid,animation_enabled boolean default true,animation_style text default 'soft',gps_lat double precision check(gps_lat between -90 and 90),gps_lng double precision check(gps_lng between -180 and 180),gps_radius_m int not null default 200 check(gps_radius_m between 1 and 10000),attendance_methods text default 'gps',pin_code text,qr_code_token text,device_mapping jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now(),foreign key(organization_id,meeting_session_id) references public.meeting_sessions(organization_id,id),foreign key(organization_id,template_id) references public.ui_templates(organization_id,id),foreign key(organization_id,custom_banner_asset_id) references public.ui_assets(organization_id,id),foreign key(organization_id,custom_background_asset_id) references public.ui_assets(organization_id,id));
create table public.audit_logs(id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations,actor_id uuid references public.app_users,action text not null,target_type text,target_id uuid,metadata jsonb default '{}',created_at timestamptz default now());
alter table public.meeting_attendance add column evidence_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('attendance-evidence','attendance-evidence',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('meeting-documents','meeting-documents',false,52428800,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ui-assets','ui-assets',true,3145728,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=3145728,allowed_mime_types=excluded.allowed_mime_types;

create function private.profile() returns public.app_users language sql stable security definer set search_path='' as $$ select u from public.app_users u where u.id=auth.uid() and u.is_active and (u.member_id is null or exists(select 1 from public.members m where m.id=u.member_id and m.is_active)) $$;
create function private.can_read(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select u.role='super_admin' or u.organization_id=p_org from private.profile() u),false) $$;
create function private.can_manage(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select u.role='super_admin' or(u.organization_id=p_org and u.role in('admin','organizer')) from private.profile() u),false) $$;
create function private.is_admin(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select u.role='super_admin' or(u.organization_id=p_org and u.role='admin') from private.profile() u),false) $$;
create function private.own_member(p_member uuid) returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select member_id=p_member from private.profile()),false) $$;

-- Explicit privileges + RLS. Sensitive writes are exclusively through checked RPC/Edge.
do $$ declare t text; begin
for t in select tablename from pg_tables where schemaname='public' loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('grant select on public.%I to authenticated',t);
if t not in('organizations','app_users','members','exam_attempt_answers','questions','meeting_reports') then
 execute format('create policy tenant_read on public.%I for select to authenticated using(private.can_read(organization_id))',t);
 end if;
 if t in('chi_bos','question_banks','questions','meeting_exams','meeting_exam_banks','meeting_documents','meeting_reports','ui_assets','ui_settings','ui_templates','meeting_ui_settings') then
 execute format('grant insert,update,delete on public.%I to authenticated',t);
 execute format('create policy admin_write on public.%I for all to authenticated using(private.is_admin(organization_id)) with check(private.is_admin(organization_id))',t);
 end if;
 if t <> 'organizations' then execute format('create index %I on public.%I(organization_id)',t||'_org_idx',t); end if;
end loop;end $$;
create policy org_read on public.organizations for select to authenticated using(private.can_read(id));
create policy user_read on public.app_users for select to authenticated using(id=auth.uid() or private.can_manage(organization_id));
create policy member_read on public.members for select to authenticated using(private.own_member(id) or private.can_manage(organization_id));
-- Answer tables and question banks must not expose answers to members.
create policy answer_admin_read on public.exam_attempt_answers for select to authenticated using(private.can_manage(organization_id));
-- Restrict personal attendance and attempts, including members of the same commune.
drop policy tenant_read on public.meeting_attendance;
create policy attendance_read on public.meeting_attendance for select to authenticated using(private.own_member(member_id) or private.can_manage(organization_id));
drop policy tenant_read on public.exam_attempts;
create policy attempt_read on public.exam_attempts for select to authenticated using(private.own_member(member_id) or private.can_manage(organization_id));
drop policy tenant_read on public.meeting_participants;
create policy participant_read on public.meeting_participants for select to authenticated using(private.own_member(member_id) or private.can_manage(organization_id));
drop policy tenant_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated using(private.can_manage(organization_id));
create policy meeting_report_admin_read on public.meeting_reports for select to authenticated using(private.can_manage(organization_id));
create index attendance_session_idx on public.meeting_attendance(meeting_session_id);
create index attempts_session_idx on public.exam_attempts(meeting_session_id);
create index answers_attempt_idx on public.exam_attempt_answers(exam_attempt_id);
create index members_branch_idx on public.members(chi_bo_id);

create function private.login_directory(p_organization_id uuid,p_chi_bo_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('organizations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug) order by name) from public.organizations where is_active),'[]'::jsonb),'chi_bos',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by sort_order,name) from public.chi_bos where organization_id=p_organization_id and is_active),'[]'::jsonb),'members',coalesce((select jsonb_agg(jsonb_build_object('id',id,'full_name',full_name,'display_name',full_name||case when n>1 then ' ('||to_char(date_of_birth,'DD/MM/YYYY')||')' else '' end) order by full_name,date_of_birth) from(select d.*,b.is_active branch_active from(select m.*,count(*) over(partition by full_name) n from public.members m where m.organization_id=p_organization_id and m.is_active) d join public.chi_bos b on b.id=d.chi_bo_id where d.chi_bo_id=p_chi_bo_id and b.is_active) d),'[]'::jsonb)) $$;
create function public.login_directory(p_organization_id uuid default null,p_chi_bo_id uuid default null) returns jsonb language sql stable security definer set search_path='' as $$select private.login_directory(p_organization_id,p_chi_bo_id)$$;
create function private.get_current_profile() returns jsonb language sql stable security definer set search_path='' as $$select to_jsonb(u)||jsonb_build_object('full_name',coalesce(m.full_name,u.username),'chi_bo_id',m.chi_bo_id,'chi_bo_name',b.name,'organization_name',o.name,'is_global_admin',u.role='super_admin') from private.profile() u left join public.members m on m.id=u.member_id left join public.chi_bos b on b.id=m.chi_bo_id left join public.organizations o on o.id=u.organization_id where u.id is not null$$;
create function public.get_current_profile() returns jsonb language sql stable set search_path='' as $$select private.get_current_profile()$$;
create or replace function public.get_meeting_ui_settings(p_meeting_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_row public.meeting_ui_settings; v_org uuid;
begin
 select organization_id into v_org from public.meeting_sessions where id=p_meeting_session_id;
 if v_org is null or not private.can_read(v_org) then raise exception 'Không được truy cập phiên họp này.' using errcode='42501'; end if;
 select * into v_row from public.meeting_ui_settings where meeting_session_id=p_meeting_session_id and organization_id=v_org;
 if not found then return null; end if;
 if private.can_manage(v_org) then return to_jsonb(v_row); end if;
 return jsonb_build_object('id',v_row.id,'organization_id',v_row.organization_id,'meeting_session_id',v_row.meeting_session_id,'template_id',v_row.template_id,'custom_title',v_row.custom_title,'custom_subtitle',v_row.custom_subtitle,'custom_slogan',v_row.custom_slogan,'custom_banner_asset_id',v_row.custom_banner_asset_id,'custom_background_asset_id',v_row.custom_background_asset_id,'animation_enabled',v_row.animation_enabled,'animation_style',v_row.animation_style,'gps_lat',v_row.gps_lat,'gps_lng',v_row.gps_lng,'gps_radius_m',v_row.gps_radius_m,'attendance_methods',v_row.attendance_methods,'pin_required',position('pin' in v_row.attendance_methods)>0,'qr_required',position('qr' in v_row.attendance_methods)>0,'created_at',v_row.created_at,'updated_at',v_row.updated_at);
end $$;

insert into public.organizations(slug,name) values('muong-la','Xã Mường La'),('chieng-lao','Xã Chiềng Lao');
insert into public.chi_bos(organization_id,name,chi_bo_number,sort_order) select id,'Các cơ quan Đảng',1,1 from public.organizations where slug='muong-la';
insert into public.chi_bos(organization_id,name,chi_bo_number,sort_order) select id,'Ủy ban nhân dân xã',2,2 from public.organizations where slug='muong-la';
insert into public.ui_settings(organization_id,organization_name) select id,upper('Đảng bộ '||name) from public.organizations;

revoke all on all functions in schema private from public;
revoke all on function public.login_directory(uuid,uuid),public.get_current_profile() from public;
grant execute on function private.profile(),private.can_read(uuid),private.can_manage(uuid),private.is_admin(uuid),private.own_member(uuid),private.get_current_profile() to authenticated;
grant execute on function private.login_directory(uuid,uuid),public.login_directory(uuid,uuid) to anon,authenticated;
grant execute on function public.get_current_profile() to authenticated;
revoke all on function public.get_meeting_ui_settings(uuid) from public;
grant execute on function public.get_meeting_ui_settings(uuid) to authenticated;

-- Every privileged workflow derives both tenant and member from auth.uid().
create or replace function private.current_org()
returns uuid language sql stable security definer set search_path=''
as $$ select organization_id from private.profile() $$;

create or replace function public.attendance_mark(
  p_meeting_session_id uuid,p_lat double precision default null,p_lng double precision default null,
  p_accuracy double precision default null,p_absence_reason text default null,
  p_method text default 'gps',p_pin_code text default null,p_qr_token text default null,p_evidence_path text default null
) returns public.meeting_attendance
language plpgsql security definer set search_path=''
as $$
declare v_profile public.app_users; v_session public.meeting_sessions;
v_setting public.meeting_ui_settings; v_distance double precision; v_status text; v_row public.meeting_attendance;
begin
 v_profile:=private.profile();
 if v_profile.id is null or v_profile.member_id is null or v_profile.role<>'member' then raise exception 'Tài khoản không được phép điểm danh.' using errcode='42501'; end if;
 select * into v_session from public.meeting_sessions where id=p_meeting_session_id and organization_id=v_profile.organization_id;
 if not found then raise exception 'Không tìm thấy phiên họp.'; end if;
 if v_session.status<>'attendance_open' then raise exception 'Cổng điểm danh đang đóng.'; end if;
 if p_absence_reason is not null and length(btrim(p_absence_reason)) not between 1 and 500 then raise exception 'Lý do vắng mặt cần từ 1 đến 500 ký tự.'; end if;
 select * into v_setting from public.meeting_ui_settings where meeting_session_id=v_session.id and organization_id=v_session.organization_id;
 if p_method not in('gps','qr','pin','button') then raise exception 'Phương thức điểm danh không hợp lệ.'; end if;
 if p_absence_reason is null then
   if position('pin' in coalesce(v_setting.attendance_methods,''))>0 and (p_pin_code is null or btrim(p_pin_code)<>v_setting.pin_code) then raise exception 'Mã PIN điểm danh không đúng.'; end if;
   if position('qr' in coalesce(v_setting.attendance_methods,''))>0 and (p_qr_token is null or (btrim(p_qr_token)<>v_setting.qr_code_token and position('qr_token='||v_setting.qr_code_token in p_qr_token)=0)) then raise exception 'Mã QR điểm danh không đúng.'; end if;
   if position('photo' in coalesce(v_setting.attendance_methods,''))>0 and (p_evidence_path is null or p_evidence_path not like v_profile.organization_id::text||'/'||v_profile.member_id::text||'/'||v_session.id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='attendance-evidence' and name=p_evidence_path)) then raise exception 'Cần tải ảnh minh chứng trước khi điểm danh.'; end if;
   if position('gps' in coalesce(v_setting.attendance_methods,''))>0 then
    if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Cần cho phép định vị GPS để điểm danh.'; end if;
    if v_setting.gps_lat is null or v_setting.gps_lng is null then raise exception 'Ban quản trị chưa cấu hình vị trí điểm danh.'; end if;
    v_distance:=2*6371000*asin(sqrt(power(sin(radians(p_lat-v_setting.gps_lat)/2),2)+cos(radians(v_setting.gps_lat))*cos(radians(p_lat))*power(sin(radians(p_lng-v_setting.gps_lng)/2),2)));
    v_status:=case when v_distance<=coalesce(v_setting.gps_radius_m,200) then 'present' else 'warning' end;
   else v_status:='present'; end if;
 else v_status:='excused'; end if;
 insert into public.meeting_attendance(organization_id,meeting_session_id,member_id,status,method,marked_at,gps_lat,gps_lng,gps_distance_m,gps_valid,warning_reason,marked_by,evidence_path)
 values(v_profile.organization_id,v_session.id,v_profile.member_id,v_status,p_method,now(),p_lat,p_lng,case when v_distance is null then null else round(v_distance)::int end,v_distance is not null and v_distance<=coalesce(v_setting.gps_radius_m,200),case when p_absence_reason is not null then p_absence_reason when v_status='warning' then 'Ngoài bán kính GPS cho phép.' else null end,v_profile.id,p_evidence_path)
 returning * into v_row;
 return v_row;
exception when unique_violation then raise exception 'Đã ghi nhận điểm danh cho phiên họp này.' using errcode='23505';
end $$;

create or replace function public.exam_start(p_exam_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_profile public.app_users; v_exam public.meeting_exams; v_session public.meeting_sessions;
v_attempt public.exam_attempts; v_deadline timestamptz; v_started boolean:=false;
begin
 v_profile:=private.profile();
 if v_profile.id is null or v_profile.member_id is null or v_profile.role<>'member' then raise exception 'Tài khoản không được phép làm bài.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_exam_id::text||':'||v_profile.member_id::text,0));
 select e.* into v_exam from public.meeting_exams e where e.id=p_exam_id and e.organization_id=v_profile.organization_id;
 if not found then raise exception 'Không tìm thấy đề thi.'; end if;
 select * into v_session from public.meeting_sessions where id=v_exam.meeting_session_id and organization_id=v_exam.organization_id;
 if v_session.status<>'exam_open' or v_exam.status<>'open' or v_session.attendance_closed_at is null or now()<v_session.attendance_closed_at then raise exception 'Bài thi chưa mở hoặc đã đóng.'; end if;
 if (v_session.meeting_date::timestamp at time zone 'Asia/Ho_Chi_Minh')+interval '17 hours'<=now() then raise exception 'Đã hết giờ làm bài.'; end if;
 select * into v_attempt from public.exam_attempts where meeting_exam_id=v_exam.id and member_id=v_profile.member_id for update;
 if found then
   if v_attempt.status='submitted' and not v_attempt.allow_retake then raise exception 'Đồng chí đã hoàn thành bài thi.'; end if;
   if v_attempt.status='submitted' and v_attempt.allow_retake then
     delete from public.exam_attempt_answers where exam_attempt_id=v_attempt.id;
     v_attempt.status:='started'; v_attempt.started_at:=now(); v_attempt.submitted_at:=null;
     v_attempt.score:=null; v_attempt.correct_count:=null; v_attempt.total_questions:=null;
     v_attempt.allow_retake:=false; v_started:=true;
   elsif v_attempt.status<>'started' then raise exception 'Không thể tiếp tục lượt thi này.'; end if;
 else
   v_attempt.id:=gen_random_uuid(); v_attempt.organization_id:=v_exam.organization_id;
   v_attempt.meeting_exam_id:=v_exam.id; v_attempt.meeting_session_id:=v_session.id;
   v_attempt.member_id:=v_profile.member_id; v_attempt.started_at:=now(); v_attempt.score_scale:=v_exam.score_scale;
   v_attempt.status:='started'; v_attempt.allow_retake:=false; v_started:=true;
 end if;
 v_deadline:=least(v_attempt.started_at+make_interval(secs=>v_exam.duration_seconds),(v_session.meeting_date::timestamp at time zone 'Asia/Ho_Chi_Minh')+interval '17 hours');
 if v_deadline<=now() then
   perform private.finish_exam(v_attempt.id);
   raise exception 'Đã hết giờ, hệ thống đã tự động thu bài.';
 end if;
 v_attempt.deadline_at:=v_deadline;
 v_attempt.duration_seconds:=v_exam.duration_seconds;
 if v_started then
   insert into public.exam_attempts(id,organization_id,meeting_exam_id,meeting_session_id,member_id,started_at,deadline_at,duration_seconds,score_scale,total_questions,status,allow_retake)
   values(v_attempt.id,v_exam.organization_id,v_exam.id,v_session.id,v_profile.member_id,v_attempt.started_at,v_deadline,v_exam.duration_seconds,v_exam.score_scale,v_exam.questions_per_user,'started',false)
   on conflict(meeting_exam_id,member_id) do update set started_at=excluded.started_at,deadline_at=excluded.deadline_at,duration_seconds=excluded.duration_seconds,score_scale=excluded.score_scale,total_questions=excluded.total_questions,status='started',submitted_at=null,score=null,correct_count=null,allow_retake=false;
   insert into public.exam_attempt_answers(organization_id,exam_attempt_id,question_id,correct_option,question_snapshot,sort_order)
   select v_exam.organization_id,v_attempt.id,q.id,q.correct_option,
          jsonb_build_object('content',q.content,'option_a',q.option_a,'option_b',q.option_b,'option_c',q.option_c,'option_d',q.option_d),
          row_number() over(order by random())::int
   from public.questions q join public.meeting_exam_banks eb on eb.question_bank_id=q.question_bank_id and eb.meeting_exam_id=v_exam.id and eb.organization_id=v_exam.organization_id
   where q.organization_id=v_exam.organization_id and q.is_active
   order by random() limit v_exam.questions_per_user;
   if not found then raise exception 'Ngân hàng câu hỏi chưa có câu hỏi đang hoạt động.'; end if;
 end if;
 return jsonb_build_object(
   'attempt',jsonb_build_object('id',v_attempt.id,'meeting_exam_id',v_exam.id,'meeting_session_id',v_session.id,'member_id',v_profile.member_id,'started_at',v_attempt.started_at,'submitted_at',v_attempt.submitted_at,'score',v_attempt.score,'correct_count',v_attempt.correct_count,'total_questions',v_exam.questions_per_user,'duration_seconds',v_exam.duration_seconds,'status','started','allow_retake',false),
   'questions',(select coalesce(jsonb_agg(jsonb_build_object('id',a.question_id,'content',a.question_snapshot->>'content','optionA',a.question_snapshot->>'option_a','optionB',a.question_snapshot->>'option_b','optionC',a.question_snapshot->>'option_c','optionD',a.question_snapshot->>'option_d','selectedOption',a.selected_option) order by a.sort_order),'[]'::jsonb) from public.exam_attempt_answers a where a.exam_attempt_id=v_attempt.id),
   'timeLeftSeconds',greatest(0,floor(extract(epoch from (v_deadline-now())))::int)
 );
end $$;

create or replace function private.finish_exam(p_attempt_id uuid)
returns public.exam_attempts language plpgsql security definer set search_path=''
as $$
declare v_profile public.app_users; v_attempt public.exam_attempts; v_count int; v_correct int; v_now timestamptz:=now();
begin
 v_profile:=private.profile();
 select * into v_attempt from public.exam_attempts where id=p_attempt_id and (organization_id=v_profile.organization_id or v_profile.role='super_admin') and (member_id=v_profile.member_id or v_profile.role in('admin','organizer','super_admin')) for update;
 if not found then raise exception 'Không tìm thấy lượt thi.'; end if;
 if v_attempt.status='submitted' then return v_attempt; end if;
 if v_profile.member_id is distinct from v_attempt.member_id and v_profile.role not in('admin','organizer','super_admin') then raise exception 'Không được phép nộp bài này.' using errcode='42501'; end if;
 select count(*),count(*) filter(where selected_option=correct_option) into v_count,v_correct from public.exam_attempt_answers where exam_attempt_id=v_attempt.id;
 update public.exam_attempt_answers set is_correct=(selected_option=correct_option) where exam_attempt_id=v_attempt.id;
 update public.exam_attempts set status='submitted',submitted_at=least(v_now,deadline_at),score=case when v_count=0 then 0 else round((v_correct::numeric/v_count)*score_scale,2) end,correct_count=v_correct,total_questions=v_count,duration_seconds=greatest(0,floor(extract(epoch from (least(v_now,deadline_at)-started_at)))::int)
 where id=v_attempt.id returning * into v_attempt;
 return v_attempt;
end $$;

create or replace function public.exam_save_answer(p_attempt_id uuid,p_question_id uuid,p_selected_option text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_profile public.app_users; v_attempt public.exam_attempts;
begin
 v_profile:=private.profile();
 if p_selected_option not in('A','B','C','D') then raise exception 'Đáp án không hợp lệ.'; end if;
 select * into v_attempt from public.exam_attempts where id=p_attempt_id and organization_id=v_profile.organization_id and member_id=v_profile.member_id and status='started' for update;
 if not found then raise exception 'Không tìm thấy lượt thi đang làm.'; end if;
 if now()>v_attempt.deadline_at or now()>((select meeting_date::timestamp at time zone 'Asia/Ho_Chi_Minh' from public.meeting_sessions where id=v_attempt.meeting_session_id)+interval '17 hours') then perform private.finish_exam(v_attempt.id); raise exception 'Đã hết giờ, hệ thống đã thu bài.'; end if;
 update public.exam_attempt_answers set selected_option=p_selected_option where exam_attempt_id=v_attempt.id and question_id=p_question_id;
 if not found then raise exception 'Câu hỏi không thuộc đề thi này.'; end if;
 return true;
end $$;

create or replace function public.exam_submit(p_attempt_id uuid)
returns public.exam_attempts language plpgsql security definer set search_path=''
as $$ begin return private.finish_exam(p_attempt_id); end $$;

create or replace function public.exam_result(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_profile public.app_users; v_attempt public.exam_attempts; v_exam public.meeting_exams;
begin
 v_profile:=private.profile();
 select * into v_attempt from public.exam_attempts where id=p_attempt_id and (organization_id=v_profile.organization_id or v_profile.role='super_admin') and (member_id=v_profile.member_id or v_profile.role in('admin','organizer','super_admin'));
 if not found or v_attempt.status<>'submitted' then raise exception 'Chưa có kết quả bài làm.'; end if;
 select * into v_exam from public.meeting_exams where id=v_attempt.meeting_exam_id;
 return jsonb_build_object('attempt',jsonb_build_object('id',v_attempt.id,'title',v_exam.title,'score',v_attempt.score,'correctCount',v_attempt.correct_count,'totalQuestions',v_attempt.total_questions,'durationSeconds',v_attempt.duration_seconds,'submittedAt',v_attempt.submitted_at,'meetingSessionId',v_attempt.meeting_session_id),
 'answers',(select coalesce(jsonb_agg(jsonb_build_object('id',a.question_id,'content',a.question_snapshot->>'content','optionA',a.question_snapshot->>'option_a','optionB',a.question_snapshot->>'option_b','optionC',a.question_snapshot->>'option_c','optionD',a.question_snapshot->>'option_d','selectedOption',a.selected_option,'correctOption',a.correct_option,'isCorrect',a.is_correct) order by a.sort_order),'[]'::jsonb) from public.exam_attempt_answers a where a.exam_attempt_id=v_attempt.id));
end $$;

create or replace function public.meeting_create(p_organization_id uuid,p_title text,p_meeting_date date,p_location text,p_agenda text,p_start_time timestamptz default null)
returns public.meeting_sessions language plpgsql security definer set search_path=''
as $$
declare v_user public.app_users; v_session public.meeting_sessions;
begin
 v_user:=private.profile();
 if not private.is_admin(p_organization_id) then raise exception 'Không đủ quyền tạo phiên họp.' using errcode='42501'; end if;
 insert into public.meeting_sessions(organization_id,title,meeting_date,start_time,location,agenda,created_by,status)
 values(p_organization_id,nullif(trim(p_title),''),p_meeting_date,p_start_time,nullif(trim(p_location),''),p_agenda,v_user.id,'draft') returning * into v_session;
 insert into public.meeting_participants(organization_id,meeting_session_id,member_id,chi_bo_id,required)
 select m.organization_id,v_session.id,m.id,m.chi_bo_id,true from public.members m where m.organization_id=p_organization_id and m.is_active;
 return v_session;
end $$;

create or replace function public.meeting_set_status(p_meeting_session_id uuid,p_status text)
returns public.meeting_sessions language plpgsql security definer set search_path=''
as $$
declare v_session public.meeting_sessions; v_now timestamptz:=now();
begin
 select * into v_session from public.meeting_sessions where id=p_meeting_session_id for update;
 if not found or not private.is_admin(v_session.organization_id) then raise exception 'Không đủ quyền cập nhật phiên họp.' using errcode='42501'; end if;
 if not ((v_session.status='draft' and p_status='active') or (v_session.status='active' and p_status='attendance_open') or (v_session.status='attendance_open' and p_status='attendance_closed') or (v_session.status='attendance_closed' and p_status='exam_open') or (v_session.status='exam_open' and p_status='exam_closed') or (v_session.status in('exam_closed','attendance_closed','active') and p_status='closed') or (v_session.status='closed' and p_status='archived')) then raise exception 'Chuyển trạng thái phiên họp không hợp lệ.'; end if;
 if p_status='exam_open' and (v_session.meeting_date::timestamp at time zone 'Asia/Ho_Chi_Minh')+interval '17 hours'<=v_now then raise exception 'Đã qua 17 giờ, không thể mở bài thi.'; end if;
 update public.meeting_sessions set status=p_status,attendance_opened_at=case when p_status='attendance_open' then v_now else attendance_opened_at end,attendance_closed_at=case when p_status='attendance_closed' then v_now else attendance_closed_at end,exam_opened_at=case when p_status='exam_open' then v_now else exam_opened_at end,exam_closed_at=case when p_status='exam_closed' then v_now else exam_closed_at end,end_time=case when p_status in('closed','archived') then v_now else end_time end,updated_at=v_now where id=p_meeting_session_id returning * into v_session;
 if p_status='exam_open' then update public.meeting_exams set status='open',start_time=v_now,updated_at=v_now where meeting_session_id=p_meeting_session_id;
 elsif p_status in('exam_closed','closed','archived') then update public.meeting_exams set status='closed',end_time=v_now,updated_at=v_now where meeting_session_id=p_meeting_session_id; end if;
 return v_session;
end $$;

create or replace function public.meeting_update_agenda(p_meeting_session_id uuid,p_agenda text)
returns public.meeting_sessions language plpgsql security definer set search_path=''
as $$
declare v_session public.meeting_sessions;
begin
 update public.meeting_sessions set agenda=p_agenda,updated_at=now() where id=p_meeting_session_id and private.is_admin(organization_id) returning * into v_session;
 if not found then raise exception 'Không tìm thấy phiên họp hoặc không đủ quyền.' using errcode='42501'; end if;
 return v_session;
end $$;

create or replace function public.meeting_archive(p_meeting_session_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_org uuid;
begin
 select organization_id into v_org from public.meeting_sessions where id=p_meeting_session_id;
 if v_org is null or not private.is_admin(v_org) then raise exception 'Không tìm thấy phiên họp hoặc không đủ quyền.' using errcode='42501'; end if;
 update public.meeting_sessions set status='archived',updated_at=now(),end_time=coalesce(end_time,now()) where id=p_meeting_session_id and status in('draft','active','attendance_closed','exam_closed','closed');
 if not found then raise exception 'Chỉ có thể lưu trữ phiên chưa mở điểm danh hoặc đã kết thúc.'; end if;
 return true;
end $$;

create or replace function public.meeting_attendance_review(p_meeting_session_id uuid,p_member_id uuid,p_status text,p_approve_excused boolean default false)
returns public.meeting_attendance language plpgsql security definer set search_path=''
as $$
declare v_session public.meeting_sessions; v_row public.meeting_attendance; v_user public.app_users;
begin
 v_user:=private.profile();
 select * into v_session from public.meeting_sessions where id=p_meeting_session_id and (organization_id=v_user.organization_id or v_user.role='super_admin');
 if not found or not private.is_admin(v_session.organization_id) then raise exception 'Không đủ quyền duyệt điểm danh.' using errcode='42501'; end if;
 if p_approve_excused then
   if p_status<>'excused' then raise exception 'Trạng thái duyệt vắng phép không hợp lệ.'; end if;
   update public.meeting_attendance set warning_reason='[Đã duyệt] '||coalesce(nullif(warning_reason,''),'Vắng có phép'),marked_by=v_user.id
   where meeting_session_id=p_meeting_session_id and member_id=p_member_id and organization_id=v_session.organization_id and status='excused' returning * into v_row;
 else
   if p_status not in('present','absent') then raise exception 'Trạng thái điểm danh không hợp lệ.'; end if;
   update public.meeting_attendance set status=p_status,marked_by=v_user.id,
     warning_reason=case when p_status='present' then null else warning_reason end
   where meeting_session_id=p_meeting_session_id and member_id=p_member_id and organization_id=v_session.organization_id and status in('warning','excused') returning * into v_row;
 end if;
 if not found then raise exception 'Không tìm thấy yêu cầu điểm danh cần duyệt.'; end if;
 insert into public.audit_logs(organization_id,actor_id,action,target_type,target_id,metadata)
 values(v_session.organization_id,v_user.id,case when p_approve_excused then 'APPROVE_EXCUSED_ABSENCE' else 'REVIEW_ATTENDANCE' end,'meeting_attendance',v_row.id,jsonb_build_object('status',v_row.status,'meeting_session_id',p_meeting_session_id));
 return v_row;
end $$;

create or replace function public.member_exam_rank(p_meeting_session_id uuid,p_member_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_profile public.app_users; v_result jsonb;
begin
 v_profile:=private.profile();
 if v_profile.id is null or (v_profile.role='member' and v_profile.member_id is distinct from p_member_id) then raise exception 'Không được xem kết quả của tài khoản khác.' using errcode='42501'; end if;
 with ranked as (
   select a.member_id,a.score,a.correct_count,a.total_questions,a.duration_seconds,
          row_number() over(order by a.score desc,a.duration_seconds asc,a.submitted_at asc,a.member_id) as rank,
          count(*) over() as total
   from public.exam_attempts a
   where a.meeting_session_id=p_meeting_session_id and a.organization_id=(select organization_id from public.meeting_sessions where id=p_meeting_session_id)
     and a.status='submitted'
 )
 select jsonb_build_object('rank',rank,'total',total,'score',score,'correctCount',correct_count,'totalQuestions',total_questions,'durationSeconds',duration_seconds)
 into v_result from ranked where member_id=p_member_id;
 if not private.can_read((select organization_id from public.meeting_sessions where id=p_meeting_session_id)) then raise exception 'Không được truy cập phiên họp này.' using errcode='42501'; end if;
 return v_result;
end $$;

-- No browser may insert auth profiles or bypass the RPC workflows.
revoke all on function public.attendance_mark(uuid,double precision,double precision,double precision,text,text,text,text,text),public.exam_start(uuid),public.exam_save_answer(uuid,uuid,text),public.exam_submit(uuid),public.exam_result(uuid),public.meeting_create(uuid,text,date,text,text,timestamptz),public.meeting_set_status(uuid,text),public.meeting_update_agenda(uuid,text),public.meeting_archive(uuid),public.meeting_attendance_review(uuid,uuid,text,boolean),public.member_exam_rank(uuid,uuid),private.current_org(),private.finish_exam(uuid) from public,anon;
grant execute on function public.attendance_mark(uuid,double precision,double precision,double precision,text,text,text,text,text),public.exam_start(uuid),public.exam_save_answer(uuid,uuid,text),public.exam_submit(uuid),public.exam_result(uuid),public.meeting_create(uuid,text,date,text,text,timestamptz),public.meeting_set_status(uuid,text),public.meeting_update_agenda(uuid,text),public.meeting_archive(uuid),public.meeting_attendance_review(uuid,uuid,text,boolean),public.member_exam_rank(uuid,uuid),private.current_org() to authenticated;

-- Keep test and management clients able to read questions only through role-aware RLS.
create policy question_admin_read on public.questions for select to authenticated using(private.can_manage(organization_id));
drop policy tenant_read on public.meeting_ui_settings;
create policy meeting_ui_admin_read on public.meeting_ui_settings for select to authenticated using(private.can_manage(organization_id));
create policy attendance_evidence_insert on storage.objects for insert to authenticated
with check(bucket_id='attendance-evidence' and split_part(name,'/',2)=(select member_id::text from private.profile()) and exists(select 1 from public.meeting_sessions s where s.id=split_part(name,'/',3)::uuid and s.organization_id=split_part(name,'/',1)::uuid and s.status='attendance_open' and s.organization_id=(select organization_id from private.profile())));
create policy attendance_evidence_read on storage.objects for select to authenticated
using(bucket_id='attendance-evidence' and ((split_part(name,'/',2)=(select member_id::text from private.profile()) and split_part(name,'/',1)=(select organization_id::text from private.profile())) or private.can_manage(split_part(name,'/',1)::uuid)));
create policy attendance_evidence_delete on storage.objects for delete to authenticated
using(bucket_id='attendance-evidence' and (private.can_manage(split_part(name,'/',1)::uuid) or (split_part(name,'/',2)=(select member_id::text from private.profile()) and split_part(name,'/',1)=(select organization_id::text from private.profile()) and not exists(select 1 from public.meeting_attendance a where a.organization_id=(select organization_id from private.profile()) and a.member_id=(select member_id from private.profile()) and a.evidence_path=name))));
create policy meeting_documents_storage_read on storage.objects for select to authenticated
using(bucket_id='meeting-documents' and exists(select 1 from public.meeting_sessions s where s.id=split_part(name,'/',2)::uuid and s.organization_id=split_part(name,'/',1)::uuid and private.can_read(s.organization_id)));
create policy meeting_documents_storage_insert on storage.objects for insert to authenticated
with check(bucket_id='meeting-documents' and private.is_admin(split_part(name,'/',1)::uuid) and exists(select 1 from public.meeting_sessions s where s.id=split_part(name,'/',2)::uuid and s.organization_id=split_part(name,'/',1)::uuid));
create policy meeting_documents_storage_delete on storage.objects for delete to authenticated
using(bucket_id='meeting-documents' and private.is_admin(split_part(name,'/',1)::uuid));
create policy ui_assets_storage_insert on storage.objects for insert to authenticated
with check(bucket_id='ui-assets' and private.is_admin(split_part(name,'/',1)::uuid));
create policy ui_assets_storage_delete on storage.objects for delete to authenticated
using(bucket_id='ui-assets' and private.is_admin(split_part(name,'/',1)::uuid));
grant insert on public.audit_logs to authenticated;
create policy audit_insert on public.audit_logs for insert to authenticated with check(actor_id=auth.uid() and private.is_admin(organization_id));
