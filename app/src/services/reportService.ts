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
  generatedAt: string
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
    // All counters and rankings come from one database statement at one point in time.
    const { data: snapshot, error } = await supabase.rpc('meeting_report_snapshot', {
      p_meeting_session_id: sessionId,
      p_organization_id: organizationId
    })
    if (error) throw new Error(error.message || 'Không thể lấy dữ liệu báo cáo.')
    if (!snapshot || snapshot.session?.id !== sessionId || snapshot.session?.organization_id !== organizationId) {
      throw new Error('Không tìm thấy thông tin phiên họp.')
    }
    if (!snapshot.generatedAt || !Number.isFinite(Date.parse(snapshot.generatedAt)) ||
      !['participants', 'attendance', 'attempts', 'chiBos'].every(key => Array.isArray(snapshot[key]))) {
      throw new Error('Dữ liệu báo cáo không đầy đủ. Vui lòng làm mới.')
    }

    const session = snapshot.session
    const participants: Array<{ member_id: string; chi_bo_id: string }> =
      Array.from(new Map<string, { member_id: string; chi_bo_id: string }>(
        snapshot.participants.map((p: any) => [p.member_id, p])).values())
    const participantIds = new Set(participants.map(p => p.member_id))
    const attendance: Array<{ member_id: string; status: string; gps_valid: boolean | null }> =
      Array.from(new Map<string, { member_id: string; status: string; gps_valid: boolean | null }>(
        snapshot.attendance.filter((a: any) => participantIds.has(a.member_id))
          .map((a: any) => [a.member_id, a])).values())
    // A completed person is counted once, even if historical duplicate attempts exist.
    const latestByMember = new Map<string, any>()
    for (const attempt of snapshot.attempts) {
      if (attempt.members?.organization_id && attempt.members.organization_id !== organizationId) {
        throw new Error('Dữ liệu kết quả thi không thuộc xã đang chọn.')
      }
      if (attempt.status !== 'submitted') continue
      const previous = latestByMember.get(attempt.member_id)
      if (!previous || String(attempt.submitted_at || '').localeCompare(String(previous.submitted_at || '')) > 0 ||
        (attempt.submitted_at === previous.submitted_at && String(attempt.id || '') > String(previous.id || ''))) {
        latestByMember.set(attempt.member_id, attempt)
      }
    }
    const attempts: any[] = Array.from(latestByMember.values())
    const totalParticipants = participants.length
    const attendedCount = attendance.filter(a => ['present', 'warning', 'manual'].includes(a.status)).length
    const excusedCount = attendance.filter(a => a.status === 'excused').length
    const warningGpsCount = attendance.filter(a => a.status === 'warning' || a.gps_valid === false).length
    const absentCount = Math.max(0, totalParticipants - attendedCount - excusedCount)
    const examSubmittedCount = attempts.length
    const examNotSubmittedCount = Math.max(0, totalParticipants - examSubmittedCount)
    const sumScores = attempts.reduce((sum, a) => sum + Number(a.score || 0), 0)
    // Preserve the existing whole-roster average (including those not yet submitted).
    const averageScore = totalParticipants > 0 ? Number((sumScores / totalParticipants).toFixed(2)) : 0

    const chiBoMap = new Map<string, ChiBoReport>()
    snapshot.chiBos.forEach((cb: any) => chiBoMap.set(cb.id, {
      id: cb.id, name: cb.name, secretaryName: cb.secretary_name || 'Chưa cập nhật',
      totalRequired: 0, totalAttended: 0, totalExcused: 0, attendanceRate: 0, avgScore: 0
    }))
    const attendeeIds = new Set(attendance.filter(a => ['present', 'warning', 'manual'].includes(a.status)).map(a => a.member_id))
    const excusedIds = new Set(attendance.filter(a => a.status === 'excused').map(a => a.member_id))
    const scores = new Map(attempts.map(a => [a.member_id, Number(a.score || 0)]))
    const branchScores = new Map<string, number>()
    participants.forEach(p => {
      const branch = chiBoMap.get(p.chi_bo_id)
      if (!branch) return
      branch.totalRequired++
      if (attendeeIds.has(p.member_id)) branch.totalAttended++
      else if (excusedIds.has(p.member_id)) branch.totalExcused++
      branchScores.set(p.chi_bo_id, (branchScores.get(p.chi_bo_id) || 0) + (scores.get(p.member_id) || 0))
    })
    const chiBoReportsList = Array.from(chiBoMap.values()).map(branch => ({
      ...branch,
      attendanceRate: branch.totalRequired > 0 ? Number((100 * branch.totalAttended / branch.totalRequired).toFixed(1)) : 0,
      avgScore: branch.totalRequired > 0 ? Number(((branchScores.get(branch.id) || 0) / branch.totalRequired).toFixed(2)) : 0
    })).sort((a, b) => b.attendanceRate - a.attendanceRate || b.avgScore - a.avgScore || a.name.localeCompare(b.name, 'vi'))
    const topMembers: TopMember[] = [...attempts]
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) ||
        Number(a.duration_seconds || 0) - Number(b.duration_seconds || 0) ||
        String(a.submitted_at || '').localeCompare(String(b.submitted_at || '')) ||
        a.member_id.localeCompare(b.member_id))
      .slice(0, 10).map(att => ({
        memberId: att.member_id, fullName: att.members?.full_name || 'Không rõ',
        position: att.members?.position || 'Đảng viên', chiBoName: att.members?.chi_bos?.name || 'Không rõ',
        score: Number(att.score || 0), correctCount: att.correct_count ?? 0,
        totalQuestions: att.total_questions ?? 0, durationSeconds: att.duration_seconds ?? 0,
        submittedAt: att.submitted_at
      }))

    return {
      sessionId,
      generatedAt: snapshot.generatedAt,
      title: session.title,
      meetingDate: session.meeting_date || 'Chưa rõ',
      stats: { totalParticipants, attendedCount, warningGpsCount, absentCount, excusedCount,
        examSubmittedCount, examNotSubmittedCount, averageScore },
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
    lines.push(`Số liệu cập nhật lúc: ${new Date(report.generatedAt).toLocaleString('vi-VN')}`)
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
      ["Số liệu cập nhật lúc:", new Date(report.generatedAt).toLocaleString('vi-VN')],
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
