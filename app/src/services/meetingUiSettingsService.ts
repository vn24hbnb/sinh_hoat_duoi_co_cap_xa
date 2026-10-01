import { supabase } from './supabaseClient'
import { tenantService } from './tenantService'

export interface MeetingUiSettings {
  id?: string
  meeting_session_id: string
  gps_lat: number | null
  gps_lng: number | null
  gps_radius_m: number
  attendance_methods: string // các hình thức cách nhau bằng dấu phẩy: e.g. 'gps' hoặc 'gps,qr,pin,photo'
  pin_code: string | null
  qr_code_token: string | null
}

export const meetingUiSettingsService = {
  /**
   * Lấy cấu hình điểm danh/giao diện của phiên họp
   */
  async getSettings(sessionId: string): Promise<MeetingUiSettings | null> {
    const { data, error } = await supabase.rpc('get_meeting_ui_settings', {
      p_meeting_session_id: sessionId
    })

    if (error) {
      console.error('Error fetching meeting ui settings:', error.message)
      return null
    }

    return data as MeetingUiSettings | null
  },

  /**
   * Cập nhật hoặc thêm mới cấu hình điểm danh/giao diện cho phiên họp
   */
  async upsertSettings(settings: Partial<MeetingUiSettings>, actorId?: string): Promise<MeetingUiSettings> {
    const { meeting_session_id } = settings
    if (!meeting_session_id) throw new Error('Thiếu meeting_session_id')

    const existing = await this.getSettings(meeting_session_id)

    let result
    if (existing) {
      const { data, error } = await supabase
        .from('meeting_ui_settings')
        .update(settings)
        .eq('id', existing.id)
        .eq('organization_id', tenantService.requireOrganizationId())
        .select('*')
        .single()

      if (error) throw new Error(`Lỗi cập nhật cấu hình điểm danh: ${error.message}`)
      result = data
    } else {
      const { data, error } = await supabase
        .from('meeting_ui_settings')
        .insert({
          ...settings,
          organization_id: tenantService.requireOrganizationId(),
          gps_radius_m: settings.gps_radius_m ?? 200,
          attendance_methods: settings.attendance_methods ?? 'gps',
        })
        .select('*')
        .single()

      if (error) throw new Error(`Lỗi lưu cấu hình điểm danh: ${error.message}`)
      result = data
    }

    if (actorId) {
      await supabase.from('audit_logs').insert({
        organization_id: tenantService.requireOrganizationId(),
        actor_id: actorId,
        action: 'UPDATE_MEETING_UI_SETTINGS',
        target_type: 'meeting_sessions',
        target_id: meeting_session_id,
        metadata: {
          gps_radius_m: result.gps_radius_m,
          attendance_methods: result.attendance_methods
        }
      }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
    }

    return result as MeetingUiSettings
  },

}
