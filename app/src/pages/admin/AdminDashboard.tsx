import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, UserCheck, Award, FileQuestion, Calendar, RefreshCw, Star, Check, X, ShieldAlert, Smartphone, Key } from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { StatCard } from '../../components/ui/StatCard'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { meetingService } from '../../services/meetingService'
import type { MeetingSession } from '../../services/meetingService'
import { reportService } from '../../services/reportService'
import { memberService } from '../../services/memberService'
import { tenantService } from '../../services/tenantService'
import { useAuth } from '../../contexts/AuthContext'

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout, organizationId } = useAuth()
  const requestSequenceRef = useRef(0)
  const loadedOrganizationIdRef = useRef<string | null>(null)
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | null>(null)

  const [meeting, setMeeting] = useState<MeetingSession | null>(null)
  const [stats, setStats] = useState<any>({
    totalParticipants: 0,
    attendedCount: 0,
    warningGpsCount: 0,
    absentCount: 0,
    examSubmittedCount: 0,
    examNotSubmittedCount: 0,
    averageScore: 0
  })

  const [memberCount, setMemberCount] = useState(0)
  const [chiBoCount, setChiBoCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
  const sharedDevices: any[] = []
  const defaultPasswordUsers: any[] = []
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const loadDashboardData = useCallback(async (showSpinner = true) => {
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
      setMemberCount(0)
      setChiBoCount(0)
      setPendingApprovals([])
      setStats({ totalParticipants: 0, attendedCount: 0, warningGpsCount: 0, absentCount: 0, excusedCount: 0, examSubmittedCount: 0, examNotSubmittedCount: 0, averageScore: 0 })
    }
    if (!organizationId) {
      setMeeting(null)
      setMemberCount(0)
      setChiBoCount(0)
      setPendingApprovals([])
      setStats({ totalParticipants: 0, attendedCount: 0, warningGpsCount: 0, absentCount: 0, excusedCount: 0, examSubmittedCount: 0, examNotSubmittedCount: 0, averageScore: 0 })
      setLoading(false)
      setRefreshing(false)
      loadedOrganizationIdRef.current = null
      setLoadedOrganizationId(null)
      return
    }
    try {
      const activeSession = await meetingService.getActiveSession()
      if (!isCurrentRequest()) return
      setMeeting(activeSession)

      // Tải số liệu của đúng xã đang được quản lý.
      try {
        const [fetchedChiBos, fetchedMembers] = await Promise.all([
          memberService.getChiBos(),
          memberService.getAllMembers()
        ])
        if (!isCurrentRequest()) return
        const filteredMembers = fetchedMembers.filter(m => 
          m.full_name.toLowerCase() !== 'admin' &&
          !m.position?.toLowerCase().includes('admin')
        )
        setMemberCount(filteredMembers.length)
        setChiBoCount(fetchedChiBos.length)

      } catch (e) {
        console.error('Lỗi tải số lượng đảng viên/chi bộ:', e)
      }

      if (activeSession) {
        const [report, pending] = await Promise.all([
          reportService.compileMeetingReport(activeSession.id),
          meetingService.getPendingApprovals(activeSession.id)
        ])
        if (!isCurrentRequest()) return
        setStats(report.stats)
        setPendingApprovals(pending)
      } else {
        setPendingApprovals([])
        setStats({
          totalParticipants: 0,
          attendedCount: 0,
          warningGpsCount: 0,
          absentCount: 0,
          excusedCount: 0,
          examSubmittedCount: 0,
          examNotSubmittedCount: 0,
          averageScore: 0
        })
      }
      loadedOrganizationIdRef.current = organizationId
      setLoadedOrganizationId(organizationId)
    } catch (err: any) {
      if (!isCurrentRequest()) return
      console.error(err)
      setError(err.message || 'Không thể tải thông tin thống kê Dashboard.')
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

  const handleQuickApprove = async (memberId: string, type: 'warning' | 'excused') => {
    if (!meeting || !user) return
    setActionLoading(memberId)
    setError('')
    try {
      if (type === 'warning') {
        await meetingService.evaluateAttendance(meeting.id, memberId, 'present', user.id)
      } else {
        await meetingService.approveExcusedAbsence(meeting.id, memberId, user.id)
      }
      
      const [report, pending] = await Promise.all([
        reportService.compileMeetingReport(meeting.id),
        meetingService.getPendingApprovals(meeting.id)
      ])
      setStats(report.stats)
      setPendingApprovals(pending)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Phê duyệt thất bại.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleQuickReject = async (memberId: string) => {
    if (!meeting || !user) return
    const confirmReject = window.confirm('Đồng chí có chắc chắn muốn Từ chối và đánh Vắng mặt không phép đối với trường hợp này?')
    if (!confirmReject) return
    
    setActionLoading(memberId)
    setError('')
    try {
      await meetingService.evaluateAttendance(meeting.id, memberId, 'absent', user.id)
      
      const [report, pending] = await Promise.all([
        reportService.compileMeetingReport(meeting.id),
        meetingService.getPendingApprovals(meeting.id)
      ])
      setStats(report.stats)
      setPendingApprovals(pending)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Từ chối thất bại.')
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboardData() }, 0)
    return () => {
      window.clearTimeout(timer)
      requestSequenceRef.current += 1
    }
  }, [loadDashboardData])

  // Tự động làm mới số liệu Dashboard & danh sách chờ duyệt mỗi 12 giây khi có phiên họp đang mở
  useEffect(() => {
    if (!meeting) return

    const interval = setInterval(() => {
      loadDashboardData(false)
    }, 12000)

    return () => clearInterval(interval)
  }, [meeting, loadDashboardData])

  if (loading || loadedOrganizationId !== organizationId) {
    return <LoadingSpinner message="Đang tải thông tin bảng điều hành..." fullScreen />
  }

  const attendanceRate = stats.totalParticipants > 0 ? ((stats.attendedCount / stats.totalParticipants) * 100).toFixed(1) : '0'
  const examCompletionRate = stats.totalParticipants > 0 ? ((stats.examSubmittedCount / stats.totalParticipants) * 100).toFixed(1) : '0'

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-red-deep dark:text-gold normal-case tracking-normal">
              Bảng điều hành Ban Tổ chức
            </h1>
            <p className="text-xs font-semibold text-muted dark:text-muted mt-0.5">
              {meeting ? `Theo dõi tiến độ thực tế phiên họp: "${meeting.title}"` : 'Giám sát tiến độ các phiên sinh hoạt chính trị'}
            </p>
          </div>
          
          <button
            onClick={() => loadDashboardData(false)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy/40 text-muted dark:text-muted rounded-xl text-xs font-bold transition-all hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Làm mới số liệu
          </button>
        </div>

        {error && <AlertMessage type="error" message={error} className="mb-6 animate-fade-in" />}

        {/* Dynamic Statistic Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard 
            title="Đảng viên chốt họp" 
            value={stats.totalParticipants.toString()} 
            icon={Users} 
            description={`Số lượng thuộc ${chiBoCount < 10 ? '0' + chiBoCount : chiBoCount} Chi bộ`} 
          />
          <StatCard 
            title="Đảng viên có mặt" 
            value={`${stats.attendedCount} / ${stats.totalParticipants}`} 
            icon={UserCheck} 
            description={`Tỷ lệ điểm danh: ${attendanceRate}%`}
            trend={`Vắng phép: ${stats.excusedCount || 0}${stats.warningGpsCount > 0 ? ` | Cảnh báo GPS: ${stats.warningGpsCount}` : ''}`}
            trendType={stats.warningGpsCount > 0 ? 'negative' : 'positive'}
          />
          <StatCard 
            title="Đã hoàn thành thi" 
            value={`${stats.examSubmittedCount} / ${stats.totalParticipants}`} 
            icon={Award} 
            description={`Tỷ lệ hoàn thành: ${examCompletionRate}%`}
            trend={`Còn thiếu: ${stats.examNotSubmittedCount} đồng chí`}
            trendType={stats.examNotSubmittedCount > 0 ? 'negative' : 'positive'}
          />
          <StatCard 
            title="Điểm thi trung bình" 
            value={stats.averageScore.toFixed(1)} 
            icon={Star} 
            description="Điểm TB toàn Đảng bộ" 
            trend="Mục tiêu TB: >= 8.0"
            trendType={stats.averageScore >= 8.0 ? 'positive' : 'negative'}
          />
        </div>

        {/* Unified Board Grid (Quick Approval & Security Alerts) */}
        {((meeting && pendingApprovals.length > 0) || sharedDevices.length > 0 || defaultPasswordUsers.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Quick Approval Column */}
            {meeting && pendingApprovals.length > 0 ? (
              <div className={sharedDevices.length > 0 || defaultPasswordUsers.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}>
                <GlassCard className="h-full border-l-4 border-l-amber-500 animate-slide-up">
                  <div className="flex items-center justify-between gap-4 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      <h3 className="text-xs font-bold normal-case tracking-normal">
                        Danh sách chờ duyệt điểm danh & báo vắng ({pendingApprovals.length})
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-muted">Tự động cập nhật real-time</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs font-semibold text-left">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-muted normal-case tracking-normal text-xs">
                          <th className="py-2 px-3">Họ và tên</th>
                          <th className="py-2 px-3">Chi bộ</th>
                          <th className="py-2 px-3">Loại yêu cầu</th>
                          <th className="py-2 px-3">Chi tiết / Lý do</th>
                          <th className="py-2 px-3 text-center">Thao tác nhanh</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingApprovals.map((appr) => (
                          <tr key={appr.memberId} className="border-b border-slate-50/50 dark:border-slate-900/30 hover:bg-amber-500/5">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-navy dark:text-white">{appr.fullName}</div>
                              <div className="text-xs text-muted font-medium">{appr.position}</div>
                            </td>
                            <td className="py-2.5 px-3 text-muted">{appr.chiBoName}</td>
                            <td className="py-2.5 px-3">
                              {appr.status === 'warning' ? (
                                <span className="inline-flex bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold border border-red-100">
                                  ⚠️ Sai vị trí / GPS
                                </span>
                              ) : (
                                <span className="inline-flex bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold border border-amber-100">
                                  ✉ Xin vắng phép
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-xs text-muted dark:text-slate-355 max-w-xs truncate" title={appr.reason}>
                              {appr.status === 'warning' ? (
                                <span>{appr.gpsDistanceM == null ? 'Chưa xác định được vị trí' : <>Cự ly: <b>{Math.round(appr.gpsDistanceM)}m</b></>} · {appr.reason.replace(/^Vượt quá bán kính cho phép:.*?\.\s*/, '')}</span>
                              ) : (
                                <span>Lý do: <b>{appr.reason.replace(/^\[Yêu cầu\]\s*/, '')}</b></span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleQuickApprove(appr.memberId, appr.status)}
                                  disabled={actionLoading === appr.memberId}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold normal-case tracking-normal cursor-pointer disabled:opacity-50 transition-all shadow-sm"
                                  title="Phê duyệt yêu cầu"
                                >
                                  <Check size={12} />
                                  <span>Duyệt</span>
                                </button>
                                <button
                                  onClick={() => handleQuickReject(appr.memberId)}
                                  disabled={actionLoading === appr.memberId}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold normal-case tracking-normal cursor-pointer disabled:opacity-50 transition-all shadow-sm"
                                  title="Từ chối yêu cầu, đánh vắng mặt"
                                >
                                  <X size={12} />
                                  <span>Từ chối</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              </div>
            ) : null}

            {/* Security Alerts Column */}
            {sharedDevices.length > 0 || defaultPasswordUsers.length > 0 ? (
              <div className={meeting && pendingApprovals.length > 0 ? "lg:col-span-1" : "lg:col-span-3"}>
                <GlassCard className="h-full border-l-4 border-l-rose-600 dark:border-l-rose-500 animate-slide-up">
                  <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 text-rose-600 dark:text-rose-400">
                    <ShieldAlert size={16} className="animate-pulse" />
                    <h3 className="text-xs font-bold normal-case tracking-normal">
                      Cảnh báo bảo mật hệ thống
                    </h3>
                  </div>

                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {/* Shared Devices Alert */}
                    {sharedDevices.length > 0 && (
                      <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold text-xs mb-2">
                          <Smartphone size={14} />
                          <span>Trùng thiết bị điểm danh ({sharedDevices.length})</span>
                        </div>
                        <ul className="space-y-2 text-xs text-muted dark:text-muted font-semibold">
                          {sharedDevices.map((dev, i) => (
                            <li key={i} className="bg-white/80 dark:bg-slate-900/40 p-2 rounded-lg border border-rose-100/50 dark:border-rose-950/50">
                              <div className="text-muted dark:text-muted font-mono mb-1">
                                Device ID: ...{dev.deviceUuid.substring(Math.max(0, dev.deviceUuid.length - 8))}
                              </div>
                              <div className="flex flex-col gap-1 text-slate-800 dark:text-muted">
                                {dev.members.map((m: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between">
                                    <span className="font-extrabold text-red-700 dark:text-red-400">👤 {m.name}</span>
                                    <span className="text-xs text-muted font-medium">{m.chiBoName}</span>
                                  </div>
                                ))}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Default Password Alert */}
                    {defaultPasswordUsers.length > 0 && (
                      <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-xs mb-2">
                          <Key size={14} />
                          <span>Mật khẩu chưa đổi ({defaultPasswordUsers.length})</span>
                        </div>
                        <p className="text-xs text-muted dark:text-muted mb-2 leading-relaxed font-semibold">
                          Các tài khoản dưới đây vẫn giữ nguyên mật khẩu mặc định ban đầu.
                        </p>
                        <div className="max-h-[120px] overflow-y-auto space-y-1">
                          {defaultPasswordUsers.map((u, i) => (
                            <div key={i} className="flex justify-between items-center bg-white/60 dark:bg-slate-900/20 p-1.5 rounded border border-amber-100/30 dark:border-amber-950/30 text-xs font-bold text-slate-700 dark:text-muted">
                              <span>🔑 {u.fullName}</span>
                              <span className="text-xs text-muted font-medium">{u.chiBoName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </GlassCard>
              </div>
            ) : null}
          </div>
        )}

        {/* Shortcuts Panel */}
        <GlassCard>
          <h3 className="text-xs font-bold text-brown-text dark:text-cream-light normal-case tracking-normal mb-4">
            Lối tắt Quản lý nghiệp vụ Ban Tổ chức
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Phiên họp', desc: 'Thiết lập & điều hành họp', path: '/admin/meetings', icon: Calendar },
              { label: 'Đảng viên', desc: `Danh sách ${memberCount} đảng viên`, path: '/admin/members', icon: Users },
              { label: 'Ngân hàng đề', desc: 'Bộ câu hỏi trắc nghiệm', path: '/admin/questions', icon: FileQuestion },
              { label: 'Báo cáo & Vinh danh', desc: 'Xếp hạng chi bộ, xuất CSV', path: '/admin/reports', icon: Award },
              { label: 'Nhật ký hệ thống', desc: 'Xem vết thay đổi vận hành', path: '/admin/audit-logs', icon: ShieldAlert }
            ].map((shortcut) => {
              const Icon = shortcut.icon
              return (
                <button
                  key={shortcut.label}
                  onClick={() => navigate(shortcut.path)}
                  className="p-4 rounded-xl border border-red-revolution/10 bg-red-revolution/5 hover:bg-red-revolution/10 hover-lift text-left transition-all"
                >
                  <Icon className="text-red-revolution dark:text-gold mb-2" size={24} />
                  <div className="font-bold text-sm text-navy dark:text-white">{shortcut.label}</div>
                  <div className="text-xs font-semibold text-muted dark:text-muted mt-0.5">{shortcut.desc}</div>
                </button>
              )
            })}
          </div>
        </GlassCard>
      </main>
    </PatternBackground>
  )
}

export default AdminDashboard
