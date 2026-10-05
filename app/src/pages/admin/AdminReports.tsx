import React, { useState, useEffect, useRef, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, RefreshCw, Trophy, Star, Users, Calendar, UserCheck, Printer, FileText } from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { meetingService } from '../../services/meetingService'
import type { MeetingSession } from '../../services/meetingService'
import { reportService } from '../../services/reportService'
import type { MeetingReportData } from '../../services/reportService'
import { useAuth } from '../../contexts/AuthContext'
import { tenantService } from '../../services/tenantService'
import { useReportAutoRefresh } from '../../hooks/useReportAutoRefresh'

interface ChartSegment {
  label: string
  value: number
  color: string
}

const DonutChart: React.FC<{ title: string; segments: ChartSegment[] }> = ({ title, segments }) => {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const r = 40
  const circ = 2 * Math.PI * r
  const chartSegments = segments.reduce<Array<{ segment: ChartSegment; strokeDash: number; strokeOffset: number; accumulatedPercent: number }>>((result, segment) => {
    if (total === 0 || segment.value === 0) return result
    const previousPercent = result[result.length - 1]?.accumulatedPercent || 0
    const percent = (segment.value / total) * 100
    return [...result, {
      segment,
      strokeDash: (percent / 100) * circ,
      strokeOffset: circ - (previousPercent / 100) * circ,
      accumulatedPercent: previousPercent + percent
    }]
  }, [])

  return (
    <div className="p-4 bg-white/70 dark:bg-navy/40 rounded-card border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center">
      <h4 className="text-xs font-bold normal-case tracking-normal text-muted dark:text-slate-405 mb-3">{title}</h4>
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          <circle cx="50" cy="50" r={r} fill="transparent" stroke="rgba(0,0,0,0.03)" strokeWidth="10" />
          {chartSegments.map(({ segment, strokeDash, strokeOffset }, idx) => (
              <circle
                key={idx}
                cx="50"
                cy="50"
                r={r}
                fill="transparent"
                stroke={segment.color}
                strokeWidth="10"
                strokeDasharray={`${strokeDash} ${circ}`}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-in-out"
              />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold text-muted normal-case">Tỷ lệ</span>
          <span className="text-sm font-bold text-navy dark:text-white">
            {total > 0 ? `${Math.round((segments[0]?.value / total) * 100)}%` : '0%'}
          </span>
        </div>
      </div>
      <div className="mt-3 w-full text-xs font-bold text-muted dark:text-muted space-y-1">
        {segments.map((seg, idx) => (
          <div key={idx} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="truncate">{seg.label}</span>
            </div>
            <span className="shrink-0">{seg.value} ({total > 0 ? ((seg.value / total) * 100).toFixed(0) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export const AdminReports: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout, organizations, organizationId } = useAuth()
  const reportOrganizationName = organizations.find(org => org.id === organizationId)?.name || user?.organizationName || 'Đảng bộ cấp xã'
  const requestSequenceRef = useRef(0)
  const selectedMeetingIdRef = useRef('')
  const loadedOrganizationIdRef = useRef<string | null>(null)
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | null>(null)

  const [meeting, setMeeting] = useState<MeetingSession | null>(null)
  const [report, setReport] = useState<MeetingReportData | null>(null)
  const [meetingsList, setMeetingsList] = useState<MeetingSession[]>([])
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('')
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [exporting, setExporting] = useState(false)

  const getGuongMauChiBos = () => {
    if (!report || !report.chiBoReports || report.chiBoReports.length === 0) {
      return { discipline: null, academic: null }
    }
    let bestDiscipline = report.chiBoReports[0]
    let bestAcademic = report.chiBoReports[0]
    report.chiBoReports.forEach((cb: any) => {
      if (cb.attendanceRate > bestDiscipline.attendanceRate) {
        bestDiscipline = cb
      }
      if (cb.avgScore > bestAcademic.avgScore) {
        bestAcademic = cb
      }
    })
    return { discipline: bestDiscipline, academic: bestAcademic }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const loadReportData = useCallback(async (showSpinner = true, targetSessionId?: string) => {
    const requestId = ++requestSequenceRef.current
    const isCurrentRequest = () => requestId === requestSequenceRef.current && tenantService.getOrganizationId() === organizationId
    await Promise.resolve()
    if (!isCurrentRequest()) return
    const organizationChanged = loadedOrganizationIdRef.current !== organizationId
    if (showSpinner) setLoading(true)
    else setRefreshing(true)
    setError('')
    if (organizationChanged) {
      setMeeting(null)
      setReport(null)
      setMeetingsList([])
      selectedMeetingIdRef.current = ''
      setSelectedMeetingId('')
      setAutoRefresh(true)
    }
    if (!organizationId) {
      setMeeting(null)
      setReport(null)
      setMeetingsList([])
      setSelectedMeetingId('')
      setLoading(false)
      setRefreshing(false)
      loadedOrganizationIdRef.current = null
      setLoadedOrganizationId(null)
      return
    }
    try {
      // 1. Tải danh sách tất cả phiên họp để hiển thị trong dropdown
      const allMeetings = await meetingService.getMeetingList()
      if (!isCurrentRequest()) return
      // Lọc bỏ các phiên họp bản nháp chưa kích hoạt
      const filtered = allMeetings.filter(m => m.status !== 'draft')
      setMeetingsList(filtered)

      let selectedId = targetSessionId || selectedMeetingIdRef.current
      let currentSession = null

      if (filtered.length > 0) {
        if (selectedId) {
          currentSession = filtered.find(m => m.id === selectedId) || null
        }
        
        // Nếu chưa chọn hoặc không tìm thấy, mặc định lấy phiên họp đang hoạt động (active)
        if (!currentSession) {
          const activeSession = await meetingService.getActiveSession()
          if (!isCurrentRequest()) return
          if (activeSession && filtered.some(m => m.id === activeSession.id)) {
            currentSession = activeSession
          } else {
            // Nếu không có phiên active, chọn phiên họp đầu tiên (mới nhất)
            currentSession = filtered[0]
          }
        }
      }

      setMeeting(currentSession)

      if (currentSession) {
        selectedMeetingIdRef.current = currentSession.id
        setSelectedMeetingId(currentSession.id)
        const data = await reportService.compileMeetingReport(currentSession.id, organizationId)
        if (!isCurrentRequest()) return
        setReport(data)
      } else {
        selectedMeetingIdRef.current = ''
        setReport(null)
        setSelectedMeetingId('')
      }
      loadedOrganizationIdRef.current = organizationId
      setLoadedOrganizationId(organizationId)
    } catch (err: any) {
      if (!isCurrentRequest()) return
      console.error(err)
      setError(err.message || 'Không thể tải báo cáo của phiên họp.')
      if (organizationChanged) {
        loadedOrganizationIdRef.current = organizationId
        setLoadedOrganizationId(organizationId)
      }
    } finally {
      if (isCurrentRequest()) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [organizationId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReportData() }, 0)
    return () => {
      window.clearTimeout(timer)
      requestSequenceRef.current += 1
    }
  }, [loadReportData])

  useReportAutoRefresh(autoRefresh, organizationId, selectedMeetingId, () => loadReportData(false, selectedMeetingId))

  const handleSelectMeeting = (id: string) => {
    selectedMeetingIdRef.current = id
    setSelectedMeetingId(id)
    setReport(null)
    setMeeting(null)
    void loadReportData(true, id)
  }
  const exportToWord = (exportReport: MeetingReportData) => {

    // Lấy nội dung HTML của bản in báo cáo
    const contentHtml = document.getElementById('print-section')?.innerHTML || ''

    // Mẫu tài liệu MS Word HTML/MHTML
    const docTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>Báo cáo Kết quả Sinh hoạt chính trị</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page Section1 {
            size: 595.3pt 841.9pt; /* A4 size */
            margin: 56.7pt 56.7pt 56.7pt 56.7pt; /* 2cm margins */
            mso-header-margin: 36.0pt;
            mso-footer-margin: 36.0pt;
            mso-paper-source: 0;
          }
          div.Section1 {
            page: Section1;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 13pt;
            line-height: 1.3;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 10px;
            margin-bottom: 10px;
          }
          th, td {
            border: 1px solid black;
            padding: 6px;
            font-size: 11pt;
            vertical-align: top;
          }
          th {
            background-color: #f2f2f2;
            font-weight: bold;
            text-align: center;
          }
          .text-center {
            text-align: center;
          }
          .font-bold {
            font-weight: bold;
          }
          .uppercase {
            text-transform: uppercase;
          }
          .flex {
            display: table;
            width: 100%;
          }
          .flex > div {
            display: table-cell;
            width: 50%;
          }
          h1, h2, h3 {
            margin-top: 12px;
            margin-bottom: 6px;
          }
          ul {
            margin-top: 6px;
            margin-bottom: 6px;
            padding-left: 20px;
          }
          li {
            margin-bottom: 3px;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          ${contentHtml}
        </div>
      </body>
      </html>
    `

    const blob = new Blob(['\ufeff' + docTemplate], {
      type: 'application/msword;charset=utf-8'
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const cleanTitle = exportReport.title.replace(/[^a-zA-Z0-9À-ỹ\s-_]/g, '').replace(/\s+/g, '_')
    link.download = `Bao_Cao_SHCT_${cleanTitle}.doc`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Always refresh before exporting; Word/PDF read the same freshly rendered snapshot.
  const exportReport = async (format: 'excel' | 'word' | 'pdf') => {
    if (!organizationId || !selectedMeetingId || exporting) return
    const sessionId = selectedMeetingId
    setExporting(true)
    setError('')
    try {
      const fresh = await reportService.compileMeetingReport(sessionId, organizationId)
      if (tenantService.getOrganizationId() !== organizationId || selectedMeetingIdRef.current !== sessionId) return
      // Invalidate older polling requests so they cannot overwrite this newer snapshot.
      requestSequenceRef.current += 1
      flushSync(() => { setReport(fresh); setLoading(false); setRefreshing(false) })
      if (format === 'excel') reportService.downloadExcel(fresh)
      else if (format === 'word') exportToWord(fresh)
      else window.print()
    } catch (err: any) {
      if (tenantService.getOrganizationId() === organizationId && selectedMeetingIdRef.current === sessionId) {
        setError(err.message || 'Không thể cập nhật số liệu để xuất báo cáo.')
      }
    } finally {
      setExporting(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const cleanSeconds = Math.max(0, seconds)
    const mins = Math.floor(cleanSeconds / 60)
    const secs = cleanSeconds % 60
    return mins > 0 ? `${mins}p ${secs}s` : `${secs}s`
  }

  if (loading || loadedOrganizationId !== organizationId) {
    return <LoadingSpinner message="Đang tải dữ liệu báo cáo..." fullScreen />
  }

  return (
    <PatternBackground>
      <PortalHeader />
      <RedNavigationBar
        isAuthenticated={true}
        userRole="admin"
        userName={user?.memberName || 'Ban Tổ Chức'}
        onLogout={handleLogout}
      />
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 mb-6 report-toolbar">
          <div className="min-w-0 w-full report-heading">
            <h1 className="text-xl md:text-2xl font-bold text-red-deep dark:text-gold normal-case tracking-normal flex flex-wrap items-center gap-2">
              Báo cáo & Vinh danh phiên họp
              {autoRefresh && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 normal-case tracking-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE
                </span>
              )}
            </h1>
            <p className="text-xs font-semibold text-muted dark:text-muted mt-0.5">
              {meeting ? `Hồ sơ báo cáo kết quả của: "${meeting.title}"` : 'Tổng hợp kết quả xếp hạng thi đua và vinh danh'}
            </p>
            {report && <p className="text-xs text-muted mt-1" role="status">
              Số liệu cập nhật lúc: {new Date(report.generatedAt).toLocaleString('vi-VN')}
            </p>}
          </div>
          
          {/* Dropdown chọn xem lại hồ sơ phiên họp cũ */}
          {meetingsList.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 w-full min-w-0 text-xs md:text-sm font-bold">
              <span className="text-muted dark:text-muted shrink-0">Hồ sơ phiên:</span>
              <select
                value={selectedMeetingId}
                onChange={(e) => handleSelectMeeting(e.target.value)}
                className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-bold outline-none focus:border-red-revolution w-full sm:w-auto sm:flex-1 min-w-0"
              >
                {meetingsList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.meeting_date || 'Không ngày'})
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-2 w-full min-w-0 justify-start lg:justify-end no-print">
            {meeting && (
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/70 dark:bg-navy/40 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-muted cursor-pointer hover:bg-slate-50 dark:hover:bg-navy/60 transition-colors select-none shadow-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-red-revolution focus:ring-red-revolution h-4 w-4 accent-red-revolution cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  ⚡️ Giám sát trực tiếp (10s)
                </span>
              </label>
            )}

            <RevolutionaryButton 
              onClick={() => loadReportData(false, selectedMeetingId)} 
              variant="secondary" 
              className="flex items-center gap-1.5"
              loading={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Làm mới
            </RevolutionaryButton>
            
            {report && (
              <>
                <RevolutionaryButton 
                  onClick={() => void exportReport('excel')}
                  disabled={exporting}
                  variant="gold"
                  className="flex items-center gap-1.5 shadow-sm text-xs font-bold normal-case"
                >
                  <FileSpreadsheet size={14} /> Xuất Excel
                </RevolutionaryButton>
                
                <RevolutionaryButton 
                  onClick={() => void exportReport('word')}
                  disabled={exporting}
                  variant="secondary"
                  className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 text-xs font-bold normal-case"
                >
                  <FileText size={14} className="text-blue-550 dark:text-blue-400" /> Xuất Word
                </RevolutionaryButton>
                
                <RevolutionaryButton 
                  onClick={() => void exportReport('pdf')}
                  disabled={exporting}
                  variant="secondary"
                  className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 text-xs font-bold normal-case"
                >
                  <Printer size={14} /> In PDF
                </RevolutionaryButton>
              </>
            )}
          </div>
        </div>

        {error && <AlertMessage type="error" message={error} className="mb-6 animate-fade-in no-print" onDismiss={() => setError('')} />}

        {!report ? (
          <GlassCard className="text-center py-12 border border-red-revolution/20 no-print">
            <div className="w-16 h-16 rounded-full bg-red-revolution/10 flex items-center justify-center text-red-revolution mx-auto mb-4">
              <Calendar size={32} />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-navy dark:text-white mb-2">
              Chưa có phiên họp chính trị nào diễn ra
            </h2>
            <p className="text-xs md:text-sm font-semibold text-muted max-w-sm mx-auto mb-6">
              Vui lòng quay lại sau hoặc kích hoạt phiên họp để xem báo cáo xếp hạng thi đua.
            </p>
            <RevolutionaryButton onClick={() => navigate('/admin/meetings')} variant="secondary">
              Đi đến Quản lý phiên họp
            </RevolutionaryButton>
          </GlassCard>
        ) : (
          <div className="space-y-6 animate-slide-up no-print">
            
            {/* Quick Stats Panel */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white/70 dark:bg-navy/40 rounded-card border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-revolution/10 text-red-revolution flex items-center justify-center shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-muted normal-case tracking-normal">Tổng sĩ số chốt</div>
                  <div className="text-base font-bold text-navy dark:text-white">{report.stats.totalParticipants} Đ/c</div>
                </div>
              </div>
              <div className="p-4 bg-white/70 dark:bg-navy/40 rounded-card border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserCheck size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-muted normal-case tracking-normal">Đã điểm danh</div>
                  <div className="text-base font-bold text-navy dark:text-white">
                    {report.stats.attendedCount} ({report.stats.totalParticipants > 0 ? ((report.stats.attendedCount / report.stats.totalParticipants) * 100).toFixed(0) : 0}%)
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white/70 dark:bg-navy/40 rounded-card border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Trophy size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-muted normal-case tracking-normal">Đã hoàn thành thi</div>
                  <div className="text-base font-bold text-navy dark:text-white">
                    {report.stats.examSubmittedCount} ({report.stats.totalParticipants > 0 ? ((report.stats.examSubmittedCount / report.stats.totalParticipants) * 100).toFixed(0) : 0}%)
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white/70 dark:bg-navy/40 rounded-card border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center shrink-0">
                  <Star size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-muted normal-case tracking-normal">Điểm thi trung bình</div>
                  <div className="text-base font-bold text-navy dark:text-white">{report.stats.examSubmittedCount > 0 ? `${report.stats.averageScore.toFixed(1)} / 10` : 'Chưa có bài hoàn tất'}</div>
                </div>
              </div>
            </div>

            {/* Donut Charts Visual Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DonutChart 
                title="Phân tích Tỷ lệ Điểm danh"
                segments={[
                  { label: "Điểm danh hợp lệ", value: report.stats.attendedCount - report.stats.warningGpsCount, color: "#10B981" },
                  { label: "Cảnh báo vị trí GPS", value: report.stats.warningGpsCount, color: "#F59E0B" },
                  { label: "Vắng có lý do", value: report.stats.excusedCount || 0, color: "#06B6D4" },
                  { label: "Vắng mặt không phép", value: report.stats.absentCount, color: "#EF4444" }
                ]}
              />
              <DonutChart 
                title="Phân tích Tiến độ làm bài thi"
                segments={[
                  { label: "Đã hoàn thành thi", value: report.stats.examSubmittedCount, color: "#06B6D4" },
                  { label: "Chưa hoàn thành thi", value: report.stats.examNotSubmittedCount, color: "#64748B" }
                ]}
              />
            </div>

            {/* BẢNG VÀNG VINH DANH CHI BỘ GƯƠNG MẪU */}
            {(() => {
              const { discipline, academic } = getGuongMauChiBos()
              if (!discipline && !academic) return null
              return (
                <GlassCard className="border border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-amber-500/5 dark:from-yellow-500/10 dark:to-amber-500/10 relative overflow-hidden">
                  <div className="absolute -right-8 -bottom-8 opacity-10 text-yellow-500 pointer-events-none transform rotate-12 scale-150">
                    <Trophy size={120} />
                  </div>
                  
                  <div className="flex items-center gap-2.5 text-yellow-600 dark:text-gold border-b border-yellow-500/20 pb-3 mb-4">
                    <Trophy className="animate-pulse" size={20} />
                    <h3 className="text-sm font-bold normal-case tracking-normal">
                      Bảng vàng danh dự - Chi bộ gương mẫu
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                    {discipline && (
                      <div className="p-4 bg-white/60 dark:bg-navy/50 rounded-xl border border-yellow-500/15 flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm font-bold text-sm">
                          🚀
                        </div>
                        <div>
                          <div className="text-xs font-bold text-muted dark:text-muted normal-case tracking-normal">
                            Chi bộ kỷ luật nhất
                          </div>
                          <h4 className="font-bold text-navy dark:text-white text-sm mt-0.5">
                            {discipline.name}
                          </h4>
                          <p className="text-xs font-semibold text-muted dark:text-muted mt-1">
                            Đi đầu phong trào với tỷ lệ điểm danh đạt <b>{discipline.attendanceRate}%</b> ({discipline.totalAttended}/{discipline.totalRequired} đồng chí).
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {academic && (
                      <div className="p-4 bg-white/60 dark:bg-navy/50 rounded-xl border border-yellow-500/15 flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 flex items-center justify-center shrink-0 shadow-sm font-bold text-sm">
                          🎓
                        </div>
                        <div>
                          <div className="text-xs font-bold text-muted dark:text-muted normal-case tracking-normal">
                            Chi bộ học tập xuất sắc nhất
                          </div>
                          <h4 className="font-bold text-navy dark:text-white text-sm mt-0.5">
                            {academic.name}
                          </h4>
                          <p className="text-xs font-semibold text-muted dark:text-muted mt-1">
                            Đạt điểm thi trung bình chuyên đề cao nhất toàn Đảng bộ: <b>{academic.avgScore.toFixed(2)}/10</b> điểm.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </GlassCard>
              )
            })()}

            {/* Chi Bo Rankings */}
            <GlassCard>
              <div className="flex items-center gap-2 text-red-revolution dark:text-gold mb-6 border-b border-red-revolution/10 pb-3">
                <Trophy size={18} />
                <h3 className="text-xs font-bold normal-case tracking-normal">Bảng xếp hạng thi đua {report.chiBoReports.length < 10 ? '0' + report.chiBoReports.length : report.chiBoReports.length} Chi bộ</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm font-semibold text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-muted">
                      <th className="py-3 px-4 text-center w-12">Thứ hạng</th>
                      <th className="py-3 px-4">Tên chi bộ</th>
                      <th className="py-3 px-4">Bí thư chi bộ</th>
                      <th className="py-3 px-4 text-center">Sĩ số chốt</th>
                      <th className="py-3 px-4 text-center">Có mặt</th>
                      <th className="py-3 px-4 text-center">Vắng phép</th>
                      <th className="py-3 px-4 text-center">Tỷ lệ điểm danh</th>
                      <th className="py-3 px-4 text-center">Điểm thi TB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.chiBoReports.map((cb, idx) => {
                      const isTop3 = idx < 3
                      const badgeColors = [
                        'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-400',
                        'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800/40 dark:text-slate-400',
                        'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400'
                      ]
                      
                      return (
                        <tr key={cb.id} className="border-b border-slate-50 dark:border-slate-900 hover:bg-red-revolution/5">
                          <td className="py-4 px-4 text-center font-bold">
                            {isTop3 ? (
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs font-bold ${badgeColors[idx]}`}>
                                {idx + 1}
                              </span>
                            ) : (
                              <span>{idx + 1}</span>
                            )}
                          </td>
                          <td className="py-4 px-4 font-bold text-navy dark:text-white">{cb.name}</td>
                          <td className="py-4 px-4 text-muted dark:text-muted font-bold">{cb.secretaryName}</td>
                          <td className="py-4 px-4 text-center font-bold text-muted">{cb.totalRequired}</td>
                          <td className="py-4 px-4 text-center font-bold text-muted">{cb.totalAttended}</td>
                          <td className="py-4 px-4 text-center font-bold text-muted">{cb.totalExcused || 0}</td>
                          <td className="py-4 px-4 text-center">
                            <span className={`font-bold ${
                              cb.attendanceRate === 100 ? 'text-emerald-600' : 'text-slate-700 dark:text-muted'
                            }`}>
                              {cb.attendanceRate}%
                            </span>
                          </td>
                          <td className={`py-4 px-4 text-center font-semibold ${cb.avgScore >= 8 ? 'text-success' : cb.avgScore < 5 ? 'text-danger' : 'text-ink'}`}>
                            {report.stats.examSubmittedCount > 0 ? cb.avgScore.toFixed(2) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            {/* Top 10 Honor Roll (Bảng vàng vinh danh) */}
            <GlassCard className="border border-yellow-500/20 bg-gradient-to-br from-white/95 to-amber-50/10 dark:from-navy/95 dark:to-amber-950/5">
              <div className="flex items-center gap-2 text-yellow-600 dark:text-gold mb-6 border-b border-yellow-500/10 pb-3">
                <Star size={18} className="animate-spin-slow" />
                <h3 className="text-xs font-bold normal-case tracking-normal">Bảng Vàng Danh Độ - Top 10 cá nhân xuất sắc nhất</h3>
              </div>

              {report.topMembers.length === 0 ? (
                <div className="text-center py-8 text-xs font-semibold text-muted">
                  Chưa có kết quả bài thi trắc nghiệm nào được nộp trong phiên này.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.topMembers.map((member, idx) => {
                    const rankColors = [
                      'border-yellow-400 bg-yellow-50/30 dark:bg-yellow-950/10',
                      'border-slate-300 bg-slate-50/30 dark:bg-slate-800/10',
                      'border-amber-400 bg-amber-50/30 dark:bg-amber-950/10'
                    ]
                    const defaultBorder = 'border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-navy/20'
                    
                    return (
                      <div 
                        key={member.memberId}
                        className={`p-4 rounded-xl border flex items-center justify-between gap-4 shadow-sm hover:scale-[1.01] transition-transform ${
                          idx < 3 ? rankColors[idx] : defaultBorder
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${
                            idx === 0 ? 'bg-yellow-100 text-yellow-700 border-yellow-400 dark:bg-yellow-950 dark:text-yellow-400' :
                            idx === 1 ? 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-muted' :
                            idx === 2 ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400' :
                            'bg-slate-100 dark:bg-slate-800 text-muted dark:text-muted'
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="font-bold text-navy dark:text-white text-sm">{member.fullName}</h4>
                            <p className="text-xs font-semibold text-muted dark:text-muted">
                              {member.position} | <b>{member.chiBoName}</b>
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`text-base font-semibold ${member.score >= 8 ? 'text-success' : member.score < 5 ? 'text-danger' : 'text-ink'}`}>
                            {member.score.toFixed(1)} <span className="text-xs text-muted">điểm</span>
                          </div>
                          <div className="text-xs font-semibold text-muted mt-0.5">
                            ⏱️ {formatDuration(member.durationSeconds)} | Đúng: {member.correctCount}/{member.totalQuestions}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </GlassCard>
          </div>
        )}
      </main>

      {/* GIAO DIỆN IN BÁO CÁO HÀNH CHÍNH CHUẨN CHỈ (PRINT ONLY) */}
      {report && (
        <div id="print-section" className="hidden print:block p-8 bg-white text-black font-serif leading-relaxed text-xs md:text-sm">
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #print-section, #print-section * {
                visibility: visible;
              }
              #print-section {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
            }
          `}</style>
          
          {/* Header hành chính */}
          <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
            <div className="text-center font-bold">
              <div>ĐẢNG CỘNG SẢN VIỆT NAM</div>
              <div className="text-xs normal-case tracking-normal">Đảng bộ {reportOrganizationName}</div>
              <div className="text-xs font-normal mt-1">Số: .....-BC/ĐU</div>
            </div>
            <div className="text-center font-bold">
              <div className="text-xs normal-case tracking-normal">ĐẢNG CỘNG SẢN VIỆT NAM QUANG VINH MUÔN NĂM</div>
              <div className="text-xs font-normal mt-2">Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</div>
            </div>
          </div>
          
          {/* Title */}
          <div className="text-center my-8">
            <h1 className="text-base font-bold normal-case">BÁO CÁO KẾT QUẢ</h1>
            <h2 className="text-sm font-bold normal-case mt-1">SINH HOẠT CHÍNH TRỊ DƯỚI NGHI THỨC CHÀO CỜ</h2>
            <div className="italic mt-2">Phiên họp: "{report.title}" (Ngày {report.meetingDate})</div>
            <div className="italic mt-1">Số liệu cập nhật lúc: {new Date(report.generatedAt).toLocaleString('vi-VN')}</div>
          </div>
          
          {/* Nội dung báo cáo */}
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-xs">I. SỐ LIỆU THỐNG KÊ CHUNG</h3>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Tổng số đảng viên thuộc diện tham gia: <b>{report.stats.totalParticipants}</b> đồng chí.</li>
                <li>Đảng viên đã điểm danh có mặt: <b>{report.stats.attendedCount}</b> đồng chí ({report.stats.totalParticipants > 0 ? ((report.stats.attendedCount / report.stats.totalParticipants) * 100).toFixed(1) : 0}%).</li>
                <li>Ghi nhận cảnh báo khoảng cách định vị GPS: <b>{report.stats.warningGpsCount}</b> đồng chí.</li>
                <li>Đảng viên vắng mặt có lý do: <b>{report.stats.excusedCount || 0}</b> đồng chí ({report.stats.totalParticipants > 0 ? (((report.stats.excusedCount || 0) / report.stats.totalParticipants) * 100).toFixed(1) : 0}%).</li>
                <li>Đảng viên vắng mặt không phép: <b>{report.stats.absentCount}</b> đồng chí ({report.stats.totalParticipants > 0 ? ((report.stats.absentCount / report.stats.totalParticipants) * 100).toFixed(1) : 0}%).</li>
                <li>Số bài thu hoạch trắc nghiệm đã hoàn thành: <b>{report.stats.examSubmittedCount}</b> đồng chí.</li>
                <li>Điểm số trung bình toàn Đảng bộ: <b>{report.stats.averageScore.toFixed(1)}/10</b> điểm.</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-xs mt-4">II. KẾT QUẢ THI ĐUA CÁC CHI BỘ</h3>
              <table className="w-full border-collapse border border-black mt-2 text-left text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-1.5 text-center">Thứ hạng</th>
                    <th className="border border-black p-1.5">Tên Chi bộ</th>
                    <th className="border border-black p-1.5">Bí thư Chi bộ</th>
                    <th className="border border-black p-1.5 text-center">Sĩ số chốt</th>
                    <th className="border border-black p-1.5 text-center">Có mặt</th>
                    <th className="border border-black p-1.5 text-center">Vắng phép</th>
                    <th className="border border-black p-1.5 text-center">Tỷ lệ điểm danh</th>
                    <th className="border border-black p-1.5 text-center">Điểm thi TB</th>
                  </tr>
                </thead>
                <tbody>
                  {report.chiBoReports.map((cb, idx) => (
                    <tr key={cb.id}>
                      <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                      <td className="border border-black p-1.5 font-bold">{cb.name}</td>
                      <td className="border border-black p-1.5">{cb.secretaryName}</td>
                      <td className="border border-black p-1.5 text-center">{cb.totalRequired}</td>
                      <td className="border border-black p-1.5 text-center">{cb.totalAttended}</td>
                      <td className="border border-black p-1.5 text-center">{cb.totalExcused || 0}</td>
                      <td className="border border-black p-1.5 text-center font-bold">{cb.attendanceRate}%</td>
                      <td className="border border-black p-1.5 text-center font-bold">{cb.avgScore.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="font-bold text-xs mt-4">III. VINH DANH CÁ NHÂN ĐẠT KẾT QUẢ XUẤT SẮC (TOP 10)</h3>
              <table className="w-full border-collapse border border-black mt-2 text-left text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-black p-1 text-center">Hạng</th>
                    <th className="border border-black p-1">Họ và tên</th>
                    <th className="border border-black p-1">Chi bộ</th>
                    <th className="border border-black p-1">Chức vụ</th>
                    <th className="border border-black p-1 text-center">Điểm số</th>
                    <th className="border border-black p-1 text-center">Số câu đúng</th>
                    <th className="border border-black p-1 text-right">Thời gian làm bài</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topMembers.map((member, idx) => {
                    const mins = Math.floor(member.durationSeconds / 60)
                    const secs = member.durationSeconds % 60
                    const timeStr = mins > 0 ? `${mins}p ${secs}s` : `${secs}s`
                    return (
                      <tr key={member.memberId}>
                        <td className="border border-black p-1 text-center">{idx + 1}</td>
                        <td className="border border-black p-1 font-bold">{member.fullName}</td>
                        <td className="border border-black p-1">{member.chiBoName}</td>
                        <td className="border border-black p-1">{member.position || 'Đảng viên'}</td>
                        <td className="border border-black p-1 text-center font-bold">{member.score.toFixed(1)}</td>
                        <td className="border border-black p-1 text-center">{member.correctCount}/{member.totalQuestions}</td>
                        <td className="border border-black p-1 text-right">{timeStr}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Signatures */}
          <div className="flex justify-between items-start mt-12 text-xs">
            <div className="italic">
              <b>Nơi nhận:</b><br />
              - Đảng bộ {reportOrganizationName};<br />
              - Ban Tổ chức;<br />
              - Lưu hồ sơ.<br />
            </div>
            <div className="text-center font-bold w-64 mr-8">
              <div>T/M ĐẢNG ỦY</div>
              <div className="text-xs tracking-normal mt-1">BÍ THƯ</div>
              <div className="h-16"></div>
              <div className="underline font-bold normal-case">(Ký, đóng dấu và ghi rõ họ tên)</div>
            </div>
          </div>
        </div>
      )}
    </PatternBackground>
  )
}

export default AdminReports
