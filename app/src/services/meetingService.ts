import { supabase } from './supabaseClient'

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

    if (error) {
      console.error('Error fetching session documents:', error.message)
      return []
    }

    return data
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

    if (pError) {
      console.error('Error fetching participants:', pError.message)
      throw new Error('Không thể tải danh sách đảng viên tham dự.')
    }

    // 2. Fetch attendance records
    const { data: attendance, error: aError } = await supabase
      .from('meeting_attendance')
      .select('member_id, status, marked_at, gps_valid, warning_reason, gps_distance_m')
      .eq('meeting_session_id', sessionId)

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
  async createMeetingSession(
    title: string,
    meetingDate: string,
    location: string,
    agenda: string,
    createdBy: string,
    startTime: string | null = null
  ): Promise<MeetingSession> {
    // 1. Insert session record
    const { data: newSession, error: sError } = await supabase
      .from('meeting_sessions')
      .insert({
        title,
        meeting_date: meetingDate,
        location,
        agenda,
        status: 'draft',
        created_by: createdBy,
        start_time: startTime
      })
      .select('*')
      .single()

    if (sError || !newSession) {
      console.error('Error creating session:', sError?.message)
      throw new Error(`Tạo phiên họp thất bại: ${sError?.message || 'Lỗi không xác định'}`)
    }

    // 2. Fetch all active members from members table
    const { data: members, error: mError } = await supabase
      .from('members')
      .select('id, chi_bo_id')
      .eq('is_active', true)

    if (mError) {
      console.error('Error fetching members for lock-in:', mError.message)
      throw new Error('Tạo phiên họp thành công nhưng không thể lấy danh sách đảng viên để chốt.')
    }

    if (members && members.length > 0) {
      // 3. Create bulk payload for meeting_participants
      const participantsPayload = members.map(m => ({
        meeting_session_id: newSession.id,
        member_id: m.id,
        chi_bo_id: m.chi_bo_id,
        required: true
      }))

      const { error: pError } = await supabase
        .from('meeting_participants')
        .insert(participantsPayload)

      if (pError) {
        console.error('Error locking in participants:', pError.message)
        throw new Error(`Tạo phiên họp thành công nhưng chốt danh sách đảng viên thất bại: ${pError.message}`)
      }
    }

    // 4. Log audit log
    await supabase.from('audit_logs').insert({
      actor_id: createdBy,
      action: 'CREATE_MEETING',
      target_type: 'meeting_sessions',
      target_id: newSession.id,
      metadata: { title, meetingDate, lockedParticipantsCount: members?.length || 0 }
    })

    return newSession as MeetingSession
  },

  /**
   * Update the status of a meeting session, logging time and auditing
   */
  async updateMeetingStatus(
    sessionId: string,
    newStatus: 'draft' | 'active' | 'attendance_open' | 'attendance_closed' | 'exam_open' | 'exam_closed' | 'closed' | 'archived',
    actorId: string
  ): Promise<void> {
    const updatePayload: any = { status: newStatus }

    if (newStatus === 'attendance_open') {
      updatePayload.attendance_opened_at = new Date().toISOString()
    } else if (newStatus === 'attendance_closed') {
      updatePayload.attendance_closed_at = new Date().toISOString()
    } else if (newStatus === 'exam_open') {
      updatePayload.exam_opened_at = new Date().toISOString()
      
      // Auto open associated meeting_exams status to 'open' if it exists!
      const { data: exam } = await supabase
        .from('meeting_exams')
        .select('id')
        .eq('meeting_session_id', sessionId)
        .maybeSingle()

      if (exam) {
        await supabase
          .from('meeting_exams')
          .update({ status: 'open', start_time: new Date().toISOString() })
          .eq('id', exam.id)
      }
    } else if (newStatus === 'exam_closed') {
      updatePayload.exam_closed_at = new Date().toISOString()

      // Auto close associated meeting_exams status to 'closed'
      const { data: exam } = await supabase
        .from('meeting_exams')
        .select('id')
        .eq('meeting_session_id', sessionId)
        .maybeSingle()

      if (exam) {
        await supabase
          .from('meeting_exams')
          .update({ status: 'closed', end_time: new Date().toISOString() })
          .eq('id', exam.id)
      }
    } else if (newStatus === 'closed') {
      updatePayload.end_time = new Date().toISOString()
    }

    const { error } = await supabase
      .from('meeting_sessions')
      .update(updatePayload)
      .eq('id', sessionId)

    if (error) {
      console.error('Error updating meeting status:', error.message)
      throw new Error(`Cập nhật trạng thái phiên họp thất bại: ${error.message}`)
    }

    // Log audit log
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action: `UPDATE_MEETING_STATUS_${newStatus.toUpperCase()}`,
      target_type: 'meeting_sessions',
      target_id: sessionId,
      metadata: { newStatus }
    }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
  },

  /**
   * Update the agenda content of a meeting session
   */
  async updateMeetingAgenda(sessionId: string, agenda: string, actorId: string): Promise<void> {
    const { error } = await supabase
      .from('meeting_sessions')
      .update({ 
        agenda,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (error) {
      console.error('Error updating meeting agenda:', error.message)
      throw new Error(`Cập nhật chương trình sinh hoạt thất bại: ${error.message}`)
    }

    // Log audit log
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action: 'UPDATE_MEETING_AGENDA',
      target_type: 'meeting_sessions',
      target_id: sessionId,
      metadata: { note: 'Cập nhật chương trình sinh hoạt chi tiết' }
    }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
  },

  /**
   * Delete a meeting session and all its cascading records safely
   */
  async deleteMeetingSession(meetingId: string, actorId: string): Promise<void> {
    // 1. Get attempt IDs linked to this session
    const { data: attempts } = await supabase
      .from('exam_attempts')
      .select('id')
      .eq('meeting_session_id', meetingId)
    const attemptIds = attempts?.map(a => a.id) || []

    // 2. Delete attempt answers
    if (attemptIds.length > 0) {
      await supabase.from('exam_attempt_answers').delete().in('exam_attempt_id', attemptIds)
    }

    // 3. Delete exam attempts
    await supabase.from('exam_attempts').delete().eq('meeting_session_id', meetingId)

    // 4. Get exam IDs linked to this session
    const { data: exams } = await supabase
      .from('meeting_exams')
      .select('id')
      .eq('meeting_session_id', meetingId)
    const examIds = exams?.map(e => e.id) || []

    // 5. Delete meeting exam banks
    if (examIds.length > 0) {
      await supabase.from('meeting_exam_banks').delete().in('meeting_exam_id', examIds)
    }

    // 6. Delete meeting exams
    await supabase.from('meeting_exams').delete().eq('meeting_session_id', meetingId)

    // 7. Delete attendance records
    await supabase.from('meeting_attendance').delete().eq('meeting_session_id', meetingId)

    // 8. Delete participants
    await supabase.from('meeting_participants').delete().eq('meeting_session_id', meetingId)

    // 9. Delete documents
    await supabase.from('meeting_documents').delete().eq('meeting_session_id', meetingId)

    // 10. Delete reports
    await supabase.from('meeting_reports').delete().eq('meeting_session_id', meetingId)

    // 11. Delete the session itself
    const { error } = await supabase
      .from('meeting_sessions')
      .delete()
      .eq('id', meetingId)

    if (error) {
      console.error('Error deleting session:', error.message)
      throw new Error(`Xóa phiên họp thất bại: ${error.message}`)
    }

    // 12. Record Audit log
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action: 'DELETE_MEETING',
      target_type: 'meeting_sessions',
      target_id: meetingId,
      metadata: { deletedAt: new Date().toISOString() }
    })
  },

  /**
   * Cập nhật trạng thái điểm danh thủ công bởi Admin (duyệt có mặt hoặc vắng mặt từ cảnh báo)
   */
  async evaluateAttendance(sessionId: string, memberId: string, newStatus: 'present' | 'absent', actorId: string): Promise<void> {
    const { error } = await supabase
      .from('meeting_attendance')
      .update({
        status: newStatus,
        marked_by: actorId
      })
      .eq('meeting_session_id', sessionId)
      .eq('member_id', memberId)

    if (error) {
      console.error('Error evaluating attendance:', error.message)
      throw new Error(`Đánh giá điểm danh thất bại: ${error.message}`)
    }

    // Ghi audit log
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action: `EVALUATE_ATTENDANCE_${newStatus.toUpperCase()}`,
      target_type: 'meeting_attendance',
      target_id: memberId,
      metadata: { sessionId, memberId, newStatus }
    })
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
    const filePath = `${sessionId}/${fileName}`

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

    // 3. Get public URL of the uploaded document
    const { data: urlData } = supabase.storage
      .from('meeting-documents')
      .getPublicUrl(filePath)

    const publicUrl = urlData.publicUrl

    // 4. Save metadata record to meeting_documents table
    const { data, error: dbError } = await supabase
      .from('meeting_documents')
      .insert({
        meeting_session_id: sessionId,
        title: title || file.name,
        file_url: publicUrl,
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
  async deleteSessionDocument(docId: string, fileUrl: string): Promise<void> {
    // 1. Extract storage file path from publicUrl
    // Example: https://.../storage/v1/object/public/meeting-documents/sessionId/fileName
    let filePath = ''
    try {
      const urlParts = fileUrl.split('/meeting-documents/')
      if (urlParts.length > 1) {
        filePath = decodeURIComponent(urlParts[1])
      }
    } catch (err) {
      console.error('Error parsing file path from URL:', err)
    }

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

    if (dbError) {
      console.error('Error deleting document from DB:', dbError.message)
      throw new Error(`Xóa tài liệu khỏi database thất bại: ${dbError.message}`)
    }
  },

  /**
   * Fetch all meeting sessions (history + active)
   */
  async getMeetingList(): Promise<MeetingSession[]> {
    const { data, error } = await supabase
      .from('meeting_sessions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching meeting list:', error.message)
      throw new Error('Không thể tải danh sách phiên họp.')
    }

    return data as MeetingSession[]
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
  async approveExcusedAbsence(sessionId: string, memberId: string, actorId: string): Promise<void> {
    const { data, error: fetchErr } = await supabase
      .from('meeting_attendance')
      .select('warning_reason')
      .eq('meeting_session_id', sessionId)
      .eq('member_id', memberId)
      .single()

    if (fetchErr || !data) {
      throw new Error('Không tìm thấy bản ghi báo vắng.')
    }

    let currentReason = data.warning_reason || ''
    if (!currentReason.startsWith('[Đã duyệt]')) {
      currentReason = `[Đã duyệt] ${currentReason.replace(/^\[Yêu cầu\]\s*/, '')}`
    }

    const { error } = await supabase
      .from('meeting_attendance')
      .update({
        warning_reason: currentReason,
        marked_by: actorId
      })
      .eq('meeting_session_id', sessionId)
      .eq('member_id', memberId)

    if (error) {
      throw new Error(`Phê duyệt vắng phép thất bại: ${error.message}`)
    }

    // Ghi audit log
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action: 'APPROVE_EXCUSED_ABSENCE',
      target_type: 'meeting_attendance',
      target_id: memberId,
      metadata: { sessionId, memberId }
    })
  }
}
