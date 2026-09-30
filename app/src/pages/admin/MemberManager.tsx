import React, { useState, useEffect } from 'react'
import {
  Search,
  Phone,
  Shield,
  Award,
  ChevronRight,
  User,
  X
} from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { useUiSettings } from '../../contexts/UiSettingsContext'
import { memberService } from '../../services/memberService'
import { useAuth } from '../../contexts/AuthContext'

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
  app_users?: {
    username: string
    role: string
  }[]
}

interface ChiBo {
  id: string
  name: string
  chi_bo_number: number
  secretary_name: string | null
  sort_order: number
}

export const MemberManager: React.FC = () => {
  const { settings } = useUiSettings()
  const { user } = useAuth()

  // State
  const [members, setMembers] = useState<Member[]>([])
  const [chiBos, setChiBos] = useState<ChiBo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Interactive state
  const [activeView, setActiveView] = useState<'danguy' | 'chibo'>('danguy')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [selectedChiBo, setSelectedChiBo] = useState<ChiBo | null>(null)

  // CRUD & Leaders Modification States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isLeaderModalOpen, setIsLeaderModalOpen] = useState(false)
  
  const [memberForm, setMemberForm] = useState({
    id: '',
    full_name: '',
    chi_bo_id: '',
    position: '',
    phone: '',
    role: 'member' as 'member' | 'organizer' | 'admin',
    username: ''
  })
  
  const [selectedChiBoForLeader, setSelectedChiBoForLeader] = useState<ChiBo | null>(null)
  const [leaderForm, setLeaderForm] = useState({
    biThuMemberId: '',
    phoBiThuMemberId: '',
    chiUyVienMemberIds: [] as string[]
  })

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [fetchedChiBos, fetchedMembers] = await Promise.all([
          memberService.getChiBos(),
          memberService.getAllMembers()
        ])
        setChiBos(fetchedChiBos)
        // Filter out admin users from the members list
        const filtered = fetchedMembers.filter(m => 
          m.full_name.toLowerCase() !== 'admin' &&
          !m.position?.toLowerCase().includes('admin')
        )
        setMembers(filtered)
      } catch (err: any) {
        console.error(err)
        setError('Không thể tải danh sách chi bộ và đảng viên từ hệ thống.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // 7 members of the Party Committee (Đảng ủy) defined by database position or name matching
  const getDangUyMembers = (): Member[] => {
    const dangUyNames = [
      'Nguyễn Văn Bắc',
      'Lê Huy Long',
      'Lương Thị Loan',
      'Lê Thị Thu Hằng',
      'Đinh Kiều Hưng',
      'Cao Xuân Hải',
      'Phạm Văn Cường'
    ]

    return members
      .filter(m => dangUyNames.includes(m.full_name))
      .sort((a, b) => {
        // Sort: Secretary first, Deputy Secretary second, others following
        const getPriority = (name: string) => {
          if (name === 'Nguyễn Văn Bắc') return 1 // Bí thư Đảng ủy
          if (name === 'Lê Huy Long') return 2   // Phó bí thư Đảng ủy
          return 3
        }
        return getPriority(a.full_name) - getPriority(b.full_name)
      })
  }

  const dangUyList = getDangUyMembers()
  const biThu = dangUyList.find(m => m.full_name === 'Nguyễn Văn Bắc')
  const phoBiThu = dangUyList.find(m => m.full_name === 'Lê Huy Long')
  const uyVienList = dangUyList.filter(m => m.full_name !== 'Nguyễn Văn Bắc' && m.full_name !== 'Lê Huy Long')

  const getMemberRankWeight = (m: any): number => {
    const dangUyNames = [
      'Nguyễn Văn Bắc',
      'Lê Huy Long',
      'Lương Thị Loan',
      'Lê Thị Thu Hằng',
      'Đinh Kiều Hưng',
      'Cao Xuân Hải',
      'Phạm Văn Cường'
    ]

    const weights: number[] = []

    if (m.full_name === 'Nguyễn Văn Bắc') weights.push(10)
    else if (m.full_name === 'Lê Huy Long') weights.push(20)
    else if (dangUyNames.includes(m.full_name)) weights.push(30)

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

  // Global search for any member across all Chi Bos
  const getFilteredAllMembers = () => {
    if (!searchQuery) return []
    return members.filter(m => 
      m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.position && m.position.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.chi_bos?.name && m.chi_bos.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.phone && m.phone.includes(searchQuery))
    )
  }

  // Get leader text for a Chi Bo (Bí thư, Phó Bí thư, Chi ủy viên)
  const getChiBoLeaders = (chiBoId: string) => {
    const cbMembers = members.filter(m => m.chi_bo_id === chiBoId)
    
    // Helper to extract the chi bo leadership part (before first '|')
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

  // Handler functions for CRUD and Leadership assignments
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberForm.full_name || !memberForm.chi_bo_id) {
      setError('Vui lòng điền đầy đủ họ tên và chọn chi bộ.')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const selectedCb = chiBos.find(c => c.id === memberForm.chi_bo_id)
      if (!selectedCb) throw new Error('Chi bộ không hợp lệ.')
      
      await memberService.createMember(
        memberForm.full_name,
        memberForm.chi_bo_id,
        selectedCb.name,
        memberForm.position || null,
        memberForm.phone || null,
        memberForm.role,
        memberForm.username || null,
        user?.id
      )
      
      // Reload members list
      const updatedMembers = await memberService.getAllMembers()
      setMembers(updatedMembers.filter(m => m.full_name.toLowerCase() !== 'admin' && !m.position?.toLowerCase().includes('admin')))
      setIsCreateModalOpen(false)
      setSuccess('Đã thêm đảng viên và tự động tạo tài khoản đăng nhập thành công!')
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Lỗi khi tạo đảng viên mới.')
    } finally {
      setLoading(false)
    }
  }

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memberForm.id || !memberForm.full_name || !memberForm.chi_bo_id) {
      setError('Vui lòng điền đầy đủ họ tên và chọn chi bộ.')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const selectedCb = chiBos.find(c => c.id === memberForm.chi_bo_id)
      if (!selectedCb) throw new Error('Chi bộ không hợp lệ.')

      await memberService.updateMember(
        memberForm.id,
        memberForm.full_name,
        memberForm.chi_bo_id,
        selectedCb.name,
        memberForm.position || null,
        memberForm.phone || null,
        memberForm.username || null,
        memberForm.role,
        user?.id
      )

      // Reload members list
      const updatedMembers = await memberService.getAllMembers()
      setMembers(updatedMembers.filter(m => m.full_name.toLowerCase() !== 'admin' && !m.position?.toLowerCase().includes('admin')))
      setIsEditModalOpen(false)
      setSelectedMember(null)
      setSuccess('Đã cập nhật thông tin đảng viên thành công!')
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Lỗi khi cập nhật thông tin.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (memberId: string) => {
    if (!window.confirm('Đồng chí có chắc chắn muốn đặt lại mật khẩu mặc định (Thanhtra@123) cho tài khoản này?')) {
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await memberService.resetPasswordToDefault(memberId, user?.id)
      setSuccess('Mật khẩu của đảng viên đã được đặt lại về mặc định: Thanhtra@123 (yêu cầu đổi mật khẩu ở lần đăng nhập tiếp theo).')
      setTimeout(() => setSuccess(null), 8000)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Lỗi khi đặt lại mật khẩu.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteMember = async (memberId: string) => {
    if (!window.confirm('Đồng chí có chắc chắn muốn xóa tài khoản đảng viên này ra khỏi hệ thống? (Thao tác sẽ ưu tiên xóa cứng hoặc tự động chuyển sang chế độ vô hiệu hóa tài khoản nếu có dữ liệu liên quan để bảo toàn hệ thống).')) {
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await memberService.deleteMember(memberId, user?.id)
      
      // Reload members list
      const updatedMembers = await memberService.getAllMembers()
      setMembers(updatedMembers.filter(m => m.full_name.toLowerCase() !== 'admin' && !m.position?.toLowerCase().includes('admin')))
      setSelectedMember(null)
      
      if (result.softDeleted) {
        setSuccess('Tài khoản đã được chuyển sang trạng thái Vô hiệu hóa (do có dữ liệu lịch sử cuộc họp/lượt thi cần lưu trữ).')
      } else {
        setSuccess('Đã xóa đảng viên và tài khoản vĩnh viễn khỏi hệ thống thành công.')
      }
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Lỗi khi xóa đảng viên.')
    } finally {
      setLoading(false)
    }
  }

  const openLeaderModal = (cb: ChiBo) => {
    setSelectedChiBoForLeader(cb)
    const cbMembers = members.filter(m => m.chi_bo_id === cb.id)
    
    const isDangUyTitle = (posStr: string): boolean => {
      const lower = posStr.toLowerCase()
      if (lower.includes('đảng ủy') || lower.includes('đảng bộ') || lower.includes('đảng uỷ')) {
        if (!lower.includes('chi bộ')) return true
      }
      return false
    }

    // Find who is currently Secretary
    const biThu = cbMembers.find(m => {
      const pos = m.position?.toLowerCase() || ''
      return (pos.includes('bí thư') || pos.includes('bt')) && !pos.includes('phó') && !pos.includes('ủy viên') && !isDangUyTitle(pos)
    })
    
    // Find who is currently Deputy Secretary
    const phoBiThu = cbMembers.find(m => {
      const pos = m.position?.toLowerCase() || ''
      return (pos.includes('phó bí thư') || pos.includes('pbt')) && !isDangUyTitle(pos)
    })
    
    // Find who are currently Chi ủy viên
    const chiUyViens = cbMembers.filter(m => {
      const pos = m.position?.toLowerCase() || ''
      return (pos.includes('chi ủy viên') || pos.includes('ủy viên chi ủy') || pos.includes('cuv')) && !pos.includes('phó') && !pos.includes('bí thư') && !isDangUyTitle(pos)
    }).map(m => m.id)

    setLeaderForm({
      biThuMemberId: biThu?.id || '',
      phoBiThuMemberId: phoBiThu?.id || '',
      chiUyVienMemberIds: chiUyViens
    })
    setIsLeaderModalOpen(true)
  }

  const handleUpdateLeaders = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChiBoForLeader) return
    
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await memberService.updateChiBoLeaders(
        selectedChiBoForLeader.id,
        leaderForm.biThuMemberId || null,
        leaderForm.phoBiThuMemberId || null,
        leaderForm.chiUyVienMemberIds
      )

      // Reload members list
      const updatedMembers = await memberService.getAllMembers()
      setMembers(updatedMembers.filter(m => m.full_name.toLowerCase() !== 'admin' && !m.position?.toLowerCase().includes('admin')))
      
      setIsLeaderModalOpen(false)
      setSuccess('Đã cập nhật cơ cấu ban chi ủy của Chi bộ thành công!')
      setTimeout(() => setSuccess(null), 5500)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Lỗi khi cập nhật ban chi ủy.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner message="Đang tải sơ đồ tổ chức đảng viên..." fullScreen />
  }

  return (
    <PatternBackground bgImageUrl={settings?.active_home_background?.file_url}>
      <PortalHeader
        systemTitle={settings?.organization_name}
        subtitle={settings?.site_name}
      />
      <RedNavigationBar isAuthenticated={true} userRole="admin" />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        {/* Page Title & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-red-revolution/10 pb-4">
          <div>
            <h1 className="text-xl md:text-3xl font-black text-red-deep dark:text-gold uppercase tracking-wider">
              Sơ đồ Tổ chức Đảng bộ
            </h1>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
              Hệ thống quản lý {members.length} Đảng viên thuộc {chiBos.length < 10 ? '0' + chiBos.length : chiBos.length} Chi bộ
            </p>
          </div>

          {/* Action Row: Search box + View toggle */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Add New Member Button */}
            {!selectedChiBo && (
              <button
                onClick={() => {
                  setMemberForm({
                    id: '',
                    full_name: '',
                    chi_bo_id: chiBos[0]?.id || '',
                    position: '',
                    phone: '',
                    role: 'member',
                    username: ''
                  })
                  setIsCreateModalOpen(true)
                }}
                className="flex items-center gap-1.5 w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-xl shadow-md transition-colors text-center justify-center shrink-0 cursor-pointer"
              >
                + Thêm Đảng viên
              </button>
            )}

            {/* Quick search input (only when not inside a specific Chi Bo) */}
            {!selectedChiBo && (
              <div className="relative w-full sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search size={14} />
                </div>
                <input
                  type="text"
                  placeholder="Tìm nhanh đảng viên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full min-h-[36px] pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 text-xs font-semibold shadow-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            {/* Toggle button view */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
              <button
                onClick={() => {
                  setActiveView('danguy')
                  setSelectedChiBo(null)
                }}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 text-[11px] font-bold uppercase rounded-lg transition-all ${
                  activeView === 'danguy'
                    ? 'bg-red-revolution text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-red-revolution'
                }`}
              >
                Ban Chấp hành
              </button>
              <button
                onClick={() => {
                  setActiveView('chibo')
                  setSelectedChiBo(null)
                }}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 text-[11px] font-bold uppercase rounded-lg transition-all ${
                  activeView === 'chibo' && !selectedChiBo
                    ? 'bg-red-revolution text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-red-revolution'
                }`}
              >
                8 Chi bộ
              </button>
            </div>
          </div>
        </div>

        {success && (
          <AlertMessage type="success" message={success} className="mb-6 animate-fade-in" />
        )}
        {error && <AlertMessage type="error" message={error} className="mb-6" />}

        {/* ==================== GLOBAL SEARCH RESULTS ==================== */}
        {searchQuery && !selectedChiBo ? (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-red-revolution/10 pb-2">
              <h2 className="text-xs font-black text-red-deep dark:text-gold uppercase tracking-wider">
                Kết quả tìm kiếm Đảng viên ({getFilteredAllMembers().length})
              </h2>
              <button
                onClick={() => setSearchQuery('')}
                className="text-[10px] font-bold text-slate-500 hover:text-red-revolution uppercase tracking-wider"
              >
                Xóa tìm kiếm
              </button>
            </div>

            {getFilteredAllMembers().length === 0 ? (
              <div className="bg-white/40 dark:bg-navy/10 border border-slate-200 dark:border-slate-800 p-8 text-center rounded-2xl font-bold text-slate-400 text-xs shadow-sm">
                Không tìm thấy đảng viên nào phù hợp với từ khoá "{searchQuery}".
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {getFilteredAllMembers().map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMember(m)}
                    className="cursor-pointer bg-white/95 dark:bg-slate-900/90 shadow-[0_8px_25px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_30px_rgba(212,0,0,0.12)] border border-slate-200 dark:border-slate-800 hover:border-red-revolution/40 p-3 rounded-xl flex items-center gap-3.5 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div className="w-8 h-8 rounded-full bg-red-revolution/5 dark:bg-gold/5 text-red-revolution dark:text-gold flex items-center justify-center shrink-0 border border-red-revolution/10">
                      <User size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                        {m.full_name}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {m.position || 'Đảng viên'}
                      </p>
                      <p className="text-[9px] font-black text-red-revolution dark:text-gold uppercase tracking-wider mt-0.5 truncate">
                        {m.chi_bos?.name || 'Chi bộ'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ==================== VIEW 1: DANG UY DIAGRAM ==================== */}
            {activeView === 'danguy' && (
              <div className="space-y-10 animate-fade-in">
                {/* Introductory Text */}
                <div className="text-center max-w-2xl mx-auto">
                  <span className="bg-gold/15 text-gold border border-gold/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-glow">
                    Cơ quan chỉ đạo
                  </span>
                  <h2 className="text-base md:text-xl font-black text-red-deep dark:text-gold uppercase mt-3">
                    Ban Chấp hành Đảng bộ Thanh tra Tỉnh
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1.5 leading-relaxed">
                    Gồm 07 đồng chí Ủy viên Ban Chấp hành chỉ đạo toàn diện công tác Đảng tại Đảng bộ.
                  </p>
                </div>

                {/* Hierarchical Structure: 2 rows */}
                <div className="flex flex-col items-center gap-8 relative w-full">
                  {/* Row 1: Secretary (Bí thư) */}
                  {biThu && (
                    <div className="flex flex-col items-center">
                      <div
                        onClick={() => setSelectedMember(biThu)}
                        className="cursor-pointer group flex flex-col items-center bg-gradient-to-b from-red-revolution to-red-dark border border-gold text-white p-3 rounded-xl shadow-md text-center w-52 transition-transform hover:scale-[1.02] active:scale-95"
                      >
                        <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center border border-gold/40 text-gold mb-1.5 shadow-inner">
                          <Shield size={16} className="animate-pulse" />
                        </div>
                        <h3 className="text-xs font-black tracking-wide uppercase">
                          {biThu.full_name}
                        </h3>
                        <p className="text-[9px] font-bold text-gold uppercase tracking-wider mt-0.5">
                          Bí thư Đảng ủy
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Row 2: Deputy Secretary (Phó Bí thư) & Committee Members (Ủy viên) */}
                  <div className="w-full max-w-5xl">
                    <div className="flex flex-wrap justify-center gap-3.5">
                      {/* Deputy Secretary first on the left */}
                      {phoBiThu && (
                        <div
                          onClick={() => setSelectedMember(phoBiThu)}
                          className="cursor-pointer group flex flex-col items-center bg-white dark:bg-slate-900 border border-red-revolution/50 dark:border-gold/40 text-navy dark:text-white p-3 rounded-xl shadow-md text-center w-44 transition-transform hover:scale-[1.02] active:scale-95"
                        >
                          <div className="w-8 h-8 rounded-full bg-red-revolution/10 dark:bg-gold/15 text-red-revolution dark:text-gold flex items-center justify-center border border-red-revolution/20 mb-1.5">
                            <Award size={15} />
                          </div>
                          <h3 className="text-xs font-black uppercase text-red-deep dark:text-gold truncate max-w-full px-1">
                            {phoBiThu.full_name}
                          </h3>
                          <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-0.5">
                            Phó Bí thư Đảng ủy
                          </p>
                        </div>
                      )}

                      {/* Other Committee Members */}
                      {uyVienList.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => setSelectedMember(m)}
                          className="cursor-pointer group flex flex-col items-center bg-white/80 dark:bg-navy/40 backdrop-blur-md border border-slate-200 dark:border-slate-800 hover:border-red-revolution/40 hover:dark:border-gold/40 p-3 rounded-xl text-center w-44 transition-transform hover:scale-[1.02] active:scale-95 shadow-sm"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 flex items-center justify-center mb-1.5 border border-slate-200 dark:border-slate-800">
                            <User size={14} />
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-full px-1">
                            {m.full_name}
                          </h4>
                          <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                            Ủy viên BCH
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== VIEW 2: 8 CHI BO MECHANISM ==================== */}
            {activeView === 'chibo' && !selectedChiBo && (
              <div className="space-y-6 animate-fade-in">
                {/* Introductory Text */}
                <div className="text-center max-w-2xl mx-auto">
                  <span className="bg-red-revolution/10 text-red-revolution border border-red-revolution/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Cơ sở chi bộ trực thuộc
                  </span>
                  <h2 className="text-base md:text-xl font-black text-red-deep dark:text-gold uppercase mt-3">
                    Cơ cấu {chiBos.length < 10 ? '0' + chiBos.length : chiBos.length} Chi bộ Trực thuộc
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1.5 leading-relaxed">
                    Nhấp vào chi bộ bất kỳ để xem danh sách Đảng viên trực thuộc.
                  </p>
                </div>

                {/* Chi Bo Cards Grid: Elevated and Compact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        className="bg-white/95 dark:bg-slate-900/90 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-slate-200/80 dark:border-slate-800/80 hover:border-red-revolution/40 hover:dark:border-gold/40 cursor-pointer flex flex-col justify-between rounded-xl p-3.5 transition-all duration-200 hover:-translate-y-1 min-h-[165px]"
                      >
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-black uppercase tracking-wider text-red-revolution dark:text-gold">
                              {cb.name}
                            </span>
                            <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                              {cbMembers.length} đ/c
                            </span>
                          </div>

                          <div className="space-y-1 mt-2.5 text-[10.5px] font-semibold text-slate-650 dark:text-slate-350">
                            <div className="truncate">
                              👤 Bí thư: <span className="font-bold text-slate-800 dark:text-white">{leaders.biThu}</span>
                            </div>
                            <div className="truncate">
                              👥 Phó BT: <span className="font-bold text-slate-800 dark:text-white">{leaders.phoBiThu}</span>
                            </div>
                            <div className="truncate">
                              🎖️ Chi ủy viên: <span className="font-bold text-slate-855 dark:text-slate-200">{leaders.chiUyViens}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end items-center text-[10px] font-black text-red-revolution dark:text-gold uppercase tracking-wider pt-2 border-t border-slate-100 dark:border-slate-800/60 mt-3">
                          <span>Danh sách</span>
                          <ChevronRight size={12} className="ml-0.5" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== DETAIL VIEW: SINGLE CHI BO LIST ==================== */}
        {activeView === 'chibo' && selectedChiBo && (
          <div className="space-y-6 animate-fade-in">
            {/* Breadcrumb / Back button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedChiBo(null)}
                className="text-xs font-bold text-slate-500 hover:text-red-revolution dark:hover:text-gold uppercase tracking-wider flex items-center gap-1"
              >
                ← Quay lại cơ cấu 8 Chi bộ
              </button>
            </div>

            {/* Chi Bo Header details */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white/40 dark:bg-navy/20 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <div>
                <span className="text-[10px] font-black uppercase bg-red-revolution text-white px-2.5 py-0.5 rounded-full shadow-sm">
                  Chi bộ trực thuộc
                </span>
                <h2 className="text-xl md:text-2xl font-black text-red-deep dark:text-gold uppercase mt-2">
                  {selectedChiBo.name}
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  <div>👤 Bí thư: <b className="text-slate-700 dark:text-white">{getChiBoLeaders(selectedChiBo.id).biThu}</b></div>
                  <div>👥 Phó Bí thư: <b className="text-slate-700 dark:text-white">{getChiBoLeaders(selectedChiBo.id).phoBiThu}</b></div>
                </div>
              </div>
              
              {/* Controls & Search */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
                <button
                  onClick={() => openLeaderModal(selectedChiBo)}
                  className="w-full sm:w-auto px-4 py-2 bg-red-revolution hover:bg-red-dark text-white text-xs font-black uppercase rounded-xl shadow-sm transition-colors text-center justify-center shrink-0 cursor-pointer"
                >
                  ⚙️ Cài đặt Ban chi ủy
                </button>
                
                {/* Search within active Chi Bo */}
                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search size={15} />
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm họ tên hoặc chức vụ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full min-h-[38px] pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-navy/35 text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-revolution/50 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Chi Bo Members Table */}
            <GlassCard className="overflow-hidden border border-slate-200 dark:border-slate-800 p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-900/60">
                    <tr>
                      <th scope="col" className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">STT</th>
                      <th scope="col" className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Đồng chí</th>
                      <th scope="col" className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Chức vụ</th>
                      <th scope="col" className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Điện thoại</th>
                      <th scope="col" className="px-5 py-3.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-300 bg-transparent">
                    {getFilteredChiBoMembers().length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center font-bold text-slate-400">
                          Không tìm thấy đảng viên nào phù hợp với từ khoá.
                        </td>
                      </tr>
                    ) : (
                      getFilteredChiBoMembers().map((m, idx) => (
                        <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="px-5 py-3.5 font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900 dark:text-white">{m.full_name}</div>
                          </td>
                          <td className="px-5 py-3.5 text-[11px] truncate max-w-xs">{m.position || 'Đảng viên'}</td>
                          <td className="px-5 py-3.5 text-slate-500">
                            {m.phone ? (
                              <span className="flex items-center gap-1">
                                <Phone size={12} className="text-slate-400" /> {m.phone}
                              </span>
                            ) : (
                              'Chưa có'
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setSelectedMember(m)}
                              className="text-[10px] font-black uppercase text-red-revolution dark:text-gold tracking-wider hover:underline"
                            >
                              Xem chi tiết
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        )}

      </main>

      {/* ==================== INTERACTIVE DETAIL MODAL ==================== */}
      {selectedMember && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          {/* Backdrop blur */}
          <div
            onClick={() => setSelectedMember(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
          />

          {/* Modal Container */}
          <div className="relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up z-10">
            {/* Close Button */}
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            {/* Profile Avatar Emblem */}
            <div className="flex flex-col items-center text-center mt-3 mb-6">
              <div className="w-16 h-16 rounded-full bg-red-revolution/10 dark:bg-gold/10 text-red-revolution dark:text-gold flex items-center justify-center border border-red-revolution/20 mb-3 shadow-inner">
                <User size={30} />
              </div>
              <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                {selectedMember.full_name}
              </h3>
              <p className="text-[10px] font-black text-red-revolution dark:text-gold uppercase tracking-widest mt-1.5 border border-red-revolution/20 bg-red-revolution/5 px-2.5 py-0.5 rounded-full">
                {selectedMember.position || 'Đảng viên'}
              </p>
            </div>

            {/* Details table information */}
            <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-800/80 pt-5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400">Chi bộ sinh hoạt:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedMember.chi_bos?.name || chiBos.find(c => c.id === selectedMember.chi_bo_id)?.name || 'Chưa phân chi bộ'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400">Tên đăng nhập (Username):</span>
                <span className="font-bold text-red-revolution dark:text-gold select-all bg-slate-100/50 dark:bg-slate-900/50 px-2 py-0.5 rounded border border-slate-200/40 dark:border-slate-800/40">
                  {selectedMember.app_users && selectedMember.app_users.length > 0 
                    ? selectedMember.app_users[0].username 
                    : 'Chưa tạo'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400">Quyền hạn hệ thống:</span>
                <span className="font-bold text-slate-900 dark:text-white uppercase">
                  {selectedMember.app_users && selectedMember.app_users.length > 0 
                    ? selectedMember.app_users[0].role 
                    : 'member'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400">Điện thoại liên hệ:</span>
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <Phone size={12} className="text-red-revolution" /> {selectedMember.phone || 'Chưa cập nhật'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400">Trạng thái công tác:</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-bold text-slate-900 dark:text-white">Đang hoạt động</span>
                </span>
              </div>
            </div>

            {/* Admin Management Controls */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
              <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                ⚙️ Công cụ quản trị
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const mUsername = selectedMember.app_users && selectedMember.app_users.length > 0
                      ? selectedMember.app_users[0].username
                      : ''
                    const mRole = selectedMember.app_users && selectedMember.app_users.length > 0
                      ? (selectedMember.app_users[0].role as 'member' | 'organizer' | 'admin')
                      : 'member'
                    setMemberForm({
                      id: selectedMember.id,
                      full_name: selectedMember.full_name,
                      chi_bo_id: selectedMember.chi_bo_id,
                      position: selectedMember.position || '',
                      phone: selectedMember.phone || '',
                      role: mRole,
                      username: mUsername
                    })
                    setIsEditModalOpen(true)
                  }}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase rounded-xl transition-colors cursor-pointer text-center animate-lift"
                >
                  Sửa
                </button>
                <button
                  onClick={() => handleResetPassword(selectedMember.id)}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black uppercase rounded-xl transition-colors cursor-pointer text-center animate-lift"
                >
                  Đặt lại MK
                </button>
                <button
                  onClick={() => handleDeleteMember(selectedMember.id)}
                  className="flex-1 py-2 bg-red-revolution hover:bg-red-dark text-white text-[11px] font-black uppercase rounded-xl transition-colors cursor-pointer text-center animate-lift"
                >
                  Xóa
                </button>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="mt-6">
              <button
                onClick={() => setSelectedMember(null)}
                className="w-full py-2.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Đóng thông tin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CREATE MEMBER MODAL ==================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div onClick={() => setIsCreateModalOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <form onSubmit={handleCreateMember} className="relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up z-10 space-y-4">
            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-750 dark:hover:text-white"><X size={18} /></button>
            <h3 className="text-sm font-black text-red-deep dark:text-gold uppercase tracking-wider text-center">Thêm Đảng viên mới</h3>
            
            <div className="space-y-3.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="space-y-1">
                <label className="block text-slate-400">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={memberForm.full_name}
                  onChange={(e) => setMemberForm({ ...memberForm, full_name: e.target.value })}
                  placeholder="Nhập họ và tên đầy đủ..."
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Chi bộ sinh hoạt *</label>
                <select
                  value={memberForm.chi_bo_id}
                  onChange={(e) => setMemberForm({ ...memberForm, chi_bo_id: e.target.value })}
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy dark:text-white focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-semibold"
                >
                  {chiBos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Chức danh / Chức vụ</label>
                <input
                  type="text"
                  value={memberForm.position}
                  onChange={(e) => setMemberForm({ ...memberForm, position: e.target.value })}
                  placeholder="Ví dụ: Trưởng phòng, Chuyên viên..."
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Số điện thoại</label>
                <input
                  type="text"
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                  placeholder="Nhập số điện thoại liên lạc..."
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Tên đăng nhập (Username) - Tùy chọn</label>
                <input
                  type="text"
                  value={memberForm.username}
                  onChange={(e) => setMemberForm({ ...memberForm, username: e.target.value })}
                  placeholder="Nhập tên đăng nhập tùy chọn (ví dụ: thuyntb.chibo6)..."
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Quyền hạn hệ thống</label>
                <select
                  value={memberForm.role}
                  onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value as any })}
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy dark:text-white focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-semibold"
                >
                  <option value="member">Đảng viên (member)</option>
                  <option value="organizer">Ban Tổ chức (organizer)</option>
                  <option value="admin">Quản trị tối cao (admin)</option>
                </select>
              </div>

              <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                💡 Lưu ý: Hệ thống sẽ tự động tạo tên đăng nhập (Username) dựa trên tên và chi bộ theo quy định, và đặt mật khẩu mặc định là <span className="font-bold text-red-revolution dark:text-gold">Thanhtra@123</span> (bắt đổi khi vào lần đầu).
              </p>
            </div>

            <div className="flex gap-3 pt-3">
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors">Hủy</button>
              <button type="submit" className="flex-1 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">Tạo mới</button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== EDIT MEMBER MODAL ==================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div onClick={() => setIsEditModalOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <form onSubmit={handleEditMember} className="relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up z-10 space-y-4">
            <button type="button" onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-750 dark:hover:text-white"><X size={18} /></button>
            <h3 className="text-sm font-black text-red-deep dark:text-gold uppercase tracking-wider text-center">Chỉnh sửa thông tin</h3>
            
            <div className="space-y-3.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="space-y-1">
                <label className="block text-slate-400">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={memberForm.full_name}
                  onChange={(e) => setMemberForm({ ...memberForm, full_name: e.target.value })}
                  placeholder="Nhập họ và tên..."
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Chi bộ sinh hoạt *</label>
                <select
                  value={memberForm.chi_bo_id}
                  onChange={(e) => setMemberForm({ ...memberForm, chi_bo_id: e.target.value })}
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy dark:text-white focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-semibold"
                >
                  {chiBos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Chức danh / Chức vụ</label>
                <input
                  type="text"
                  value={memberForm.position}
                  onChange={(e) => setMemberForm({ ...memberForm, position: e.target.value })}
                  placeholder="Chức vụ nghiệp vụ..."
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Số điện thoại</label>
                <input
                  type="text"
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                  placeholder="Số điện thoại..."
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-bold">Tên đăng nhập (Username)</label>
                <input
                  type="text"
                  value={memberForm.username}
                  onChange={(e) => setMemberForm({ ...memberForm, username: e.target.value })}
                  placeholder="Tên đăng nhập..."
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-navy dark:text-white focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Quyền hạn hệ thống</label>
                <select
                  value={memberForm.role}
                  onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value as any })}
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy dark:text-white focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-semibold"
                >
                  <option value="member">Đảng viên (member)</option>
                  <option value="organizer">Ban Tổ chức (organizer)</option>
                  <option value="admin">Quản trị tối cao (admin)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors">Hủy</button>
              <button type="submit" className="flex-1 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors">Lưu thay đổi</button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== CHI BO LEADERS SETTINGS MODAL ==================== */}
      {isLeaderModalOpen && selectedChiBoForLeader && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div onClick={() => setIsLeaderModalOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <form onSubmit={handleUpdateLeaders} className="relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-slide-up z-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setIsLeaderModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-750 dark:hover:text-white"><X size={18} /></button>
            <h3 className="text-sm font-black text-red-deep dark:text-gold uppercase tracking-wider text-center">Cài đặt cơ cấu Ban chi ủy</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center">{selectedChiBoForLeader.name}</p>

            <div className="space-y-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="space-y-1">
                <label className="block text-slate-400">Đồng chí Bí thư Chi bộ</label>
                <select
                  value={leaderForm.biThuMemberId}
                  onChange={(e) => setLeaderForm({ ...leaderForm, biThuMemberId: e.target.value })}
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy dark:text-white focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-semibold"
                >
                  <option value="">-- Chọn đồng chí Bí thư --</option>
                  {members.filter(m => m.chi_bo_id === selectedChiBoForLeader.id).map(m => (
                    <option key={m.id} value={m.id}>{m.full_name} ({m.position || 'Đảng viên'})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Đồng chí Phó Bí thư Chi bộ</label>
                <select
                  value={leaderForm.phoBiThuMemberId}
                  onChange={(e) => setLeaderForm({ ...leaderForm, phoBiThuMemberId: e.target.value })}
                  className="block w-full min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-navy dark:text-white focus:outline-none focus:ring-1.5 focus:ring-red-revolution/50 font-semibold"
                >
                  <option value="">-- Chọn đồng chí Phó Bí thư --</option>
                  {members.filter(m => m.chi_bo_id === selectedChiBoForLeader.id).map(m => (
                    <option key={m.id} value={m.id}>{m.full_name} ({m.position || 'Đảng viên'})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-slate-400">Danh sách Chi ủy viên</label>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-slate-50/50 dark:bg-slate-900/30 max-h-48 overflow-y-auto space-y-2">
                  {members.filter(m => m.chi_bo_id === selectedChiBoForLeader.id).map(m => {
                    const isChecked = leaderForm.chiUyVienMemberIds.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2.5 p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const newIds = isChecked
                              ? leaderForm.chiUyVienMemberIds.filter(id => id !== m.id)
                              : [...leaderForm.chiUyVienMemberIds, m.id];
                            setLeaderForm({ ...leaderForm, chiUyVienMemberIds: newIds });
                          }}
                          className="rounded text-red-revolution focus:ring-red-revolution/50"
                        />
                        <span className="text-[11px] text-slate-800 dark:text-slate-200">{m.full_name} <span className="text-slate-400">({m.position || 'Đảng viên'})</span></span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button type="button" onClick={() => setIsLeaderModalOpen(false)} className="flex-1 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors">Hủy</button>
              <button type="submit" className="flex-1 py-2 text-xs font-bold rounded-xl bg-red-revolution hover:bg-red-dark text-white transition-colors">Cập nhật</button>
            </div>
          </form>
        </div>
      )}
    </PatternBackground>
  )
}

export default MemberManager
