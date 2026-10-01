import { supabase } from './supabaseClient'
export interface Organization { id: string; name: string; slug: string }
export interface Directory { organizations: Organization[]; chi_bos: { id: string; name: string }[]; members: { id: string; full_name: string; display_name: string }[] }
let organizationId: string | null = null
export const tenantService = {
  getOrganizationId: () => organizationId,
  setOrganizationId: (id: string | null) => { organizationId = id },
  requireOrganizationId: () => { if (!organizationId) throw new Error('Vui lòng chọn xã trước khi thực hiện.'); return organizationId },
  async directory(organization?: string, branch?: string): Promise<Directory> {
    const { data, error } = await supabase.rpc('login_directory', { p_organization_id: organization || null, p_chi_bo_id: branch || null })
    if (error) throw new Error('Không tải được danh sách đăng nhập. Vui lòng thử lại.')
    return { organizations: data?.organizations || [], chi_bos: data?.chi_bos || [], members: data?.members || [] }
  },
}
