import { supabase } from './supabaseClient'
import { tenantService } from './tenantService'

export const MAX_ALLOWED_DISTANCE_METERS = 200
export interface AttendanceResult {
  id: string
  status: 'present' | 'warning'
  gps_valid: boolean | null
  warning_reason: string | null
}

export interface AttendanceRecord {
  meetingSessionId: string
  memberId: string
  latitude?: number
  longitude?: number
  accuracy?: number
  method?: 'button' | 'gps' | 'qr' | 'pin' | 'manual'
  pinCode?: string
  qrToken?: string
  markedBy: string
  photoUrl?: string
}

export const attendanceService = {
  async uploadSelfie(file: File, memberId: string, sessionId: string): Promise<string> {
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error('Ảnh cần có định dạng JPG, PNG hoặc WEBP và dung lượng không quá 5 MB.')
    }
    const path = `${tenantService.requireOrganizationId()}/${memberId}/${sessionId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('attendance-evidence').upload(path,file,{contentType:file.type,upsert:false})
    if (error) throw new Error('Không tải được ảnh minh chứng lên hệ thống.')
    return path
  },

  async markAttendance(record: AttendanceRecord): Promise<AttendanceResult> {
    const hasCoordinates = Number.isFinite(record.latitude) && Number.isFinite(record.longitude)
    const { data, error } = await supabase.rpc('attendance_mark', {
      p_meeting_session_id: record.meetingSessionId,
      p_lat: record.latitude ?? null,
      p_lng: record.longitude ?? null,
      p_accuracy: record.accuracy ?? null,
      p_absence_reason: null,
      p_method: record.method || (hasCoordinates ? 'gps' : 'button'),
      p_pin_code: record.pinCode?.trim() || null,
      p_qr_token: record.qrToken?.trim() || null,
      p_evidence_path: record.photoUrl || null
    })
    if (error) {
      if (record.photoUrl) await supabase.storage.from('attendance-evidence').remove([record.photoUrl])
      throw new Error(error.message)
    }
    const result = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data
    if (!result?.id || !['present', 'warning'].includes(result.status)) throw new Error('Máy chủ chưa xác nhận kết quả điểm danh. Vui lòng kiểm tra lại trước khi thử tiếp.')
    return result as AttendanceResult
  },

  async requestExcusedAbsence(meetingSessionId: string, _memberId: string, reason: string, _markedBy: string): Promise<void> {
    const { error } = await supabase.rpc('attendance_mark', {
      p_meeting_session_id: meetingSessionId,
      p_lat: null, p_lng: null, p_accuracy: null,
      p_absence_reason: reason.trim()
    })
    if (error) throw new Error(error.message)
  }
}
