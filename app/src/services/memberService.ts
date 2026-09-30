import { supabase } from './supabaseClient'
import bcrypt from 'bcryptjs'

export interface MemberSessionStatus {
  attended: boolean
  attendanceTime: string | null
  examSubmitted: boolean
  examScore: number | null
  hasExam: boolean
  examId: string | null
  excused?: boolean
  excusedReason?: string | null
  attendanceStatus?: string | null
  attendanceWarningReason?: string | null
}

export const memberService = {
  /**
   * Retrieves the current member's progress details (attendance, exam submission status) for a specific meeting session ID
   */
  async getMemberSessionStatus(memberId: string, sessionId: string): Promise<MemberSessionStatus> {
    const status: MemberSessionStatus = {
      attended: false,
      attendanceTime: null,
      examSubmitted: false,
      examScore: null,
      hasExam: false,
      examId: null,
      excused: false,
      excusedReason: null
    }

    try {
      // 1. Check attendance record
      const { data: attendance, error: attError } = await supabase
        .from('meeting_attendance')
        .select('marked_at, status, warning_reason')
        .eq('meeting_session_id', sessionId)
        .eq('member_id', memberId)
        .maybeSingle()

      if (!attError && attendance) {
        status.attendanceStatus = attendance.status
        status.attendanceWarningReason = attendance.warning_reason
        if (['present', 'warning', 'manual'].includes(attendance.status)) {
          status.attended = true
          status.attendanceTime = attendance.marked_at
        } else if (attendance.status === 'excused') {
          status.excused = true
          status.excusedReason = attendance.warning_reason
          status.attendanceTime = attendance.marked_at
        }
      }

      // 2. Check if there is an active exam associated with the session
      const { data: exam, error: examError } = await supabase
        .from('meeting_exams')
        .select('id, status')
        .eq('meeting_session_id', sessionId)
        .maybeSingle()

      if (!examError && exam) {
        status.hasExam = true
        status.examId = exam.id

        // 3. Check if member submitted an attempt for this exam
        const { data: attempt, error: attpError } = await supabase
          .from('exam_attempts')
          .select('status, score')
          .eq('meeting_exam_id', exam.id)
          .eq('member_id', memberId)
          .maybeSingle()

        if (!attpError && attempt && attempt.status === 'submitted') {
          status.examSubmitted = true
          status.examScore = Number(attempt.score)
        }
      }
    } catch (err) {
      console.error('Error getting member session status:', err)
    }

    return status
  },

  /**
   * Fetch all Chi Bos from DB
   */
  async getChiBos(): Promise<any[]> {
    const { data, error } = await supabase
      .from('chi_bos')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching chi bos:', error.message)
      throw new Error(error.message)
    }
    return data || []
  },

  /**
   * Fetch members belonging to a Chi Bo
   */
  async getMembersByChiBo(chiBoId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('chi_bo_id', chiBoId)
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Error fetching members by chi bo:', error.message)
      throw new Error(error.message)
    }
    return data || []
  },

  /**
   * Fetch all active members along with their Chi Bo details
   */
  async getAllMembers(): Promise<any[]> {
    const { data, error } = await supabase
      .from('members')
      .select(`
        *,
        chi_bos(id, name),
        app_users(username, role)
      `)
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Error fetching all members:', error.message)
      throw new Error(error.message)
    }
    return data || []
  },

  /**
   * Helper to generate username matching Rule 4
   */
  generateUsername(fullName: string, chiBoName: string): string {
    const removeTones = (str: string): string => {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase();
    };
    
    const cleanName = removeTones(fullName.trim());
    const nameParts = cleanName.split(/\s+/).filter(Boolean);
    if (nameParts.length === 0) return 'user';
    
    const lastName = nameParts[nameParts.length - 1];
    const initials = nameParts.slice(0, nameParts.length - 1)
      .map(p => p.charAt(0))
      .join('');
      
    const match = chiBoName.match(/\d+/);
    const chiBoNum = match ? match[0] : '1';
    
    return `${lastName}${initials}.chibo${chiBoNum}`;
  },

  /**
   * Creates a new member and their corresponding login user account in app_users
   */
  async createMember(
    fullName: string,
    chiBoId: string,
    chiBoName: string,
    position: string | null,
    phone: string | null,
    role: 'member' | 'organizer' | 'admin' = 'member',
    customUsername?: string | null,
    actorId?: string
  ): Promise<any> {
    // 1. Generate Username
    const username = customUsername ? customUsername.trim() : this.generateUsername(fullName, chiBoName);
    
    // 2. Insert into members table
    const { data: newMember, error: mError } = await supabase
      .from('members')
      .insert({
        full_name: fullName,
        chi_bo_id: chiBoId,
        position: position,
        phone: phone,
        is_active: true
      })
      .select('*')
      .single()

    if (mError) {
      console.error('Error inserting member:', mError.message)
      throw new Error(`Tạo thông tin đảng viên thất bại: ${mError.message}`)
    }

    // 3. Hash Default Password (Thanhtra@123)
    const salt = bcrypt.genSaltSync(10)
    const passwordHash = bcrypt.hashSync('Thanhtra@123', salt)

    // 4. Insert into app_users
    const { error: uError } = await supabase
      .from('app_users')
      .insert({
        member_id: newMember.id,
        username: username,
        password_hash: passwordHash,
        role: role,
        must_change_password: true,
        is_active: true
      })

    if (uError) {
      console.error('Error inserting app user:', uError.message)
      // Soft cleanup: delete members record if users insert fails to prevent orphan members
      await supabase.from('members').delete().eq('id', newMember.id)
      throw new Error(`Tạo tài khoản đăng nhập thất bại: ${uError.message}`)
    }

    // 5. Ghi nhận Audit log
    if (actorId) {
      await supabase.from('audit_logs').insert({
        actor_id: actorId,
        action: 'CREATE_MEMBER',
        target_type: 'members',
        target_id: newMember.id,
        metadata: { fullName, chiBoName, username }
      }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
    }

    return newMember
  },

  async updateMember(
    memberId: string,
    fullName: string,
    chiBoId: string,
    chiBoName: string,
    position: string | null,
    phone: string | null,
    customUsername?: string | null,
    role?: 'member' | 'organizer' | 'admin',
    actorId?: string
  ): Promise<any> {
    // 1. Update members table
    const { data: updatedMember, error: mError } = await supabase
      .from('members')
      .update({
        full_name: fullName,
        chi_bo_id: chiBoId,
        position: position,
        phone: phone,
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId)
      .select('*')
      .single()

    if (mError) {
      console.error('Error updating member:', mError.message)
      throw new Error(`Cập nhật đảng viên thất bại: ${mError.message}`)
    }

    // 2. Generate new username based on the updated name and Chi Bo name
    const newUsername = customUsername ? customUsername.trim() : this.generateUsername(fullName, chiBoName);

    // 3. Update app_users username dynamically
    const updatePayload: any = {
      username: newUsername,
      updated_at: new Date().toISOString()
    }
    if (role) {
      updatePayload.role = role
    }

    const { error: uError } = await supabase
      .from('app_users')
      .update(updatePayload)
      .eq('member_id', memberId)

    if (uError) {
      console.error('Warning: could not update username in app_users:', uError.message)
    }

    // 4. Ghi nhận Audit log
    if (actorId) {
      await supabase.from('audit_logs').insert({
        actor_id: actorId,
        action: 'UPDATE_MEMBER',
        target_type: 'members',
        target_id: memberId,
        metadata: { fullName, chiBoName, username: newUsername }
      }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
    }

    return updatedMember
  },

  /**
   * Resets a member's login password back to the default "Thanhtra@123" and sets must_change_password to true
   */
  async resetPasswordToDefault(memberId: string, actorId?: string): Promise<void> {
    const salt = bcrypt.genSaltSync(10)
    const defaultHash = bcrypt.hashSync('Thanhtra@123', salt)

    const { error } = await supabase
      .from('app_users')
      .update({
        password_hash: defaultHash,
        must_change_password: true,
        updated_at: new Date().toISOString()
      })
      .eq('member_id', memberId)

    if (error) {
      console.error('Error resetting password:', error.message)
      throw new Error(`Đặt lại mật khẩu mặc định thất bại: ${error.message}`)
    }

    // Ghi nhận Audit log
    if (actorId) {
      await supabase.from('audit_logs').insert({
        actor_id: actorId,
        action: 'RESET_PASSWORD',
        target_type: 'members',
        target_id: memberId,
        metadata: { note: 'Đặt lại về Thanhtra@123' }
      }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
    }
  },

  /**
   * Tries to hard-delete a member and user account. If blocked by foreign key references (such as existing attendance/exams),
   * it gracefully falls back to soft-deleting them (is_active = false)
   */
  async deleteMember(memberId: string, actorId?: string): Promise<{ deleted: boolean; softDeleted: boolean }> {
    try {
      // 1. Try to delete user account
      const { error: uError } = await supabase
        .from('app_users')
        .delete()
        .eq('member_id', memberId)

      if (uError) {
        throw new Error(uError.message)
      }

      // 2. Try to delete member record
      const { error: mError } = await supabase
        .from('members')
        .delete()
        .eq('id', memberId)

      if (mError) {
        throw new Error(mError.message)
      }

      // Ghi nhận Audit log
      if (actorId) {
        await supabase.from('audit_logs').insert({
          actor_id: actorId,
          action: 'DELETE_MEMBER',
          target_type: 'members',
          target_id: memberId,
          metadata: { memberId, type: 'hard' }
        }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
      }

      return { deleted: true, softDeleted: false }
    } catch (err) {
      console.log('Cascade hard delete failed. Falling back to soft-delete...', err)
      
      // Soft-delete user and member
      const { error: uUpdateError } = await supabase
        .from('app_users')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('member_id', memberId)

      if (uUpdateError) {
        console.error('Soft delete of app_users failed:', uUpdateError.message)
        throw new Error(`Vô hiệu hóa tài khoản thất bại: ${uUpdateError.message}`)
      }

      const { error: mUpdateError } = await supabase
        .from('members')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', memberId)

      if (mUpdateError) {
        console.error('Soft delete of members failed:', mUpdateError.message)
        throw new Error(`Vô hiệu hóa đảng viên thất bại: ${mUpdateError.message}`)
      }

      // Ghi nhận Audit log
      if (actorId) {
        await supabase.from('audit_logs').insert({
          actor_id: actorId,
          action: 'SOFT_DELETE_MEMBER',
          target_type: 'members',
          target_id: memberId,
          metadata: { memberId, type: 'soft' }
        }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
      }

      return { deleted: false, softDeleted: true }
    }
  },

  /**
   * Assigns Chi Bo leadership titles (Bí thư, Phó Bí thư, Chi ủy viên) to selected members, preserving existing text positions
   */
  async updateChiBoLeaders(
    chiBoId: string,
    biThuMemberId: string | null,
    phoBiThuMemberId: string | null,
    chiUyVienMemberIds: string[]
  ): Promise<void> {
    // 1. Get all members of the Chi Bo
    const { data: cbMembers, error } = await supabase
      .from('members')
      .select('id, position')
      .eq('chi_bo_id', chiBoId)
      .eq('is_active', true)

    if (error || !cbMembers) {
      throw new Error(`Lấy danh sách thành viên chi bộ thất bại: ${error?.message}`)
    }

    // 2. Update each member's position
    for (const m of cbMembers) {
      let currentPos = m.position || ''
      
      // Remove any existing chi bo leadership terms
      let basePos = currentPos
        .replace(/Bí thư chi bộ|Phó Bí thư chi bộ|Chi ủy viên/gi, '')
        .replace(/^\s*\|\s*|\s*\|\s*$/g, '') // remove outer pipes
        .replace(/\s*\|\s*\|\s*/g, ' | ') // fix double pipes
        .trim()
        
      const roles: string[] = []
      if (m.id === biThuMemberId) {
        roles.push('Bí thư chi bộ')
      } else if (m.id === phoBiThuMemberId) {
        roles.push('Phó Bí thư chi bộ')
      } else if (chiUyVienMemberIds.includes(m.id)) {
        roles.push('Chi ủy viên')
      }

      let newPosition = ''
      if (roles.length > 0) {
        const rolesStr = roles.join(' & ')
        newPosition = basePos ? `${rolesStr} | ${basePos}` : rolesStr
      } else {
        newPosition = basePos
      }

      // Convert empty string to null
      const finalPosition = newPosition.trim() || null

      if (finalPosition !== m.position) {
        const { error: updateError } = await supabase
          .from('members')
          .update({ position: finalPosition, updated_at: new Date().toISOString() })
          .eq('id', m.id)

        if (updateError) {
          console.error(`Error updating position for member ${m.id}:`, updateError.message)
          throw new Error(`Cập nhật chức vụ thất bại: ${updateError.message}`)
        }
      }
    }
  },

  /**
   * Calculates the exam rank of a member for a specific meeting session
   */
  async getMemberExamRank(sessionId: string, memberId: string) {
    const { data: attempts, error } = await supabase
      .from('exam_attempts')
      .select('member_id, score, duration_seconds, correct_count, total_questions')
      .eq('meeting_session_id', sessionId)
      .eq('status', 'submitted')
      .order('score', { ascending: false })
      .order('duration_seconds', { ascending: true })

    if (error || !attempts) {
      console.error('Error fetching attempts for rank:', error?.message)
      return null
    }

    const index = attempts.findIndex(att => att.member_id === memberId)
    if (index === -1) {
      return null
    }

    return {
      rank: index + 1,
      total: attempts.length,
      score: Number(attempts[index].score),
      correctCount: attempts[index].correct_count,
      totalQuestions: attempts[index].total_questions,
      durationSeconds: attempts[index].duration_seconds
    }
  },

  /**
   * Retrieves a member's history of participating in all past sessions
   */
  async getMemberParticipationHistory(memberId: string) {
    const { data: sessions, error: sError } = await supabase
      .from('meeting_sessions')
      .select('id, title, meeting_date, status')
      .neq('status', 'draft')
      .order('meeting_date', { ascending: false })

    if (sError || !sessions) {
      console.error('Error fetching sessions:', sError?.message)
      throw new Error('Không thể tải lịch sử các phiên họp.')
    }

    const { data: attendance, error: aError } = await supabase
      .from('meeting_attendance')
      .select('meeting_session_id, status, marked_at, warning_reason')
      .eq('member_id', memberId)

    if (aError) {
      console.error('Error fetching attendance:', aError.message)
    }

    const { data: attempts, error: attError } = await supabase
      .from('exam_attempts')
      .select('score, correct_count, total_questions, duration_seconds, meeting_session_id')
      .eq('member_id', memberId)
      .eq('status', 'submitted')

    if (attError) {
      console.error('Error fetching attempts:', attError.message)
    }

    const attendanceMap = new Map(attendance?.map(a => [a.meeting_session_id, a]) || [])
    const attemptsMap = new Map(attempts?.map(a => [a.meeting_session_id, a]) || [])

    return sessions.map(session => {
      const attRecord = attendanceMap.get(session.id)
      const attempt = attemptsMap.get(session.id)

      let attendanceStatus: 'present' | 'warning' | 'excused' | 'absent' = 'absent'
      let attendanceTime: string | null = null
      let excuseReason: string | null = null

      if (attRecord) {
        attendanceTime = attRecord.marked_at
        if (['present', 'manual'].includes(attRecord.status)) {
          attendanceStatus = 'present'
        } else if (attRecord.status === 'warning') {
          attendanceStatus = 'warning'
          excuseReason = attRecord.warning_reason
        } else if (attRecord.status === 'excused') {
          attendanceStatus = 'excused'
          excuseReason = attRecord.warning_reason
        }
      }

      return {
        sessionId: session.id,
        title: session.title,
        meetingDate: session.meeting_date || 'Chưa rõ',
        status: session.status,
        attendanceStatus,
        attendanceTime,
        excuseReason,
        examScore: attempt ? Number(attempt.score) : null,
        correctCount: attempt ? attempt.correct_count : null,
        totalQuestions: attempt ? attempt.total_questions : null,
        durationSeconds: attempt ? attempt.duration_seconds : null
      }
    })
  }
}
