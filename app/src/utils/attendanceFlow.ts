export interface AttendanceReadiness {
  ready: boolean
  loading: boolean
  photoUploading: boolean
  pinRequired: boolean
  pinCompleted: boolean
  qrRequired: boolean
  qrCompleted: boolean
  photoRequired: boolean
  hasPhoto: boolean
}

/** GPS is advisory: denied, pending, missing hall coordinates never block confirmation. */
export const canConfirmAttendance = (state: AttendanceReadiness) => state.ready && !state.loading && !state.photoUploading &&
  (!state.pinRequired || state.pinCompleted) && (!state.qrRequired || state.qrCompleted) && (!state.photoRequired || state.hasPhoto)

export function attendanceMethod(methods: string[], hasCoordinates: boolean): 'button' | 'gps' | 'qr' | 'pin' {
  if (methods.includes('qr')) return 'qr'
  if (methods.includes('pin')) return 'pin'
  return hasCoordinates ? 'gps' : 'button'
}
