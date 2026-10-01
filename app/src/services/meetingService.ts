import { supabase } from './supabaseClient'
import { tenantService } from './tenantService'

export interface MeetingSession {
  id: string
  title: string
  meeting_type: string | null
  meeting_date: string | null
  start_time: string | null
  end_time: string | null
  location: string | null
  participants: string | null
  agenda: string | null
  status: 'draft' | 'active' | 'attendance_open' | 'attendance_closed' | 'exam_open' | 'exam_closed' | 'closed' | 'archived'
}

export const meetingService = {
  /**
   * Fetch the currently active meeting session (not draft and not archived)
   */
  async getActiveSession(): Promise<MeetingSession | null> {
    const { data, error } = await supabase
      .from('meeting_sessions')
      .select('*')
      .eq('organization_id', tenantService.requireOrganizationId())
      .in('status', ['active', 'attendance_open', 'attendance_closed', 'exam_open', 'exam_closed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching active session:', error.message)
      throw new Error('Không thể tải thông tin phiên họp hiện tại.')
    }

    return data as MeetingSession | null
  },

  /**
   * Fetch details of a specific session by ID
   */
  async getSessionById(sessionId: string): Promise<MeetingSession> {
    const { data, error } = await supabase
      .from('meeting_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('organization_id', tenantService.requireOrganizationId())
      .single()

    if (error || !data) {
      throw new Error('Không tìm thấy thông tin phiên họp.')
    }

    return data as MeetingSession
  },

  /**
   * Fetch documents associated with a session
   */
  async getSessionDocuments(sessionId: string) {
    const { data, error } = await supabase
      .from('meeting_documents')
      .select('id, title, file_url, file_type, created_at')
      .eq('meeting_session_id', sessionId)
      .eq('organization_id', tenantService.requireOrganizationId())

    if (error) {
      console.error('Error fetching session documents:', error.message)
      return []
    }

    return Promise.all((data || []).map(async (document) => {
      const { data: signed } = await supabase.storage
        .from('meeting-documents')
        .createSignedUrl(document.file_url || '', 60 * 60)
      return { ...document, file_url: signed?.signedUrl || '' }
    }))
  },

  /**
   * Fetch all participants of a session with their attendance details
   */
  async getParticipantsAttendance(sessionId: string) {
    // 1. Fetch participants (meeting_participants join with members and chi_bos)
    const { data: participants, error: pError } = await supabase
      .from('meeting_participants')
      .select(`
        id,
        member_id,
        required,
        members (
          id,
          full_name,
          position,
          chi_bos (
            id,
            name
          )
        )
      `)
      .eq('meeting_session_id', sessionId)
      .eq('organization_id', tenantService.requireOrganizationId())

    if (pError) {
      console.error('Error fetching participants:', pError.message)
      throw new Error('Không thể tải danh sách đảng viên tham dự.')
    }

    // 2. Fetch attendance records
    const { data: attendance, error: aError } = await supabase
      .from('meeting_attendance')
      .select('member_id, status, marked_at, gps_valid, warning_reason, gps_distance_m')
      .eq('meeting_session_id', sessionId)
      .eq('organization_id', tenantService.requireOrganizationId())

    if (aError) {
      console.error('Error fetching attendance:', aError.message)
      throw new Error('Không thể tải danh sách điểm danh.')
    }

    // Map them together
    const attendanceMap = new Map(attendance.map(a => [a.member_id, a]))

    return participants.map((p: any) => {
      const att = attendanceMap.get(p.member_id)
      return {
        memberId: p.member_id,
        fullName: p.members?.full_name || 'Không rõ',
        position: p.members?.position || 'Đảng viên',
        chiBoName: p.members?.chi_bos?.name || 'Không rõ',
        required: p.required,
        attended: !!att && ['present', 'warning', 'manual'].includes(att.status),
        status: att?.status || 'absent', // 'present', 'warning', 'absent', etc.
        markedAt: att?.marked_at || null,
        gpsValid: att?.gps_valid ?? null,
        warningReason: att?.warning_reason || null,
        gpsDistanceM: att?.gps_distance_m ?? null
      }
    })
  },

  /**
   * Create a new meeting session, locking in active members as participants
   */
  async createMeetingSession(title:string,meetingDate:string,location:string,agenda:string,_createdBy:string,startTime:string|null=null):Promise<MeetingSession>{
    const {data,error}=await supabase.rpc('meeting_create',{
      p_organization_id:tenantService.requireOrganizationId(),p_title:title,p_meeting_date:meetingDate,
      p_location:location,p_agenda:agenda,p_start_time:startTime
    })
    if(error||!data)throw new Error(`Tạo phiên họp thất bại: ${error?.message||'Lỗi không xác định'}`)
    return data as MeetingSession
  },

  /**
   * Update the status of a meeting session, logging time and auditing
   */
  async updateMeetingStatus(sessionId:string,newStatus:'draft'|'active'|'attendance_open'|'attendance_closed'|'exam_open'|'exam_closed'|'closed'|'archived',_actorId:string):Promise<void>{
    const {error}=await supabase.rpc('meeting_set_status',{p_meeting_session_id:sessionId,p_status:newStatus})
    if(error)throw new Error(`Cập nhật trạng thái phiên họp thất bại: ${error.message}`)
  },

  /**
   * Update the agenda content of a meeting session
   */
  async updateMeetingAgenda(sessionId:string,agenda:string,_actorId:string):Promise<void>{
    const {error}=await supabase.rpc('meeting_update_agenda',{p_meeting_session_id:sessionId,p_agenda:agenda})
    if(error)throw new Error(`Cập nhật chương trình sinh hoạt thất bại: ${error.message}`)
  },

  /**
   * Delete a meeting session and all its cascading records safely
   */
  async deleteMeetingSession(meetingId:string,_actorId:string):Promise<void>{
    const {error}=await supabase.rpc('meeting_archive',{p_meeting_session_id:meetingId})
    if(error)throw new Error(`Lưu trữ phiên họp thất bại: ${error.message}`)
  },

  /**
   * Cập nhật trạng thái điểm danh thủ công bởi Admin (duyệt có mặt hoặc vắng mặt từ cảnh báo)
   */
  async evaluateAttendance(sessionId:string,memberId:string,newStatus:'present'|'absent',_actorId:string):Promise<void>{
    const {error}=await supabase.rpc('meeting_attendance_review',{p_meeting_session_id:sessionId,p_member_id:memberId,p_status:newStatus,p_approve_excused:false})
    if(error)throw new Error(`Đánh giá điểm danh thất bại: ${error.message}`)
  },

  /**
   * Upload meeting document to Storage bucket `meeting-documents` and save record to DB
   */
  async uploadSessionDocument(
    sessionId: string,
    file: File,
    title: string
  ): Promise<any> {
    // 1. Generate unique file path in storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`
    const organizationId = tenantService.requireOrganizationId()
    const filePath = `${organizationId}/${sessionId}/${fileName}`

    // 2. Upload file to supabase storage
    const { error: uploadError } = await supabase.storage
      .from('meeting-documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading document file:', uploadError.message)
      throw new Error(`Tải tệp tin lên hệ thống thất bại: ${uploadError.message}`)
    }

    // Store the path, not a public URL. Readers receive short-lived signed URLs.
    const { data, error: dbError } = await supabase
      .from('meeting_documents')
      .insert({
        organization_id: organizationId,
        meeting_session_id: sessionId,
        title: title || file.name,
        file_url: filePath,
        file_type: fileExt?.toLowerCase() || 'unknown'
      })
      .select('*')
      .single()

    if (dbError) {
      console.error('Error saving document metadata:', dbError.message)
      // Soft cleanup: delete file if db insert fails
      await supabase.storage.from('meeting-documents').remove([filePath])
      throw new Error(`Lưu thông tin văn bản thất bại: ${dbError.message}`)
    }

    return data
  },

  /**
   * Delete meeting document from both storage and DB
   */
  async deleteSessionDocument(docId: string, _fileUrl: string): Promise<void> {
    const { data: document, error: lookupError } = await supabase
      .from('meeting_documents')
      .select('file_url')
      .eq('id', docId)
      .eq('organization_id', tenantService.requireOrganizationId())
      .maybeSingle()
    if (lookupError || !document) throw new Error('Không tìm thấy tài liệu trong xã đang quản lý.')
    const filePath = document.file_url || ''

    // 2. Remove from Storage
    if (filePath) {
      const { error: removeError } = await supabase.storage
        .from('meeting-documents')
        .remove([filePath])

      if (removeError) {
        console.warn('Warning: Could not remove file from storage:', removeError.message)
      }
    }

    // 3. Delete from DB
    const { error: dbError } = await supabase
      .from('meeting_documents')
      .delete()
      .eq('id', docId)
      .eq('organization_id', tenantService.requireOrganizationId())

    if (dbError) {
      console.error('Error deleting document from DB:', dbError.message)
      throw new Error(`Xóa tài liệu khỏi database thất bại: ${dbError.message}`)
    }
  },

  /**
   * Fetch all meeting sessions (history + active)
   */
  async getMeetingList():Promise<MeetingSession[]>{
    const {data,error}=await supabase.from('meeting_sessions').select('*').eq('organization_id',tenantService.requireOrganizationId()).order('created_at',{ascending:false})
    if(error)throw new Error('Không thể tải danh sách phiên họp.')
    return (data||[]) as MeetingSession[]
  },

  /**
   * Lấy danh sách điểm danh chờ duyệt (cảnh báo vị trí hoặc báo vắng)
   */
  async getPendingApprovals(sessionId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('meeting_attendance')
      .select(`
        id,
        member_id,
        status,
        marked_at,
        gps_distance_m,
        warning_reason,
        members (
          full_name,
          position,
          chi_bos (
            name
          )
        )
      `)
      .eq('meeting_session_id', sessionId)
      .eq('organization_id', tenantService.requireOrganizationId())
      .in('status', ['warning', 'excused'])

    if (error) {
      console.error('Error fetching pending approvals:', error.message)
      return []
    }

    return (data || [])
      .filter((item: any) => {
        if (item.status === 'excused' && item.warning_reason?.startsWith('[Đã duyệt]')) {
          return false
        }
        return true
      })
      .map((item: any) => ({
        id: item.id,
        memberId: item.member_id,
        fullName: item.members?.full_name || 'Không rõ',
        position: item.members?.position || 'Đảng viên',
        chiBoName: item.members?.chi_bos?.name || 'Không rõ',
        status: item.status,
        markedAt: item.marked_at,
        gpsDistanceM: item.gps_distance_m,
        reason: item.warning_reason || ''
      }))
  },

  /**
   * Phê duyệt vắng phép (chuyển lý do từ Yêu cầu thành Đã duyệt)
   */
  async approveExcusedAbsence(sessionId:string,memberId:string,_actorId:string):Promise<void>{
    const {error}=await supabase.rpc('meeting_attendance_review',{p_meeting_session_id:sessionId,p_member_id:memberId,p_status:'excused',p_approve_excused:true})
    if(error)throw new Error(`Phê duyệt vắng phép thất bại: ${error.message}`)
  }
}
