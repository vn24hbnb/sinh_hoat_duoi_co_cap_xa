import { supabase } from './supabaseClient'

export interface MeetingUiSettings {
  id?: string
  meeting_session_id: string
  gps_lat: number | null
  gps_lng: number | null
  gps_radius_m: number
  attendance_methods: string // các hình thức cách nhau bằng dấu phẩy: e.g. 'gps' hoặc 'gps,qr,pin,photo'
  pin_code: string | null
  qr_code_token: string | null
  device_mapping: Record<string, string> // member_id -> device_uuid để phát hiện điểm danh hộ
}

export const meetingUiSettingsService = {
  /**
   * Lấy cấu hình điểm danh/giao diện của phiên họp
   */
  async getSettings(sessionId: string): Promise<MeetingUiSettings | null> {
    const { data, error } = await supabase
      .from('meeting_ui_settings')
      .select('*')
      .eq('meeting_session_id', sessionId)
      .maybeSingle()

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
        .select('*')
        .single()

      if (error) throw new Error(`Lỗi cập nhật cấu hình điểm danh: ${error.message}`)
      result = data
    } else {
      const { data, error } = await supabase
        .from('meeting_ui_settings')
        .insert({
          ...settings,
          gps_radius_m: settings.gps_radius_m ?? 100,
          attendance_methods: settings.attendance_methods ?? 'gps',
          device_mapping: settings.device_mapping ?? {}
        })
        .select('*')
        .single()

      if (error) throw new Error(`Lỗi lưu cấu hình điểm danh: ${error.message}`)
      result = data
    }

    if (actorId) {
      await supabase.from('audit_logs').insert({
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

  /**
   * Cập nhật bản đồ thiết bị điểm danh để phát hiện điểm danh hộ
   */
  async updateDeviceMapping(sessionId: string, memberId: string, deviceId: string): Promise<void> {
    const existing = await this.getSettings(sessionId)
    const currentMapping = existing?.device_mapping || {}
    
    // Cập nhật mapping mới
    const newMapping = { ...currentMapping, [memberId]: deviceId }

    await this.upsertSettings({
      meeting_session_id: sessionId,
      device_mapping: newMapping
    })
  }
}
