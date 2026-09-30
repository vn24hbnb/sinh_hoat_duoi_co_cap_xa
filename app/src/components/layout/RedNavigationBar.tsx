import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, LayoutDashboard, Calendar, Users, BookOpen, BarChart3, Settings, HelpCircle, Trophy, MonitorPlay, Minimize2, Play, Pause, Map } from 'lucide-react'

interface NavLinkItem {
  path: string
  label: string
  icon?: React.ComponentType<any>
}

interface NavigationBarProps {
  isAuthenticated: boolean
  userRole?: 'member' | 'organizer' | 'admin'
  userName?: string
  onLogout?: () => void
}

export const RedNavigationBar: React.FC<NavigationBarProps> = ({
  isAuthenticated,
  userRole = 'member',
  userName,
  onLogout
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  // Cấu hình cỡ chữ cá nhân lưu trữ LocalStorage
  const [textSize, setTextSize] = useState<'sm' | 'md' | 'lg'>(() => {
    return (localStorage.getItem('user-text-size') as 'sm' | 'md' | 'lg') || 'md'
  })

  useEffect(() => {
    document.documentElement.classList.remove('text-size-sm', 'text-size-md', 'text-size-lg')
    document.documentElement.classList.add(`text-size-${textSize}`)
    localStorage.setItem('user-text-size', textSize)
  }, [textSize])

  const [presentationMode, setPresentationMode] = useState(false)
  const [presentationFontSize, setPresentationFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('presentation-font-size')) || 24
  })
  const [autoScroll, setAutoScroll] = useState(false)

  // Sync presentation font size to CSS Variables
  useEffect(() => {
    if (presentationMode) {
      document.documentElement.style.setProperty('--presentation-font-size', `${presentationFontSize}px`)
      document.documentElement.style.setProperty('--presentation-font-size-mobile', `${Math.round(presentationFontSize * 0.75)}px`)
      localStorage.setItem('presentation-font-size', String(presentationFontSize))
    } else {
      document.documentElement.style.removeProperty('--presentation-font-size')
      document.documentElement.style.removeProperty('--presentation-font-size-mobile')
    }
  }, [presentationMode, presentationFontSize])

  // Auto-scroll logic inside presentation mode
  useEffect(() => {
    if (!autoScroll || !presentationMode) return

    let animationFrameId: number
    let lastScrollY = window.scrollY

    const scrollStep = () => {
      window.scrollBy(0, 1) // scroll by 1 pixel

      const currentScrollY = window.scrollY
      const maxScrollY = document.documentElement.scrollHeight - window.innerHeight

      // If reached the bottom or stuck
      if (currentScrollY >= maxScrollY - 2 || (currentScrollY === lastScrollY && currentScrollY > 0)) {
        setAutoScroll(false)
        return
      }

      lastScrollY = currentScrollY
      animationFrameId = requestAnimationFrame(scrollStep)
    }

    animationFrameId = requestAnimationFrame(scrollStep)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [autoScroll, presentationMode])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement
      if (!isCurrentlyFullscreen) {
        setPresentationMode(false)
        setAutoScroll(false)
        document.documentElement.classList.remove('presentation-mode')
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle presentation mode on Alt + P (or Option + P on macOS)
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        const activeEl = document.activeElement
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.getAttribute('contenteditable') !== null
        )
        if (!isInput) {
          e.preventDefault()
          togglePresentationMode()
        }
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [presentationMode])

  const togglePresentationMode = async () => {
    try {
      if (!presentationMode) {
        setPresentationMode(true)
        document.documentElement.classList.add('presentation-mode')
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen()
        }
      } else {
        setPresentationMode(false)
        setAutoScroll(false)
        document.documentElement.classList.remove('presentation-mode')
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen()
        }
      }
    } catch (err) {
      console.error('Error toggling presentation mode:', err)
    }
  }

  const decreaseFontSize = () => {
    setPresentationFontSize(prev => Math.max(prev - 2, 16))
  }

  const increaseFontSize = () => {
    setPresentationFontSize(prev => Math.min(prev + 2, 40))
  }

  const toggleAutoScroll = () => {
    setAutoScroll(prev => !prev)
  }

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout()
    } else {
      navigate('/login')
    }
  }

  // Define links based on Role
  const getNavLinks = (): NavLinkItem[] => {
    if (!isAuthenticated) {
      return [
        { path: '/', label: 'Tổng quan', icon: LayoutDashboard },
        { path: '/login', label: 'Cuộc họp', icon: Calendar },
        { path: '/guide', label: 'Hướng dẫn', icon: HelpCircle },
        { path: '/login', label: 'Đăng nhập', icon: LogOut }
      ]
    }

    const links: NavLinkItem[] = []

    if (userRole === 'member') {
      links.push({ path: '/member', label: 'Trang chủ', icon: LayoutDashboard })
      links.push({ path: '/attendance', label: 'Điểm danh', icon: Calendar })
      links.push({ path: '/exam', label: 'Kiểm tra', icon: BookOpen })
      links.push({ path: '/results', label: 'Kết quả', icon: Trophy })
      links.push({ path: '/guide', label: 'Hướng dẫn', icon: HelpCircle })
    } else {
      // Organizer & Admin links
      links.push({ path: '/admin', label: 'Bảng điều khiển', icon: LayoutDashboard })
      links.push({ path: '/admin/live-map', label: 'Bản đồ Giám sát', icon: Map })
      links.push({ path: '/admin/meetings', label: 'Phiên họp', icon: Calendar })
      links.push({ path: '/admin/members', label: 'Đảng viên', icon: Users })
      links.push({ path: '/admin/questions', label: 'Câu hỏi', icon: BookOpen })
      links.push({ path: '/admin/reports', label: 'Báo cáo', icon: BarChart3 })
      links.push({ path: '/admin/ui-settings', label: 'Giao diện', icon: Settings })
      links.push({ path: '/guide', label: 'Hướng dẫn', icon: HelpCircle })
    }

    return links
  }

  const getMobileBottomLinks = (): NavLinkItem[] => {
    if (!isAuthenticated) {
      return [
        { path: '/', label: 'Tổng quan', icon: LayoutDashboard },
        { path: '/guide', label: 'Hướng dẫn', icon: HelpCircle },
        { path: '/login', label: 'Đăng nhập', icon: LogOut }
      ]
    }

    if (userRole === 'member') {
      return [
        { path: '/member', label: 'Trang chủ', icon: LayoutDashboard },
        { path: '/attendance', label: 'Điểm danh', icon: Calendar },
        { path: '/exam', label: 'Kiểm tra', icon: BookOpen },
        { path: '/results', label: 'Kết quả', icon: Trophy }
      ]
    }

    // Admin & Organizer mobile tasks
    return [
      { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/admin/meetings', label: 'Phiên họp', icon: Calendar },
      { path: '/admin/members', label: 'Đảng viên', icon: Users },
      { path: '/admin/reports', label: 'Báo cáo', icon: BarChart3 },
      { path: '/guide', label: 'Hướng dẫn', icon: HelpCircle }
    ]
  }

  const links = getNavLinks()
  const mobileLinks = getMobileBottomLinks()

  return (
    <>
      <nav className="revolution-nav text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            {/* Logo / Home Label */}
            <div className="flex items-center">
              {/* Bỏ dòng chữ ST-NTC theo yêu cầu */}
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex space-x-1.5 items-center">
              {links.map((link) => {
                const Icon = link.icon
                return (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    end={link.path === '/admin' || link.path === '/member'}
                    className={({ isActive }) =>
                      `px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide transition-all duration-150 flex items-center gap-1 border whitespace-nowrap ${
                        isActive
                          ? 'bg-white/15 text-gold border-gold/25 shadow-sm backdrop-blur-sm scale-105'
                          : 'border-transparent text-red-100 hover:text-white hover:bg-white/10 hover:border-white/10'
                      }`
                    }
                  >
                    {Icon && <Icon size={14} />}
                    {link.label}
                  </NavLink>
                )
              })}
            </div>

            {/* User Info & Logout (Desktop) */}
            <div className="hidden md:flex items-center gap-2">
              {/* Tùy chỉnh cỡ chữ cá nhân */}
              <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-lg border border-white/10 backdrop-blur-sm">
                <button
                  onClick={() => setTextSize('sm')}
                  className={`px-1.5 py-0.5 text-[9px] font-black rounded transition-all cursor-pointer ${
                    textSize === 'sm' ? 'bg-gold text-red-deep shadow-sm scale-105' : 'text-red-100/90 hover:text-white hover:bg-white/10'
                  }`}
                  title="Cỡ chữ nhỏ"
                >
                  A-
                </button>
                <button
                  onClick={() => setTextSize('md')}
                  className={`px-1.5 py-0.5 text-[9px] font-black rounded transition-all cursor-pointer ${
                    textSize === 'md' ? 'bg-gold text-red-deep shadow-sm scale-105' : 'text-red-100/90 hover:text-white hover:bg-white/10'
                  }`}
                  title="Cỡ chữ vừa"
                >
                  A
                </button>
                <button
                  onClick={() => setTextSize('lg')}
                  className={`px-1.5 py-0.5 text-[9px] font-black rounded transition-all cursor-pointer ${
                    textSize === 'lg' ? 'bg-gold text-red-deep shadow-sm scale-105' : 'text-red-100/90 hover:text-white hover:bg-white/10'
                  }`}
                  title="Cỡ chữ lớn"
                >
                  A+
                </button>
              </div>

              {/* Nút Trình chiếu (Desktop) */}
              <button
                onClick={togglePresentationMode}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                  presentationMode
                    ? 'bg-gold text-red-deep border-gold shadow-sm scale-105'
                    : 'bg-white/10 text-red-100 border-white/10 hover:text-white hover:bg-white/20'
                }`}
                title="Bật/Tắt chế độ Trình chiếu"
              >
                <MonitorPlay size={12} className={presentationMode ? 'text-red-deep' : 'text-gold'} />
                <span>Trình chiếu</span>
              </button>

              {isAuthenticated && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gold font-bold bg-white/10 py-1 px-2.5 rounded-lg border border-white/10 backdrop-blur-sm whitespace-nowrap">
                    đ/c {userName || 'Đảng viên'} ({userRole === 'admin' ? 'Admin' : userRole === 'organizer' ? 'BTC' : 'Đảng viên'})
                  </span>
                  <button
                    onClick={handleLogoutClick}
                    className="flex items-center gap-1 text-[11px] font-bold text-red-100 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg border border-white/10 transition-all cursor-pointer"
                  >
                    <LogOut size={13} />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-red-100 hover:text-white hover:bg-red-revolution/60 focus:outline-none transition-colors"
              >
                {isOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden bg-red-dark border-t border-red-deep px-2 pt-2 pb-3 space-y-1 shadow-lg">
            {/* Tùy chỉnh cỡ chữ mobile */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-red-deep/40 mb-2">
              <span className="text-xs font-semibold text-red-100">Cỡ chữ cá nhân:</span>
              <div className="flex items-center gap-1 bg-red-deep/50 p-0.5 rounded-lg border border-gold/30">
                <button
                  onClick={() => setTextSize('sm')}
                  className={`px-2.5 py-1 text-xs font-black rounded transition-all ${
                    textSize === 'sm' ? 'bg-gold text-red-deep shadow-sm' : 'text-red-100/90 hover:bg-white/10'
                  }`}
                >
                  Nhỏ
                </button>
                <button
                  onClick={() => setTextSize('md')}
                  className={`px-2.5 py-1 text-xs font-black rounded transition-all ${
                    textSize === 'md' ? 'bg-gold text-red-deep shadow-sm' : 'text-red-100/90 hover:bg-white/10'
                  }`}
                >
                  Vừa
                </button>
                <button
                  onClick={() => setTextSize('lg')}
                  className={`px-2.5 py-1 text-xs font-black rounded transition-all ${
                    textSize === 'lg' ? 'bg-gold text-red-deep shadow-sm' : 'text-red-100/90 hover:bg-white/10'
                  }`}
                >
                  To
                </button>
              </div>
            </div>

            {/* Tùy chỉnh trình chiếu mobile */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-red-deep/40 mb-2">
              <span className="text-xs font-semibold text-red-100">Chế độ trình chiếu:</span>
              <button
                onClick={() => {
                  setIsOpen(false)
                  togglePresentationMode()
                }}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-black rounded border transition-all ${
                  presentationMode
                    ? 'bg-gold text-red-deep border-gold shadow-sm'
                    : 'bg-red-deep/50 text-red-100 border-gold/30 hover:bg-white/10'
                }`}
              >
                <MonitorPlay size={14} className={presentationMode ? 'text-red-deep' : 'text-gold'} />
                <span>{presentationMode ? 'Đang bật' : 'Tắt'}</span>
              </button>
            </div>
            {links.map((link) => {
              const Icon = link.icon
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.path === '/admin' || link.path === '/member'}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-base font-semibold transition-colors flex items-center gap-2 ${
                      isActive
                        ? 'bg-red-deep text-gold shadow-inner border-l-4 border-gold'
                        : 'text-red-100 hover:bg-red-revolution hover:text-white'
                    }`
                  }
                >
                  {Icon && <Icon size={18} />}
                  {link.label}
                </NavLink>
              )
            })}

            {isAuthenticated && (
              <div className="pt-4 pb-2 border-t border-red-deep mt-2 px-3">
                <div className="text-sm font-semibold text-gold mb-2">
                  đ/c {userName || 'Đảng viên'}
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    handleLogoutClick()
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-red-deep/80 hover:bg-red-deep border border-red-deep text-white px-3 py-2 rounded-md text-sm font-semibold transition-colors"
                >
                  <LogOut size={16} />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-gradient-to-r from-red-dark/95 via-red-revolution/95 to-red-dark/95 backdrop-blur-md border-t border-gold/30 shadow-lg px-2 py-1 flex items-center justify-around h-16 safe-bottom">
        {mobileLinks.map((link) => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === '/admin' || link.path === '/member'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 text-[9px] font-black uppercase tracking-wider transition-all duration-150 ${
                  isActive
                    ? 'text-gold scale-105 drop-shadow-glow'
                    : 'text-red-100/70 hover:text-white'
                }`
              }
            >
              {Icon && <Icon size={18} className="mb-0.5" />}
              <span className="truncate max-w-[70px]">{link.label}</span>
            </NavLink>
          )
        })}
      </div>

      {/* Floating Presentation Control Panel */}
      {presentationMode && (
        <div className="fixed bottom-20 right-6 md:bottom-6 md:right-6 z-[9999] floating-presentation-exit bg-gradient-to-r from-red-dark/95 via-red-revolution/95 to-red-dark/95 backdrop-blur-md border border-gold/40 shadow-2xl rounded-2xl p-3 flex flex-wrap md:flex-nowrap items-center gap-4 text-white max-w-[90vw] md:max-w-xl animate-slide-up select-none">
          {/* Cỡ chữ */}
          <div className="flex items-center gap-2 border-b md:border-b-0 md:border-r border-gold/20 pb-2 md:pb-0 pr-0 md:pr-4 w-full md:w-auto justify-between md:justify-start">
            <span className="text-[10px] font-bold text-gold uppercase tracking-wider">Cỡ chữ:</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={decreaseFontSize}
                disabled={presentationFontSize <= 16}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center font-bold text-sm transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 cursor-pointer"
                title="Giảm cỡ chữ (A-)"
              >
                A-
              </button>
              <span className="text-xs font-bold w-12 text-center bg-black/20 py-1 rounded-md border border-white/5">{presentationFontSize}px</span>
              <button
                onClick={increaseFontSize}
                disabled={presentationFontSize >= 40}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center font-bold text-sm transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 cursor-pointer"
                title="Tăng cỡ chữ (A+)"
              >
                A+
              </button>
            </div>
          </div>

          {/* Tự động cuộn */}
          <div className="flex items-center gap-2 border-b md:border-b-0 md:border-r border-gold/20 pb-2 md:pb-0 pr-0 md:pr-4 w-full md:w-auto justify-between md:justify-start">
            <span className="text-[10px] font-bold text-gold uppercase tracking-wider">Tự cuộn:</span>
            <button
              onClick={toggleAutoScroll}
              className={`w-20 h-7 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                autoScroll 
                  ? 'bg-gold text-red-dark shadow-glow animate-pulse font-black' 
                  : 'bg-white/10 hover:bg-white/20 border border-white/10 text-white'
              }`}
              title={autoScroll ? "Tạm dừng tự động cuộn" : "Bắt đầu tự động cuộn mượt mà"}
            >
              {autoScroll ? (
                <>
                  <Pause size={10} fill="currentColor" />
                  <span>Dừng</span>
                </>
              ) : (
                <>
                  <Play size={10} fill="currentColor" />
                  <span>Cuộn</span>
                </>
              )}
            </button>
          </div>

          {/* Phím tắt / Hướng dẫn */}
          <div className="hidden lg:block text-[9px] text-red-100/70 font-semibold leading-tight pr-2">
            <div>Alt+P: Bật/Tắt</div>
            <div>Esc: Thoát | F11: Toàn màn hình</div>
          </div>

          {/* Nút thoát */}
          <button
            onClick={togglePresentationMode}
            className="w-full md:w-auto bg-red-revolution hover:bg-red-deep text-gold border border-gold/30 hover:border-gold/60 px-3.5 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-bold uppercase text-[10px] tracking-wider transition-all duration-200 cursor-pointer active:scale-95"
            title="Thoát chế độ trình chiếu (Phím tắt: Esc)"
          >
            <Minimize2 size={12} className="text-gold" />
            <span>Thoát</span>
          </button>
        </div>
      )}
    </>
  )
}
