import { supabase } from './supabaseClient'
import bcrypt from 'bcryptjs'

export interface UserSession {
  id: string
  username: string
  role: 'member' | 'organizer' | 'admin'
  mustChangePassword: boolean
  memberId: string
  memberName: string
  position: string
  chiBoId: string
  chiBoName: string
}

export const authService = {
  /**
   * Performs user login by querying the app_users custom table and matching hashes with bcryptjs
   */
  async login(username: string, passwordPlain: string): Promise<UserSession> {
    const cleanUsername = username.toLowerCase().trim()

    // 1. Fetch user from app_users
    const { data: user, error: userError } = await supabase
      .from('app_users')
      .select('id, username, password_hash, role, must_change_password, is_active, member_id')
      .eq('username', cleanUsername)
      .single()

    if (userError || !user) {
      await supabase.from('audit_logs').insert({
        actor_id: null,
        action: 'LOGIN_FAILURE',
        target_type: 'app_users',
        metadata: { username: cleanUsername, reason: 'Tài khoản không tồn tại' }
      }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))

      throw new Error('Tên đăng nhập không tồn tại trên hệ thống.')
    }

    if (!user.is_active) {
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'LOGIN_FAILURE',
        target_type: 'app_users',
        target_id: user.id,
        metadata: { username: user.username, reason: 'Tài khoản bị khóa' }
      }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))

      throw new Error('Tài khoản của đồng chí đã bị tạm khóa. Vui lòng liên hệ Ban Tổ Chức.')
    }

    // 2. Compare bcrypt hash
    const isMatch = bcrypt.compareSync(passwordPlain, user.password_hash)
    if (!isMatch) {
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'LOGIN_FAILURE',
        target_type: 'app_users',
        target_id: user.id,
        metadata: { username: user.username, reason: 'Sai mật khẩu' }
      }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))

      throw new Error('Mật khẩu không chính xác. Vui lòng thử lại.')
    }

    // 3. Fetch member and Chi Bo details
    let session: UserSession
    if (user.role === 'admin' && !user.member_id) {
      session = {
        id: user.id,
        username: user.username,
        role: 'admin',
        mustChangePassword: false, // disabled by user request
        memberId: '',
        memberName: 'Quản trị viên hệ thống',
        position: 'Cán bộ quản lý',
        chiBoId: '',
        chiBoName: 'Ban Quản trị'
      }
    } else {
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('id, full_name, position, chi_bo_id, chi_bos(name)')
        .eq('id', user.member_id)
        .single()

      if (memberError || !member) {
        throw new Error('Không tìm thấy thông tin đảng viên liên kết với tài khoản này.')
      }

      session = {
        id: user.id,
        username: user.username,
        role: user.role as 'member' | 'organizer' | 'admin',
        mustChangePassword: false, // disabled by user request
        memberId: member.id,
        memberName: member.full_name,
        position: member.position || 'Đảng viên',
        chiBoId: member.chi_bo_id,
        chiBoName: (member.chi_bos as any)?.name || 'Chưa phân chi bộ'
      }
    }

    // 4. Update last login timestamp in background
    await supabase
      .from('app_users')
      .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', user.id)

    // 6. Record Audit log
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'LOGIN',
      target_type: 'app_users',
      target_id: user.id,
      metadata: { username: user.username, role: user.role }
    })

    return session
  },

  /**
   * Resets password hash and updates the must_change_password status in the database
   */
  async changePassword(userId: string, newPasswordPlain: string): Promise<void> {
    // Generate fresh bcrypt hash (default salt cost 10)
    const salt = bcrypt.genSaltSync(10)
    const newHash = bcrypt.hashSync(newPasswordPlain, salt)

    const { error } = await supabase
      .from('app_users')
      .update({
        password_hash: newHash,
        must_change_password: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) {
      throw new Error(`Đổi mật khẩu thất bại: ${error.message}`)
    }

    // Record Audit log
    await supabase.from('audit_logs').insert({
      actor_id: userId,
      action: 'CHANGE_PASSWORD',
      target_type: 'app_users',
      target_id: userId,
      metadata: { timestamp: new Date().toISOString() }
    })
  },

  /**
   * Terminate local session
   */
  logout(userId?: string): void {
    if (userId) {
      // Background audit log record on logout
      supabase.from('audit_logs').insert({
        actor_id: userId,
        action: 'LOGOUT',
        target_type: 'app_users',
        target_id: userId
      }).then(() => {})
    }
    localStorage.removeItem('session_user')
  }
}
