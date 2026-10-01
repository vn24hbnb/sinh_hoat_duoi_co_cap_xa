import React from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Calendar, ShieldCheck, ArrowRight, Award } from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { NewsTicker } from '../../components/layout/NewsTicker'
import { HeroBanner } from '../../components/layout/HeroBanner'
import { GlassCard } from '../../components/ui/GlassCard'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { useAuth } from '../../contexts/AuthContext'

export const Overview: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isAuthenticated = Boolean(user)
  const userRole = user?.role || 'member'
  const userName = user?.memberName || user?.username || ''

  const handleLogout = () => {
    void logout()
    navigate('/login')
  }

  const handleJoinMeeting = () => {
    if (isAuthenticated) {
      if (userRole === 'admin' || userRole === 'organizer') {
        navigate('/admin')
      } else {
        navigate('/member')
      }
    } else {
      navigate('/login')
    }
  }

  return (
    <PatternBackground>
      <PortalHeader />
      <RedNavigationBar
        isAuthenticated={isAuthenticated}
        userRole={userRole}
        userName={userName}
        onLogout={handleLogout}
      />
      <NewsTicker />
      <HeroBanner />

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Informational Columns */}
          <div className="lg:col-span-2 space-y-6">
            <GlassCard className="animate-fade-in">
              <h2 className="text-lg md:text-xl font-bold text-red-deep dark:text-gold normal-case tracking-normal mb-4 border-b border-red-revolution/10 pb-2">
                Giới thiệu chung
              </h2>
              <p className="text-xs md:text-sm font-semibold text-slate-700 dark:text-muted leading-relaxed mb-4">
                Sinh hoạt chính trị dưới nghi thức chào cờ là hoạt động nề nếp, trang nghiêm, góp phần giáo dục truyền thống cách mạng, nâng cao lòng yêu nước, lòng tự hào dân tộc và ý thức trách nhiệm của mỗi cán bộ, đảng viên.
              </p>
              <p className="text-xs md:text-sm font-semibold text-slate-700 dark:text-muted leading-relaxed">
                Hệ thống Sinh hoạt chính trị điện tử hỗ trợ Ban tổ chức quản lý nhanh danh sách tham dự, tối ưu quy trình điểm danh tọa độ GPS và số hóa các bài thu hoạch, câu hỏi nhận thức nhanh giúp nâng cao chất lượng học tập Nghị quyết Đảng bộ.
              </p>
            </GlassCard>

            {/* Thi đua trích dẫn */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlassCard className="p-5 flex gap-4 items-start animate-slide-up">
                <div className="w-10 h-10 rounded-xl bg-red-revolution/10 flex items-center justify-center text-red-revolution shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-navy dark:text-white normal-case mb-1">
                    Gương mẫu - Kỷ cương
                  </h3>
                  <p className="text-xs text-muted dark:text-muted font-semibold leading-normal">
                    Mỗi đảng viên nghiêm túc thực hiện nghĩa vụ tham gia sinh hoạt, đúng giờ và chấp hành đúng quy định phòng họp.
                  </p>
                </div>
              </GlassCard>

              <GlassCard className="p-5 flex gap-4 items-start animate-slide-up">
                <div className="w-10 h-10 rounded-xl bg-red-revolution/10 flex items-center justify-center text-red-revolution shrink-0">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-navy dark:text-white normal-case mb-1">
                    Học tập không ngừng
                  </h3>
                  <p className="text-xs text-muted dark:text-muted font-semibold leading-normal">
                    Tiếp thu đầy đủ các nội dung chuyên đề chính trị dưới cờ và hoàn thành xuất sắc các bài thu hoạch trắc nghiệm.
                  </p>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Action Column */}
          <div className="space-y-6">
            <GlassCard className="text-center border-2 border-red-revolution/20 flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-gold/10 text-gold flex items-center justify-center mb-4 border border-gold/30">
                <Calendar size={28} />
              </div>
              <h3 className="text-base font-bold text-red-deep dark:text-gold normal-case tracking-normal mb-2">
                Sinh hoạt chính trị
              </h3>
              <p className="text-xs font-semibold text-muted dark:text-muted leading-relaxed mb-6">
                Đồng chí đảng viên vui lòng bấm nút bên dưới để tiến hành điểm danh trực tuyến và hoàn thành bài kiểm tra nhận thức chuyên đề tháng.
              </p>
              
              <RevolutionaryButton onClick={handleJoinMeeting} className="w-full" variant="primary">
                {isAuthenticated ? 'Vào cuộc họp ngay' : 'Đăng nhập tham gia'} <ArrowRight size={18} />
              </RevolutionaryButton>
            </GlassCard>

            {/* Thi đua vinh danh */}
            <GlassCard className="p-6">
              <div className="flex items-center gap-2 text-gold mb-3">
                <Award size={20} />
                <span className="text-xs font-bold normal-case tracking-normal">Thông điệp thi đua</span>
              </div>
              <blockquote className="border-l-2 border-gold pl-3 text-xs italic font-semibold text-muted dark:text-muted leading-relaxed">
                "Đoàn kết, gương mẫu, trách nhiệm; hoàn thành tốt nhiệm vụ chính trị được giao."
              </blockquote>
            </GlassCard>
          </div>

        </div>
      </main>
    </PatternBackground>
  )
}

export default Overview
