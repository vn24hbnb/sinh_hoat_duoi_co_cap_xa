import { supabase } from './supabaseClient'
export interface UserSession {
  id: string; username: string; role: 'member' | 'organizer' | 'admin'
  mustChangePassword: boolean; memberId: string; memberName: string; position: string; chiBoId: string; chiBoName: string
  organizationId: string | null; organizationName: string; isGlobalAdmin: boolean
}
export function loginEmail(identifier: string): string {
  const aliases: Record<string, string> = { 'admin@': 'admin-global@admins.internal', 'admin@muongla': 'admin-muongla@admins.internal', 'admin@chienglao': 'admin-chienglao@admins.internal' }
  const value = identifier.trim().toLowerCase()
  if (aliases[value]) return aliases[value]
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) throw new Error('Vui lòng chọn tên trong danh sách hoặc kiểm tra tài khoản quản trị.')
  return `member-${value}@members.internal`
}
export const authService = {
  async currentProfile(): Promise<UserSession | null> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    const { data, error } = await supabase.rpc('get_current_profile')
    if (error) throw new Error('Không thể xác nhận quyền truy cập. Vui lòng đăng nhập lại.')
    const p = Array.isArray(data) ? data[0] : data
    if (!p || p.is_active === false) { await supabase.auth.signOut({ scope: 'local' }); return null }
    return { id: p.id, username: p.username, role: p.role === 'super_admin' ? 'admin' : p.role,
      mustChangePassword: false, memberId: p.member_id || '', memberName: p.full_name || 'Quản trị viên', position: p.position || 'Đảng viên',
      chiBoId: p.chi_bo_id || '', chiBoName: p.chi_bo_name || 'Quản trị', organizationId: p.organization_id || null,
      organizationName: p.organization_name || '', isGlobalAdmin: p.role === 'super_admin' || p.is_global_admin === true }
  },
  async login(identifier: string, password: string): Promise<UserSession> {
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(identifier), password })
    if (error) throw new Error('Thông tin đăng nhập không đúng hoặc tài khoản tạm khóa. Vui lòng kiểm tra lại.')
    const p = await this.currentProfile()
    if (!p) throw new Error('Tài khoản chưa được cấp quyền sử dụng ứng dụng.')
    return p
  },
  async changePassword(_userId: string, password: string): Promise<void> {
    if (password.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error('Không thể đổi mật khẩu. Vui lòng đăng nhập lại và thử lại.')
  },
  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
    localStorage.removeItem('session_user')
  },
}
