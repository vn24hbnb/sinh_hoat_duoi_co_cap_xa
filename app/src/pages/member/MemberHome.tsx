import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  Flag,
  FileText,
  ArrowRight,
  UserCheck,
  FileQuestion,
  BookOpen,
  Clock,
  Volume2,
  VolumeX,
  Eye,
  X,
  Award,
  Trophy,
  Shield,
  User,
  ChevronRight,
  Phone,
  Search,
  Users,
  ListChecks
} from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { NewsTicker } from '../../components/layout/NewsTicker'
import { GlassCard } from '../../components/ui/GlassCard'
import { SessionProgress } from '../../components/ui/SessionProgress'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { useAuth } from '../../contexts/AuthContext'
import { useUiSettings } from '../../contexts/UiSettingsContext'
import { meetingService } from '../../services/meetingService'
import type { MeetingSession } from '../../services/meetingService'
import { memberService } from '../../services/memberService'
import type { MemberSessionStatus } from '../../services/memberService'
import { reportService } from '../../services/reportService'
import type { MeetingReportData } from '../../services/reportService'
import partyCommitteeIntroImg from '../../assets/party_committee_intro.png'

interface Member {
  id: string
  full_name: string
  chi_bo_id: string
  position: string | null
  phone: string | null
  is_active: boolean
  chi_bos?: {
    id: string
    name: string
  }
}

interface ChiBo {
  id: string
  name: string
  chi_bo_number: number
  secretary_name: string | null
  sort_order: number
}

const anthemLyrics = [
  { time: 0, text: "Nghiêm! Chào cờ! Chào!" },
  { time: 6, text: "Đoàn quân Việt Nam đi, chung lòng cứu quốc," },
  { time: 13, text: "Bước chân dồn vang trên đường gập ghềnh xa." },
  { time: 20, text: "Cờ in máu chiến thắng mang hồn nước," },
  { time: 27, text: "Súng ngoài xa chen khúc quân hành ca." },
  { time: 33, text: "Đường vinh quang xây xác quân thù," },
  { time: 39, text: "Thắng gian lao cùng nhau lập chiến khu." },
  { time: 46, text: "Vì nhân dân chiến đấu không ngừng," },
  { time: 52, text: "Tiến mau ra sa trường," },
  { time: 56, text: "Tiến lên! Cùng tiến lên!" },
  { time: 61, text: "Nước non Việt Nam ta vững bền!" },
  { time: 70, text: "Đoàn quân Việt Nam đi, chung lòng cứu quốc..." }
]

