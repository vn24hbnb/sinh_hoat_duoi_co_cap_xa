import { supabase } from './supabaseClient'
import { tenantService } from './tenantService'

function scope(organizationId: string, branchId: string) {
  if (!organizationId || organizationId !== tenantService.requireOrganizationId()) throw new Error('Xã đang chọn đã thay đổi. Vui lòng tải lại danh sách.')
  if (!branchId) throw new Error('Vui lòng chọn chi bộ.')
}
function failure(error: { code?: string; message?: string }): never {
  if (error.code === '23505') throw new Error('Tên chi bộ đã tồn tại trong xã này.')
  if (error.code === '23503') throw new Error('Chi bộ đã có đảng viên hoặc dữ liệu phiên họp nên không thể xóa. Lịch sử được giữ nguyên.')
  if (error.code === '42501' || error.code === 'PGRST116') throw new Error('Không có quyền quản lý chi bộ này hoặc chi bộ không còn tồn tại.')
  throw new Error(error.message || 'Không cập nhật được chi bộ. Vui lòng thử lại.')
}

export const branchService = {
  async rename(organizationId: string, branchId: string, rawName: string) {
    scope(organizationId, branchId)
    const name = rawName.normalize('NFC').trim().replace(/\s+/g, ' ')
    if (!name || name.length > 200) throw new Error('Tên chi bộ phải có từ 1 đến 200 ký tự.')
    // Keep the branch ID and all member/session references unchanged. RLS enforces admin rights.
    const { data, error } = await supabase.from('chi_bos').update({ name, updated_at: new Date().toISOString() })
      .eq('organization_id', organizationId).eq('id', branchId).select('id,name').single()
    if (error) failure(error)
    if (!data) throw new Error('Không tìm thấy chi bộ để cập nhật.')
    return data as { id: string; name: string }
  },
  async remove(organizationId: string, branchId: string) {
    scope(organizationId, branchId)
    const references = await Promise.all(['members', 'meeting_participants'].map(table =>
      supabase.from(table).select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('chi_bo_id', branchId)))
    for (const result of references) {
      if (result.error) failure(result.error)
      if (result.count == null) throw new Error('Chưa kiểm tra được dữ liệu liên quan. Không thực hiện xóa.')
      if (result.count > 0) throw new Error('Chi bộ đã có đảng viên hoặc dữ liệu phiên họp nên không thể xóa. Hãy chuyển đảng viên sang chi bộ khác nếu cần; lịch sử phiên họp vẫn phải được giữ lại.')
    }
    scope(organizationId, branchId)
    // Non-cascading database foreign keys also protect against a concurrent assignment.
    const { data, error } = await supabase.from('chi_bos').delete().eq('organization_id', organizationId).eq('id', branchId).select('id').single()
    if (error) failure(error)
    if (!data) throw new Error('Không tìm thấy chi bộ để xóa.')
  },
}
