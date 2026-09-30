export type LocationStatus =
  | 'inside_radius'
  | 'outside_radius'
  | 'missing_gps'
  | 'unknown'

export interface MemberRelation {
  id: string
  full_name: string
  position: string | null
  chi_bo_id: string
  chi_bos: {
    id: string
    name: string
  } | { id: string; name: string }[] | null
}

export interface MapAttendanceRow {
  id: string
  meeting_session_id: string
  member_id: string
  gps_lat: number | null
  gps_lng: number | null
  gps_distance_m: number | null
  gps_valid: boolean | null
  warning_reason: string | null
  status: string
  method: string | null
  marked_at: string | null
  created_at: string
  members: MemberRelation | MemberRelation[] | null
}

export interface AttendanceMapPoint {
  attendanceId: string
  meetingSessionId: string
  memberId: string
  fullName: string
  position: string
  chiBoId: string | null
  chiBoName: string
  latitude: number
  longitude: number
  distanceM: number | null
  gpsValid: boolean | null
  locationStatus: LocationStatus
  attendanceStatus: string
  attendanceMethod: string | null
  warningReason: string | null
  markedAt: string | null
}

export interface HallLocation {
  latitude: number
  longitude: number
  radiusM: number
  source: 'meeting_settings' | 'fallback'
}

export interface SessionMapSummary {
  totalAttendance: number
  positioned: number
  missingGps: number
  insideRadius: number
  outsideRadius: number
  unknown: number
}

export interface SessionMapData {
  meetingSessionId: string
  hall: HallLocation
  points: AttendanceMapPoint[]
  summary: SessionMapSummary
  loadedAt: string
}
