-- Approved rollout: GPS becomes advisory; auth, tenant, time and code checks remain.
create or replace function public.attendance_mark(
  p_meeting_session_id uuid,p_lat double precision default null,p_lng double precision default null,
  p_accuracy double precision default null,p_absence_reason text default null,
  p_method text default 'gps',p_pin_code text default null,p_qr_token text default null,p_evidence_path text default null
) returns public.meeting_attendance
language plpgsql security definer set search_path=''
as $$
declare v_profile public.app_users; v_session public.meeting_sessions;
v_setting public.meeting_ui_settings; v_distance double precision; v_status text; v_row public.meeting_attendance;
v_warning text; v_lat double precision; v_lng double precision; v_gps_valid boolean;
begin
 v_profile:=private.profile();
 if v_profile.id is null or v_profile.member_id is null or v_profile.role<>'member' then raise exception 'Tài khoản không được phép điểm danh.' using errcode='42501'; end if;
 select * into v_session from public.meeting_sessions where id=p_meeting_session_id and organization_id=v_profile.organization_id;
 if not found then raise exception 'Không tìm thấy phiên họp.'; end if;
 if v_session.status<>'attendance_open' then raise exception 'Cổng điểm danh đang đóng.'; end if;
 if p_absence_reason is not null and length(btrim(p_absence_reason)) not between 1 and 500 then raise exception 'Lý do vắng mặt cần từ 1 đến 500 ký tự.'; end if;
 select * into v_setting from public.meeting_ui_settings where meeting_session_id=v_session.id and organization_id=v_session.organization_id;
 if p_method is null or p_method not in('gps','qr','pin','button') then raise exception 'Phương thức điểm danh không hợp lệ.'; end if;
 if p_absence_reason is null then
   if position('pin' in coalesce(v_setting.attendance_methods,''))>0 and (p_pin_code is null or btrim(p_pin_code)<>v_setting.pin_code) then raise exception 'Mã PIN điểm danh không đúng.'; end if;
   if position('qr' in coalesce(v_setting.attendance_methods,''))>0 and (p_qr_token is null or (btrim(p_qr_token)<>v_setting.qr_code_token and position('qr_token='||v_setting.qr_code_token in p_qr_token)=0)) then raise exception 'Mã QR điểm danh không đúng.'; end if;
   if position('photo' in coalesce(v_setting.attendance_methods,''))>0 and (p_evidence_path is null or p_evidence_path not like v_profile.organization_id::text||'/'||v_profile.member_id::text||'/'||v_session.id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='attendance-evidence' and name=p_evidence_path)) then raise exception 'Cần tải ảnh minh chứng trước khi điểm danh.'; end if;
   v_status:='warning'; v_gps_valid:=false;
   if p_lat is null or p_lng is null then
     v_warning:='Không có tọa độ GPS. Đã ghi nhận điểm danh; Ban tổ chức cần kiểm tra.';
   elsif p_lat not between -90 and 90 or p_lng not between -180 and 180 then
     v_warning:='Tọa độ GPS không hợp lệ. Đã ghi nhận điểm danh; Ban tổ chức cần kiểm tra.';
   else
     v_lat:=p_lat; v_lng:=p_lng;
     if v_setting.gps_lat is null or v_setting.gps_lng is null then
       v_warning:='Chưa cấu hình vị trí hội trường để đối chiếu GPS. Đã ghi nhận điểm danh; Ban tổ chức cần kiểm tra.';
     else
       v_distance:=2*6371000*asin(sqrt(least(1::double precision,greatest(0::double precision,power(sin(radians(v_lat-v_setting.gps_lat)/2),2)+cos(radians(v_setting.gps_lat))*cos(radians(v_lat))*power(sin(radians(v_lng-v_setting.gps_lng)/2),2)))));
       v_gps_valid:=v_distance<=coalesce(v_setting.gps_radius_m,200);
       if v_gps_valid then v_status:='present';
       else v_warning:='Ngoài bán kính GPS cho phép.'; end if;
     end if;
   end if;
 else v_status:='excused'; v_warning:=p_absence_reason; end if;
 insert into public.meeting_attendance(organization_id,meeting_session_id,member_id,status,method,marked_at,gps_lat,gps_lng,gps_distance_m,gps_valid,warning_reason,marked_by,evidence_path)
 values(v_profile.organization_id,v_session.id,v_profile.member_id,v_status,p_method,now(),v_lat,v_lng,case when v_distance is null then null else round(v_distance)::int end,v_gps_valid,v_warning,v_profile.id,p_evidence_path)
 returning * into v_row;
 return v_row;
exception when unique_violation then raise exception 'Đã ghi nhận điểm danh cho phiên họp này.' using errcode='23505';
end $$;

revoke all on function public.attendance_mark(uuid,double precision,double precision,double precision,text,text,text,text,text) from public,anon;
grant execute on function public.attendance_mark(uuid,double precision,double precision,double precision,text,text,text,text,text) to authenticated;
