import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, KeyRound, Eye, EyeOff } from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { GlassCard } from '../../components/ui/GlassCard'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { useAuth } from '../../contexts/AuthContext'

export const ChangePassword: React.FC = () => {
  const { user, changePassword } = useAuth()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có tối thiểu 8 ký tự.')
      return
    }

    if (newPassword === 'Thanhtra@123') {
      setError('Mật khẩu mới không được trùng với mật khẩu mặc định.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.')
      return
    }

    setLoading(true)

    try {
      await changePassword(newPassword)
      if (user?.role === 'admin' || user?.role === 'organizer') {
        navigate('/admin')
      } else {
        navigate('/member')
      }
    } catch (err: any) {
      setError(err.message || 'Thay đổi mật khẩu thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PatternBackground>
      <PortalHeader />
      <div className="max-w-md mx-auto py-12 px-4">
        <GlassCard>
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-red-revolution/10 flex items-center justify-center text-red-revolution mx-auto mb-4">
              <ShieldAlert size={32} />
            </div>
            <h2 className="text-xl font-black text-red-deep dark:text-gold uppercase tracking-wider">
              Đổi mật khẩu mới
            </h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              Đồng chí đang sử dụng mật khẩu mặc định. Vui lòng cập nhật để bảo mật tài khoản.
            </p>
          </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              {error && <AlertMessage type="error" message={error} />}

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brown-text dark:text-cream-light mb-1.5">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu mới"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full min-h-[48px] pl-10 pr-12 rounded-xl border border-red-revolution/20 bg-white/70 dark:bg-navy/50 text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-revolution/50 text-sm font-semibold transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-navy dark:hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brown-text dark:text-cream-light mb-1.5">
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full min-h-[48px] pl-10 pr-12 rounded-xl border border-red-revolution/20 bg-white/70 dark:bg-navy/50 text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-revolution/50 text-sm font-semibold transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <RevolutionaryButton type="submit" loading={loading} fullWidth>
                  Thay đổi và Tiếp tục
                </RevolutionaryButton>
              </div>
            </form>
        </GlassCard>
      </div>
    </PatternBackground>
  )
}

export default ChangePassword
