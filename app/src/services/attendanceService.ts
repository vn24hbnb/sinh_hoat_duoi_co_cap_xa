import { supabase } from './supabaseClient'
import { calculateDistance, calculateEffectiveDistance } from '../utils/gps'
import { meetingUiSettingsService } from './meetingUiSettingsService'

// Tọa độ mặc định của Thanh tra tỉnh Sơn La làm fallback
export const DEFAULT_MEETING_LAT = 21.3284
export const DEFAULT_MEETING_LNG = 103.9125
export const MAX_ALLOWED_DISTANCE_METERS = 100 // Bán kính 100m mặc định

export interface AttendanceRecord {
  meetingSessionId: string
  memberId: string
  latitude?: number
  longitude?: number
  accuracy?: number
  method?: 'button' | 'gps' | 'qr' | 'pin' | 'manual'
  markedBy: string
  deviceUuid?: string
  photoUrl?: string
}

export const attendanceService = {
  /**
   * Tải ảnh selfie minh chứng điểm danh lên Supabase Storage
   */
  async uploadSelfie(file: File, memberId: string, sessionId: string): Promise<string> {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filePath = `selfies/${sessionId}_${memberId}_${Date.now()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage
      .from('ui-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      })
      
    if (uploadError) {
      throw new Error(`Lỗi tải ảnh selfie lên Storage: ${uploadError.message}`)
    }
    
    const { data: urlData } = supabase.storage
      .from('ui-assets')
      .getPublicUrl(filePath)
      
    return urlData.publicUrl
  },

  /**
   * Registers a member's attendance, evaluating GPS coordinates boundaries and checking device sharing
   */
  async markAttendance(record: AttendanceRecord): Promise<void> {
    const { 
      meetingSessionId, 
      memberId, 
      latitude, 
      longitude, 
      method = 'gps', 
      markedBy,
      deviceUuid,
      photoUrl
    } = record

    // 0. Check session status
    const { data: session, error: sessionError } = await supabase
      .from('meeting_sessions')
      .select('status')
      .eq('id', meetingSessionId)
      .single()

    if (sessionError || !session) {
      throw new Error('Không tìm thấy thông tin phiên họp tương ứng.')
    }

    if (session.status === 'draft') {
      throw new Error('Phiên họp hiện chưa mở điểm danh.')
    }

    if (['attendance_closed', 'exam_open', 'exam_closed', 'closed', 'archived'].includes(session.status)) {
      throw new Error('Đã hết thời gian điểm danh.')
    }

    // 1. Double check duplicate record to prevent race conditions
    const { data: existing } = await supabase
      .from('meeting_attendance')
      .select('id')
      .eq('meeting_session_id', meetingSessionId)
      .eq('member_id', memberId)
      .maybeSingle()

    if (existing) {
      throw new Error('Đồng chí đã thực hiện điểm danh cho phiên họp này trước đó.')
    }

    // Tải cấu hình điểm danh nâng cao (GPS động, bán kính, hình thức)
    const uiSettings = await meetingUiSettingsService.getSettings(meetingSessionId)
    
    // Tọa độ và bán kính quét phòng họp (động hoặc mặc định)
    const targetLat = uiSettings?.gps_lat ?? DEFAULT_MEETING_LAT
    const targetLng = uiSettings?.gps_lng ?? DEFAULT_MEETING_LNG
    const allowedRadius = (uiSettings?.gps_radius_m && uiSettings.gps_radius_m > 0) 
      ? uiSettings.gps_radius_m 
      : MAX_ALLOWED_DISTANCE_METERS

    let gpsDistanceM: number | null = null
    let gpsValid = false
    let warningReason: string | null = null
    let status: 'present' | 'warning' = 'present'

    // 2. Perform distance calculations if GPS coordinates are provided
    if (latitude !== undefined && longitude !== undefined) {
      const rawDistanceM = calculateDistance(latitude, longitude, targetLat, targetLng)
      const { effectiveDistanceM } = calculateEffectiveDistance(rawDistanceM, record.accuracy)
      gpsDistanceM = effectiveDistanceM

      if (effectiveDistanceM <= allowedRadius) {
        gpsValid = true
        status = 'present'
      } else {
        gpsValid = false
        status = 'warning'
        warningReason = `Vượt quá bán kính cho phép: ${rawDistanceM}m (Tính theo sai số thực tế: ${effectiveDistanceM}m, Bán kính yêu cầu <= ${allowedRadius}m).`
      }
    } else {
      // Coordinates missing (user denied GPS permissions)
      gpsValid = false
      status = 'warning'
      warningReason = 'Không lấy được định vị GPS từ thiết bị.'
    }

    // 3. Kiểm tra cảnh báo trùng thiết bị (Điểm danh hộ)
    if (deviceUuid && uiSettings) {
      const deviceMapping = uiSettings.device_mapping || {}
      
      // Tìm xem thiết bị này đã được tài khoản khác dùng điểm danh chưa
      const duplicateMemberId = Object.keys(deviceMapping).find(
        key => deviceMapping[key] === deviceUuid && key !== memberId
      )

      if (duplicateMemberId) {
        status = 'warning'
        
        // Lấy tên đồng chí đã điểm danh trước đó trên thiết bị này
        const { data: dupMember } = await supabase
          .from('members')
          .select('full_name')
          .eq('id', duplicateMemberId)
          .maybeSingle()
          
        const dupName = dupMember?.full_name || 'đồng chí khác'
        const dupWarningText = `⚠️ [CẢNH BÁO ĐIỂM DANH HỘ] Dùng chung thiết bị/trình duyệt với đ/c ${dupName}.`
        
        if (warningReason) {
          warningReason = `${dupWarningText} | ${warningReason}`
        } else {
          warningReason = dupWarningText
        }
      }
    }

    // 4. Lưu ảnh minh chứng (nếu có) vào warning_reason để hiển thị cho Admin xem xét
    if (photoUrl) {
      const photoText = `📸 Ảnh minh chứng: ${photoUrl}`
      if (warningReason) {
        warningReason = `${photoText} | ${warningReason}`
      } else {
        warningReason = photoText
      }
    }

    // 5. Write record into database table meeting_attendance
    const { error: insertError } = await supabase
      .from('meeting_attendance')
      .insert({
        meeting_session_id: meetingSessionId,
        member_id: memberId,
        status,
        method,
        gps_lat: latitude ?? null,
        gps_lng: longitude ?? null,
        gps_distance_m: gpsDistanceM !== null ? Math.round(gpsDistanceM) : null,
        gps_valid: gpsValid,
        warning_reason: warningReason,
        marked_by: markedBy
      })

    if (insertError) {
      throw new Error(`Điểm danh thất bại: ${insertError.message}`)
    }

    // 6. Cập nhật bản đồ thiết bị điểm danh của phiên họp này
    if (deviceUuid) {
      await meetingUiSettingsService.updateDeviceMapping(meetingSessionId, memberId, deviceUuid)
    }

    // 7. Log audit log
    await supabase.from('audit_logs').insert({
      actor_id: markedBy,
      action: 'MARK_ATTENDANCE',
      target_type: 'meeting_attendance',
      metadata: { 
        meetingSessionId, 
        memberId, 
        gpsValid, 
        distanceMeters: gpsDistanceM !== null ? Math.round(gpsDistanceM) : null,
        isDuplicateDevice: status === 'warning' && warningReason?.includes('CẢNH BÁO ĐIỂM DANH HỘ')
      }
    })
  },

  /**
   * Đăng ký báo vắng có lý do
   */
  async requestExcusedAbsence(meetingSessionId: string, memberId: string, reason: string, markedBy: string): Promise<void> {
    // 1. Kiểm tra bản ghi điểm danh cũ
    const { data: existing } = await supabase
      .from('meeting_attendance')
      .select('id')
      .eq('meeting_session_id', meetingSessionId)
      .eq('member_id', memberId)
      .maybeSingle()

    if (existing) {
      throw new Error('Đồng chí đã thực hiện điểm danh hoặc báo vắng cho phiên họp này.')
    }

    // 2. Ghi nhận báo vắng vào database
    const { error: insertError } = await supabase
      .from('meeting_attendance')
      .insert({
        meeting_session_id: meetingSessionId,
        member_id: memberId,
        status: 'excused',
        method: 'manual',
        warning_reason: reason,
        marked_by: markedBy
      })

    if (insertError) {
      throw new Error(`Báo vắng thất bại: ${insertError.message}`)
    }

    // 3. Ghi audit log
    await supabase.from('audit_logs').insert({
      actor_id: markedBy,
      action: 'EXCUSED_ABSENCE',
      target_type: 'meeting_attendance',
      metadata: { 
        meetingSessionId, 
        memberId, 
        reason
      }
    })
  }
}
