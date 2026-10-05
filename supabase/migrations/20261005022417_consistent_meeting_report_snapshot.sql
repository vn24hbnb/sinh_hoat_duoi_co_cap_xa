-- One read-only snapshot for dashboard, reports and rankings; existing RLS stays in force.
create or replace function public.meeting_report_snapshot(
  p_meeting_session_id uuid,
  p_organization_id uuid
) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  snapshot jsonb;
begin
  if auth.uid() is null or not private.can_manage(p_organization_id) then
    raise exception 'Không có quyền xem báo cáo của xã này.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'generatedAt', now(),
    'session', jsonb_build_object('id', s.id, 'organization_id', s.organization_id,
      'title', s.title, 'meeting_date', s.meeting_date),
    'participants', coalesce((select jsonb_agg(jsonb_build_object(
      'member_id', p.member_id, 'chi_bo_id', p.chi_bo_id))
      from public.meeting_participants p
      where p.meeting_session_id = s.id and p.organization_id = s.organization_id), '[]'::jsonb),
    'attendance', coalesce((select jsonb_agg(jsonb_build_object(
      'member_id', a.member_id, 'status', a.status, 'gps_valid', a.gps_valid))
      from public.meeting_attendance a
      where a.meeting_session_id = s.id and a.organization_id = s.organization_id), '[]'::jsonb),
    'chiBos', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'secretary_name', c.secretary_name)
      order by c.sort_order, c.name)
      from public.chi_bos c
      where c.organization_id = s.organization_id and c.is_active = true), '[]'::jsonb),
    'attempts', coalesce((select jsonb_agg(jsonb_build_object(
      'id', e.id, 'member_id', e.member_id, 'status', e.status, 'score', e.score,
      'correct_count', e.correct_count, 'total_questions', e.total_questions,
      'duration_seconds', e.duration_seconds, 'submitted_at', e.submitted_at,
      'members', jsonb_build_object('organization_id', m.organization_id,
        'full_name', m.full_name, 'position', m.position,
        'chi_bos', jsonb_build_object('name', c.name))))
      from public.exam_attempts e
      left join public.members m on m.id = e.member_id and m.organization_id = s.organization_id
      left join public.chi_bos c on c.id = m.chi_bo_id and c.organization_id = s.organization_id
      where e.meeting_session_id = s.id and e.organization_id = s.organization_id
        and e.status = 'submitted'), '[]'::jsonb)
  ) into snapshot
  from public.meeting_sessions s
  where s.id = p_meeting_session_id and s.organization_id = p_organization_id;
  if snapshot is null then
    raise exception 'Không tìm thấy thông tin phiên họp.' using errcode = 'P0002';
  end if;
  return snapshot;
end;
$$;
revoke all on function public.meeting_report_snapshot(uuid, uuid) from public, anon;
grant execute on function public.meeting_report_snapshot(uuid, uuid) to authenticated;
comment on function public.meeting_report_snapshot(uuid, uuid) is
  'Read-only, RLS-preserving, single-statement snapshot scoped to one managed commune and meeting.';
