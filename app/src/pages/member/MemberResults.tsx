import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Award, Calendar, Clock } from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { NewsTicker } from '../../components/layout/NewsTicker'
import { GlassCard } from '../../components/ui/GlassCard'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { useAuth } from '../../contexts/AuthContext'
import { meetingService } from '../../services/meetingService'
import type { MeetingSession } from '../../services/meetingService'
import { reportService } from '../../services/reportService'
import { memberService } from '../../services/memberService'

export const MemberResults: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  
  const [meeting, setMeeting] = useState<MeetingSession | null>(null)
  const [reportData, setReportData] = useState<any>(null)
  const [personalRank, setPersonalRank] = useState<any>(null)
  const [historyData, setHistoryData] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState('')

  const getGuongMauChiBos = () => {
    if (!reportData || !reportData.chiBoReports || reportData.chiBoReports.length === 0) {
      return { discipline: null, academic: null }
    }
    let bestDiscipline = reportData.chiBoReports[0]
    let bestAcademic = reportData.chiBoReports[0]
    reportData.chiBoReports.forEach((cb: any) => {
      if (cb.attendanceRate > bestDiscipline.attendanceRate) {
        bestDiscipline = cb
      }
      if (cb.avgScore > bestAcademic.avgScore) {
        bestAcademic = cb
      }
    })
    return { discipline: bestDiscipline, academic: bestAcademic }
  }

  useEffect(() => {
    async function loadResults() {
      if (!user) return
      
      setLoading(true)
      setError('')
      try {
        // 1. Get active political session
        const activeSession = await meetingService.getActiveSession()
        setMeeting(activeSession)

        if (activeSession) {
          // 2. Load report data & personal rank for active session
          setLoadingReport(true)
          try {
            const [rep, rank] = await Promise.all([
              reportService.compileMeetingReport(activeSession.id),
              memberService.getMemberExamRank(activeSession.id, user.memberId)
            ])
            setReportData(rep)
            setPersonalRank(rank)
          } catch (rErr) {
            console.error('Lỗi tải bảng xếp hạng:', rErr)
            setError('Không thể tải dữ liệu bảng xếp hạng.')
          } finally {
            setLoadingReport(false)
          }
        }

        // 3. Load past meetings participation history
        setLoadingHistory(true)
        try {
          const hist = await memberService.getMemberParticipationHistory(user.memberId)
          setHistoryData(hist)
        } catch (hErr) {
          console.error('Lỗi tải lịch sử tham gia sinh hoạt:', hErr)
        } finally {
          setLoadingHistory(false)
        }
      } catch (err: any) {
        console.error(err)
        setError('Có lỗi xảy ra khi tải dữ liệu từ hệ thống.')
      } finally {
        setLoading(false)
      }
    }

    loadResults()
  }, [user])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (loading) {
    return <LoadingSpinner message="Đang tải kết quả thi đua..." fullScreen />
  }

  return (
    <PatternBackground>
      <PortalHeader />
      <RedNavigationBar
        isAuthenticated={true}
        userRole="member"
        userName={user?.memberName}
        onLogout={handleLogout}
      />
      <NewsTicker />

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
        
        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-red-deep dark:text-gold uppercase tracking-wide">
              Kết quả thi đua & học tập
            </h1>
            {meeting && (
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 uppercase">
                Phiên họp: {meeting.title}
              </p>
            )}
          </div>
          <div>
            <RevolutionaryButton onClick={() => navigate('/member')} variant="secondary" className="px-4 py-1.5 text-xs">
              Quay lại Trang chủ
            </RevolutionaryButton>
          </div>
        </div>

        {error && <AlertMessage type="error" message={error} className="mb-6" />}

        {/* 1. NO ACTIVE MEETING STATE */}
        {!meeting ? (
          <GlassCard className="text-center py-12 animate-slide-up border border-red-revolution/20">
            <div className="w-16 h-16 rounded-full bg-red-revolution/10 flex items-center justify-center text-red-revolution mx-auto mb-4">
              <Trophy size={32} />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-navy dark:text-white mb-2">
              Chưa có phiên sinh hoạt chính trị nào được mở
            </h2>
            <p className="text-xs md:text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed mb-6">
              Bảng kết quả thi đua chi bộ và lịch sử tham gia sẽ hiển thị sau khi Ban Tổ Chức kích hoạt phiên sinh hoạt chính trị trên hệ thống.
            </p>
            <RevolutionaryButton onClick={() => navigate('/member')}>
              Về Trang chủ
            </RevolutionaryButton>
          </GlassCard>
        ) : (
          /* 2. LEADERBOARD DISPLAY STATE */
          <div className="space-y-6">
            {loadingReport ? (
              <div className="py-12 flex justify-center bg-white/40 dark:bg-navy/30 rounded-2xl border border-red-revolution/10">
                <LoadingSpinner message="Đang tải bảng xếp hạng thi đua..." />
              </div>
            ) : reportData ? (
              <div className="space-y-6">
                {/* BẢNG VÀNG VINH DANH CHI BỘ GƯƠNG MẪU */}
                {(() => {
                  const { discipline, academic } = getGuongMauChiBos()
                  if (!discipline && !academic) return null
                  return (
                    <GlassCard className="border border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-amber-500/5 dark:from-yellow-500/10 dark:to-amber-500/10 animate-fade-in relative overflow-hidden">
                      {/* Decorative background badge */}
                      <div className="absolute -right-8 -bottom-8 opacity-10 text-yellow-500 pointer-events-none transform rotate-12 scale-150">
                        <Trophy size={120} />
                      </div>
                      
                      <div className="flex items-center gap-2.5 text-yellow-600 dark:text-gold border-b border-yellow-500/20 pb-3 mb-4">
                        <Trophy className="animate-pulse" size={20} />
                        <h3 className="text-sm font-black uppercase tracking-wider">
                          Bảng vàng danh dự - Chi bộ gương mẫu
                        </h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                        {discipline && (
                          <div className="p-4 bg-white/60 dark:bg-navy/50 rounded-xl border border-yellow-500/15 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm font-black text-sm">
                              🚀
                            </div>
                            <div>
                              <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                Chi bộ kỷ luật nhất
                              </div>
                              <h4 className="font-bold text-navy dark:text-white text-sm mt-0.5">
                                {discipline.name}
                              </h4>
                              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                                Đi đầu phong trào với tỷ lệ điểm danh đạt <b>{discipline.attendanceRate}%</b> ({discipline.totalAttended}/{discipline.totalRequired} đồng chí).
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {academic && (
                          <div className="p-4 bg-white/60 dark:bg-navy/50 rounded-xl border border-yellow-500/15 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 flex items-center justify-center shrink-0 shadow-sm font-black text-sm">
                              🎓
                            </div>
                            <div>
                              <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                Chi bộ học tập xuất sắc nhất
                              </div>
                              <h4 className="font-bold text-navy dark:text-white text-sm mt-0.5">
                                {academic.name}
                              </h4>
                              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                                Đạt điểm thi trung bình chuyên đề cao nhất toàn Đảng bộ: <b>{academic.avgScore.toFixed(2)}/10</b> điểm.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  )
                })()}

                <GlassCard className="animate-slide-up">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 lg:divide-x lg:divide-slate-200 dark:lg:divide-slate-800">
                    
                    {/* Column 1: BẢNG XẾP HẠNG CHI BỘ */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-red-revolution dark:text-gold border-b border-red-revolution/10 pb-1.5">
                        <Trophy size={16} />
                        <h3 className="text-xs font-black uppercase tracking-wider">Bảng xếp hạng thi đua Chi bộ</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-[11px] font-semibold text-left">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                              <th className="py-1.5 px-2 text-center w-12">Thứ hạng</th>
                              <th className="py-1.5 px-2">Tên chi bộ</th>
                              <th className="py-1.5 px-2 text-center">Sĩ số (Có mặt / Vắng phép / Tổng)</th>
                              <th className="py-1.5 px-2 text-right">Điểm thi TB</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.chiBoReports.map((cb: any, idx: number) => (
                              <tr key={cb.id} className="border-b border-slate-50/50 dark:border-slate-900/30 hover:bg-red-revolution/5">
                                <td className="py-1.5 px-2 text-center">
                                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black ${
                                    idx === 0 ? "bg-amber-100 text-amber-700" :
                                    idx === 1 ? "bg-slate-100 text-slate-700" :
                                    idx === 2 ? "bg-orange-100 text-orange-700" : "text-slate-500"
                                  }`}>
                                    {idx + 1}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 font-bold text-navy dark:text-white">{cb.name}</td>
                                <td className="py-1.5 px-2 text-center text-slate-500">
                                  {cb.totalAttended} / {cb.totalExcused || 0} / {cb.totalRequired} ({cb.attendanceRate}%)
                                </td>
                                <td className="py-1.5 px-2 text-right font-black text-red-revolution dark:text-gold">{cb.avgScore.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Horizontal line for mobile screen split */}
                    <hr className="block lg:hidden my-2 border-slate-100 dark:border-slate-800/50" />

                    {/* Column 2: KẾT QUẢ BÀI THI CỦA ĐỒNG CHÍ */}
                    <div className="space-y-3 lg:pl-8">
                      <div className="flex items-center gap-2 text-red-revolution dark:text-gold border-b border-red-revolution/10 pb-1.5">
                        <Award size={16} />
                        <h3 className="text-xs font-black uppercase tracking-wider">Kết quả kiểm tra của đồng chí</h3>
                      </div>
                      
                      {personalRank ? (
                        <div className="bg-gradient-to-br from-red-revolution/5 to-amber-500/5 dark:from-navy/50 dark:to-amber-950/10 p-5 rounded-2xl border border-red-revolution/15 shadow-sm space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Xếp hạng của đồng chí:</div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 dark:bg-yellow-950/40 text-yellow-750 dark:text-gold border border-yellow-300 dark:border-yellow-900 rounded-full text-xs font-black uppercase tracking-wider shadow-sm">
                              Hạng {personalRank.rank} / {personalRank.total}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="p-3 bg-white/60 dark:bg-navy/30 rounded-xl border border-slate-100 dark:border-slate-850">
                              <div className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Điểm số</div>
                              <div className="text-lg font-black text-red-revolution dark:text-gold mt-1">
                                {personalRank.score.toFixed(1)} <span className="text-[10px] font-bold text-slate-450">/10</span>
                              </div>
                            </div>
                            <div className="p-3 bg-white/60 dark:bg-navy/30 rounded-xl border border-slate-100 dark:border-slate-850">
                              <div className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Trả lời đúng</div>
                              <div className="text-lg font-black text-navy dark:text-white mt-1">
                                {personalRank.correctCount} <span className="text-[10px] font-bold text-slate-450">/ {personalRank.totalQuestions}</span>
                              </div>
                            </div>
                            <div className="p-3 bg-white/60 dark:bg-navy/30 rounded-xl border border-slate-100 dark:border-slate-850">
                              <div className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Thời gian</div>
                              <div className="text-sm font-black text-slate-700 dark:text-slate-300 mt-2 flex items-center justify-center gap-1">
                                <Clock size={12} className="text-slate-400" />
                                {(() => {
                                  const mins = Math.floor(personalRank.durationSeconds / 60)
                                  const secs = personalRank.durationSeconds % 60
                                  return mins > 0 ? `${mins}p ${secs}s` : `${secs}s`
                                })()}
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-[10px] text-slate-450 dark:text-slate-550 text-center font-semibold italic">
                            * Kết quả xếp hạng dựa trên điểm thi và thời gian hoàn thành bài thu hoạch trắc nghiệm.
                          </p>
                        </div>
                      ) : (
                        <div className="text-center py-10 bg-slate-50/50 dark:bg-navy/20 rounded-2xl border border-slate-150 dark:border-slate-850 text-xs font-semibold text-slate-500">
                          Đồng chí chưa tham gia hoặc chưa nộp bài thi trắc nghiệm trong chuyên đề này.
                        </div>
                      )}
                    </div>

                  </div>
                </GlassCard>
              </div>
            ) : (
              <GlassCard className="text-center py-6 text-xs text-slate-500 font-semibold">
                Không tìm thấy dữ liệu thi đua của phiên họp này.
              </GlassCard>
            )}
          </div>
        )}

        {/* 3. LỊCH SỬ THAM GIA SINH HOẠT CHÍNH TRỊ (MEMBER HISTORY) */}
        {user && (
          <GlassCard className="animate-slide-up">
            <div className="flex items-center gap-2 text-red-revolution dark:text-gold mb-4 border-b border-red-revolution/10 pb-2">
              <Calendar size={18} />
              <h3 className="text-xs font-black uppercase tracking-wider">Quá trình tham gia sinh hoạt chính trị</h3>
            </div>

            {!loadingHistory && historyData.length > 0 && (
              <div className="mb-6 p-4 bg-white/30 dark:bg-navy/10 rounded-2xl border border-red-revolution/5">
                <h4 className="text-[11px] font-black uppercase text-slate-500 dark:text-cream-light mb-3 tracking-wider flex items-center gap-1">
                  <span>🌟 Lộ trình sinh hoạt gần đây</span>
                  <span className="text-[9px] font-bold text-slate-400 normal-case">(Tối đa 8 phiên họp gần nhất)</span>
                </h4>
                <div className="flex flex-wrap items-center justify-start gap-4">
                  {historyData.slice(0, 8).map((hist, index) => {
                    let badgeColor = 'bg-slate-100 text-slate-450 border-slate-200 dark:bg-slate-800 dark:text-slate-455'
                    let badgeText = 'Không rõ'

                    if (hist.attendanceStatus === 'present') {
                      if (hist.examScore !== null) {
                        if (hist.examScore >= 5.0) {
                          badgeColor = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-350 border-emerald-250'
                          badgeText = `Đạt (${hist.examScore}đ)`
                        } else {
                          badgeColor = 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-350 border-teal-200'
                          badgeText = `Chưa đạt (${hist.examScore}đ)`
                        }
                      } else {
                        badgeColor = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-350 border-emerald-200'
                        badgeText = 'Có mặt'
                      }
                    } else if (hist.attendanceStatus === 'warning') {
                      badgeColor = 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-350 border-amber-250'
                      badgeText = 'Cảnh báo'
                    } else if (hist.attendanceStatus === 'excused') {
                      badgeColor = 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-750 dark:text-yellow-350 border-yellow-250'
                      badgeText = 'Vắng phép'
                    } else if (hist.attendanceStatus === 'absent') {
                      badgeColor = 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-350 border-rose-200'
                      badgeText = 'Vắng mặt'
                    }

                    return (
                      <div key={hist.sessionId} className="flex flex-col items-center gap-1.5 shrink-0 w-[95px] transition-transform hover:scale-105 cursor-help" title={`${hist.title} (${hist.meetingDate})`}>
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-black text-xs ${badgeColor} shadow-sm`}>
                          {historyData.length - index}
                        </div>
                        <span className="text-[10px] font-bold text-navy dark:text-white text-center truncate w-full">
                          {hist.title}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-center">
                          {badgeText}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {loadingHistory ? (
              <div className="py-6 flex justify-center">
                <LoadingSpinner message="Đang tải lịch sử tham gia..." />
              </div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-8 text-xs font-semibold text-slate-500">
                Chưa ghi nhận lịch sử tham gia phiên họp nào trên hệ thống.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs font-semibold text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Tên phiên họp</th>
                      <th className="py-2.5 px-3">Ngày họp</th>
                      <th className="py-2.5 px-3 text-center">Điểm danh</th>
                      <th className="py-2.5 px-3 text-center">Bài kiểm tra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((hist) => (
                      <tr key={hist.sessionId} className="border-b border-slate-50/50 dark:border-slate-900/30 hover:bg-red-revolution/5">
                        <td className="py-3 px-3 font-bold text-navy dark:text-white max-w-xs truncate" title={hist.title}>
                          {hist.title}
                        </td>
                        <td className="py-3 px-3 text-slate-500">{hist.meetingDate}</td>
                        <td className="py-3 px-3 text-center">
                          {hist.attendanceStatus === 'present' && (
                            <span className="inline-flex bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-150">
                              ✓ Có mặt
                            </span>
                          )}
                          {hist.attendanceStatus === 'warning' && (
                            <span className="inline-flex bg-yellow-50 text-yellow-750 px-2 py-0.5 rounded-full text-[10px] font-bold border border-yellow-250" title={hist.excuseReason || 'Cảnh báo định vị'}>
                              ⚠️ Cảnh báo vị trí
                            </span>
                          )}
                          {hist.attendanceStatus === 'excused' && (
                            <span className="inline-flex bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-200" title={hist.excuseReason || 'Vắng có phép'}>
                              ✉ Vắng phép
                            </span>
                          )}
                          {hist.attendanceStatus === 'absent' && (
                            <span className="inline-flex bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-rose-150">
                              ✗ Vắng mặt
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-black text-red-revolution dark:text-gold">
                          {hist.examScore !== null ? (
                            <span>{hist.examScore.toFixed(1)} / 10</span>
                          ) : (
                            <span className="text-slate-400 font-medium text-[11px] italic">Chưa làm / Không có</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        )}
      </main>
    </PatternBackground>
  )
}

export default MemberResults
