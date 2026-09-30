import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, User, Eye, EyeOff, HelpCircle } from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { GlassCard } from '../../components/ui/GlassCard'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { useAuth } from '../../contexts/AuthContext'
import { useUiSettings } from '../../contexts/UiSettingsContext'

export const Login: React.FC = () => {
  const { login } = useAuth()
  const { settings } = useUiSettings()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.')
      return
    }

    setLoading(true)

    try {
      const session = await login(username, password)
      
      // Redirect directly to destination without forcing password change
      if (session.role === 'admin' || session.role === 'organizer') {
        navigate('/admin')
      } else {
        navigate('/member')
      }
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra trong quá trình đăng nhập. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PatternBackground bgImageUrl={settings?.active_login_background?.file_url}>
      <PortalHeader />
      <div className="max-w-md mx-auto py-12 px-4">
        <GlassCard className="border border-red-revolution/25">
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-red-deep dark:text-gold uppercase tracking-wider">
              {settings?.login_title || 'Đăng nhập phiên họp'}
            </h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              {settings?.organization_name || 'Đảng bộ Thanh tra tỉnh Sơn La'}
            </p>
          </div>

          {error && <AlertMessage type="error" message={error} className="mb-4" />}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Username Field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brown-text dark:text-cream-light mb-1.5">
                Tên đăng nhập
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  placeholder="viethd.chibo1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-red-revolution/20 bg-white/70 dark:bg-navy/50 text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-revolution/50 text-sm font-semibold transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brown-text dark:text-cream-light mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full min-h-[48px] pl-10 pr-12 rounded-xl border border-red-revolution/20 bg-white/70 dark:bg-navy/50 text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-revolution/50 text-sm font-semibold transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-navy dark:hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <RevolutionaryButton type="submit" loading={loading} fullWidth>
                Đăng nhập
              </RevolutionaryButton>
            </div>
          </form>

          {/* Account Instruction */}
          <div className="mt-6 pt-4 border-t border-red-revolution/10 text-center">
            <span className="text-[11px] font-semibold text-slate-400 leading-normal">
              * Sử dụng tài khoản được cấp theo công thức: <b>[tên][họđệm].chibo[X]</b>
              <br />Mật khẩu mặc định: <b>Thanhtra@123</b>
            </span>
          </div>
        </GlassCard>
      </div>

      {/* Floating Guide Button */}
      <button
        onClick={() => navigate('/guide')}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 p-3 rounded-full bg-white/10 dark:bg-gold/10 hover:bg-white/20 dark:hover:bg-gold/20 border border-white/20 dark:border-gold/30 backdrop-blur-md text-white dark:text-gold shadow-lg transition-all duration-300 hover:scale-110 flex items-center justify-center cursor-pointer group"
        title="Hướng dẫn sử dụng"
        id="btn-guide-floating"
      >
        <HelpCircle size={22} className="text-gold dark:text-gold animate-pulse" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 ease-out text-xs font-black whitespace-nowrap uppercase tracking-wider text-white">
          Hướng dẫn
        </span>
      </button>
    </PatternBackground>
  )
}

export default Login
