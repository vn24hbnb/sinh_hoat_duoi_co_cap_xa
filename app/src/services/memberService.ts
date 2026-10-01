import { supabase } from './supabaseClient'
import { tenantService } from './tenantService'

export interface MemberSessionStatus {
  attended:boolean
  attendanceTime:string|null
  examSubmitted:boolean
  examScore:number|null
  hasExam:boolean
  examId:string|null
  excused?:boolean
  excusedReason?:string|null
  attendanceStatus?:string|null
  attendanceWarningReason?:string|null
}
const organizationId=()=>tenantService.requireOrganizationId()

export const memberService={
 async getMemberSessionStatus(memberId:string,sessionId:string):Promise<MemberSessionStatus>{
  const result:MemberSessionStatus={attended:false,attendanceTime:null,examSubmitted:false,examScore:null,hasExam:false,examId:null,excused:false,excusedReason:null}
  const [attendance,exam]=await Promise.all([
   supabase.from('meeting_attendance').select('marked_at,status,warning_reason').eq('organization_id',organizationId()).eq('meeting_session_id',sessionId).eq('member_id',memberId).maybeSingle(),
   supabase.from('meeting_exams').select('id,status').eq('organization_id',organizationId()).eq('meeting_session_id',sessionId).maybeSingle()
  ])
  if(attendance.error&&attendance.error.code!=='PGRST116')throw attendance.error
  if(attendance.data){
   const a=attendance.data;result.attendanceStatus=a.status;result.attendanceWarningReason=a.warning_reason
   if(['present','warning','manual'].includes(a.status)){result.attended=true;result.attendanceTime=a.marked_at}
   if(a.status==='excused'){result.excused=true;result.excusedReason=a.warning_reason;result.attendanceTime=a.marked_at}
  }
  if(exam.error&&exam.error.code!=='PGRST116')throw exam.error
  if(exam.data){
   result.hasExam=true;result.examId=exam.data.id
   const {data:attempt,error}=await supabase.from('exam_attempts').select('status,score').eq('organization_id',organizationId()).eq('meeting_exam_id',exam.data.id).eq('member_id',memberId).maybeSingle()
   if(error&&error.code!=='PGRST116')throw error
   if(attempt?.status==='submitted'){result.examSubmitted=true;result.examScore=Number(attempt.score)}
  }
  return result
 },
 async getChiBos():Promise<any[]>{
  const {data,error}=await supabase.from('chi_bos').select('*').eq('organization_id',organizationId()).eq('is_active',true).order('sort_order')
  if(error)throw new Error(error.message)
  return data||[]
 },
 async getMembersByChiBo(chiBoId:string):Promise<any[]>{
  const {data,error}=await supabase.from('members').select('*,chi_bos(id,name)').eq('organization_id',organizationId()).eq('chi_bo_id',chiBoId).eq('is_active',true).order('full_name')
  if(error)throw new Error(error.message)
  return data||[]
 },
 async getAllMembers():Promise<any[]>{
  const {data,error}=await supabase.from('members').select('*,chi_bos(id,name),app_users(username,role)').eq('organization_id',organizationId()).order('full_name')
  if(error)throw new Error(error.message)
  return data||[]
 },
 async getMemberExamRank(sessionId:string,memberId:string){
  const {data,error}=await supabase.rpc('member_exam_rank',{p_meeting_session_id:sessionId,p_member_id:memberId})
  if(error)throw error
  return data
 },
 async getMemberParticipationHistory(memberId:string){
  const org=organizationId()
  const {data:sessions,error:sError}=await supabase.from('meeting_sessions').select('id,title,meeting_date,status').eq('organization_id',org).neq('status','draft').order('meeting_date',{ascending:false})
  if(sError)throw new Error('Không thể tải lịch sử các phiên họp.')
  const [attendance,attempts]=await Promise.all([
   supabase.from('meeting_attendance').select('meeting_session_id,status,marked_at,warning_reason').eq('organization_id',org).eq('member_id',memberId),
   supabase.from('exam_attempts').select('score,correct_count,total_questions,duration_seconds,meeting_session_id').eq('organization_id',org).eq('member_id',memberId).eq('status','submitted')
  ])
  const attendanceMap=new Map((attendance.data||[]).map(a=>[a.meeting_session_id,a]))
  const attemptMap=new Map((attempts.data||[]).map(a=>[a.meeting_session_id,a]))
  return (sessions||[]).map(session=>{
   const a=attendanceMap.get(session.id),x=attemptMap.get(session.id)
   const attendanceStatus=a?.status==='excused'?'excused':a?.status==='warning'?'warning':a?'present':'absent'
   return {sessionId:session.id,title:session.title,meetingDate:session.meeting_date||'Chưa rõ',status:session.status,attendanceStatus,attendanceTime:a?.marked_at||null,excuseReason:a?.warning_reason||null,examScore:x?Number(x.score):null,correctCount:x?.correct_count??null,totalQuestions:x?.total_questions??null,durationSeconds:x?.duration_seconds??null}
  })
 }
}
