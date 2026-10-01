import { supabase } from './supabaseClient'
import { tenantService } from './tenantService'
import * as XLSX from 'xlsx'

export interface ChiBoReport {
  id: string
  name: string
  secretaryName: string
  totalRequired: number
  totalAttended: number
  totalExcused: number
  attendanceRate: number
  avgScore: number
}

export interface TopMember {
  memberId: string
  fullName: string
  position: string
  chiBoName: string
  score: number
  correctCount: number
  totalQuestions: number
  durationSeconds: number
  submittedAt: string
}

export interface MeetingReportData {
  sessionId: string
  title: string
  meetingDate: string
  stats: {
    totalParticipants: number
    attendedCount: number
    warningGpsCount: number
    absentCount: number
    excusedCount: number
    examSubmittedCount: number
    examNotSubmittedCount: number
    averageScore: number
  }
  chiBoReports: ChiBoReport[]
  topMembers: TopMember[]
}

export const reportService = {
  /**
   * Generates a comprehensive meeting report containing stats, chi bo rankings, and top 10 members
   */
  async compileMeetingReport(sessionId: string, organizationId = tenantService.requireOrganizationId()): Promise<MeetingReportData> {
    if (!sessionId.trim() || !organizationId) throw new Error('Thiếu xã hoặc phiên họp báo cáo.')
    // 0. Fetch session details
    const { data: session, error: sError } = await supabase
      .from('meeting_sessions')
      .select('title, meeting_date')
      .eq('id', sessionId)
      .eq('organization_id', organizationId)
      .single()

    if (sError || !session) {
      throw new Error('Không tìm thấy thông tin phiên họp.')
    }

    // 1. Fetch meeting_participants
    const { data: participants, error: pError } = await supabase
      .from('meeting_participants')
      .select('member_id, chi_bo_id')
      .eq('meeting_session_id', sessionId)
      .eq('organization_id', organizationId)

    if (pError || !participants) {
      throw new Error('Không thể lấy danh sách đảng viên đăng ký phiên họp.')
    }

    const totalParticipants = participants.length

    // 2. Fetch meeting_attendance
    const { data: attendance, error: aError } = await supabase
      .from('meeting_attendance')
      .select('member_id, status, gps_valid')
      .eq('meeting_session_id', sessionId)
      .eq('organization_id', organizationId)

    if (aError || !attendance) {
      throw new Error('Không thể lấy dữ liệu điểm danh của phiên họp.')
    }

    const attendedCount = attendance.filter(a => ['present', 'warning', 'manual'].includes(a.status)).length
    const excusedCount = attendance.filter(a => a.status === 'excused').length
    const warningGpsCount = attendance.filter(a => a.status === 'warning' || a.gps_valid === false).length
    const absentCount = Math.max(0, totalParticipants - attendedCount - excusedCount)

    // 3. Fetch exam_attempts
    const { data: attempts, error: attError } = await supabase
      .from('exam_attempts')
      .select('member_id, score, status')
      .eq('meeting_session_id', sessionId)
      .eq('organization_id', organizationId)
      .eq('status', 'submitted')

    if (attError || !attempts) {
      throw new Error('Không thể lấy dữ liệu kết quả thi của phiên họp.')
    }

    const examSubmittedCount = attempts.length
    const examNotSubmittedCount = Math.max(0, totalParticipants - examSubmittedCount)
    
    const sumScores = attempts.reduce((acc, curr) => acc + Number(curr.score || 0), 0)
    const averageScore = totalParticipants > 0 ? Number((sumScores / totalParticipants).toFixed(2)) : 0

    // 4. Fetch all Chi Bos
    const { data: chiBos, error: cbError } = await supabase
      .from('chi_bos')
      .select('*')
      .eq('is_active', true)
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true })

    if (cbError || !chiBos) {
      throw new Error('Không thể lấy danh sách chi bộ.')
    }

    // 5. Fetch members and their scores grouped by Chi Bo
    // We can map this in-memory for accuracy
    const chiBoMap = new Map<string, ChiBoReport>()
    
    // Group participants and attendance by Chi Bo
    chiBos.forEach(cb => {
      chiBoMap.set(cb.id, {
        id: cb.id,
        name: cb.name,
        secretaryName: cb.secretary_name || 'Chưa cập nhật',
        totalRequired: 0,
        totalAttended: 0,
        totalExcused: 0,
        attendanceRate: 0,
        avgScore: 0
      })
    })

    // Count participants per Chi Bo
    participants.forEach(p => {
      const report = chiBoMap.get(p.chi_bo_id)
      if (report) {
        report.totalRequired++
      }
    })

    // Count attended and excused per Chi Bo
    const attendeeMemberIds = new Set(attendance.filter(a => ['present', 'warning', 'manual'].includes(a.status)).map(a => a.member_id))
    const excusedMemberIds = new Set(attendance.filter(a => a.status === 'excused').map(a => a.member_id))
    participants.forEach(p => {
      if (attendeeMemberIds.has(p.member_id)) {
        const report = chiBoMap.get(p.chi_bo_id)
        if (report) {
          report.totalAttended++
        }
      } else if (excusedMemberIds.has(p.member_id)) {
        const report = chiBoMap.get(p.chi_bo_id)
        if (report) {
          report.totalExcused++
        }
      }
    })

    // Count average score per Chi Bo
    const memberScoresMap = new Map(attempts.map(att => [att.member_id, Number(att.score || 0)]))
    const chiBoScoresSum = new Map<string, number>()
    const chiBoExamCount = new Map<string, number>()

    participants.forEach(p => {
      const score = memberScoresMap.get(p.member_id)
      if (score !== undefined) {
        chiBoScoresSum.set(p.chi_bo_id, (chiBoScoresSum.get(p.chi_bo_id) || 0) + score)
        chiBoExamCount.set(p.chi_bo_id, (chiBoExamCount.get(p.chi_bo_id) || 0) + 1)
      }
    })

    // Finalize Chi Bo reports
    const chiBoReportsList: ChiBoReport[] = Array.from(chiBoMap.values()).map(report => {
      const totalScore = chiBoScoresSum.get(report.id) || 0
      
      return {
        ...report,
        attendanceRate: report.totalRequired > 0 ? Number(((report.totalAttended / report.totalRequired) * 100).toFixed(1)) : 0,
        avgScore: report.totalRequired > 0 ? Number((totalScore / report.totalRequired).toFixed(2)) : 0
      }
    })

    // Sort Chi Bo rankings: Primary by Attendance Rate (desc), Secondary by average score (desc)
    chiBoReportsList.sort((a, b) => {
      if (b.attendanceRate !== a.attendanceRate) {
        return b.attendanceRate - a.attendanceRate
      }
      return b.avgScore - a.avgScore
    })

    // 6. Fetch Top 10 individuals
    // Score descending, duration_seconds ascending (lower time first)
    const { data: topAttempts, error: topError } = await supabase
      .from('exam_attempts')
      .select(`
        id,
        member_id,
        score,
        correct_count,
        total_questions,
        duration_seconds,
        submitted_at,
        members!inner (
          organization_id,
          full_name,
          position,
          chi_bos (
            name
          )
        )
      `)
      .eq('meeting_session_id', sessionId)
      .eq('organization_id', organizationId)
      .eq('status', 'submitted')
      .eq('members.organization_id', organizationId)
      .order('score', { ascending: false })
      .order('duration_seconds', { ascending: true })
      .limit(10)

    if (topError) {
      throw new Error('Không thể lấy danh sách cá nhân xuất sắc: ' + topError.message)
    }

    const topMembers: TopMember[] = (topAttempts || []).map((att: any) => ({
      memberId: att.member_id,
      fullName: att.members?.full_name || 'Không rõ',
      position: att.members?.position || 'Đảng viên',
      chiBoName: att.members?.chi_bos?.name || 'Không rõ',
      score: Number(att.score || 0),
      correctCount: att.correct_count || 0,
      totalQuestions: att.total_questions || 10,
      durationSeconds: att.duration_seconds || 0,
      submittedAt: att.submitted_at
    }))

    return {
      sessionId,
      title: session.title,
      meetingDate: session.meeting_date || 'Chưa rõ',
      stats: {
        totalParticipants,
        attendedCount,
        warningGpsCount,
        absentCount,
        excusedCount,
        examSubmittedCount,
        examNotSubmittedCount,
        averageScore
      },
      chiBoReports: chiBoReportsList,
      topMembers
    }
  },

  /**
   * Generates a downloadable CSV text string with Vietnamese support (UTF-8 with BOM)
   */
  generateCsvContent(report: MeetingReportData): string {
    const lines: string[] = []

    // BOM UTF-8 for Excel Vietnamese support
    lines.push('\uFEFF')

    // Header Metadata
    lines.push(`BÁO CÁO TỔNG HỢP PHIÊN SINH HOẠT CHÍNH TRỊ`)
    lines.push(`Phiên họp: "${report.title}"`)
    lines.push(`Ngày sinh hoạt: ${report.meetingDate}`)
    lines.push('')

    // Key Statistics Section
    lines.push('THỐNG KÊ CHUNG')
    lines.push('Chỉ số,Số lượng,Tỷ lệ')
    lines.push(`Tổng sĩ số đảng viên chốt tham dự,${report.stats.totalParticipants},100%`)
    lines.push(`Đảng viên đã điểm danh,${report.stats.attendedCount},${report.stats.totalParticipants > 0 ? ((report.stats.attendedCount / report.stats.totalParticipants) * 100).toFixed(1) : 0}%`)
    lines.push(`Đảng viên vắng có lý do,${report.stats.excusedCount || 0},${report.stats.totalParticipants > 0 ? (((report.stats.excusedCount || 0) / report.stats.totalParticipants) * 100).toFixed(1) : 0}%`)
    lines.push(`Cảnh báo định vị GPS,${report.stats.warningGpsCount},${report.stats.attendedCount > 0 ? ((report.stats.warningGpsCount / report.stats.attendedCount) * 100).toFixed(1) : 0}%`)
    lines.push(`Đảng viên vắng mặt (không phép),${report.stats.absentCount},${report.stats.totalParticipants > 0 ? ((report.stats.absentCount / report.stats.totalParticipants) * 100).toFixed(1) : 0}%`)
    lines.push(`Đã hoàn thành bài kiểm tra,${report.stats.examSubmittedCount},${report.stats.totalParticipants > 0 ? ((report.stats.examSubmittedCount / report.stats.totalParticipants) * 100).toFixed(1) : 0}%`)
    lines.push(`Điểm số trung bình toàn Đảng bộ,${report.stats.averageScore},-`)
    lines.push('')

    // Chi Bo Rankings Section
    lines.push('BẢNG XẾP HẠNG THI ĐUA CHI BỘ')
    lines.push('Thứ hạng,Tên Chi bộ,Bí thư Chi bộ,Sĩ số yêu cầu,Số đảng viên có mặt,Số đảng viên vắng có lý do,Tỷ lệ điểm danh,Điểm thi trung bình')
    report.chiBoReports.forEach((cb, idx) => {
      lines.push(`${idx + 1},${cb.name},${cb.secretaryName},${cb.totalRequired},${cb.totalAttended},${cb.totalExcused || 0},${cb.attendanceRate}%,${cb.avgScore}`)
    })
    lines.push('')

    // Top 10 Honor Members Section
    lines.push('BẢNG VÀNG DANH DỰ - TOP 10 ĐẲNG VIÊN XUẤT SẮC')
    lines.push('Hạng,Họ và tên,Chi bộ,Chức vụ,Điểm số,Số câu đúng,Thời gian làm bài')
    report.topMembers.forEach((member, idx) => {
      const minutes = Math.floor(member.durationSeconds / 60)
      const seconds = member.durationSeconds % 60
      const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
      lines.push(`${idx + 1},${member.fullName},${member.chiBoName},${member.position},${member.score},${member.correctCount}/${member.totalQuestions},${timeStr}`)
    })

    return lines.join('\n')
  },

  /**
   * Helper utility to download CSV in browser
   */
  downloadCsv(report: MeetingReportData): void {
    const csvContent = this.generateCsvContent(report)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (navigator.msSaveBlob) {
      // IE 10+
      navigator.msSaveBlob(blob, `Bao_cao_sinh_hoat_chinh_tri_${report.sessionId}.csv`)
    } else {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `Bao_cao_sinh_hoat_chinh_tri_${report.sessionId}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  },

  /**
   * Helper utility to download Excel (.xlsx) file in browser using SheetJS
   */
  downloadExcel(report: MeetingReportData): void {
    const wb = XLSX.utils.book_new()

    // Sheet 1: THỐNG KÊ CHUNG
    const statsData = [
      ["BÁO CÁO TỔNG HỢP PHIÊN SINH HOẠT CHÍNH TRỊ DƯỚI NGHI THỨC CHÀO CỜ"],
      ["Phiên họp:", report.title],
      ["Ngày họp:", report.meetingDate],
      [],
      ["THÔNG SỐ THỐNG KÊ CHUNG"],
      ["Chỉ số", "Số lượng", "Tỷ lệ"],
      ["Tổng sĩ số đảng viên tham dự", report.stats.totalParticipants, "100%"],
      ["Đảng viên đã điểm danh", report.stats.attendedCount, report.stats.totalParticipants > 0 ? `${((report.stats.attendedCount / report.stats.totalParticipants) * 100).toFixed(1)}%` : "0%"],
      ["Đảng viên vắng có lý do", report.stats.excusedCount || 0, report.stats.totalParticipants > 0 ? `${(((report.stats.excusedCount || 0) / report.stats.totalParticipants) * 100).toFixed(1)}%` : "0%"],
      ["Cảnh báo định vị GPS", report.stats.warningGpsCount, report.stats.attendedCount > 0 ? `${((report.stats.warningGpsCount / report.stats.attendedCount) * 100).toFixed(1)}%` : "0%"],
      ["Đảng viên vắng mặt (không phép)", report.stats.absentCount, report.stats.totalParticipants > 0 ? `${((report.stats.absentCount / report.stats.totalParticipants) * 100).toFixed(1)}%` : "0%"],
      ["Đã hoàn thành bài kiểm tra", report.stats.examSubmittedCount, report.stats.totalParticipants > 0 ? `${((report.stats.examSubmittedCount / report.stats.totalParticipants) * 100).toFixed(1)}%` : "0%"],
      ["Điểm số trung bình toàn Đảng bộ", report.stats.averageScore, "-"]
    ]
    const wsStats = XLSX.utils.aoa_to_sheet(statsData)
    XLSX.utils.book_append_sheet(wb, wsStats, "Thống kê chung")

    // Sheet 2: XẾP HẠNG CHI BỘ
    const chiBoData = [
      ["BẢNG XẾP HẠNG THI ĐUA CÁC CHI BỘ"],
      ["Thứ hạng", "Tên Chi bộ", "Bí thư Chi bộ", "Sĩ số yêu cầu", "Đảng viên có mặt", "Vắng có lý do", "Tỷ lệ điểm danh", "Điểm thi trung bình"],
      ...report.chiBoReports.map((cb, idx) => [
        idx + 1,
        cb.name,
        cb.secretaryName,
        cb.totalRequired,
        cb.totalAttended,
        cb.totalExcused || 0,
        `${cb.attendanceRate}%`,
        cb.avgScore
      ])
    ]
    const wsChiBo = XLSX.utils.aoa_to_sheet(chiBoData)
    XLSX.utils.book_append_sheet(wb, wsChiBo, "Xếp hạng Chi bộ")

    // Sheet 3: DANH SÁCH ĐẢNG VIÊN THI ĐUA XUẤT SẮC
    const topMembersData = [
      ["BẢNG VÀNG VINH DANH CÁ NHÂN XUẤT SẮC"],
      ["Hạng", "Họ và tên", "Chi bộ", "Chức vụ", "Điểm số", "Số câu đúng", "Thời gian làm bài"],
      ...report.topMembers.map((member, idx) => {
        const minutes = Math.floor(member.durationSeconds / 60)
        const seconds = member.durationSeconds % 60
        const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
        return [
          idx + 1,
          member.fullName,
          member.chiBoName,
          member.position || "",
          member.score,
          `${member.correctCount}/${member.totalQuestions}`,
          timeStr
        ]
      })
    ]
    const wsTopMembers = XLSX.utils.aoa_to_sheet(topMembersData)
    XLSX.utils.book_append_sheet(wb, wsTopMembers, "Vinh danh đảng viên")

    // Write file
    XLSX.writeFile(wb, `Bao_cao_sinh_hoat_chinh_tri_${report.sessionId}.xlsx`)
  }
}

// Global declaration workaround for IE msSaveBlob compiler warning
declare global {
  interface Navigator {
    msSaveBlob?: (blob: any, defaultName?: string) => boolean
  }
}
