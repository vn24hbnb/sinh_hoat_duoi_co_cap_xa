import { supabase } from './supabaseClient'
import { meetingUiSettingsService } from './meetingUiSettingsService'
import { calculateDistance } from '../utils/gps'
import { DEFAULT_MEETING_LAT, DEFAULT_MEETING_LNG, MAX_ALLOWED_DISTANCE_METERS } from './attendanceService'
import type {
  SessionMapData,
  AttendanceMapPoint,
  MapAttendanceRow,
  HallLocation,
  LocationStatus
} from '../types/mapAttendance'

// In-memory cache cho vị trí Hội trường của các phiên họp
const hallSettingsCache = new Map<string, HallLocation>()

export const mapAttendanceService = {
  /**
   * Tải toàn bộ dữ liệu bản đồ cho một phiên họp cụ thể theo meeting_session_id.
   */
  async getSessionMapData(
    meetingSessionId: string,
    options?: {
      forceReloadSettings?: boolean
    }
  ): Promise<SessionMapData> {
    if (!meetingSessionId || meetingSessionId.trim() === '') {
      throw new Error('MISSING_SESSION_ID: meetingSessionId không được để trống.')
    }

    const trimmedSessionId = meetingSessionId.trim()

    // 1. Tải thông tin Hội trường (dùng cache nếu có và không yêu cầu forceReload)
    let hall: HallLocation
    if (!options?.forceReloadSettings && hallSettingsCache.has(trimmedSessionId)) {
      hall = hallSettingsCache.get(trimmedSessionId)!
    } else {
      try {
        const settings = await meetingUiSettingsService.getSettings(trimmedSessionId)
        const lat = settings?.gps_lat ?? DEFAULT_MEETING_LAT
        const lng = settings?.gps_lng ?? DEFAULT_MEETING_LNG
        const radius = (settings?.gps_radius_m && settings.gps_radius_m > 0)
          ? settings.gps_radius_m
          : MAX_ALLOWED_DISTANCE_METERS

        hall = {
          latitude: lat,
          longitude: lng,
          radiusM: radius,
          source: settings?.gps_lat ? 'meeting_settings' : 'fallback'
        }
        hallSettingsCache.set(trimmedSessionId, hall)
      } catch (err: unknown) {
        console.warn('Dùng vị trí hội trường mặc định:', err)
        hall = {
          latitude: DEFAULT_MEETING_LAT,
          longitude: DEFAULT_MEETING_LNG,
          radiusM: MAX_ALLOWED_DISTANCE_METERS,
          source: 'fallback'
        }
      }
    }

    // 2. Truy vấn dữ liệu meeting_attendance cô lập strictly theo meeting_session_id
    const { data, error } = await supabase
      .from('meeting_attendance')
      .select(`
        id,
        meeting_session_id,
        member_id,
        gps_lat,
        gps_lng,
        gps_distance_m,
        gps_valid,
        warning_reason,
        status,
        method,
        marked_at,
        created_at,
        members (
          id,
          full_name,
          position,
          chi_bo_id,
          chi_bos ( id, name )
        )
      `)
      .eq('meeting_session_id', trimmedSessionId)
      .order('marked_at', { ascending: true })

    if (error) {
      throw new Error('ATTENDANCE_QUERY_FAILED: ' + error.message)
    }

    const rows = (data as unknown as MapAttendanceRow[]) || []
    const totalAttendance = rows.length
    const points: AttendanceMapPoint[] = []

    let missingGps = 0
    let insideRadius = 0
    let outsideRadius = 0
    let unknown = 0

    // 3. Chuyển đổi từng bản ghi thành model bản đồ chuẩn hóa
    rows.forEach((row) => {
      const rawLat = row.gps_lat
      const rawLng = row.gps_lng

      // Đánh giá cặp tọa độ hợp lệ
      if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) {
        missingGps++
        return
      }

      const memberObj = Array.isArray(row.members) ? row.members[0] : row.members
      const chiBoObj = memberObj ? (Array.isArray(memberObj.chi_bos) ? memberObj.chi_bos[0] : memberObj.chi_bos) : null

      const fullName = memberObj?.full_name || 'Đảng viên'
      const position = memberObj?.position || 'Đảng viên'
      const chiBoId = memberObj?.chi_bo_id || null
      const chiBoName = chiBoObj?.name || 'Chi bộ'

      // 1. Khoảng cách: ưu tiên gps_distance_m từ DB, fallback tính theo calculateDistance
      const distM = Number.isFinite(row.gps_distance_m)
        ? (row.gps_distance_m as number)
        : calculateDistance(rawLat as number, rawLng as number, hall.latitude, hall.longitude)

      // 2. Trạng thái GPS hợp lệ: ưu tiên boolean gps_valid từ DB, fallback so sánh với bán kính hội trường
      const isValid = typeof row.gps_valid === 'boolean'
        ? row.gps_valid
        : distM <= hall.radiusM

      // 3. Xác định LocationStatus tách biệt khỏi attendance.status
      let locStatus: LocationStatus = 'unknown'
      if (typeof isValid === 'boolean') {
        locStatus = isValid ? 'inside_radius' : 'outside_radius'
      }

      if (locStatus === 'inside_radius') insideRadius++
      else if (locStatus === 'outside_radius') outsideRadius++
      else unknown++

      // 4. Thời gian điểm danh: marked_at ?? created_at
      const timeStr = row.marked_at || row.created_at
      let formattedTime: string | null = null
      if (timeStr) {
        const d = new Date(timeStr)
        if (!isNaN(d.getTime())) {
          formattedTime = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }
      }

      points.push({
        attendanceId: row.id,
        meetingSessionId: row.meeting_session_id || trimmedSessionId,
        memberId: row.member_id,
        fullName,
        position,
        chiBoId,
        chiBoName,
        latitude: rawLat as number,
        longitude: rawLng as number,
        distanceM: distM,
        gpsValid: isValid,
        locationStatus: locStatus,
        attendanceStatus: row.status || 'present',
        attendanceMethod: row.method || null,
        warningReason: row.warning_reason || null,
        markedAt: formattedTime
      })
    })

    const summary = {
      totalAttendance,
      positioned: points.length,
      missingGps,
      insideRadius,
      outsideRadius,
      unknown
    }

    return {
      meetingSessionId: trimmedSessionId,
      hall,
      points,
      summary,
      loadedAt: new Date().toISOString()
    }
  },

  /**
   * Xóa cache cấu hình hội trường cho một phiên hoặc toàn bộ
   */
  clearHallCache(meetingSessionId?: string) {
    if (meetingSessionId) {
      hallSettingsCache.delete(meetingSessionId)
    } else {
      hallSettingsCache.clear()
    }
  }
}
