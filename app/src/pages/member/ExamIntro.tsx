import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileQuestion, Clock, CheckCircle, AlertTriangle, ArrowRight, Volume2, VolumeX } from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { meetingService } from '../../services/meetingService'
import type { MeetingSession } from '../../services/meetingService'
import { examService } from '../../services/examService'
import type { MeetingExam, ExamQuestion, ExamAttempt } from '../../services/examService'
import { supabase } from '../../services/supabaseClient'

export const ExamIntro: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  
  const [meeting, setMeeting] = useState<MeetingSession | null>(null)
  const [exam, setExam] = useState<MeetingExam | null>(null)
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null)
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [started, setStarted] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [error, setError] = useState('')

  // Cỡ chữ và Trợ lý đọc
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'pending'>('synced')

  const timerRef = useRef<any>(null)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Khởi tạo trạng thái đồng bộ dựa vào hàng đợi local
  const initSyncStatus = (attemptId: string) => {
    const queueStr = localStorage.getItem(`exam_sync_queue_${attemptId}`) || '{}'
    const queue = JSON.parse(queueStr)
    if (Object.keys(queue).length > 0) {
      setSyncStatus('pending')
    } else {
      setSyncStatus('synced')
    }
  }

  // Thực hiện đồng bộ các đáp án trong hàng đợi lên máy chủ
  const triggerSync = async (attemptId: string) => {
    const queueStr = localStorage.getItem(`exam_sync_queue_${attemptId}`) || '{}'
    const queue = JSON.parse(queueStr)
    const questionIds = Object.keys(queue)
    if (questionIds.length === 0) {
      setSyncStatus('synced')
      return
    }

    setSyncStatus('syncing')
    
    for (const qId of questionIds) {
      const opt = queue[qId]
      try {
        await examService.saveAnswer(attemptId, qId, opt)
        
        // Xóa khỏi hàng đợi khi đồng bộ thành công
        const currentQueueStr = localStorage.getItem(`exam_sync_queue_${attemptId}`) || '{}'
        const currentQueue = JSON.parse(currentQueueStr)
        delete currentQueue[qId]
        localStorage.setItem(`exam_sync_queue_${attemptId}`, JSON.stringify(currentQueue))
      } catch (err) {
        console.warn(`Sync failed for question ${qId}:`, err)
      }
    }

    const finalQueueStr = localStorage.getItem(`exam_sync_queue_${attemptId}`) || '{}'
    const finalQueue = JSON.parse(finalQueueStr)
    if (Object.keys(finalQueue).length === 0) {
      setSyncStatus('synced')
    } else {
      setSyncStatus('pending')
    }
  }

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      if (attempt) {
        triggerSync(attempt.id)
      }
    }
    const handleOffline = () => setIsOffline(true)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [attempt])

  const handleSpeakQuestion = () => {
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
        setIsSpeaking(false)
        return
      }
      
      const currentQ = questions[currentIdx]
      if (!currentQ) return
      
      const textToSpeak = `Câu hỏi thứ ${currentIdx + 1}: ${currentQ.content}. Lựa chọn A: ${currentQ.optionA}. Lựa chọn B: ${currentQ.optionB}. Lựa chọn C: ${currentQ.optionC}. Lựa chọn D: ${currentQ.optionD}.`
      
      const utterance = new SpeechSynthesisUtterance(textToSpeak)
      utterance.lang = 'vi-VN'
      
      utterance.onend = () => {
        setIsSpeaking(false)
      }
      utterance.onerror = () => {
        setIsSpeaking(false)
      }
      
      setIsSpeaking(true)
      window.speechSynthesis.speak(utterance)
    } else {
      alert('Trình duyệt của đồng chí không hỗ trợ chức năng đọc giọng nói.')
    }
  }

  // Dừng đọc khi đổi câu hỏi
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [currentIdx])

  // 1. Fetch meeting & exam details on load
  useEffect(() => {
    async function loadExamData() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const activeSession = await meetingService.getActiveSession()
        setMeeting(activeSession)

        if (activeSession) {
          const activeExam = await examService.getActiveExam(activeSession.id)
          setExam(activeExam)
          
          if (activeExam) {
            // Check if there is already an active started attempt to restore
            const { data: currentAttempt } = await supabaseCheckAttempt(activeExam.id, user.memberId)
            if (currentAttempt && currentAttempt.status === 'started') {
              // Restore state
              handleStartExam(activeExam.id, activeSession.id)
            }
          }
        }
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Không thể tải thông tin bài thi.')
      } finally {
        setLoading(false)
      }
    }

    loadExamData()
  }, [user])

  // Helper check attempt without generating questions (non-blocking)
  async function supabaseCheckAttempt(examId: string, memberId: string) {
    const { data } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('meeting_exam_id', examId)
      .eq('member_id', memberId)
      .maybeSingle()
    return { data }
  }

  // 2. Start timer when exam starts
  useEffect(() => {
    if (started && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            // Time is up! Auto submit
            handleAutoSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [started, timeLeft])

  const handleStartExam = async (examId: string, sessionId: string) => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const result = await examService.getOrCreateAttempt(examId, user.memberId, sessionId)
      setAttempt(result.attempt)
      
      let loadedQuestions = result.questions
      
      // Khôi phục các câu trả lời đã chọn được lưu tạm ở localStorage
      const savedAnswersStr = localStorage.getItem(`exam_answers_${result.attempt.id}`)
      if (savedAnswersStr) {
        const savedAnswers = JSON.parse(savedAnswersStr)
        loadedQuestions = loadedQuestions.map(q => {
          if (savedAnswers[q.id] && !q.selectedOption) {
            return { ...q, selectedOption: savedAnswers[q.id] }
          }
          return q
        })
      }
      
      setQuestions(loadedQuestions)
      setTimeLeft(result.timeLeftSeconds)
      
      initSyncStatus(result.attempt.id)
      
      // Determine current index to start (default to first unanswered question)
      const firstUnanswered = loadedQuestions.findIndex(q => !q.selectedOption)
      setCurrentIdx(firstUnanswered !== -1 ? firstUnanswered : 0)
      
      setStarted(true)
      
      // Cố gắng đồng bộ lại hàng đợi cũ (nếu có) khi bắt đầu làm tiếp
      triggerSync(result.attempt.id)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Không thể bắt đầu làm bài kiểm tra.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectOption = async (option: string) => {
    if (!attempt || submitting) return
    const currentQuestion = questions[currentIdx]
    
    // Cập nhật State giao diện ngay lập tức (Optimistic UI)
    const updatedQuestions = [...questions]
    updatedQuestions[currentIdx] = { ...currentQuestion, selectedOption: option }
    setQuestions(updatedQuestions)

    // 1. Lưu tạm câu trả lời vào localStorage để phòng mất kết nối
    const savedAnswersStr = localStorage.getItem(`exam_answers_${attempt.id}`) || '{}'
    const savedAnswers = JSON.parse(savedAnswersStr)
    savedAnswers[currentQuestion.id] = option
    localStorage.setItem(`exam_answers_${attempt.id}`, JSON.stringify(savedAnswers))

    // 2. Thêm đáp án vào hàng đợi đồng bộ (Sync Queue) ở localStorage
    const queueStr = localStorage.getItem(`exam_sync_queue_${attempt.id}`) || '{}'
    const queue = JSON.parse(queueStr)
    queue[currentQuestion.id] = option
    localStorage.setItem(`exam_sync_queue_${attempt.id}`, JSON.stringify(queue))

    setSyncStatus('pending')

    // 3. Kích hoạt đồng bộ nền lên cơ sở dữ liệu Supabase
    triggerSync(attempt.id)
  }

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1)
      setError('')
      if (attempt) triggerSync(attempt.id)
    }
  }

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1)
      setError('')
      if (attempt) triggerSync(attempt.id)
    }
  }

  const handleSubmit = async () => {
    if (!attempt) return
    
    // Check if there are unanswered questions
    const unansweredCount = questions.filter(q => !q.selectedOption).length
    let message = ''
    if (unansweredCount > 0) {
      message = `Đồng chí còn ${unansweredCount} câu hỏi chưa trả lời. Đồng chí có chắc chắn muốn nộp bài thi?`
    } else {
      message = 'Đồng chí có chắc chắn muốn nộp bài thi ngay bây giờ không?'
    }

    const confirmSubmit = window.confirm(message)
    if (!confirmSubmit) return

    submitExamAttempt()
  }

  const handleAutoSubmit = async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    alert('Đã hết thời gian làm bài! Hệ thống tự động nộp bài làm của đồng chí.')
    submitExamAttempt()
  }

  const submitExamAttempt = async () => {
    if (!attempt) return
    setSubmitting(true)
    setError('')
    try {
      if (timerRef.current) clearInterval(timerRef.current)
      
      // Đồng bộ cưỡng bức tất cả các câu chưa kịp lưu lên máy chủ
      const queueStr = localStorage.getItem(`exam_sync_queue_${attempt.id}`) || '{}'
      const queue = JSON.parse(queueStr)
      const questionIds = Object.keys(queue)
      
      if (questionIds.length > 0) {
        setError('Đang đồng bộ nốt các câu trả lời lên máy chủ...')
        for (const qId of questionIds) {
          const opt = queue[qId]
          try {
            await examService.saveAnswer(attempt.id, qId, opt)
            
            const currentQueueStr = localStorage.getItem(`exam_sync_queue_${attempt.id}`) || '{}'
            const currentQueue = JSON.parse(currentQueueStr)
            delete currentQueue[qId]
            localStorage.setItem(`exam_sync_queue_${attempt.id}`, JSON.stringify(currentQueue))
          } catch (syncErr) {
            console.error('Final sync failed for question:', qId, syncErr)
            throw new Error('Lỗi kết nối: Không thể đồng bộ toàn bộ đáp án lên máy chủ. Vui lòng kiểm tra mạng ổn định để nộp bài.')
          }
        }
      }
      
      const result = await examService.submitAttempt(attempt.id)
      
      // Xóa bộ nhớ tạm sau khi nộp bài thành công
      localStorage.removeItem(`exam_answers_${attempt.id}`)
      localStorage.removeItem(`exam_sync_queue_${attempt.id}`)
      
      navigate(`/result?attemptId=${result.id}`)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Có lỗi xảy ra khi nộp bài thi.')
      setSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return <LoadingSpinner message="Đang tải thông tin đề thi..." fullScreen />
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
      
      <main className="max-w-xl mx-auto py-12 px-4">
        {error && <AlertMessage type="error" message={error} className="mb-4 animate-fade-in" />}

        {!started ? (
          /* INTRO MODE */
          <GlassCard className="border border-red-revolution/20">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-revolution/10 flex items-center justify-center text-red-revolution mx-auto mb-4 border border-red-revolution/20">
                <FileQuestion size={32} />
              </div>
              <h2 className="text-xl font-black text-red-deep dark:text-gold uppercase tracking-wider">
                {exam ? exam.title : 'Bài kiểm tra nhận thức'}
              </h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                Sinh hoạt dưới nghi thức chào cờ cấp xã
              </p>
            </div>

            {exam ? (
              <>
                <div className="space-y-3 bg-red-revolution/5 p-4 rounded-xl border border-red-revolution/10 text-xs md:text-sm font-semibold text-brown-text dark:text-cream-light mb-6">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-red-revolution dark:text-gold" />
                    <span>Thời gian làm bài: <b>{Math.round(exam.duration_seconds / 60)} phút</b></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileQuestion size={16} className="text-red-revolution dark:text-gold" />
                    <span>Số lượng câu hỏi: <b>{exam.questions_per_user} câu trắc nghiệm</b></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-red-revolution dark:text-gold" />
                    <span>Thang điểm: <b>{exam.score_scale} điểm</b> (Đạt yêu cầu &gt;= 5.0)</span>
                  </div>
                </div>

                <div className="text-center">
                  <RevolutionaryButton onClick={() => handleStartExam(exam.id, exam.meeting_session_id)} fullWidth>
                    Bắt đầu làm bài
                  </RevolutionaryButton>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <AlertMessage
                  type="info"
                  message={
                    meeting 
                      ? 'Phiên họp hiện chưa có bài thi trắc nghiệm được gán hoặc chưa ở trạng thái mở thi.'
                      : 'Chưa phát hiện phiên họp chính trị nào đang hoạt động.'
                  }
                />
                <div className="mt-6">
                  <RevolutionaryButton onClick={() => navigate('/member')} variant="secondary" fullWidth>
                    Quay lại trang chính
                  </RevolutionaryButton>
                </div>
              </div>
            )}
          </GlassCard>
        ) : (
          /* QUIZ MODE */
          <GlassCard className="border border-red-revolution/20">
            {isOffline && (
              <div className="bg-red-600 text-white text-[11px] font-black py-2 px-3 text-center rounded-xl mb-4 animate-pulse">
                ⚠️ Kết nối mạng không ổn định. Dữ liệu làm bài thi của đồng chí đang được tự động lưu trữ tạm thời trên thiết bị.
              </div>
            )}

            {/* Header: Progress, Font adjustments, TTS and Countdown */}
            <div className="flex flex-col gap-3 mb-4 border-b border-red-revolution/10 pb-4">
              <div className="flex justify-between items-center w-full">
                <span className="text-xs font-black text-red-revolution dark:text-gold uppercase tracking-wider">
                  Câu hỏi {currentIdx + 1} / {questions.length}
                </span>
                
                <div className="flex items-center gap-2">
                  {/* Trạng thái đồng bộ đáp án */}
                  {syncStatus === 'syncing' ? (
                    <span className="text-[10px] font-black text-amber-600 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                      🔄 Đang đồng bộ...
                    </span>
                  ) : syncStatus === 'pending' ? (
                    <span className="text-[10px] font-black text-rose-600 bg-rose-100 dark:bg-rose-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                      💾 Lưu tạm trên máy
                    </span>
                  ) : (
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                      ✅ Đã đồng bộ
                    </span>
                  )}

                  <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md transition-colors ${
                    timeLeft < 60 
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 animate-pulse' 
                      : 'bg-gold/20 text-brown-text dark:text-cream-light'
                  }`}>
                    <Clock size={14} />
                    <span>{formatTime(timeLeft)}</span>
                  </div>
                </div>
              </div>

              {/* Utility Bar: FontSize Adjuster & TTS Speaker */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-navy/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Cỡ chữ:</span>
                  {[
                    { id: 'normal', label: 'A', class: 'text-xs' },
                    { id: 'large', label: 'A+', class: 'text-sm' },
                    { id: 'xlarge', label: 'A++', class: 'text-base' }
                  ].map((size) => (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => setFontSize(size.id as any)}
                      className={`w-6 h-6 rounded-md font-black flex items-center justify-center border transition-all ${
                        fontSize === size.id
                          ? 'bg-red-revolution text-white border-red-revolution'
                          : 'bg-white dark:bg-navy border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      } ${size.class}`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSpeakQuestion}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                    isSpeaking
                      ? 'bg-amber-500 text-white border-amber-500 animate-pulse'
                      : 'bg-white dark:bg-navy border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                  title={isSpeaking ? 'Dừng đọc câu hỏi' : 'Đọc câu hỏi tiếng Việt'}
                >
                  {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  <span>{isSpeaking ? 'Dừng đọc' : 'Đọc câu hỏi'}</span>
                </button>
              </div>
            </div>

            {/* Question Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mb-6 overflow-hidden">
              <div 
                className="bg-red-revolution h-full transition-all duration-300"
                style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
              ></div>
            </div>

            {/* Question content */}
            <h3 className={`font-bold text-navy dark:text-white leading-relaxed mb-6 ${
              fontSize === 'normal' ? 'text-base' : fontSize === 'large' ? 'text-lg' : 'text-xl'
            }`}>
              {questions[currentIdx]?.content}
            </h3>

            {/* Answer Options */}
            <div className="space-y-3 mb-6">
              {[
                { key: 'A', value: questions[currentIdx]?.optionA },
                { key: 'B', value: questions[currentIdx]?.optionB },
                { key: 'C', value: questions[currentIdx]?.optionC },
                { key: 'D', value: questions[currentIdx]?.optionD }
              ].map((opt) => (
                <button
                  key={opt.key}
                  disabled={submitting}
                  onClick={() => handleSelectOption(opt.key)}
                  className={`w-full min-h-[48px] text-left p-4 rounded-xl border font-bold transition-all flex items-center gap-3 ${
                    fontSize === 'normal' ? 'text-sm' : fontSize === 'large' ? 'text-base' : 'text-lg'
                  } ${
                    questions[currentIdx]?.selectedOption === opt.key
                      ? 'border-red-revolution bg-red-revolution/10 text-red-deep dark:text-gold shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-cream-light/60 dark:hover:bg-navy/30 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 font-black text-xs ${
                    questions[currentIdx]?.selectedOption === opt.key
                      ? 'border-red-revolution bg-red-revolution text-white'
                      : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-navy/40 text-slate-500'
                  }`}>
                    {opt.key}
                  </span>
                  <span className="flex-1 leading-relaxed">{opt.value}</span>
                </button>
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex gap-3 border-t border-slate-100 dark:border-slate-800 pt-4 mt-6">
              <button
                disabled={currentIdx === 0 || submitting}
                onClick={handlePrev}
                className="flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                Câu trước
              </button>
              
              {currentIdx === questions.length - 1 ? (
                <RevolutionaryButton
                  onClick={handleSubmit}
                  loading={submitting}
                  className="flex-1"
                >
                  Nộp bài thi
                </RevolutionaryButton>
              ) : (
                <button
                  disabled={submitting}
                  onClick={handleNext}
                  className="flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl bg-red-revolution text-white hover:bg-red-deep flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Câu tiếp theo <ArrowRight size={14} />
                </button>
              )}
            </div>

            {/* Warning indicator */}
            {questions.filter(q => !q.selectedOption).length > 0 && (
              <div className="mt-4 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-semibold justify-center">
                <AlertTriangle size={12} />
                <span>Còn {questions.filter(q => !q.selectedOption).length} câu hỏi chưa hoàn thành.</span>
              </div>
            )}
          </GlassCard>
        )}
      </main>
    </PatternBackground>
  )
}

export default ExamIntro