export const MemberHome: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { settings } = useUiSettings()
  
  const [meeting, setMeeting] = useState<MeetingSession | null>(null)
  const [memberStatus, setMemberStatus] = useState<MemberSessionStatus | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [reportData, setReportData] = useState<MeetingReportData | null>(null)
  const [historyData, setHistoryData] = useState<any[]>([])
  
  // Tăng trải nghiệm xem tài liệu, đọc và offline
  const [viewingDoc, setViewingDoc] = useState<any | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [speechRate, setSpeechRate] = useState<number>(1.0)
  const [speechVoiceName, setSpeechVoiceName] = useState<string>('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [readProgress, setReadProgress] = useState<number>(0)
  const [showCeremonyModal, setShowCeremonyModal] = useState(false)
  const [ceremonyPlaying, setCeremonyPlaying] = useState(false)
  const [lyricsIndex, setLyricsIndex] = useState(0)
  
  // States cho Sơ đồ và Giới thiệu Đảng bộ
  const [activeTab, setActiveTab] = useState<'session' | 'attendance' | 'org'>('session')
  const [chiBos, setChiBos] = useState<ChiBo[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selectedChiBo, setSelectedChiBo] = useState<ChiBo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeOrgView, setActiveOrgView] = useState<'danguy' | 'chibo'>('chibo')
  
  // States cho báo xin vắng
  const [showAbsenceModal, setShowAbsenceModal] = useState(false)
  const [absenceReason, setAbsenceReason] = useState('Ốm, đau')
  const [absenceNotes, setAbsenceNotes] = useState('')
  const [submittingAbsence, setSubmittingAbsence] = useState(false)
  const [absenceError, setAbsenceError] = useState('')
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Tải danh sách giọng đọc tiếng Việt khả dụng
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const allVoices = window.speechSynthesis.getVoices()
        const viVoices = allVoices.filter(v => v.lang.toLowerCase().includes('vi'))
        setVoices(viVoices)
        if (viVoices.length > 0 && !speechVoiceName) {
          setSpeechVoiceName(viVoices[0].name)
        }
      }
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, [])

  const handleSpeakDocTitle = () => {
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
        setIsSpeaking(false)
        return
      }

      if (!viewingDoc) return
      
      const textToSpeak = `Đồng chí đang xem tài liệu chuyên đề: ${viewingDoc.title}. Tài liệu định dạng ${viewingDoc.file_type === 'pdf' ? 'P Đê Ép' : 'Word'}. Vui lòng theo dõi nội dung hiển thị trên màn hình.`
      
      const utterance = new SpeechSynthesisUtterance(textToSpeak)
      utterance.lang = 'vi-VN'
      utterance.rate = speechRate
      
      if (speechVoiceName) {
        const selectedVoice = voices.find(v => v.name === speechVoiceName)
        if (selectedVoice) {
          utterance.voice = selectedVoice
        }
      }
      
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

  // Tắt đọc khi đóng modal
  useEffect(() => {
    if (!viewingDoc && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [viewingDoc])

  useEffect(() => {
    async function loadData() {
      if (!user) return
      
      setLoading(true)
      setError('')
      try {
        // Tải thông tin phiên họp, danh sách chi bộ và đảng viên song song
        const [activeSession, fetchedChiBos, fetchedMembers] = await Promise.all([
          meetingService.getActiveSession(),
          memberService.getChiBos(),
          memberService.getAllMembers()
        ])
        
        setMeeting(activeSession)
        setChiBos(fetchedChiBos)
        
        // Lọc bỏ tài khoản admin ra khỏi danh sách hiển thị
        const filtered = fetchedMembers.filter(m => 
          m.full_name.toLowerCase() !== 'admin' &&
          !m.position?.toLowerCase().includes('admin')
        )
        setMembers(filtered)

        // Tải lịch sử tham gia sinh hoạt ở chế độ nền
        if (user) {
          memberService.getMemberParticipationHistory(user.memberId)
            .then(hist => setHistoryData(hist))
            .catch(err => console.error('Lỗi tải lịch sử sinh hoạt:', err))
        }

        if (activeSession) {
          // Tải trạng thái cá nhân, danh sách tài liệu họp và báo cáo điểm danh chi bộ song song
          const [status, docs, report] = await Promise.all([
            memberService.getMemberSessionStatus(user.memberId, activeSession.id),
            meetingService.getSessionDocuments(activeSession.id),
            reportService.compileMeetingReport(activeSession.id)
          ])
          setMemberStatus(status)
          setDocuments(docs)
          setReportData(report)
        }
      } catch (err: any) {
        console.error(err)
        setError('Có lỗi xảy ra khi tải dữ liệu từ hệ thống.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  // Polling tự động làm mới trạng thái điểm danh và kết quả các chi bộ mỗi 15 giây khi phiên họp đang mở
  useEffect(() => {
    if (!meeting || !user) return

    const interval = setInterval(async () => {
      try {
        const [status, report] = await Promise.all([
          memberService.getMemberSessionStatus(user.memberId, meeting.id),
          reportService.compileMeetingReport(meeting.id)
        ])
        setMemberStatus(status)
        setReportData(report)
      } catch (err) {
        console.error("Lỗi cập nhật dữ liệu tự động:", err)
      }
    }, 15000)

    return () => clearInterval(interval)
  }, [meeting, user])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleAbsenceSubmit = async () => {
    if (!user || !meeting) return
    
    setSubmittingAbsence(true)
    setAbsenceError('')
    try {
      const fullReason = `Vắng có lý do: ${absenceReason}${absenceNotes.trim() ? ` (${absenceNotes.trim()})` : ''}`
      
      const { attendanceService } = await import('../../services/attendanceService')
      await attendanceService.requestExcusedAbsence(meeting.id, user.memberId, fullReason, user.id)
      
      setShowAbsenceModal(false)
      setAbsenceNotes('')
      
      // Tải lại dữ liệu trang
      const status = await memberService.getMemberSessionStatus(user.memberId, meeting.id)
      setMemberStatus(status)
      
      const report = await reportService.compileMeetingReport(meeting.id)
      setReportData(report)
    } catch (err: any) {
      setAbsenceError(err.message || 'Lỗi gửi báo cáo xin vắng.')
    } finally {
      setSubmittingAbsence(false)
    }
  }

  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return ''
    try {
      const date = new Date(timeStr)
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch (e) {
      return ''
    }
  }

  /**
   * Evaluates current user state and returns target redirect string
   */
  const getNextAction = (status: MemberSessionStatus, session: MeetingSession): 'ATTENDANCE' | 'EXAM' | 'RESULT' | 'WAITING' => {
    if (!status.attended && !status.excused && session.status === 'attendance_open') {
      return 'ATTENDANCE'
    }

    // Taking the exam does not depend on having a successful attendance record.
    if (!status.examSubmitted && status.hasExam && session.status === 'exam_open') {
      return 'EXAM'
    }

    if (!status.attended) return 'WAITING'

    if (status.attended && !status.examSubmitted) return 'WAITING'

    if (status.examSubmitted) {
      return 'RESULT'
    }

    return 'WAITING'
  }

  const handleContinueClick = () => {
    if (!memberStatus || !meeting) return

    const nextAction = getNextAction(memberStatus, meeting)

    switch (nextAction) {
      case 'ATTENDANCE':
        navigate('/attendance')
        break
      case 'EXAM':
        navigate('/exam')
        break
      case 'RESULT':
        navigate('/result')
        break
      default:
        // Already handled or waiting
        break
    }
  }

  const handleCeremonyTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const time = e.currentTarget.currentTime
    let currentLyricIndex = 0
    for (let i = 0; i < anthemLyrics.length; i++) {
      if (time >= anthemLyrics[i].time) {
        currentLyricIndex = i
      }
    }
    setLyricsIndex(currentLyricIndex)
  }

  // Tiến trình đọc tài liệu chuyên đề
  useEffect(() => {
    if (!viewingDoc) {
      setReadProgress(0)
      return
    }

    const interval = setInterval(() => {
      setReadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 2 // Tăng 2% mỗi giây -> 50 giây để hoàn thành
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [viewingDoc])

  // Chức danh được hiển thị theo dữ liệu đã nhập; không giả định trước danh sách cán bộ.
  const getDangUyMembers = (): Member[] => {
    return members
      .filter(m => /đảng ủy viên|ủy viên ban chấp hành|bí thư đảng ủy|phó bí thư đảng ủy/i.test(m.position || ''))
      .sort((a, b) => {
        const getPriority = (position: string | null) => {
          const value = position || ''
          if (/bí thư đảng ủy/i.test(value) && !/phó/i.test(value)) return 1
          if (/phó bí thư đảng ủy/i.test(value)) return 2
          return 3
        }
        return getPriority(a.position) - getPriority(b.position) || a.full_name.localeCompare(b.full_name, 'vi')
      })
  }

  const dangUyList = getDangUyMembers()
  const biThu = dangUyList.find(m => /bí thư đảng ủy/i.test(m.position || '') && !/phó/i.test(m.position || ''))
  const phoBiThu = dangUyList.find(m => /phó bí thư đảng ủy/i.test(m.position || ''))
  const uyVienList = dangUyList.filter(m => m.id !== biThu?.id && m.id !== phoBiThu?.id)

  // Get leader text for a Chi Bo (Bí thư, Phó Bí thư, Chi ủy viên)
  const getChiBoLeaders = (chiBoId: string) => {
    const cbMembers = members.filter(m => m.chi_bo_id === chiBoId)
    
    const getLeadPart = (pos: string | null): string => {
      if (!pos) return ''
      return pos.split('|')[0].toLowerCase().trim()
    }

    const isDangUyTitle = (posStr: string): boolean => {
      const lower = posStr.toLowerCase()
      // Nếu có "đảng ủy" / "đảng bộ" mà KHÔNG có từ "chi bộ", thì là chức danh Đảng ủy/Đảng bộ
      if (lower.includes('đảng ủy') || lower.includes('đảng bộ') || lower.includes('đảng uỷ')) {
        if (!lower.includes('chi bộ')) return true
      }
      return false
    }
    
    // Find Bí thư Chi bộ (strictly check for 'bí thư', exclude 'phó' and Dang Uy titles)
    const biThu = cbMembers.find(m => {
      const leadPart = getLeadPart(m.position)
      const isBt = (leadPart.includes('bí thư') || leadPart.includes('bt')) && !leadPart.includes('phó')
      return isBt && !isDangUyTitle(leadPart) && !isDangUyTitle(m.position || '')
    })
    
    // Find Phó Bí thư Chi bộ (strictly check for 'phó bí thư', exclude Dang Uy titles)
    const phoBiThu = cbMembers.find(m => {
      const leadPart = getLeadPart(m.position)
      const isPbt = leadPart.includes('phó bí thư') || leadPart.includes('pbt')
      return isPbt && !isDangUyTitle(leadPart) && !isDangUyTitle(m.position || '')
    })
    
    // Find Chi ủy viên Chi bộ (exclude Bí thư, Phó bí thư, and Dang Uy titles)
    const chiUyViens = cbMembers.filter(m => {
      const leadPart = getLeadPart(m.position)
      const isCuv = (leadPart.includes('chi ủy viên') || leadPart.includes('cuv')) && !leadPart.includes('phó') && !leadPart.includes('bí thư')
      return isCuv && !isDangUyTitle(leadPart) && !isDangUyTitle(m.position || '')
    }).map(m => m.full_name)

    return {
      biThu: biThu?.full_name || 'Chưa cập nhật',
      phoBiThu: phoBiThu?.full_name || 'Chưa cập nhật',
      chiUyViens: chiUyViens.length > 0 ? chiUyViens.join(', ') : 'Không có'
    }
  }

  const getMemberRankWeight = (m: any): number => {
    const weights: number[] = []

    if (m.position) {
      // Tách các chức danh kiêm nhiệm qua dấu phẩy, chấm phẩy, gạch dọc, gạch chéo, hoặc dấu và
      const parts = m.position.split(/[,;|&\/]/).map((p: string) => p.trim().toLowerCase()).filter(Boolean)
      
      parts.forEach((posLower: string) => {
        if (posLower.includes('phó bí thư đảng ủy') || posLower.includes('phó bí thư đảng bộ')) {
          weights.push(20)
        } else if (posLower.includes('bí thư đảng ủy') || posLower.includes('bí thư đảng bộ')) {
          weights.push(10)
        } else if (
          posLower.includes('đảng ủy viên') || 
          posLower.includes('ủy viên ban chấp hành đảng bộ') || 
          posLower.includes('ủy viên bch đảng bộ') || 
          posLower.includes('ủy viên ban chấp hành đảng ủy')
        ) {
          weights.push(30)
        } else if (posLower.includes('phó bí thư chi bộ')) {
          weights.push(50)
        } else if (posLower.includes('bí thư chi bộ') || posLower.includes('bí thư cb')) {
          weights.push(40)
        } else if (posLower.includes('chi ủy viên') || posLower.includes('cuv')) {
          weights.push(60)
        } else if (posLower.includes('phó chủ nhiệm ủy ban kiểm tra') || posLower.includes('phó chủ nhiệm ubkt')) {
          weights.push(80)
        } else if (posLower.includes('chủ nhiệm ủy ban kiểm tra') || posLower.includes('chủ nhiệm ubkt')) {
          weights.push(70)
        } else if (
          posLower.includes('ủy viên ủy ban kiểm tra') || 
          posLower.includes('ủy viên ubkt') || 
          posLower.includes('ubkt')
        ) {
          weights.push(90)
        } else if (posLower.includes('đảng viên')) {
          weights.push(100)
        }
      })
    }

    if (weights.length === 0) {
      return 100
    }

    return Math.min(...weights)
  }

  // Filtered members inside a selected Chi Bo based on search query
  const getFilteredChiBoMembers = () => {
    if (!selectedChiBo) return []
    const list = members.filter(m => 
      m.chi_bo_id === selectedChiBo.id &&
      (m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       (m.position && m.position.toLowerCase().includes(searchQuery.toLowerCase())))
    )
    return [...list].sort((a, b) => {
      const wA = getMemberRankWeight(a)
      const wB = getMemberRankWeight(b)
      if (wA !== wB) return wA - wB
      return a.full_name.localeCompare(b.full_name, 'vi')
    })
  }

  if (loading) {
    return <LoadingSpinner message="Đang tải thông tin..." fullScreen />
  }

  return (
    <PatternBackground bgImageUrl={settings?.active_home_background?.file_url}>
      <PortalHeader
        systemTitle={settings?.organization_name}
        subtitle={settings?.site_name}
      />
      <RedNavigationBar
        isAuthenticated={true}
        userRole="member"
        userName={user?.memberName}
        onLogout={handleLogout}
      />
      <NewsTicker />

      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
        
        {isOffline && (
          <div className="bg-red-600 text-white text-xs font-bold py-2.5 px-4 text-center rounded-xl mb-4 animate-pulse">
            ⚠️ Thiết bị của đồng chí đang mất kết nối mạng. Một số tính năng có thể không hoạt động ổn định.
          </div>
        )}

        {/* User Info Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-red-deep dark:text-gold normal-case tracking-normal">
              Đ/c {user?.memberName}
            </h1>
            <p className="text-xs font-bold text-muted dark:text-muted mt-0.5">
              Chức vụ: {user?.position} | {user?.chiBoName}
            </p>
          </div>
          <div>
          </div>
        </div>

        {error && <AlertMessage type="error" message={error} className="mb-6" />}

        {/* Tab Selection */}
        <div className="flex border-b border-red-revolution/10 mb-6 bg-white/40 dark:bg-navy/20 p-1.5 rounded-card border border-slate-200 dark:border-slate-800 shadow-sm gap-1">
          <button
            onClick={() => {
              setActiveTab('session')
              setSelectedChiBo(null)
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs md:text-sm font-bold normal-case tracking-normal rounded-xl transition-all cursor-pointer ${
              activeTab === 'session'
                ? 'bg-red-revolution text-white shadow-sm'
                : 'text-slate-650 dark:text-muted hover:text-red-revolution hover:bg-white/30'
            }`}
          >
            <Calendar size={14} />
            <span>Sinh hoạt chính trị</span>
          </button>
          
          <button
            onClick={() => {
              setActiveTab('attendance')
              setSelectedChiBo(null)
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs md:text-sm font-bold normal-case tracking-normal rounded-xl transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-red-revolution text-white shadow-sm'
                : 'text-slate-650 dark:text-muted hover:text-red-revolution hover:bg-white/30'
            }`}
          >
            <UserCheck size={14} />
            <span>Kết quả điểm danh</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('org')
              setSelectedChiBo(null)
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs md:text-sm font-bold normal-case tracking-normal rounded-xl transition-all cursor-pointer ${
              activeTab === 'org'
                ? 'bg-red-revolution text-white shadow-sm'
                : 'text-slate-650 dark:text-muted hover:text-red-revolution hover:bg-white/30'
            }`}
          >
            <Users size={14} />
            <span>Sơ đồ & Giới thiệu</span>
          </button>
        </div>

        {/* ==================== TAB 1: SESSION INFO ==================== */}
        {activeTab === 'session' && (
          <div className="animate-fade-in space-y-6">
            {/* 1. NO ACTIVE MEETING STATE */}
            {!meeting ? (
              <div className="space-y-6">
                <GlassCard className="text-center py-12 animate-slide-up border border-red-revolution/20">
                  <div className="w-16 h-16 rounded-full bg-red-revolution/10 flex items-center justify-center text-red-revolution mx-auto mb-4">
                    <Calendar size={32} />
                  </div>
                  <h2 className="text-lg md:text-xl font-bold text-navy dark:text-white mb-2">
                    Chưa có phiên họp chính trị nào diễn ra
                  </h2>
                  <p className="text-xs md:text-sm font-semibold text-muted dark:text-muted max-w-md mx-auto leading-relaxed mb-6">
                    Hiện tại Ban Tổ Chức chưa mở phiên sinh hoạt chính trị. Vui lòng đợi cho đến khi có cuộc họp được kích hoạt trên hệ thống.
                  </p>
                  <RevolutionaryButton onClick={() => window.location.reload()} variant="secondary">
                    Tải lại trang
                  </RevolutionaryButton>
                </GlassCard>

                {historyData.length > 0 && (
                  <GlassCard className="animate-slide-up border border-red-revolution/10">
                    <div className="flex items-center gap-2 text-red-revolution dark:text-gold mb-4 border-b border-red-revolution/10 pb-2">
                      <Trophy size={18} className="text-red-revolution dark:text-gold" />
                      <h3 className="text-xs font-bold normal-case tracking-normal">Quá trình sinh hoạt của đồng chí</h3>
                    </div>

                    <div className="p-4 bg-white/30 dark:bg-navy/10 rounded-card border border-red-revolution/5">
                      <h4 className="text-xs font-bold normal-case text-muted dark:text-cream-light mb-3 tracking-normal flex items-center gap-1">
                        <span>🌟 Lộ trình sinh hoạt gần đây</span>
                        <span className="text-xs font-bold text-muted normal-case">(Tối đa 8 phiên họp gần nhất)</span>
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
                              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-xs ${badgeColor} shadow-sm`}>
                                {historyData.length - index}
                              </div>
                              <span className="text-xs font-bold text-navy dark:text-white text-center truncate w-full">
                                {hist.title}
                              </span>
                              <span className="text-xs font-bold normal-case tracking-normal text-center">
                                {badgeText}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </GlassCard>
                )}
              </div>
            ) : (
              /* 2. MEETING ACTIVE STATE */
              <div className="space-y-6 animate-slide-up">
                {memberStatus && <SessionProgress attended={memberStatus.attended} submitted={memberStatus.examSubmitted} examOpen={meeting.status === 'exam_open'} />}
                
                {/* Active Meeting Card */}
                <GlassCard className="border-l-4 border-l-red-revolution">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2 text-red-revolution dark:text-gold">
                      <Calendar size={20} />
                      <span className="text-xs font-bold normal-case tracking-normal">Phiên họp hiện tại</span>
                    </div>
                    <StatusBadge 
                      status={
                        meeting.status === 'active' ? 'warning' :
                        meeting.status === 'attendance_open' ? 'warning' : 
                        meeting.status === 'exam_open' ? 'info' : 'success'
                      } 
                      label={
                        meeting.status === 'active' ? 'Chuẩn bị sinh hoạt' :
                        meeting.status === 'attendance_open' ? 'Mở điểm danh' :
                        meeting.status === 'exam_open' ? 'Đang kiểm tra' :
                        meeting.status === 'exam_closed' ? 'Đóng kiểm tra' : 'Đang diễn ra'
                      } 
                    />
                  </div>
                  
                  <h2 className="text-lg md:text-xl font-bold text-navy dark:text-white mb-2">
                    {meeting.title}
                  </h2>

                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => setShowCeremonyModal(true)}
                      className="inline-flex min-h-11 items-center gap-2 px-1 py-2 text-primary dark:text-accent-text underline underline-offset-4 text-sm font-medium cursor-pointer"
                    >
                      <Flag size={18} aria-hidden="true" /> Cử hành nghi lễ chào cờ & Quốc ca
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm font-semibold text-muted dark:text-muted mb-6">
                    <div>📍 Địa điểm: <b>{meeting.location || 'Chưa cấu hình'}</b></div>
                    <div>📅 Ngày họp: <b>{meeting.meeting_date || 'Hôm nay'}{meeting.start_time && ` lúc ${formatTime(meeting.start_time)}`}</b></div>
                  </div>

                  {/* Quick Action Callout Box */}
                  {memberStatus && (() => {
                    const nextAction = getNextAction(memberStatus, meeting)
                    
                    let calloutBg = 'bg-slate-50 dark:bg-slate-900/30 border-slate-250 dark:border-slate-800'
                    let calloutTitle = 'Đang diễn ra'
                    let calloutDesc = 'Phiên sinh hoạt chính trị đang diễn ra. Vui lòng theo dõi tiến trình của đồng chí.'
                    let pulseColor = 'bg-slate-400'
                    let showPulse = false
                    
                    if (nextAction === 'ATTENDANCE') {
                      calloutBg = 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 animate-pulse-glow'
                      calloutTitle = 'Yêu cầu: Điểm danh ngay'
                      calloutDesc = 'Vui lòng thực hiện điểm danh khuôn mặt và định vị để ghi nhận sự hiện diện của đồng chí.'
                      pulseColor = 'bg-red-500'
                      showPulse = true
                    } else if (nextAction === 'EXAM') {
                      calloutBg = 'bg-gold/10 dark:bg-gold/5 border-gold/40 animate-pulse-glow'
                      calloutTitle = 'Yêu cầu: Làm bài kiểm tra'
                      calloutDesc = 'Ban Tổ Chức đã mở bài thi trắc nghiệm. Vui lòng làm bài để hoàn thành thu hoạch chuyên đề.'
                      pulseColor = 'bg-gold-500'
                      showPulse = true
                    } else if (nextAction === 'RESULT') {
                      calloutBg = 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-250'
                      calloutTitle = 'Đã hoàn thành'
                      calloutDesc = 'Đồng chí đã hoàn tất điểm danh và làm bài thi. Bấm xem bảng điểm và xếp hạng thi đua cá nhân.'
                      pulseColor = 'bg-emerald-500'
                      showPulse = false
                    } else if (nextAction === 'WAITING') {
                      let waitingMsg = 'Cờ đã chào. Vui lòng đợi Ban Tổ Chức mở phần điểm danh cuộc họp.'
                      if (meeting.status === 'active') {
                        waitingMsg = 'Phiên sinh hoạt đang chuẩn bị khai mạc. Đồng chí vui lòng xem các tài liệu chuyên đề đính kèm bên dưới và chờ Ban Tổ chức mở cổng điểm danh.'
                      } else if (memberStatus.attended && !memberStatus.examSubmitted) {
                        waitingMsg = 'Đã điểm danh thành công. Vui lòng đợi Ban Tổ Chức mở bài kiểm tra nhận thức chuyên đề.'
                      }
                      calloutBg = 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200'
                      calloutTitle = 'Đang chờ Ban tổ chức'
                      calloutDesc = waitingMsg
                      pulseColor = 'bg-amber-500'
                      showPulse = true
                    }
                    
                    return (
                      <div className={`p-4 rounded-card border-2 mb-6 ${calloutBg} transition-all duration-200`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          {showPulse && (
                            <span className="relative flex h-2 w-2">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pulseColor} opacity-75`}></span>
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${pulseColor}`}></span>
                            </span>
                          )}
                          <h4 className="text-xs font-bold normal-case tracking-normal text-navy dark:text-gold">
                            {calloutTitle}
                          </h4>
                        </div>
                        <p className="text-xs font-semibold text-muted dark:text-slate-355 leading-relaxed">
                          {calloutDesc}
                        </p>
                      </div>
                    )
                  })()}

                  {/* User checklist items */}
                  {memberStatus && (
                    <div className="border-t border-red-revolution/10 pt-4 mb-6">
                      <h3 className="text-xs font-bold text-brown-text dark:text-cream-light normal-case tracking-normal mb-3">
                        Tiến độ của đồng chí
                      </h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        {/* Item 1: Attendance */}
                        <div className="flex items-center gap-3 p-3 bg-white/50 dark:bg-navy/30 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${memberStatus.attended ? (memberStatus.attendanceStatus === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600') : memberStatus.excused ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-muted'}`}>
                            <UserCheck size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-bold normal-case">1. Điểm danh</div>
                            <div className="text-xs font-semibold text-muted">
                              {memberStatus.attended ? (
                                memberStatus.attendanceStatus === 'warning' ? (
                                  <span className="text-amber-600 dark:text-amber-400 font-bold">Có cảnh báo</span>
                                ) : (
                                  'Đã điểm danh'
                                )
                              ) : memberStatus.excused ? (
                                'Vắng có lý do'
                              ) : (
                                'Chưa điểm danh'
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Item 2: Exam */}
                        <div className="flex items-center gap-3 p-3 bg-white/50 dark:bg-navy/30 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${memberStatus.examSubmitted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-muted'}`}>
                            <FileQuestion size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-bold normal-case">2. Làm bài thi</div>
                            <div className="text-xs font-semibold text-muted">
                              {memberStatus.examSubmitted ? `Đạt ${memberStatus.examScore} điểm` : 'Chưa làm bài'}
                            </div>
                          </div>
                        </div>

                        {/* Item 3: Documents */}
                        <div className="flex items-center gap-3 p-3 bg-white/50 dark:bg-navy/30 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${documents.length > 0 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-muted'}`}>
                            <BookOpen size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-bold normal-case">3. Tài liệu họp</div>
                            <div className="text-xs font-semibold text-muted">
                              {documents.length > 0 ? `Đã có ${documents.length} tài liệu` : 'Chưa tải lên'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* GPS Warning Callout Banner */}
                      {memberStatus.attended && memberStatus.attendanceStatus === 'warning' && (
                        <div className="bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 p-3 rounded-xl border border-amber-200/60 text-xs font-semibold flex items-start gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping mt-1 shrink-0" />
                          <div>
                            <div className="font-bold text-amber-900 dark:text-amber-400 mb-0.5">⚠️ Điểm danh không định vị / Cảnh báo vị trí</div>
                            <p className="text-xs text-muted dark:text-muted leading-relaxed font-medium">
                              Hệ thống ghi nhận sự hiện diện của đồng chí với lý do: <b>{memberStatus.attendanceWarningReason || 'Vị trí không chính xác'}</b>. Trạng thái điểm danh đang được gửi tới Ban tổ chức để phê duyệt chính thức.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dynamic navigation button based on user progress */}
                  {memberStatus && (() => {
                    const nextAction = getNextAction(memberStatus, meeting)
                    
                    if (nextAction === 'WAITING') {
                      let waitingMsg = 'Vui lòng đợi Ban Tổ Chức mở phần điểm danh cuộc họp.'
                      if (meeting.status === 'active') {
                        waitingMsg = 'Phiên sinh hoạt đang chuẩn bị khai mạc. Đồng chí vui lòng xem các tài liệu chuyên đề đính kèm bên dưới và chờ Ban Tổ chức mở cổng điểm danh.'
                      } else if (memberStatus.attended && !memberStatus.examSubmitted) {
                        waitingMsg = 'Đã điểm danh. Vui lòng đợi Ban Tổ Chức mở bài kiểm tra nhận thức chuyên đề.'
                      }
                      
                      const showAbsenceBtn = !memberStatus.attended && !memberStatus.excused && ['draft', 'active', 'attendance_open'].includes(meeting.status)

                      return (
                        <div className="flex flex-col items-center gap-3 w-full">
                          <div className="w-full bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 p-4 rounded-xl border border-amber-200 text-xs font-bold flex items-center gap-2 justify-center">
                            <Clock size={16} className="animate-pulse" />
                            <span>{waitingMsg}</span>
                          </div>
                          
                          {showAbsenceBtn && (
                            <button
                              type="button"
                              onClick={() => setShowAbsenceModal(true)}
                              className="px-8 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-muted text-xs font-bold normal-case tracking-normal rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700 shadow-sm"
                            >
                              Báo xin vắng
                            </button>
                          )}
                        </div>
                      )
                    }

                    const btnText = settings?.primary_button_text || (
                      nextAction === 'EXAM' ? 'Làm bài kiểm tra' :
                      nextAction === 'RESULT' ? 'Xem kết quả bài thi' : 'Điểm danh ngay'
                    )

                    return (
                      <div className="text-center flex flex-col sm:flex-row justify-center items-center gap-3">
                        <RevolutionaryButton onClick={handleContinueClick} className="w-full sm:w-auto px-12">
                          {btnText} <ArrowRight size={18} />
                        </RevolutionaryButton>
                        
                        {nextAction === 'ATTENDANCE' && (
                          <button
                            type="button"
                            onClick={() => setShowAbsenceModal(true)}
                            className="w-full sm:w-auto px-8 py-2.5 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-muted text-xs font-bold normal-case tracking-normal rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700 shadow-sm"
                          >
                            Báo xin vắng
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </GlassCard>

                {/* 2.5. Detailed Structured Agenda / Program */}
                {meeting && meeting.agenda && (() => {
                  try {
                    const parsed = JSON.parse(meeting.agenda)
                    if (parsed && parsed.is_structured) {
                      return (
                        <GlassCard className="border-l-4 border-l-red-revolution">
                          <div className="flex items-center gap-2 text-red-revolution dark:text-gold mb-4 border-b border-red-revolution/10 pb-2">
                            <ListChecks size={18} />
                            <h3 className="text-xs font-bold normal-case tracking-normal">Chương trình sinh hoạt chính trị dưới cờ</h3>
                          </div>
                          
                          <div className="text-xs space-y-2 mb-4 p-3 bg-red-50/30 dark:bg-red-950/5 border border-red-105 dark:border-red-900/10 rounded-xl leading-relaxed font-semibold text-slate-655 dark:text-muted">
                            {parsed.time_str && (
                              <div>📅 <b>Thời gian:</b> {parsed.time_str}</div>
                            )}
                            {parsed.location_str && (
                              <div>📍 <b>Địa điểm:</b> {parsed.location_str}</div>
                            )}
                            {parsed.participants_str && (
                              <div>👥 <b>Thành phần:</b> {parsed.participants_str}</div>
                            )}
                          </div>

                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs font-semibold text-left">
                              <thead>
                                <tr className="border-b border-red-revolution/10 text-muted">
                                  <th className="py-2.5 px-2 w-10 text-center">TT</th>
                                  <th className="py-2.5 px-2">Nội dung chương trình</th>
                                  <th className="py-2.5 px-2">Người điều hành</th>
                                  <th className="py-2.5 px-2">Người thực hiện</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parsed.items && parsed.items.map((item: any, index: number) => (
                                  <tr 
                                    key={index} 
                                    className="border-b border-slate-50 dark:border-slate-800/40 hover:bg-red-revolution/5 dark:hover:bg-gold/5 transition-colors"
                                  >
                                    <td className="py-3 px-2 text-center font-bold text-red-revolution dark:text-gold">{item.tt || index + 1}</td>
                                    <td className="py-3 px-2 text-navy dark:text-white font-bold">{item.content}</td>
                                    <td className="py-3 px-2 text-muted dark:text-muted">{item.moderator || '-'}</td>
                                    <td className="py-3 px-2 text-slate-605 dark:text-muted">{item.performer || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </GlassCard>
                      )
                    }
                  } catch (e) {
                    // Fallback to text agenda
                  }
                  return null
                })()}

                {/* Documents List panel if documents are available */}
                {documents.length > 0 && (
                  <GlassCard>
                    <div className="flex items-center gap-2 text-red-revolution dark:text-gold mb-4 border-b border-red-revolution/10 pb-2">
                      <FileText size={18} />
                      <h3 className="text-xs font-bold normal-case tracking-normal">Tài liệu chuyên đề học tập</h3>
                    </div>
                    <div className="space-y-3">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-navy/20 hover:border-red-revolution/20 transition-all text-xs md:text-sm font-semibold"
                        >
                          <span className="text-navy dark:text-white font-bold truncate mr-3 flex-1">{doc.title}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Nút Xem nhanh nhúng trực quan */}
                            <button
                              type="button"
                              onClick={() => setViewingDoc(doc)}
                              className="px-2.5 py-1 bg-red-revolution/10 hover:bg-red-revolution/15 text-red-revolution dark:text-gold text-xs font-bold normal-case tracking-normal rounded-lg border border-red-revolution/15 flex items-center gap-1 cursor-pointer"
                            >
                              <Eye size={12} />
                              <span>Xem nhanh</span>
                            </button>
                            
                            {/* Nút Tải về gốc */}
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-650 dark:text-muted text-xs font-bold normal-case tracking-normal rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-1 cursor-pointer"
                            >
                              Tải về
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 1.5: ATTENDANCE RESULTS ==================== */}
        {activeTab === 'attendance' && (
          <div className="animate-fade-in space-y-6">
            {!meeting ? (
              <GlassCard className="text-center py-12 animate-slide-up border border-red-revolution/20">
                <div className="w-16 h-16 rounded-full bg-red-revolution/10 flex items-center justify-center text-red-revolution mx-auto mb-4">
                  <UserCheck size={32} />
                </div>
                <h2 className="text-lg md:text-xl font-bold text-navy dark:text-white mb-2">
                  Chưa có phiên họp chính trị nào diễn ra
                </h2>
                <p className="text-xs md:text-sm font-semibold text-muted dark:text-muted max-w-md mx-auto leading-relaxed mb-6">
                  Hiện tại Ban Tổ Chức chưa mở phiên sinh hoạt chính trị nên không có dữ liệu điểm danh.
                </p>
                <RevolutionaryButton onClick={() => window.location.reload()} variant="secondary">
                  Tải lại trang
                </RevolutionaryButton>
              </GlassCard>
            ) : (
              <GlassCard className="border-t-4 border-t-red-revolution p-6 animate-slide-up">
                <div className="flex items-center justify-between border-b border-red-revolution/10 pb-4 mb-6">
                  <div className="flex items-center gap-2.5 text-red-revolution dark:text-gold">
                    <UserCheck size={22} />
                    <div>
                      <h3 className="text-sm md:text-base font-bold normal-case tracking-normal">Kết quả điểm danh các chi bộ</h3>
                      <p className="text-xs md:text-xs text-muted dark:text-muted font-bold normal-case mt-0.5">
                        Phiên họp: {meeting.title}
                      </p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-950/30 border border-emerald-200/50 text-emerald-650 dark:text-emerald-450 px-3 py-1 rounded-full normal-case">
                      Tự động cập nhật
                    </span>
                  </div>
                </div>

                {reportData && reportData.chiBoReports && reportData.chiBoReports.length > 0 ? (
                  <div className="space-y-6">
                    {/* List of Chi Bos with Horizontal Stacked Bar Charts */}
                    <div className="space-y-5">
                      {[...reportData.chiBoReports]
                        .sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }))
                        .map((cb) => {
                          const total = cb.totalRequired || 0;
                          const attended = cb.totalAttended || 0;
                          const excused = cb.totalExcused || 0;
                          const absent = Math.max(0, total - attended - excused);
                          
                          const attendedPercent = total > 0 ? (attended / total) * 100 : 0;
                          const excusedPercent = total > 0 ? (excused / total) * 100 : 0;
                          const absentPercent = total > 0 ? (absent / total) * 100 : 0;
                          
                          return (
                            <div key={cb.id} className="bg-white/40 dark:bg-navy/20 p-4 rounded-card border border-slate-150 dark:border-slate-800/80 shadow-sm hover:border-red-revolution/20 transition-all">
                              {/* Header info for Chi Bo */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2.5">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xs md:text-sm font-bold text-red-deep dark:text-gold normal-case tracking-normal">
                                    {cb.name}
                                  </span>
                                  <span className="text-xs font-bold text-muted dark:text-muted">
                                    • Bí thư: {cb.secretaryName || 'Chưa cập nhật'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs md:text-xs font-bold">
                                  <span className="text-slate-655 dark:text-muted">
                                    Sĩ số: <b className="text-navy dark:text-white">{total}</b> đ/c
                                  </span>
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    Đã ĐD: <b>{attended}</b>
                                  </span>
                                  <span className="text-amber-600 dark:text-amber-400">
                                    Vắng phép: <b>{excused}</b>
                                  </span>
                                  <span className={absent > 0 ? 'text-rose-600 dark:text-rose-455 font-bold' : 'text-muted'}>
                                    Vắng không phép: <b>{absent}</b>
                                  </span>
                                </div>
                              </div>

                              {/* Stacked Horizontal Bar Container */}
                              <div className="w-full h-5.5 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden flex border border-slate-200/50 dark:border-slate-800 shadow-inner relative group cursor-pointer">
                                {total > 0 ? (
                                  <>
                                    {/* Attended segment (Green, on the left) */}
                                    {attended > 0 && (
                                      <div 
                                        className="bg-gradient-to-r from-emerald-600 to-emerald-500 h-full flex items-center justify-center transition-all duration-500 border-r border-white/10"
                                        style={{ width: `${attendedPercent}%` }}
                                      >
                                        {attendedPercent >= 15 && (
                                          <span className="text-xs font-bold text-white px-1 truncate drop-shadow-sm">
                                            {attended} ({Math.round(attendedPercent)}%)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {/* Excused segment (Orange/Amber, in the middle) */}
                                    {excused > 0 && (
                                      <div 
                                        className="bg-gradient-to-r from-amber-500 to-amber-400 h-full flex items-center justify-center transition-all duration-500 border-r border-white/10"
                                        style={{ width: `${excusedPercent}%` }}
                                      >
                                        {excusedPercent >= 15 && (
                                          <span className="text-xs font-bold text-white px-1 truncate drop-shadow-sm">
                                            {excused} phép ({Math.round(excusedPercent)}%)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {/* Not Attended segment (Red, on the right) */}
                                    {absent > 0 && (
                                      <div 
                                        className="bg-gradient-to-r from-rose-500 to-rose-450 h-full flex items-center justify-center transition-all duration-500"
                                        style={{ width: `${absentPercent}%` }}
                                      >
                                        {absentPercent >= 15 && (
                                          <span className="text-xs font-bold text-white px-1 truncate drop-shadow-sm">
                                            {absent} vắng ({Math.round(absentPercent)}%)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="w-full h-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-muted dark:text-muted">
                                    Không có đảng viên đăng ký sinh hoạt chuyên đề này
                                  </div>
                                )}

                                {/* Hover statistics tooltip inside bar */}
                                <div className="absolute inset-0 opacity-0 hover:opacity-100 bg-black/5 dark:bg-white/5 flex items-center justify-between px-3 text-xs font-bold text-slate-700 dark:text-muted transition-opacity pointer-events-none">
                                  <span>Tỉ lệ có mặt: {Math.round(attendedPercent)}%</span>
                                  <span>Vắng: {absent} đ/c</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Chart Legend & Summary Info */}
                    <div className="border-t border-slate-200/20 dark:border-slate-850 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-muted dark:text-muted">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-emerald-500 inline-block shadow-sm"></span>
                          <span>Đã điểm danh ({reportData.stats?.attendedCount || 0} đồng chí)</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-rose-500 inline-block shadow-sm"></span>
                          <span>Chưa điểm danh ({reportData.stats?.absentCount || 0} đồng chí)</span>
                        </span>
                      </div>
                      <div className="italic text-xs text-muted dark:text-muted">
                        * Tự động đồng bộ hóa dữ liệu mỗi 15 giây
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted font-bold text-xs">
                    Đang tổng hợp báo cáo điểm danh chi bộ thời gian thực...
                  </div>
                )}
              </GlassCard>
            )}
          </div>
        )}

        {/* ==================== TAB 2: ORGANIZATIONAL STRUCTURE ==================== */}
        {activeTab === 'org' && (
          <div className="animate-fade-in space-y-6">
            
            {/* 1. Giới thiệu Đảng bộ với ảnh bìa cao cấp */}
            <div className="bg-white/60 dark:bg-navy/30 backdrop-blur-none border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                {/* Ảnh bìa */}
                <div className="md:col-span-4 lg:col-span-3 shrink-0">
                  <img
                    src={partyCommitteeIntroImg}
                    alt="Giới thiệu Đảng bộ"
                    className="w-full h-32 md:h-24 rounded-xl object-cover border border-red-revolution/20 shadow-[0_4px_15px_rgba(212,0,0,0.1)]"
                  />
                </div>
                {/* Văn bản giới thiệu */}
                <div className="md:col-span-8 lg:col-span-9 space-y-2">
                  <h3 className="text-sm md:text-base font-bold text-red-deep dark:text-gold normal-case tracking-normal">
                    {settings?.organization_name || 'Giới thiệu tổ chức đảng'}
                  </h3>
                  <p className="text-xs md:text-xs text-slate-700 dark:text-muted leading-relaxed font-semibold">
                    Danh sách hiện có {members.length} đảng viên sinh hoạt tại {chiBos.length} chi bộ. Thông tin tổ chức và chức danh được cập nhật theo dữ liệu do quản trị viên của đơn vị cung cấp.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Sub-tabs toggle cho Ban Chấp hành / 8 Chi bộ */}
            <div className="flex justify-center">
              <div className="inline-flex gap-1.5 bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto shadow-sm">
                <button
                  onClick={() => setActiveOrgView('danguy')}
                  className={`flex-1 sm:flex-initial px-4 py-2 text-xs md:text-xs font-bold normal-case rounded-lg transition-all cursor-pointer ${
                    activeOrgView === 'danguy'
                      ? 'bg-red-revolution text-white shadow-sm'
                      : 'text-slate-650 dark:text-muted hover:text-red-revolution'
                  }`}
                >
                  Ban Chấp hành Đảng ủy
                </button>
                <button
                  onClick={() => setActiveOrgView('chibo')}
                  className={`flex-1 sm:flex-initial px-4 py-2 text-xs md:text-xs font-bold normal-case rounded-lg transition-all cursor-pointer ${
                    activeOrgView === 'chibo'
                      ? 'bg-red-revolution text-white shadow-sm'
                      : 'text-slate-650 dark:text-muted hover:text-red-revolution'
                  }`}
                >
                  Các Chi bộ Trực thuộc
                </button>
              </div>
            </div>

            {/* ==================== SUB-VIEW: BAN CHAP HANH ==================== */}
            {activeOrgView === 'danguy' && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center max-w-xl mx-auto">
                  <span className="bg-gold/15 text-gold border border-gold/30 px-3 py-0.5 rounded-full text-xs font-bold normal-case tracking-normal">
                    Ban Chấp hành Đảng ủy
                  </span>
                    <h3 className="text-xs md:text-sm font-bold text-red-deep dark:text-gold normal-case tracking-normal mt-2.5">
                    Ban Chấp hành {settings?.organization_name || 'Đảng bộ cấp xã'}
                  </h3>
                  <p className="text-xs text-muted dark:text-muted font-bold normal-case mt-0.5">
                    {dangUyList.length > 0 ? `${dangUyList.length} đồng chí được ghi nhận theo chức danh đã cập nhật` : 'Thông tin Ban Chấp hành chưa được cập nhật'}
                  </p>
                </div>

                {/* Sơ đồ cây tổ chức phân cấp */}
                <div className="flex flex-col items-center gap-6 relative w-full py-6 px-4 bg-white/40 dark:bg-navy/20 border border-slate-200/80 dark:border-slate-800 rounded-card">
                  {/* Đường kẻ dọc kết nối các cấp */}
                  <div className="absolute top-12 bottom-12 left-1/2 w-0.5 bg-red-revolution/15 dark:bg-gold/15 hidden md:block" />

                  {/* Cấp 1: Bí thư */}
                  {biThu && (
                    <div className="flex flex-col items-center z-10">
                      <div className="flex flex-col items-center bg-gradient-to-b from-red-revolution to-red-dark border border-gold text-white p-3.5 rounded-xl shadow-sm text-center w-52">
                        <div className="w-8.5 h-8.5 rounded-full bg-gold/20 flex items-center justify-center border border-gold/40 text-gold mb-1.5 shadow-inner">
                          <Shield size={16} className="animate-pulse" />
                        </div>
                        <h4 className="text-xs font-bold tracking-normal normal-case">{biThu.full_name}</h4>
                        <p className="text-xs font-bold text-gold normal-case tracking-normal mt-0.5">Bí thư Đảng ủy</p>
                      </div>
                    </div>
                  )}

                  {/* Cấp 2: Phó Bí thư */}
                  {phoBiThu && (
                    <div className="flex flex-col items-center z-10">
                      <div className="flex flex-col items-center bg-white dark:bg-slate-900 border border-red-revolution/40 dark:border-gold/30 text-navy dark:text-white p-3 rounded-xl shadow-sm text-center w-48">
                        <div className="w-8 h-8 rounded-full bg-red-revolution/10 dark:bg-gold/15 text-red-revolution dark:text-gold flex items-center justify-center border border-red-revolution/20 mb-1.5">
                          <Award size={15} />
                        </div>
                        <h4 className="text-xs font-bold normal-case text-red-deep dark:text-gold truncate max-w-full px-1">{phoBiThu.full_name}</h4>
                        <p className="text-xs font-bold text-muted dark:text-muted normal-case tracking-normal mt-0.5">Phó Bí thư Đảng ủy</p>
                      </div>
                    </div>
                  )}

                  {/* Cấp 3: Các Ủy viên BCH */}
                  <div className="w-full max-w-2xl z-10">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 justify-center">
                      {uyVienList.map((m) => (
                        <div
                          key={m.id}
                          className="flex flex-col items-center bg-white/90 dark:bg-navy/40 backdrop-blur-none border border-slate-200/60 dark:border-slate-800 p-3 rounded-xl text-center shadow-sm"
                        >
                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-900 text-muted dark:text-muted flex items-center justify-center mb-1.5 border border-slate-200 dark:border-slate-800">
                            <User size={13} />
                          </div>
                          <h5 className="text-xs font-bold text-slate-800 dark:text-muted truncate max-w-full px-0.5">{m.full_name}</h5>
                          <p className="text-xs font-bold text-muted dark:text-muted normal-case tracking-normal mt-0.5">Ủy viên BCH</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== SUB-VIEW: 8 CHI BO ==================== */}
            {activeOrgView === 'chibo' && (
              <div className="space-y-4 animate-fade-in">
                <div className="text-center max-w-xl mx-auto mb-2">
                  <span className="bg-red-revolution/10 text-red-revolution border border-red-revolution/20 px-3 py-0.5 rounded-full text-xs font-bold normal-case tracking-normal">
                  Tổ chức đảng cơ sở
                  </span>
                  <h3 className="text-xs md:text-sm font-bold text-red-deep dark:text-gold normal-case tracking-normal mt-2.5">
                    Các Chi bộ trực thuộc Đảng bộ
                  </h3>
                  <p className="text-xs text-muted dark:text-muted font-bold normal-case mt-0.5">
                    Nhấp vào chi bộ bất kỳ để xem danh sách Đảng viên chi tiết
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {chiBos.map((cb) => {
                    const cbMembers = members.filter(m => m.chi_bo_id === cb.id)
                    const leaders = getChiBoLeaders(cb.id)
                    return (
                      <div
                        key={cb.id}
                        onClick={() => {
                          setSelectedChiBo(cb)
                          setSearchQuery('')
                        }}
                        className="bg-white/95 dark:bg-slate-900/90 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-slate-200/80 dark:border-slate-800/80 hover:border-red-revolution/40 hover:dark:border-gold/40 cursor-pointer flex flex-col justify-between rounded-xl p-3.5 transition-all duration-200 "
                      >
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold normal-case tracking-normal text-red-revolution dark:text-gold">
                              {cb.name}
                            </span>
                            <span className="text-xs font-bold bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 text-muted dark:text-muted px-2.5 py-0.5 rounded-full">
                              {cbMembers.length} đ/c
                            </span>
                          </div>

                          <div className="space-y-1 mt-2 text-xs md:text-xs font-semibold text-muted dark:text-muted">
                            <div className="truncate">👤 Bí thư: <span className="font-bold text-slate-800 dark:text-white">{leaders.biThu}</span></div>
                            <div className="truncate">👥 Phó Bí thư: <span className="font-bold text-slate-800 dark:text-white">{leaders.phoBiThu}</span></div>
                            <div className="truncate">🎖️ Chi ủy: <span className="font-bold text-slate-750 dark:text-muted">{leaders.chiUyViens}</span></div>
                          </div>
                        </div>

                        <div className="flex justify-end items-center text-xs font-bold text-red-revolution dark:text-gold normal-case tracking-normal pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-3.5">
                          <span>Chi tiết danh sách</span>
                          <ChevronRight size={10} className="ml-0.5" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal xem tài liệu trực quan */}
        {viewingDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-none animate-fade-in">
            <div className="bg-white dark:bg-navy border border-slate-200 dark:border-slate-800 rounded-card w-full max-w-4xl shadow-sm flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-red-revolution dark:text-gold">
                  <FileText size={18} />
                  <h4 className="text-xs md:text-sm font-bold normal-case tracking-normal truncate max-w-lg" title={viewingDoc.title}>
                    Đọc tài liệu: {viewingDoc.title}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  {/* TTS speaker */}
                  <button
                    type="button"
                    onClick={handleSpeakDocTitle}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold normal-case tracking-normal border transition-all cursor-pointer ${
                      isSpeaking
                        ? 'bg-amber-500 text-white border-amber-500 animate-pulse'
                        : 'bg-white dark:bg-navy border-slate-200 dark:border-slate-800 text-muted dark:text-muted hover:bg-slate-50'
                    }`}
                  >
                    {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                    <span>{isSpeaking ? 'Dừng đọc' : 'Đọc tiêu đề'}</span>
                  </button>

                  {/* Close button */}
                  <button
                    type="button"
                    onClick={() => setViewingDoc(null)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-muted hover:text-muted cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Trình điều khiển đọc tài liệu nâng cao */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2 bg-slate-50 dark:bg-navy/60 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="text-xs text-muted normal-case mr-1">Tốc độ đọc:</span>
                  {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setSpeechRate(rate)}
                      className={`px-2 py-0.5 rounded-md font-bold border text-xs transition-all cursor-pointer ${
                        speechRate === rate
                          ? 'bg-red-revolution text-white border-red-revolution shadow-sm'
                          : 'bg-white dark:bg-navy border-slate-200 dark:border-slate-800 text-muted dark:text-muted hover:bg-slate-50'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                {voices.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-bold w-full sm:w-auto">
                    <span className="text-xs text-muted normal-case mr-1 whitespace-nowrap">Giọng đọc:</span>
                    <select
                      value={speechVoiceName}
                      onChange={(e) => setSpeechVoiceName(e.target.value)}
                      className="p-1 border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-navy text-xs font-bold text-muted dark:text-muted outline-none w-full sm:w-48 focus:border-red-revolution cursor-pointer"
                    >
                      {voices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name.replace('Google', '').trim()} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 relative overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ease-out ${
                    readProgress === 100 ? 'bg-emerald-500' : 'bg-gold'
                  }`}
                  style={{ width: `${readProgress}%` }}
                />
              </div>
              <div className="flex justify-between items-center px-4 py-1.5 bg-yellow-50/50 dark:bg-amber-950/10 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-brown-text dark:text-gold normal-case tracking-normal">
                <span>📖 Tiến trình nghiên cứu chuyên đề</span>
                <span className={readProgress === 100 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                  {readProgress === 100 ? '✅ Đã hoàn thành (100%)' : `Đang nghiên cứu: ${Math.round(readProgress)}%`}
                </span>
              </div>

              {/* Modal Body: IFrame nhúng */}
              <div className="p-4 flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950/40">
                {viewingDoc.file_type === 'pdf' ? (
                  <iframe 
                    src={viewingDoc.file_url} 
                    className="w-full h-[65vh] rounded-xl border border-slate-200 dark:border-slate-800"
                    title={viewingDoc.title}
                  />
                ) : (
                  // Nhúng file Word (.doc/.docx) bằng Office Online Viewer
                  <iframe 
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewingDoc.file_url)}`} 
                    className="w-full h-[65vh] rounded-xl border border-slate-200 dark:border-slate-800"
                    title={viewingDoc.title}
                  />
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-3 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-muted dark:text-muted">
                <span>* Tài liệu nhúng bảo mật được tải trực tiếp từ máy chủ lưu trữ.</span>
                <button
                  type="button"
                  onClick={() => setViewingDoc(null)}
                  className="px-4 py-1.5 border border-slate-200 dark:border-slate-800 text-muted dark:text-muted rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 font-bold normal-case text-xs cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== MODAL CHI TIET CHI BO ==================== */}
        {selectedChiBo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-none animate-fade-in">
            <div className="bg-white dark:bg-navy border border-slate-200 dark:border-slate-800 rounded-card w-full max-w-2xl shadow-sm flex flex-col max-h-[85vh]">
              
              {/* Modal Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-150 dark:border-slate-800 gap-3">
                <div>
                  <span className="text-xs font-bold normal-case bg-red-revolution text-white px-2 py-0.5 rounded-md">
                    Chi bộ trực thuộc
                  </span>
                  <h4 className="text-xs md:text-sm font-bold normal-case tracking-normal text-red-deep dark:text-gold mt-1">
                    {selectedChiBo.name}
                  </h4>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* Tìm kiếm */}
                  <div className="relative flex-1 sm:flex-initial">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-muted">
                      <Search size={12} />
                    </div>
                    <input
                      type="text"
                      placeholder="Tìm họ tên hoặc chức vụ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="block w-full sm:w-56 min-h-[30px] pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-revolution/50 text-xs font-semibold"
                    />
                  </div>

                  {/* Nút đóng */}
                  <button
                    onClick={() => setSelectedChiBo(null)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-muted hover:text-muted cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950/40">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-150 dark:divide-slate-800">
                    <thead className="bg-slate-100 dark:bg-slate-900/60">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-bold normal-case tracking-normal text-muted w-12">STT</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-bold normal-case tracking-normal text-muted">Đồng chí</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-bold normal-case tracking-normal text-muted">Chức vụ</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-bold normal-case tracking-normal text-muted">Điện thoại</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 dark:divide-slate-800 font-semibold text-xs text-slate-700 dark:text-muted">
                      {getFilteredChiBoMembers().length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center font-bold text-muted">
                            Không tìm thấy đồng chí nào phù hợp với từ khoá.
                          </td>
                        </tr>
                      ) : (
                        getFilteredChiBoMembers().map((m, index) => {
                          const isLeader = m.position && (
                            m.position.toLowerCase().includes('bí thư') || 
                            m.position.toLowerCase().includes('chi ủy')
                          );
                          return (
                            <tr key={m.id} className="hover:bg-white/40 dark:hover:bg-navy/10 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap text-muted font-bold">{index + 1}</td>
                              <td className={`px-4 py-3 whitespace-nowrap ${isLeader ? 'text-red-revolution dark:text-gold font-bold' : 'text-slate-900 dark:text-white'}`}>
                                {m.full_name}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted dark:text-muted">{m.position || 'Đảng viên'}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {m.phone ? (
                                  <a
                                    href={`tel:${m.phone}`}
                                    className="inline-flex items-center gap-1 text-slate-650 hover:text-red-revolution dark:text-muted dark:hover:text-gold font-bold"
                                  >
                                    <Phone size={10} />
                                    <span>{m.phone}</span>
                                  </a>
                                ) : (
                                  <span className="text-muted font-medium">--</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end p-3.5 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10">
                <button
                  onClick={() => setSelectedChiBo(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-muted dark:text-muted rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-bold normal-case text-xs cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Sticky Bottom Action Bar for Mobile-first */}
      {meeting && memberStatus && (() => {
        const nextAction = getNextAction(memberStatus, meeting)
        const showAbsenceBtn = !memberStatus.attended && !memberStatus.excused && ['draft', 'active', 'attendance_open'].includes(meeting.status)

        if (nextAction === 'WAITING') {
          if (showAbsenceBtn) {
            return (
              <div className="member-action-bar fixed bottom-[calc(var(--ui-tabbar-height)+env(safe-area-inset-bottom))] left-0 right-0 z-40 p-3 bg-surface border-t border-line md:hidden flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAbsenceModal(true)}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-muted text-xs font-bold normal-case tracking-normal rounded-xl border border-slate-200 dark:border-slate-750 shadow-sm cursor-pointer"
                >
                  Báo vắng
                </button>
              </div>
            )
          }
          return null
        }

        const btnText = settings?.primary_button_text || (
          nextAction === 'EXAM' ? 'Làm bài kiểm tra' :
          nextAction === 'RESULT' ? 'Xem kết quả bài thi' : 'Điểm danh ngay'
        )
        return (
          <div className="member-action-bar fixed bottom-[calc(var(--ui-tabbar-height)+env(safe-area-inset-bottom))] left-0 right-0 z-40 p-3 bg-surface border-t border-line md:hidden flex gap-3 justify-center">
            <RevolutionaryButton onClick={handleContinueClick} className="flex-1 py-3 text-sm font-bold shadow-sm">
              {btnText} <ArrowRight size={16} />
            </RevolutionaryButton>
            {nextAction === 'ATTENDANCE' && (
              <button
                type="button"
                onClick={() => setShowAbsenceModal(true)}
                className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-muted text-xs font-bold normal-case tracking-normal rounded-xl border border-slate-200 dark:border-slate-750 shadow-sm cursor-pointer"
              >
                Báo vắng
              </button>
            )}
          </div>
        )
      })()}

      {/* ==================== MODAL NGHI LỄ CHÀO CỜ ==================== */}
      {showCeremonyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-none animate-fade-in">
          <div className="bg-red-deep dark:bg-navy border border-yellow-500/30 rounded-card w-full max-w-2xl shadow-sm p-6 flex flex-col text-center relative overflow-hidden">
            {/* Brass drum background pattern decoration */}
            <div className="absolute inset-0 opacity-5 pointer-events-none bg-center bg-no-repeat bg-contain" style={{ backgroundImage: `url(${partyCommitteeIntroImg})` }} />

            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6 border-b border-yellow-500/10 pb-3 relative z-10">
              <h3 className="text-sm font-bold text-gold normal-case tracking-normal flex items-center gap-2 mx-auto">
                <Flag size={18} aria-hidden="true" /> NGHI LỄ CHÀO CỜ & QUỐC CA
              </h3>
              <button
                type="button"
                onClick={() => setShowCeremonyModal(false)}
                className="absolute right-0 p-1.5 rounded-lg hover:bg-white/10 text-yellow-300 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Vietnam Flag SVG */}
            <div className="mb-6 relative z-10 flex flex-col items-center">
              <svg 
                viewBox="0 0 300 200" 
                className="w-56 h-36 rounded-xl shadow-sm border-2 border-yellow-400 bg-red-revolution animate-flag-wave relative"
              >
                <rect width="300" height="200" fill="#D40000" />
                <g transform="translate(150, 100)">
                  <polygon 
                    points="0,-45 13,-13 43,-13 18,6 28,38 0,19 -28,38 -18,6 -43,-13 -13,-13" 
                    fill="#FACC15" 
                  />
                </g>
              </svg>
              {ceremonyPlaying && (
                <div className="mt-3 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-400 text-red-dark animate-pulse shadow-sm animate-fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-revolution"></span>
                  ĐANG CỬ HÀNH HÀNH KHÚC
                </div>
              )}
            </div>

            {/* Lyrics Card */}
            <div className="mb-8 p-4 bg-red-dark/30 dark:bg-navy/60 rounded-xl border border-yellow-500/20 min-h-[90px] flex items-center justify-center relative z-10 shadow-inner">
              <p className="text-sm md:text-base font-serif italic text-yellow-100 font-bold tracking-normal transition-all duration-300">
                {anthemLyrics[lyricsIndex].text}
              </p>
            </div>

            {/* Audio tag */}
            <div className="mb-6 relative z-10">
              <audio
                src="https://upload.wikimedia.org/wikipedia/commons/e/ec/Tien_quan_ca_instrumental.ogg"
                autoPlay
                controls
                onPlay={() => setCeremonyPlaying(true)}
                onPause={() => setCeremonyPlaying(false)}
                onEnded={() => setCeremonyPlaying(false)}
                onTimeUpdate={handleCeremonyTimeUpdate}
                className="w-full max-w-sm mx-auto accent-yellow-400"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-center gap-3 border-t border-yellow-500/10 pt-4 relative z-10">
              <RevolutionaryButton
                onClick={() => setShowCeremonyModal(false)}
                variant="gold"
                className="px-8 shadow-sm"
              >
                Hoàn thành Nghi lễ
              </RevolutionaryButton>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL BÁO XIN VẮNG ==================== */}
      {showAbsenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-none animate-fade-in">
          <GlassCard className="w-full max-w-md border border-red-revolution/20 shadow-sm relative">
            <button 
              onClick={() => setShowAbsenceModal(false)}
              className="absolute top-4 right-4 text-muted hover:text-slate-650 dark:hover:text-slate-200 cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-sm font-bold text-red-deep dark:text-gold normal-case tracking-normal mb-4 flex items-center gap-1.5">
              <Calendar size={18} /> Báo cáo xin vắng sinh hoạt
            </h3>

            {absenceError && (
              <AlertMessage type="error" message={absenceError} className="mb-4" />
            )}

            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="text-xs normal-case font-bold text-muted block mb-1.5">Lý do xin vắng:</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Ốm, đau', 'Họp, công tác', 'Nghỉ phép', 'Việc gia đình'].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setAbsenceReason(reason)}
                      className={`p-2.5 rounded-lg border text-center font-bold cursor-pointer transition-all ${
                        absenceReason === reason
                          ? 'border-red-revolution bg-red-revolution/10 text-red-revolution dark:border-gold dark:bg-gold/15 dark:text-gold shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white/50 dark:bg-navy/20 text-slate-700 dark:text-muted'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs normal-case font-bold text-muted block mb-1.5">Ghi chú thêm (Tùy chọn):</label>
                <textarea
                  value={absenceNotes}
                  onChange={(e) => setAbsenceNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-navy/20 focus:border-red-revolution font-medium text-xs resize-none"
                  placeholder="Ghi rõ chi tiết lý do (ví dụ: Công tác đột xuất tại Hà Nội)..."
                  rows={3}
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAbsenceModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-muted rounded-xl border border-slate-200 dark:border-slate-700 font-bold normal-case cursor-pointer text-xs"
                >
                  Hủy bỏ
                </button>
                <RevolutionaryButton
                  onClick={handleAbsenceSubmit}
                  loading={submittingAbsence}
                  fullWidth
                  className="flex-1 normal-case text-xs"
                >
                  Xác nhận báo vắng
                </RevolutionaryButton>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </PatternBackground>
  )
}

export default MemberHome
