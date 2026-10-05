alter table public.meeting_exams add column ignore_session_schedule boolean not null default false;
comment on column public.meeting_exams.ignore_session_schedule is 'Allows an explicitly enabled exam to remain available until the organizer closes it, preserving the per-attempt duration.';
CREATE OR REPLACE FUNCTION public.exam_start(p_exam_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if not v_exam.ignore_session_schedule and (v_session.meeting_date::timestamp at time zone 'Asia/Ho_Chi_Minh')+interval '17 hours'<=now() then raise exception 'Đã hết giờ làm bài.'; end if;
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
 v_deadline:=case when v_exam.ignore_session_schedule then v_attempt.started_at+make_interval(secs=>v_exam.duration_seconds) else least(v_attempt.started_at+make_interval(secs=>v_exam.duration_seconds),(v_session.meeting_date::timestamp at time zone 'Asia/Ho_Chi_Minh')+interval '17 hours') end;
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
end $function$
;
CREATE OR REPLACE FUNCTION public.exam_save_answer(p_attempt_id uuid, p_question_id uuid, p_selected_option text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_profile public.app_users; v_attempt public.exam_attempts;
begin
 v_profile:=private.profile();
 if p_selected_option not in('A','B','C','D') then raise exception 'Đáp án không hợp lệ.'; end if;
 select * into v_attempt from public.exam_attempts where id=p_attempt_id and organization_id=v_profile.organization_id and member_id=v_profile.member_id and status='started' for update;
 if not found then raise exception 'Không tìm thấy lượt thi đang làm.'; end if;
 if now()>v_attempt.deadline_at or (not (select e.ignore_session_schedule from public.meeting_exams e where e.id=v_attempt.meeting_exam_id and e.organization_id=v_attempt.organization_id) and now()>((select meeting_date::timestamp at time zone 'Asia/Ho_Chi_Minh' from public.meeting_sessions where id=v_attempt.meeting_session_id)+interval '17 hours')) then perform private.finish_exam(v_attempt.id); raise exception 'Đã hết giờ, hệ thống đã thu bài.'; end if;
 update public.exam_attempt_answers set selected_option=p_selected_option where exam_attempt_id=v_attempt.id and question_id=p_question_id;
 if not found then raise exception 'Câu hỏi không thuộc đề thi này.'; end if;
 return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.meeting_set_status(p_meeting_session_id uuid, p_status text)
 RETURNS meeting_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_session public.meeting_sessions; v_now timestamptz:=now();
begin
 select * into v_session from public.meeting_sessions where id=p_meeting_session_id for update;
 if not found or not private.is_admin(v_session.organization_id) then raise exception 'Không đủ quyền cập nhật phiên họp.' using errcode='42501'; end if;
 if not ((v_session.status='draft' and p_status='active') or (v_session.status='active' and p_status='attendance_open') or (v_session.status='attendance_open' and p_status='attendance_closed') or (v_session.status='attendance_closed' and p_status='exam_open') or (v_session.status='exam_open' and p_status='exam_closed') or (v_session.status in('exam_closed','attendance_closed','active') and p_status='closed') or (v_session.status='closed' and p_status='archived')) then raise exception 'Chuyển trạng thái phiên họp không hợp lệ.'; end if;
 if p_status='exam_open' and not exists(select 1 from public.meeting_exams e where e.meeting_session_id=p_meeting_session_id and e.organization_id=v_session.organization_id and e.ignore_session_schedule) and (v_session.meeting_date::timestamp at time zone 'Asia/Ho_Chi_Minh')+interval '17 hours'<=v_now then raise exception 'Đã qua 17 giờ, không thể mở bài thi.'; end if;
 update public.meeting_sessions set status=p_status,attendance_opened_at=case when p_status='attendance_open' then v_now else attendance_opened_at end,attendance_closed_at=case when p_status='attendance_closed' then v_now else attendance_closed_at end,exam_opened_at=case when p_status='exam_open' then v_now else exam_opened_at end,exam_closed_at=case when p_status='exam_closed' then v_now else exam_closed_at end,end_time=case when p_status in('closed','archived') then v_now else end_time end,updated_at=v_now where id=p_meeting_session_id returning * into v_session;
 if p_status='exam_open' then update public.meeting_exams set status='open',start_time=v_now,updated_at=v_now where meeting_session_id=p_meeting_session_id;
 elsif p_status in('exam_closed','closed','archived') then update public.meeting_exams set status='closed',end_time=v_now,updated_at=v_now where meeting_session_id=p_meeting_session_id; end if;
 return v_session;
end $function$
;
