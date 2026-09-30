import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ShieldAlert, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  User, 
  Database,
  ArrowLeft
} from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { supabase } from '../../services/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

interface AuditLog {
  id: string
  action: string
  target_type: string | null
  target_id: string | null
  metadata: any
  created_at: string
  actor: {
    username: string
    member: {
      full_name: string
    } | null
  } | null
}

const PAGE_SIZE = 15

export const AdminAuditLogs: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  // State
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('ALL')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const loadAuditLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const start = (page - 1) * PAGE_SIZE
      const end = start + PAGE_SIZE - 1

      let query = supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          target_type,
          target_id,
          metadata,
          created_at,
          actor:app_users(
            username,
            member:members(full_name)
          )
        `, { count: 'exact' })

      // Apply action type filter
      if (actionFilter !== 'ALL') {
        query = query.eq('action', actionFilter)
      }

      // Order by latest
      query = query.order('created_at', { ascending: false }).range(start, end)

      const { data, error: err, count } = await query

      if (err) throw err

      setLogs((data as any[]) || [])
      setTotalCount(count || 0)
    } catch (err: any) {
      console.error(err)
      setError('Lỗi khi tải nhật ký hệ thống: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAuditLogs()
  }, [page, actionFilter])

  // Client side search helper
  const filteredLogs = logs.filter(log => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    
    const actorName = log.actor?.member?.full_name?.toLowerCase() || ''
    const username = log.actor?.username?.toLowerCase() || ''
    const action = log.action.toLowerCase()
    const metadataStr = JSON.stringify(log.metadata).toLowerCase()
    
    return actorName.includes(query) || username.includes(query) || action.includes(query) || metadataStr.includes(query)
  })

  // Pagination totals
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1

  // Format action name nicely
  const getActionLabel = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return { text: '🔓 Đăng nhập thành công', color: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' }
      case 'LOGIN_FAILURE':
        return { text: '🔒 Đăng nhập thất bại', color: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400' }
      case 'LOGOUT':
        return { text: '🚪 Đăng xuất', color: 'bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-900/20 dark:text-slate-400' }
      case 'CREATE_MEMBER':
        return { text: '👤 Thêm đảng viên', color: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400' }
      case 'UPDATE_MEMBER':
        return { text: '✏️ Sửa đảng viên', color: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400' }
      case 'DELETE_MEMBER':
        return { text: '🗑️ Xóa đảng viên', color: 'bg-rose-50 text-rose-750 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400' }
      case 'SOFT_DELETE_MEMBER':
        return { text: '💤 Vô hiệu hóa đảng viên', color: 'bg-violet-50 text-violet-755 border-violet-100 dark:bg-violet-950/20 dark:text-violet-400' }
      case 'RESET_PASSWORD':
        return { text: '🔑 Đặt lại mật khẩu', color: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400' }
      case 'CHANGE_PASSWORD':
        return { text: '🔄 Đổi mật khẩu', color: 'bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950/20 dark:text-teal-400' }
      case 'CREATE_QUESTION_BANK':
        return { text: '📁 Tạo bộ đề', color: 'bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-950/20 dark:text-cyan-400' }
      case 'DELETE_QUESTION_BANK':
        return { text: '🗑️ Xóa bộ đề', color: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400' }
      case 'CREATE_QUESTION':
        return { text: '❓ Thêm câu hỏi', color: 'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400' }
      case 'DELETE_QUESTION':
        return { text: '🗑️ Xóa câu hỏi', color: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400' }
      case 'IMPORT_QUESTIONS':
        return { text: '📥 Import câu hỏi', color: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400' }
      case 'UPDATE_UI_SETTINGS':
        return { text: '🎨 Cập nhật giao diện', color: 'bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-950/20 dark:text-pink-400' }
      case 'UPDATE_MEETING_UI_SETTINGS':
        return { text: '⚙️ Cấu hình điểm danh', color: 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400' }
      case 'MARK_ATTENDANCE':
        return { text: '📍 Điểm danh', color: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' }
      default:
        return { text: action, color: 'bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-900/20 dark:text-slate-400' }
    }
  }

  // Render metadata detail based on action type
  const renderMetadata = (log: AuditLog) => {
    const meta = log.metadata || {}
    switch (log.action) {
      case 'LOGIN':
        return <span className="font-semibold text-slate-650">Tài khoản: <b className="text-navy dark:text-cream-light">{meta.username}</b> (Vai trò: {meta.role})</span>
      case 'LOGIN_FAILURE':
        return <span className="text-rose-700 font-bold">Lý do lỗi: {meta.reason} {meta.username && `(Username: ${meta.username})`}</span>
      case 'CREATE_MEMBER':
      case 'UPDATE_MEMBER':
        return (
          <span className="text-slate-650">
            Đảng viên: <b className="text-navy dark:text-cream-light font-bold">{meta.fullName}</b> ({meta.chiBoName})
            {meta.username && <span> - Tài khoản: <code className="text-red-700 font-bold">{meta.username}</code></span>}
          </span>
        )
      case 'RESET_PASSWORD':
        return <span className="text-amber-700 dark:text-amber-400 font-bold">Đặt lại mật khẩu mặc định (Thanhtra@123)</span>
      case 'IMPORT_QUESTIONS':
        return <span className="text-emerald-700 dark:text-emerald-400 font-bold">Nhập thành công <b>{meta.count} câu hỏi</b> {meta.method === 'file' ? 'từ file' : 'từ clipboard'}</span>
      case 'CREATE_QUESTION':
        return <span className="text-slate-600 dark:text-slate-400 italic">" {meta.content} "</span>
      case 'UPDATE_UI_SETTINGS':
        return <span className="text-pink-700 dark:text-pink-400 font-bold">Thay đổi thiết kế giao diện cổng thông tin</span>
      case 'UPDATE_MEETING_UI_SETTINGS':
        return <span className="text-purple-700 dark:text-purple-400">Cấu hình bán kính: <b>{meta.gps_radius_m}m</b>, hình thức: <b>{meta.attendance_methods}</b></span>
      case 'MARK_ATTENDANCE':
        return <span className="text-slate-500">Tự động ghi nhận điểm danh (GPS: {meta.gpsValid ? 'Hợp lệ' : 'Cảnh báo'})</span>
      default:
        return <span className="text-slate-400 text-[10px] font-mono break-all">{JSON.stringify(meta)}</span>
    }
  }

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
        {/* Back navigation */}
        <button 
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 text-xs font-bold text-red-revolution hover:text-red-700 mb-6 transition-all font-sans cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Quay lại trang tổng quan Admin</span>
        </button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl font-black text-navy dark:text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="text-red-revolution dark:text-gold" />
              Nhật ký hệ thống (Audit Logs)
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              Theo dõi và kiểm tra vết toàn bộ các hoạt động điều hành và cấu hình của Ban Tổ chức
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <GlassCard className="mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm hành động, đảng viên, nội dung..."
                className="pl-9 pr-4 py-2 w-full text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-900/60 dark:text-white focus:outline-none focus:border-red-revolution"
              />
            </div>

            {/* Filter actions */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Bộ lọc hành động:</span>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value)
                  setPage(1)
                }}
                className="text-xs font-black rounded-lg border border-slate-200 dark:border-slate-800 py-2 px-3 dark:bg-slate-900/80 dark:text-white focus:outline-none focus:border-red-revolution"
              >
                <option value="ALL">Tất cả hành động</option>
                <option value="LOGIN">Đăng nhập thành công</option>
                <option value="LOGIN_FAILURE">Đăng nhập lỗi</option>
                <option value="CREATE_MEMBER">Thêm đảng viên</option>
                <option value="UPDATE_MEMBER">Sửa đảng viên</option>
                <option value="DELETE_MEMBER">Xóa đảng viên</option>
                <option value="RESET_PASSWORD">Đặt lại mật khẩu</option>
                <option value="CREATE_QUESTION_BANK">Tạo bộ đề</option>
                <option value="IMPORT_QUESTIONS">Nhập câu hỏi</option>
                <option value="UPDATE_UI_SETTINGS">Cập nhật giao diện</option>
                <option value="UPDATE_MEETING_UI_SETTINGS">Cấu hình điểm danh</option>
              </select>
            </div>
          </div>
        </GlassCard>

        {error && <AlertMessage type="error" message={error} className="mb-6" />}

        {/* Logs Table */}
        <GlassCard>
          {loading ? (
            <div className="py-20">
              <LoadingSpinner message="Đang tải dữ liệu nhật ký hệ thống..." />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-20 text-center">
              <Database className="mx-auto text-slate-350 dark:text-slate-650 mb-3" size={48} />
              <div className="text-sm font-bold text-slate-400">Không tìm thấy bản ghi nhật ký nào phù hợp.</div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs font-semibold text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[9px]">
                      <th className="py-3 px-4">Thời gian</th>
                      <th className="py-3 px-4">Hành động</th>
                      <th className="py-3 px-4">Người thực hiện (Actor)</th>
                      <th className="py-3 px-4">Chi tiết thay đổi (Metadata)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => {
                      const actionStyle = getActionLabel(log.action)
                      const formattedTime = new Date(log.created_at).toLocaleString('vi-VN')
                      const actorName = log.actor?.member?.full_name || log.actor?.username || 'Hệ thống / Ẩn danh'
                      const isSystem = !log.actor

                      return (
                        <tr key={log.id} className="border-b border-slate-50/50 dark:border-slate-900/20 hover:bg-red-revolution/5">
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} className="text-slate-400" />
                              {formattedTime}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${actionStyle.color}`}>
                              {actionStyle.text}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 font-bold text-navy dark:text-white">
                              <User size={12} className={isSystem ? "text-slate-400" : "text-red-revolution dark:text-gold"} />
                              <span>{actorName}</span>
                            </div>
                            {log.actor?.username && !isSystem && (
                              <span className="text-[9px] text-slate-400 font-mono font-medium">@{log.actor.username}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-350 max-w-md font-semibold">
                            {renderMetadata(log)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                <span className="text-xs text-slate-500 font-semibold">
                  Hiển thị bản ghi {Math.min(totalCount, (page - 1) * PAGE_SIZE + 1)} - {Math.min(totalCount, page * PAGE_SIZE)} trong tổng số <b>{totalCount}</b> bản ghi
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-black px-3 py-1 bg-red-revolution/10 border border-red-revolution/20 dark:border-gold/20 dark:bg-gold/10 text-red-revolution dark:text-gold rounded-lg font-sans">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </GlassCard>
      </main>
    </PatternBackground>
  )
}

export default AdminAuditLogs
