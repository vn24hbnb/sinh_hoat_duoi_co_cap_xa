import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Award, ArrowRight, CheckCircle2, XCircle, BookOpen, Trophy, Users } from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { examService } from '../../services/examService'
import { reportService } from '../../services/reportService'
import { useAuth } from '../../contexts/AuthContext'

export const ExamResult: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, logout } = useAuth()
  
  const attemptId = searchParams.get('attemptId')
  
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [reportData, setReportData] = useState<any>(null)
  const [loadingReport, setLoadingReport] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    async function loadResult() {
      if (!attemptId) {
        setError('Không tìm thấy mã bài làm trong liên kết.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      try {
        const data = await examService.getAttemptResult(attemptId)
        setResult(data)

        if (data && data.attempt.meetingSessionId) {
          setLoadingReport(true)
          try {
            const rep = await reportService.compileMeetingReport(data.attempt.meetingSessionId)
            setReportData(rep)
          } catch (rErr) {
            console.error('Lỗi tải bảng xếp hạng:', rErr)
          } finally {
            setLoadingReport(false)
          }
        }
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Không thể tải kết quả bài thi.')
      } finally {
        setLoading(false)
      }
    }

    loadResult()
  }, [attemptId])

  useEffect(() => {
    if (!result || result.attempt.score < 8.0) return

    const canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const colors = ['#D40000', '#FACC15', '#00A86B', '#1E40AF', '#FF7F50', '#8A2BE2']
    const particles: any[] = []

    const isPerfectScore = result.attempt.score === 10.0

    // Hàm tạo pháo hoa nổ
    const spawnFirework = (x: number, y: number) => {
      const fwColors = ['#FACC15', '#FFD700', '#FF4500', '#FF0000', '#FF8C00', '#FF69B4', '#00FFFF']
      const color = fwColors[Math.floor(Math.random() * fwColors.length)]
      const count = 35 + Math.floor(Math.random() * 15)
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const velocity = Math.random() * 4.5 + 1.5
        particles.push({
          x: x,
          y: y,
          size: Math.random() * 2.5 + 1.5,
          color: color,
          speedX: Math.cos(angle) * velocity,
          speedY: Math.sin(angle) * velocity - 0.5,
          rotation: Math.random() * 360,
          rotationSpeed: 0,
          type: 'firework_spark',
          alpha: 1.0,
          gravity: 0.08
        })
      }
    }

    if (isPerfectScore) {
      // Nổ pháo hoa ban đầu
      spawnFirework(width / 3, height / 3)
      spawnFirework(width * 2 / 3, height / 3)

      // Tạo các cánh sen vàng rơi xoay
      for (let i = 0; i < 45; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * -height - 20,
          size: Math.random() * 8 + 6,
          color: '#FACC15', // Gold màu hoa sen cách mạng
          speedX: Math.random() * 0.8 - 0.4,
          speedY: Math.random() * 1.2 + 0.8,
          rotation: Math.random() * 360,
          rotationSpeed: Math.random() * 2 - 1,
          type: 'lotus'
        })
      }
    } else {
      // Điểm thường: giấy hoa giấy màu rơi
      for (let i = 0; i < 120; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * -height - 20,
          size: Math.random() * 6 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          speedX: Math.random() * 2 - 1,
          speedY: Math.random() * 3 + 2,
          rotation: Math.random() * 360,
          rotationSpeed: Math.random() * 4 - 2,
          type: 'confetti'
        })
      }
    }

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      
      let alive = false

      // Nổ pháo hoa ngẫu nhiên cho điểm tuyệt đối
      if (isPerfectScore && Math.random() < 0.015) {
        spawnFirework(Math.random() * width, Math.random() * (height / 2))
      }

      particles.forEach((p) => {
        if (p.type === 'firework_spark') {
          p.x += p.speedX
          p.y += p.speedY
          p.speedY += p.gravity
          p.alpha -= 0.012 // Nhạt dần
          
          if (p.alpha > 0) {
            alive = true
            ctx.save()
            ctx.globalAlpha = p.alpha
            ctx.fillStyle = p.color
            
            // Vẽ hạt sáng pháo hoa hình tròn
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
        } else if (p.type === 'lotus') {
          p.y += p.speedY
          p.x += p.speedX + Math.sin(p.y / 25) * 0.4
          p.rotation += p.rotationSpeed

          if (p.y < height) {
            alive = true
            ctx.save()
            ctx.translate(p.x, p.y)
            ctx.rotate((p.rotation * Math.PI) / 180)
            
            // Vẽ cánh sen vàng cách mạng bằng đường Bezier
            ctx.fillStyle = p.color
            ctx.beginPath()
            ctx.moveTo(0, -p.size)
            ctx.quadraticCurveTo(-p.size / 2, 0, 0, p.size)
            ctx.quadraticCurveTo(p.size / 2, 0, 0, -p.size)
            ctx.fill()

            // Vẽ gân hoa sen
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(0, -p.size)
            ctx.lineTo(0, p.size)
            ctx.stroke()
            
            ctx.restore()
          }
        } else {
          // confetti
          p.y += p.speedY
          p.x += p.speedX
          p.rotation += p.rotationSpeed

          if (p.y < height) {
            alive = true
            ctx.save()
            ctx.translate(p.x, p.y)
            ctx.rotate((p.rotation * Math.PI) / 180)
            ctx.fillStyle = p.color
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
            ctx.restore()
          }
        }
      })

      if (alive) {
        animationFrameId = requestAnimationFrame(animate)
      }
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
    }
  }, [result])

  const formatTimeSpent = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    
    if (mins > 0) {
      return `${mins} phút ${secs} giây`
    }
    return `${secs} giây`
  }

  const getClassification = (score: number) => {
    if (score >= 9.0) return { label: 'Hoàn thành Xuất sắc', status: 'gold' as const }
    if (score >= 8.0) return { label: 'Hoàn thành Giỏi', status: 'info' as const }
    if (score >= 6.5) return { label: 'Hoàn thành Khá', status: 'info' as const }
    if (score >= 5.0) return { label: 'Đạt yêu cầu', status: 'success' as const }
    return { label: 'Chưa đạt yêu cầu', status: 'error' as const }
  }

  if (loading) {
    return <LoadingSpinner message="Đang tải kết quả bài làm..." fullScreen />
  }

  const classification = result ? getClassification(result.attempt.score) : null

  return (
    <PatternBackground>
      <canvas id="confetti-canvas" className="fixed inset-0 pointer-events-none z-50 w-full h-full" />
      <PortalHeader />
      <RedNavigationBar
        isAuthenticated={true}
        userRole="member"
        userName={user?.memberName}
        onLogout={handleLogout}
      />
      
      <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
        {error && (
          <div className="max-w-xl mx-auto w-full">
            <GlassCard className="text-center py-8">
              <AlertMessage type="error" message={error} className="mb-6 animate-fade-in" />
              <RevolutionaryButton onClick={() => navigate('/member')} fullWidth>
                Quay lại Trang chủ
              </RevolutionaryButton>
            </GlassCard>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* Score Overview Card */}
            <div className="max-w-xl mx-auto w-full">
              <GlassCard className="text-center border border-red-revolution/20">
                <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-gold/15 flex items-center justify-center text-gold mx-auto mb-4 border border-gold/30 animate-pulse">
                  <Award size={36} />
                </div>

                <h2 className="text-xl md:text-2xl font-black text-red-deep dark:text-gold uppercase tracking-wider">
                  Kết quả bài kiểm tra
                </h2>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 mb-6">
                  Chuyên đề: {result.attempt.title}
                </p>

                {/* Metric cards */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-red-revolution/5 rounded-xl border border-red-revolution/10">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Điểm số</span>
                    <span className="text-3xl font-black text-red-revolution dark:text-gold">{result.attempt.score.toFixed(1)}</span>
                  </div>
                  <div className="p-4 bg-red-revolution/5 rounded-xl border border-red-revolution/10">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Đúng / Tổng</span>
                    <span className="text-lg font-black text-navy dark:text-cream-light mt-1.5 block">
                      {result.attempt.correctCount} / {result.attempt.totalQuestions}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-300 mb-8 max-w-sm mx-auto text-left border-t border-slate-100 dark:border-slate-800 pt-4">
                  <div className="flex justify-between">
                    <span>⏱️ Thời gian làm bài:</span>
                    <span className="text-navy dark:text-white font-bold">{formatTimeSpent(result.attempt.durationSeconds || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🏆 Xếp loại đánh giá:</span>
                    <span className={`font-black ${
                      result.attempt.score >= 8.5 ? 'text-red-revolution dark:text-gold' : 'text-navy dark:text-white'
                    }`}>
                      {classification?.label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>🎖️ Đánh giá kết quả:</span>
                    <StatusBadge 
                      status={classification?.status || 'default'} 
                      label={result.attempt.score >= 5.0 ? 'ĐẠT YÊU CẦU' : 'CHƯA ĐẠT'} 
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <RevolutionaryButton onClick={() => navigate('/member')} fullWidth>
                    Quay lại Trang chủ <ArrowRight size={18} />
                  </RevolutionaryButton>
                </div>
              </GlassCard>
            </div>

            {/* BẢNG XẾP HẠNG THI ĐUA */}
            {loadingReport ? (
              <div className="py-6 flex justify-center bg-white/40 dark:bg-navy/30 rounded-2xl border border-red-revolution/10">
                <LoadingSpinner message="Đang tải bảng xếp hạng thi đua..." />
              </div>
            ) : reportData ? (
              <GlassCard className="animate-slide-up">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 lg:divide-x lg:divide-slate-200 dark:lg:divide-slate-800">
                  
                  {/* 1. BẢNG XẾP HẠNG CHI BỘ */}
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
                            <th className="py-1.5 px-2">Sĩ số (Có mặt/Tổng)</th>
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
                              <td className="py-1.5 px-2 text-slate-500">
                                {cb.totalAttended}/{cb.totalRequired} ({cb.attendanceRate}%)
                              </td>
                              <td className="py-1.5 px-2 text-right font-black text-red-revolution dark:text-gold">{cb.avgScore.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Đường kẻ ngang phân cách chỉ hiện trên Mobile khi xếp chồng */}
                  <hr className="block lg:hidden my-2 border-slate-100 dark:border-slate-800/50" />

                  {/* 2. XẾP HẠNG KIỂM TRA ĐẢNG VIÊN */}
                  <div className="space-y-3 lg:pl-8">
                    <div className="flex items-center gap-2 text-red-revolution dark:text-gold border-b border-red-revolution/10 pb-1.5">
                      <Users size={16} />
                      <h3 className="text-xs font-black uppercase tracking-wider">Xếp hạng kiểm tra đảng viên</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[11px] font-semibold text-left">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                            <th className="py-1.5 px-2 text-center w-12">Hạng</th>
                            <th className="py-1.5 px-2">Họ và tên</th>
                            <th className="py-1.5 px-2">Chi bộ</th>
                            <th className="py-1.5 px-2 text-center">Số điểm</th>
                            <th className="py-1.5 px-2 text-right">Thời gian</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.topMembers.map((m: any, idx: number) => {
                            const mins = Math.floor(m.durationSeconds / 60)
                            const secs = m.durationSeconds % 60
                            const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
                            return (
                              <tr key={m.memberId} className="border-b border-slate-50/50 dark:border-slate-900/30 hover:bg-red-revolution/5">
                                <td className="py-1.5 px-2 text-center">
                                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black ${
                                    idx === 0 ? "bg-amber-100 text-amber-700" :
                                    idx === 1 ? "bg-slate-100 text-slate-700" :
                                    idx === 2 ? "bg-orange-100 text-orange-700" : "text-slate-500"
                                  }`}>
                                    {idx + 1}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 font-bold text-navy dark:text-white">{m.fullName}</td>
                                <td className="py-1.5 px-2 text-slate-500">{m.chiBoName}</td>
                                <td className="py-1.5 px-2 text-center font-black text-red-revolution dark:text-gold">{m.score.toFixed(1)}</td>
                                <td className="py-1.5 px-2 text-right text-slate-500">{timeStr}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              </GlassCard>
            ) : null}

            {/* Answer Key Explanations Panel */}
            <div className="max-w-3xl mx-auto w-full">
              <GlassCard>
                <div className="flex items-center gap-2 text-red-revolution dark:text-gold mb-6 border-b border-red-revolution/10 pb-3">
                  <BookOpen size={18} />
                  <h3 className="text-xs font-black uppercase tracking-wider">Đáp án chi tiết chuyên đề</h3>
                </div>

                <div className="space-y-6">
                  {result.answers.map((ans: any, idx: number) => (
                    <div key={ans.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-navy/20 text-xs md:text-sm">
                      <div className="flex items-start gap-2 mb-3">
                        <span className="shrink-0 font-black text-red-revolution dark:text-gold">Câu {idx + 1}:</span>
                        <span className="font-bold text-navy dark:text-white leading-relaxed">{ans.content}</span>
                      </div>

                      <div className="space-y-2 mb-3 pl-4">
                        {[
                          { k: 'A', v: ans.optionA },
                          { k: 'B', v: ans.optionB },
                          { k: 'C', v: ans.optionC },
                          { k: 'D', v: ans.optionD }
                        ].map((opt) => {
                          const isSelected = ans.selectedOption === opt.k
                          const isCorrect = ans.correctOption === opt.k
                          
                          let optClass = 'text-slate-600 dark:text-slate-400 font-semibold'
                          let badge = null

                          if (isCorrect) {
                            optClass = 'text-emerald-700 dark:text-emerald-400 font-black'
                            badge = <CheckCircle2 size={14} className="text-emerald-600 inline ml-1.5" />
                          } else if (isSelected && !isCorrect) {
                            optClass = 'text-red-600 dark:text-red-400 font-bold line-through'
                            badge = <XCircle size={14} className="text-red-500 inline ml-1.5" />
                          }

                          return (
                            <div key={opt.k} className={`flex items-start gap-1.5 ${optClass}`}>
                              <span className="font-black">{opt.k}.</span>
                              <span className="flex-1">{opt.v} {badge}</span>
                            </div>
                          )
                        })}
                      </div>

                      <div className="bg-red-revolution/5 p-3 rounded-lg border border-red-revolution/5 text-[11px] font-semibold text-slate-500">
                        <div>
                          🎯 Trạng thái: {ans.selectedOption ? (
                            ans.isCorrect ? (
                              <span className="text-emerald-600 font-bold">Đồng chí đã trả lời ĐÚNG</span>
                            ) : (
                              <span className="text-red-600 font-bold">Đồng chí trả lời SAI (Chọn {ans.selectedOption})</span>
                            )
                          ) : (
                            <span className="text-amber-600 font-bold">Đồng chí CHƯA TRẢ LỜI câu hỏi này</span>
                          )}
                        </div>
                        <div className="mt-1 text-navy dark:text-slate-300">
                          🔑 Đáp án đúng của Ban Tổ Chức: <b className="text-emerald-600 font-black">{ans.correctOption}</b>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </main>
    </PatternBackground>
  )
}

export default ExamResult
