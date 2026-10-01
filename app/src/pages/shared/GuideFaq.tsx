import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Key,
  MapPin,
  FileQuestion,
  PlusCircle,
  FileSpreadsheet,
  Palette,
  BookOpen
} from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { useUiSettings } from '../../contexts/UiSettingsContext'
import { useAuth } from '../../contexts/AuthContext'

interface FaqItem {
  id: string
  question: string
  answer: React.ReactNode
  icon: React.ComponentType<any>
  category: 'member' | 'admin'
}

export const GuideFaq: React.FC = () => {
  const { settings } = useUiSettings()
  const { user } = useAuth()
  const [openId, setOpenId] = useState<string | null>('login')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'member' | 'admin'>('all')

  const faqData: FaqItem[] = [
    {
      id: 'login',
      category: 'member',
      icon: Key,
      question: 'Cách đăng nhập tài khoản Đảng viên trên hệ thống?',
      answer: (
        <div className="space-y-2 leading-relaxed">
          <p>
            Tại màn hình đăng nhập, chọn xã, chi bộ và họ tên trong danh sách:
          </p>
          <div className="bg-slate-100 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-cream-light font-mono text-xs">
            Xã → Chi bộ → Họ và tên → Mật khẩu
          </div>
          <p>
            Nếu có người trùng họ tên, ngày sinh sẽ được hiển thị thêm để phân biệt.
          </p>
          <p>
            Mật khẩu mặc định là <b>123456</b>; người dùng có thể tự đổi sau khi đăng nhập.
          </p>
        </div>
      )
    },
    {
      id: 'attendance',
      category: 'member',
      icon: MapPin,
      question: 'Cách xác nhận điểm danh và xử lý khi định vị GPS báo lỗi?',
      answer: (
        <div className="space-y-2 leading-relaxed">
          <p>
            Sau khi đăng nhập thành công và Ban Tổ Chức mở cổng điểm danh, đồng chí bấm nút chính <b>"{settings?.primary_button_text || 'TIẾP TỤC'}"</b> để vào màn hình điểm danh.
          </p>
          <p>
            Khi trình duyệt hiển thị thông báo yêu cầu truy cập Vị trí, đồng chí vui lòng chọn <b>"Cho phép" (Allow)</b> để hệ thống tự động đo khoảng cách tới toạ độ phòng họp.
          </p>
          <p className="font-bold text-amber-600 dark:text-amber-400">
            ⚠️ Nếu định vị báo lỗi hoặc đồng chí chặn quyền truy cập vị trí:
          </p>
          <p>
            Hệ thống <b>vẫn ghi nhận điểm danh có mặt thành công</b> và tự động chuyển tiếp luồng, tuy nhiên trạng thái điểm danh sẽ ghi nhận cảnh báo <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-200">Warning</span> kèm theo lý do lên màn hình của Ban Tổ Chức để duyệt thủ công. Đồng chí hoàn toàn không bị chặn tiến trình sinh hoạt chính trị.
          </p>
        </div>
      )
    },
    {
      id: 'exam',
      category: 'member',
      icon: FileQuestion,
      question: 'Quy trình làm bài kiểm tra trắc nghiệm chuyên đề?',
      answer: (
        <div className="space-y-2 leading-relaxed">
          <p>
            Khi cuộc họp chuyển sang trạng thái kiểm tra nhận thức, nút chính của đồng chí sẽ chuyển sang <b>"Làm bài kiểm tra"</b>.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Màn hình giới thiệu hiển thị thông tin bài kiểm tra: Thời gian làm bài (thông thường là 10 phút), số lượng câu hỏi (10 câu) và thang điểm.</li>
            <li>Đồng hồ chỉ bắt đầu đếm ngược sau khi đồng chí bấm nút <b>"Bắt đầu làm bài"</b>.</li>
            <li>Giao diện thi hiển thị <b>1 câu hỏi/màn hình</b>. Các đáp án A, B, C, D được thiết kế dạng nút lớn giúp dễ thao tác trên điện thoại di động.</li>
            <li>Đáp án được <b>tự động lưu vào hệ thống ngay khi đồng chí click chọn</b>, tránh mất kết quả làm bài nếu rớt mạng hoặc tải lại trang giữa chừng.</li>
            <li>Hết giờ làm bài, hệ thống sẽ tự động thu bài và nộp kết quả tức thì.</li>
            <li>Kết quả thi (Điểm số, số câu đúng/sai, xếp loại nhận thức và bảng giải thích đáp án chi tiết) sẽ hiện ra ngay lập tức sau khi nộp bài.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'create_meeting',
      category: 'admin',
      icon: PlusCircle,
      question: 'Cách Ban Tổ Chức (Admin) khởi tạo một phiên họp mới?',
      answer: (
        <div className="space-y-2 leading-relaxed">
          <p>
            Chỉ những tài khoản có quyền quản trị hoặc tổ chức mới vào được Bảng điều khiển. Để tạo cuộc họp:
          </p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Truy cập menu <b>"Phiên họp"</b> trên thanh điều hướng đầu trang.</li>
            <li>Bấm nút <b>"Tạo phiên họp mới"</b> ở góc phải.</li>
            <li>Nhập Tiêu đề chuyên đề sinh hoạt, Địa điểm họp, Ngày diễn ra họp và các thông tin liên quan, sau đó bấm <b>"Tạo phiên họp"</b>.</li>
          </ol>
          <p className="text-red-revolution dark:text-gold font-bold">
            ⚙️ Cơ chế tự động chốt danh sách:
          </p>
          <p>
            Khi cuộc họp được tạo, hệ thống sẽ tự động chốt toàn bộ các đảng viên đang hoạt động trong bảng thành viên và thêm vào danh sách điểm danh tham gia cuộc họp (`meeting_participants`), đảm bảo tính sĩ số chốt chính xác không sai lệch.
          </p>
        </div>
      )
    },
    {
      id: 'export_reports',
      category: 'admin',
      icon: FileSpreadsheet,
      question: 'Cách xuất báo cáo thống kê kết quả phiên họp?',
      answer: (
        <div className="space-y-2 leading-relaxed">
          <p>
            Sau khi phiên họp kết thúc, Admin truy cập mục <b>"Báo cáo"</b> để xem toàn bộ kết quả phân tích:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><b>Xếp hạng thi đua:</b> Đánh giá chất lượng của các Chi bộ trực thuộc theo tỷ lệ điểm danh và điểm thi trung bình.</li>
            <li><b>Bảng vàng vinh danh:</b> Biểu dương Top 10 cá nhân có điểm thi cao nhất và thời gian làm bài nhanh nhất.</li>
          </ul>
          <p>
            Bấm nút <b>"Xuất CSV Báo cáo"</b> ở đầu trang. Tệp tin tải về máy tính của đồng chí đã được định dạng mã hóa <b>UTF-8 BOM</b> giúp hiển thị chữ tiếng Việt có dấu chuẩn đẹp trên Microsoft Excel mà không lo lỗi font.
          </p>
        </div>
      )
    },
    {
      id: 'ui_settings',
      category: 'admin',
      icon: Palette,
      question: 'Cách tùy biến diện mạo, màu sắc và thay đổi Logo/Banner?',
      answer: (
        <div className="space-y-2 leading-relaxed">
          <p>
            Admin vào mục <b>"Giao diện"</b> (`/admin/ui-settings`) để quản lý thiết lập giao diện động:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><b>Tab Cấu hình Văn bản:</b> Cho phép thay đổi tên phần mềm, khẩu hiệu hành động, thông điệp chào mừng và nhãn nút bấm chính.</li>
            <li><b>Tab Màu sắc & Chủ đề:</b> Admin có thể đổi màu chủ đạo (Theme color) và màu nhấn (Accent color) bằng Color Picker hoặc bảng màu có sẵn. Cho phép đổi Font chữ và chuyển đổi linh hoạt Sáng/Tối.</li>
            <li><b>Tab Kho hình ảnh:</b> Hỗ trợ tải lên ảnh Logo, Banner, Ảnh nền trang chủ, Ảnh nền đăng nhập thông qua kéo thả (giới hạn tệp &lt; 3MB, định dạng jpg, png, webp). Bấm nút <b>"Sử dụng"</b> dưới ảnh để kích hoạt ảnh active hiển thị toàn trang tức thì.</li>
          </ul>
        </div>
      )
    }
  ]

  const filteredFaq = faqData.filter(item => 
    categoryFilter === 'all' || item.category === categoryFilter
  )

  const toggleOpen = (id: string) => {
    setOpenId(openId === id ? null : id)
  }

  return (
    <PatternBackground bgImageUrl={settings?.active_home_background?.file_url}>
      <PortalHeader
        systemTitle={settings?.organization_name}
        subtitle={settings?.site_name}
      />
      <RedNavigationBar
        isAuthenticated={!!user}
        userRole={user?.role}
        userName={user?.memberName}
      />

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
        
        {/* Intro */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-red-revolution/10 text-red-revolution dark:text-gold flex items-center justify-center mx-auto mb-3">
            <BookOpen size={24} />
          </div>
          <h1 className="text-xl md:text-3xl font-bold text-red-deep dark:text-gold normal-case tracking-normal">
            Hướng dẫn & Hỏi đáp
          </h1>
          <p className="text-xs font-bold text-muted dark:text-muted mt-1 normal-case tracking-normal">
            Cẩm nang hướng dẫn sử dụng hệ thống sinh hoạt chính trị điện tử
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all normal-case tracking-normal border ${
              categoryFilter === 'all'
                ? 'bg-red-revolution text-white border-red-revolution shadow-sm'
                : 'bg-white/50 dark:bg-navy/35 border-slate-200 dark:border-slate-800 text-muted dark:text-muted hover:bg-slate-100'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setCategoryFilter('member')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all normal-case tracking-normal border ${
              categoryFilter === 'member'
                ? 'bg-red-revolution text-white border-red-revolution shadow-sm'
                : 'bg-white/50 dark:bg-navy/35 border-slate-200 dark:border-slate-800 text-muted dark:text-muted hover:bg-slate-100'
            }`}
          >
            Đảng viên
          </button>
          <button
            onClick={() => setCategoryFilter('admin')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all normal-case tracking-normal border ${
              categoryFilter === 'admin'
                ? 'bg-red-revolution text-white border-red-revolution shadow-sm'
                : 'bg-white/50 dark:bg-navy/35 border-slate-200 dark:border-slate-800 text-muted dark:text-muted hover:bg-slate-100'
            }`}
          >
            Ban Tổ chức / Admin
          </button>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-4 animate-slide-up">
          {filteredFaq.map((item) => {
            const Icon = item.icon
            const isOpen = openId === item.id

            return (
              <GlassCard
                key={item.id}
                className={`border transition-all overflow-hidden p-0 duration-200 ${
                  isOpen
                    ? 'border-red-revolution/30 dark:border-gold/30 ring-1 ring-red-revolution/10'
                    : 'border-slate-200 dark:border-slate-800/80 hover:border-red-revolution/20'
                }`}
              >
                {/* Accordion Trigger Header */}
                <button
                  onClick={() => toggleOpen(item.id)}
                  className="w-full flex items-center justify-between p-4.5 text-left cursor-pointer transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/10 focus:outline-none"
                >
                  <div className="flex items-center gap-3.5 pr-4">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isOpen
                        ? 'bg-red-revolution text-white dark:bg-gold dark:text-navy shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-900 text-muted dark:text-muted'
                    }`}>
                      <Icon size={16} />
                    </div>
                    <span className="text-xs md:text-sm font-bold text-slate-800 dark:text-muted">
                      {item.question}
                    </span>
                  </div>
                  <div className="text-muted shrink-0">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Accordion Content body */}
                {isOpen && (
                  <div className="p-4.5 bg-slate-50/30 dark:bg-slate-950/15 border-t border-slate-100 dark:border-slate-900 text-xs md:text-sm text-muted dark:text-muted font-semibold animate-fade-in">
                    {item.answer}
                  </div>
                )}
              </GlassCard>
            )
          })}
        </div>

        {/* Footer info banner */}
        <div className="mt-8 text-center bg-white/30 dark:bg-navy/10 border border-slate-200/50 dark:border-slate-800/40 p-4 rounded-card">
          <p className="text-xs font-bold text-muted dark:text-muted normal-case tracking-normal">
            Hệ thống Sinh hoạt chính trị điện tử dưới nghi thức chào cờ
          </p>
          <p className="text-xs text-muted dark:text-muted mt-1 font-semibold">
            Nếu có sự cố phát sinh khác, vui lòng liên hệ quản trị viên của xã.
          </p>
        </div>

      </main>
    </PatternBackground>
  )
}

export default GuideFaq
