import { SatelliteMap } from '../../components/ui/SatelliteMap'
import type { MapStyle } from '../../components/ui/SatelliteMap'
import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, ArrowRight, QrCode, Key, Camera, Check, AlertTriangle, Layers } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { useAuth } from '../../contexts/AuthContext'
import { useGps } from '../../hooks/useGps'
import { meetingService } from '../../services/meetingService'
import type { MeetingSession } from '../../services/meetingService'
import { calculateDistance, calculateEffectiveDistance } from '../../utils/gps'
import { attendanceService, MAX_ALLOWED_DISTANCE_METERS } from '../../services/attendanceService'
import { meetingUiSettingsService } from '../../services/meetingUiSettingsService'

export const Attendance: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, logout } = useAuth()
  const { error: gpsError, loading: gpsLoading, getLocation } = useGps()
  
  const [meeting, setMeeting] = useState<MeetingSession | null>(null)
  const [uiSettings, setUiSettings] = useState<any>(null)
  
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  // Cấu hình các phương thức điểm danh yêu cầu
  const [methods, setMethods] = useState<string[]>(['gps']) // mặc định chỉ gps
  
  // Trạng thái các bước xác thực
  const [gpsCompleted, setGpsCompleted] = useState(false)
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null)

  // Mini Map Refs & State
  const [miniMapStyle, setMiniMapStyle] = useState<MapStyle>('satellite')
  
  const [pinRequired, setPinRequired] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinCompleted, setPinCompleted] = useState(false)
  
  const [qrRequired, setQrRequired] = useState(false)
  const [qrInput, setQrInput] = useState('')
  const [qrCompleted, setQrCompleted] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [autoSubmitted, setAutoSubmitted] = useState(false)
  const [permissionState, setPermissionState] = useState<string>('unknown')

  // Truy vấn trạng thái quyền định vị
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          setPermissionState(result.state)
          result.onchange = () => {
            setPermissionState(result.state)
          }
        })
        .catch((err) => {
          console.warn('Permissions query not supported:', err)
        })
    }
  }, [])
  
  const [photoRequired, setPhotoRequired] = useState(false)
  const [photoCompleted, setPhotoCompleted] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [photoUploading, setPhotoUploading] = useState(false)

  const [distance, setDistance] = useState<number | null>(null)
  const [isWithinRadius, setIsWithinRadius] = useState<boolean>(false)

  const targetLat = uiSettings?.gps_lat ?? null
  const targetLng = uiSettings?.gps_lng ?? null
  const allowedRadius = (uiSettings?.gps_radius_m && uiSettings.gps_radius_m > 0) 
    ? uiSettings.gps_radius_m 
    : MAX_ALLOWED_DISTANCE_METERS

  // Nút điểm danh chỉ hoạt động khi hoàn thành tất cả các bước được yêu cầu
  const isSubmitDisabled = 
    (methods.includes('gps') && (targetLat === null || targetLng === null)) ||
    (methods.includes('gps') && !gpsCompleted && !gpsError) || // GPS đang tải
    (pinRequired && !pinCompleted) || 
    (qrRequired && !qrCompleted) || 
    (photoRequired && !photoFile) ||
    loading || gpsLoading || photoUploading

  useEffect(() => {
    if (gpsCoords && targetLat !== null && targetLng !== null) {
      const rawDist = calculateDistance(gpsCoords.latitude, gpsCoords.longitude, targetLat, targetLng)
      const { effectiveDistanceM } = calculateEffectiveDistance(rawDist, gpsCoords.accuracy)
      setDistance(effectiveDistanceM)
      setIsWithinRadius(effectiveDistanceM <= allowedRadius)
    } else {
      setDistance(null)
      setIsWithinRadius(false)
    }
  }, [gpsCoords, uiSettings, targetLat, targetLng, allowedRadius])

  // Tải thông tin phiên họp và cấu hình điểm danh nâng cao
  useEffect(() => {
    async function initAttendance() {
      try {
        const session = await meetingService.getActiveSession()
        if (!session || session.status !== 'attendance_open') {
          navigate('/member')
          return
        }
        setMeeting(session)

        // Tải cấu hình điểm danh nâng cao
        const settings = await meetingUiSettingsService.getSettings(session.id)
        setUiSettings(settings)
        if (settings && settings.attendance_methods) {
          const reqMethods = settings.attendance_methods.split(',')
          setMethods(reqMethods)
          setPinRequired(reqMethods.includes('pin'))
          setQrRequired(reqMethods.includes('qr'))
          setPhotoRequired(reqMethods.includes('photo'))
          
          // Kiểm tra xem có qr_token trong url không (tự động điền nếu quét từ QR hội trường)
          const urlQrToken = searchParams.get('qr_token')
          if (urlQrToken && reqMethods.includes('qr')) {
            setQrInput(urlQrToken)
            setQrCompleted(true)
          }
        }
      } catch (err) {
        setError('Không thể tải thông tin cấu hình điểm danh.')
      }
    }

    initAttendance()
  }, [navigate, searchParams])

  // Lấy tọa độ GPS tự động khi truy cập trang (nếu yêu cầu GPS)
  useEffect(() => {
    if (methods.includes('gps') && !gpsCompleted) {
      // Nếu có yêu cầu quét mã QR và chưa quét thành công, ta KHÔNG tự động định vị ngay mà đợi quét xong QR
      if (methods.includes('qr') && !qrCompleted) {
        return
      }
      autoGetLocation()
    }
  }, [methods, qrCompleted, gpsCompleted])

  // Khởi tạo và giải phóng Camera QR Scanner
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null
    let active = true

    if (isScanning) {
      const startScanner = async () => {
        // Chờ DOM render reader
        await new Promise((resolve) => setTimeout(resolve, 100))
        if (!active) return

        try {
          html5QrCode = new Html5Qrcode('reader')
          await html5QrCode.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 220, height: 220 }
            },
            (decodedText) => {
              if (active) {
                setQrInput(decodedText)
                setIsScanning(false)
              }
            },
            () => {
              // Lỗi đọc khung hình
            }
          )
        } catch (err) {
          console.error('Lỗi khởi tạo QR Scanner:', err)
          setIsScanning(false)
        }
      }

      startScanner()
    }

    return () => {
      active = false
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode.stop()
            .catch(err => console.error('Lỗi dừng QR Scanner:', err))
        }
      }
    }
  }, [isScanning])

  // Tự động điểm danh khi hoàn tất các bước bắt buộc (kết hợp QR và GPS theo thứ tự)
  useEffect(() => {
    const hasCombinedFlow = methods.includes('qr') && methods.includes('gps')
    
    if (hasCombinedFlow && qrCompleted && gpsCompleted && !isSubmitDisabled && !success && !loading && !autoSubmitted) {
      setAutoSubmitted(true)
      handleAttendanceClick()
    }
  }, [qrCompleted, gpsCompleted, isSubmitDisabled, success, loading, methods, autoSubmitted])

  const autoGetLocation = async () => {
    try {
      const coords = await getLocation()
      if (coords) {
        setGpsCoords({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy })
        setGpsCompleted(true)
        setError('')
        setWarning('')
      }
    } catch (err: any) {
      console.warn('Auto GPS failed:', err.message)
      setWarning('Thiết bị di động chưa bật định vị GPS hoặc quyền định vị bị từ chối. Đồng chí vui lòng bật GPS và cho phép trình duyệt chia sẻ vị trí để điểm danh.')
    }
  }

  // Client confirms that a code was entered; the server checks its secret value.
  useEffect(() => {
    setPinCompleted(!pinRequired || pinInput.trim().length > 0)
  }, [pinInput, pinRequired])

  // The QR token is validated by the database RPC, never shipped as readable config.
  useEffect(() => {
    setQrCompleted(!qrRequired || qrInput.trim().length > 0)
  }, [qrInput, qrRequired])

  // Xử lý khi chọn ảnh selfie
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoFile(file)
    setPhotoCompleted(false)
    
    // Tạo preview ảnh
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleAttendanceClick = async () => {
    if (!user || !meeting) return

    setLoading(true)
    setError('')
    setWarning('')

    // 0. Xác thực lại trạng thái phiên họp trước khi điểm danh
    try {
      const currentSession = await meetingService.getSessionById(meeting.id)
      if (currentSession.status !== 'attendance_open') {
        setError('Cổng điểm danh hiện đang đóng. Đồng chí không thể thực hiện điểm danh.')
        setLoading(false)
        return
      }
    } catch (e: any) {
      setError('Lỗi xác thực trạng thái phiên họp: ' + e.message)
      setLoading(false)
      return
    }

    // Kiểm tra định vị GPS nếu phương thức điểm danh yêu cầu GPS
    if (methods.includes('gps')) {
      if (!gpsCoords) {
        console.warn('Điểm danh không có tọa độ GPS (Đảng viên không bật định vị).')
      }
    }

    let uploadedSelfieUrl = ''
    
    // 1. Tải ảnh selfie lên nếu có yêu cầu
    if (photoRequired && photoFile) {
      setPhotoUploading(true)
      try {
        uploadedSelfieUrl = await attendanceService.uploadSelfie(photoFile, user.memberId, meeting.id)
        setPhotoCompleted(true)
      } catch (uploadErr: any) {
        setError(`Tải ảnh minh chứng thất bại: ${uploadErr.message}`)
        setLoading(false)
        setPhotoUploading(false)
        return
      } finally {
        setPhotoUploading(false)
      }
    }

    try {
      // Xác định phương thức chính được ghi nhận trong DB
      let methodRecorded: 'gps' | 'qr' | 'pin' = 'gps'
      if (methods.includes('qr')) methodRecorded = 'qr'
      else if (methods.includes('pin')) methodRecorded = 'pin'

      // 2. Gọi attendanceService ghi nhận điểm danh
      await attendanceService.markAttendance({
        meetingSessionId: meeting.id,
        memberId: user.memberId,
        latitude: gpsCoords?.latitude,
        longitude: gpsCoords?.longitude,
        accuracy: gpsCoords?.accuracy,
        method: methodRecorded,
        markedBy: user.id,
        photoUrl: uploadedSelfieUrl || undefined,
        pinCode: pinInput,
        qrToken: qrInput
      })

      setSuccess(true)
      
      // Tự động chuyển hướng về trang chủ sau 1.8 giây
      setTimeout(() => {
        navigate('/member')
      }, 1800)
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra trong quá trình ghi nhận điểm danh. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  // Xác định số thứ tự bước động
  let currentStep = 1;
  const qrStep = qrRequired ? currentStep++ : 0;
  const gpsStep = methods.includes('gps') ? currentStep++ : 0;
  const pinStep = pinRequired ? currentStep++ : 0;
  const photoStep = photoRequired ? currentStep++ : 0;

  return (
    <PatternBackground>
      <PortalHeader />
      <RedNavigationBar
        isAuthenticated={true}
        userRole="member"
        userName={user?.memberName}
        onLogout={handleLogout}
      />
      
      <main className="max-w-xl mx-auto py-12 px-4">
        <GlassCard className="border border-red-revolution/20">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-red-revolution/10 flex items-center justify-center text-red-revolution mx-auto mb-4 border border-red-revolution/25 animate-pulse">
              <MapPin size={32} />
            </div>
            <h2 className="text-xl font-bold text-red-deep dark:text-gold normal-case tracking-normal">
              Xác nhận điểm danh
            </h2>
            <p className="text-xs font-semibold text-muted dark:text-muted mt-1">
              Sinh hoạt dưới nghi thức chào cờ cấp xã
            </p>
          </div>

          {meeting && (
            <div className="bg-red-revolution/5 p-4 rounded-xl border border-red-revolution/10 text-xs md:text-sm font-semibold text-brown-text dark:text-cream-light mb-6">
              <h4 className="font-bold text-red-deep dark:text-gold normal-case mb-1">Phiên họp:</h4>
              <p className="opacity-95 text-navy dark:text-white font-bold">{meeting.title}</p>
              <div className="mt-2 text-xs font-semibold text-muted">
                📍 Địa điểm: <b>{meeting.location || 'Chưa cấu hình'}</b>
              </div>
            </div>
          )}

          {error && <AlertMessage type="error" message={error} className="mb-4 animate-fade-in" />}
          {warning && <AlertMessage type="warning" message={warning} className="mb-4 animate-fade-in" />}

          {success ? (
            <div className="space-y-4 animate-fade-in">
              <AlertMessage
                type={isWithinRadius ? "success" : "warning"}
                title={isWithinRadius ? "ĐIỂM DANH THÀNH CÔNG" : "ĐIỂM DANH CÓ CẢNH BÁO"}
                message={isWithinRadius 
                  ? "Sự hiện diện của đồng chí đã được ghi nhận trên hệ thống. Đồng chí có thể tiếp tục tiến trình sinh hoạt chính trị."
                  : `Đồng chí đã điểm danh ngoài phạm vi phòng họp (Cự ly thực tế: ${distance !== null ? Math.round(distance) : ''}m, giới hạn: ${allowedRadius}m). Hệ thống đã ghi nhận cảnh báo vị trí gửi tới Ban tổ chức.`
                }
              />
              {gpsCoords && (
                <div className={isWithinRadius 
                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl border border-emerald-200 text-xs font-semibold"
                  : "bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 p-4 rounded-xl border border-amber-200 text-xs font-semibold"
                }>
                  📍 Tọa độ xác thực: <b>{gpsCoords.latitude.toFixed(6)}, {gpsCoords.longitude.toFixed(6)}</b>
                </div>
              )}
              <div className="pt-2">
                <RevolutionaryButton onClick={() => navigate('/member')} fullWidth>
                  Quay lại trang chính <ArrowRight size={18} />
                </RevolutionaryButton>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-xs md:text-sm text-muted dark:text-muted leading-relaxed font-semibold">
                Đồng chí vui lòng hoàn thành đầy đủ các hình thức xác thực điểm danh được yêu cầu dưới đây:
              </p>

              {/* BƯỚC QUÉT MÃ QR CODE */}
              {qrRequired && (
                <div className={`p-4 rounded-xl border transition-all ${
                  qrCompleted 
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-800 dark:text-emerald-300' 
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold normal-case flex items-center gap-1.5">
                      <QrCode size={16} className={qrCompleted ? 'text-emerald-500' : 'text-muted'} />
                      Bước {qrStep}: Quét mã QR hội trường
                    </span>
                    {qrCompleted ? (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Check size={10} /> Đã quét hợp lệ
                      </span>
                    ) : isScanning ? (
                      <span className="text-xs text-red-revolution font-bold animate-pulse">Đang mở camera...</span>
                    ) : null}
                  </div>
                  {qrCompleted ? (
                    <p className="text-xs font-medium opacity-90">
                      Xác thực mã QR hội trường thành công.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted leading-relaxed">
                        Đồng chí vui lòng quét mã QR hiển thị trên màn chiếu bằng nút dưới đây (hoặc nhập trực tiếp mã):
                      </p>
                      
                      {!isScanning ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsScanning(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-revolution hover:bg-red-dark text-white rounded-lg text-xs font-bold cursor-pointer shadow-sm transition-all"
                          >
                            <Camera size={14} /> Quét mã ngay
                          </button>
                        </div>
                      ) : (
                        <div className="relative mt-2 p-2 bg-black/5 dark:bg-black/20 rounded-xl border border-dashed border-red-revolution/30">
                          <div id="reader" className="w-full max-w-[280px] mx-auto overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-black"></div>
                          <button 
                            type="button" 
                            onClick={() => setIsScanning(false)}
                            className="mt-2 text-xs font-bold text-red-revolution normal-case tracking-normal block mx-auto cursor-pointer hover:underline"
                          >
                            Hủy quét / Tự nhập
                          </button>
                        </div>
                      )}

                      <input 
                        type="text"
                        value={qrInput}
                        onChange={(e) => setQrInput(e.target.value)}
                        className="w-full text-xs font-bold p-2 border border-slate-200 dark:border-slate-800 rounded-lg focus:border-red-revolution"
                        placeholder="Hoặc nhập mã xác thực QR hội trường tại đây..."
                      />
                    </div>
                  )}
                </div>
              )}

              {/* BƯỚC ĐỊNH VỊ GPS */}
              {methods.includes('gps') && (
                <div className={`p-4 rounded-xl border transition-all ${
                  gpsCompleted 
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-800 dark:text-emerald-300' 
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold normal-case flex items-center gap-1.5">
                      <MapPin size={16} className={gpsCompleted ? 'text-emerald-500' : 'text-muted'} />
                      Bước {gpsStep}: Định vị phòng họp (GPS)
                    </span>
                    {gpsCompleted ? (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Check size={10} /> Đã định vị
                      </span>
                    ) : gpsLoading ? (
                      <span className="text-xs text-muted font-bold animate-pulse">Đang định vị...</span>
                    ) : (
                      methods.includes('gps') && !(qrRequired && !qrCompleted) && (
                        <button 
                          type="button" 
                          onClick={autoGetLocation}
                          className="text-xs text-red-revolution underline font-bold hover:text-red-dark cursor-pointer"
                        >
                          Thử lại
                        </button>
                      )
                    )}
                  </div>

                  {qrRequired && !qrCompleted ? (
                    <div className="text-center py-4 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100/30 dark:bg-slate-900/30">
                      <MapPin size={24} className="text-slate-350 dark:text-slate-700 mx-auto animate-pulse" />
                      <p className="text-xs font-semibold text-muted px-4 leading-relaxed">
                        Vui lòng hoàn thành <b>Bước {qrStep}: Quét mã QR</b> trước. Hệ thống sẽ tự động định vị phòng họp sau khi quét thành công.
                      </p>
                    </div>
                  ) : gpsCompleted && gpsCoords ? (
                    <div className="space-y-3 mt-3 animate-fade-in">
                      {/* Bộ chuyển đổi kiểu bản đồ Google */}
                      <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900 p-1.5 rounded-lg text-xs font-bold">
                        <span className="text-muted flex items-center gap-1">
                          <Layers size={12} /> Bản đồ vị trí:
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setMiniMapStyle('satellite')}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              miniMapStyle === 'satellite'
                                ? 'bg-red-revolution text-white font-bold shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-muted dark:text-muted'
                            }`}
                          >
                            🛰️ Vệ tinh Esri
                          </button>
                          <button
                            type="button"
                            onClick={() => setMiniMapStyle('street')}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              miniMapStyle === 'street'
                                ? 'bg-red-revolution text-white font-bold shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-muted dark:text-muted'
                            }`}
                          >
                            🗺️ Đường phố
                          </button>
                        </div>
                      </div>

                      {/* Khung bản đồ Google Maps Vệ tinh thu nhỏ */}
                      <div className="relative w-full h-64 rounded-xl border-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-[#e5e3df] dark:bg-slate-800">
                        <SatelliteMap style={miniMapStyle} className="h-full w-full" hall={{ latitude: targetLat, longitude: targetLng, radiusM: allowedRadius, source: 'meeting_settings' }} userPosition={gpsCoords} />
                      </div>

                      {/* Thẻ khoảng cách thực tế và Trạng thái hợp lệ */}
                      <div className={`p-3.5 rounded-xl border text-xs flex justify-between items-center transition-all ${
                        isWithinRadius 
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-800 dark:text-emerald-300 shadow-sm'
                          : 'bg-rose-500/5 border-rose-500/20 text-rose-800 dark:text-rose-300 shadow-sm'
                      }`}>
                        <div className="space-y-0.5">
                          <p className="font-bold flex items-center gap-1">
                            📍 Khoảng cách thực tế: <span className="text-sm font-bold">{distance !== null ? Math.round(distance) : '...'}m</span>
                          </p>
                          <p className="text-xs opacity-80 font-semibold">
                            {isWithinRadius 
                              ? `Hợp lệ (Trong bán kính quy định <= ${allowedRadius}m)` 
                              : `Cảnh báo (Vượt quá bán kính cho phép ${allowedRadius}m)`
                            }
                          </p>
                        </div>
                        <span className={`text-xs font-bold normal-case px-2.5 py-1 rounded-lg border shadow-sm ${
                          isWithinRadius 
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 border-emerald-250 dark:border-emerald-900/50' 
                            : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 border-rose-250 dark:border-rose-900/50'
                        }`}>
                          {isWithinRadius ? 'Hợp lệ' : 'Ngoài vùng'}
                        </span>
                      </div>
                      
                      <p className="text-xs font-medium text-muted text-center">
                        Tọa độ GPS: <b>{gpsCoords.latitude.toFixed(6)}, {gpsCoords.longitude.toFixed(6)}</b>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted leading-relaxed">
                        Hệ thống tự động phát hiện định vị. Nếu đợi lâu, đồng chí vui lòng nhấp nút <b>"Thử lại"</b> và đồng ý chia sẻ vị trí.
                      </p>
                      
                      {/* Hướng dẫn khắc phục khi bị từ chối quyền định vị */}
                      {(((warning && (warning.includes('cấu hình') || warning.includes('cấp quyền') || warning.includes('từ chối') || warning.includes('chưa bật')))) || permissionState === 'denied') && (
                        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl space-y-2 text-rose-900 dark:text-rose-300 text-xs shadow-sm">
                          <p className="font-bold flex items-center gap-1 text-xs normal-case tracking-normal text-rose-700 dark:text-rose-400">
                            <AlertTriangle size={14} className="animate-bounce" /> Hướng dẫn mở khóa quyền định vị (GPS):
                          </p>
                          <div className="space-y-2 leading-relaxed font-medium">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-muted">Cách 1: Sửa nhanh trên thanh địa chỉ trình duyệt</p>
                              <p className="pl-3 opacity-90">• <b>Với iPhone (Safari)</b>: Nhấp biểu tượng <b>aA</b> hoặc <b>ổ khóa</b> ở bên trái thanh địa chỉ trình duyệt &rarr; Chọn <b>Cài đặt trang web</b> (Website Settings) &rarr; Đổi quyền <b>Vị trí</b> (Location) thành <b>Cho phép</b> (Allow). Sau đó tải lại trang.</p>
                              <p className="pl-3 opacity-90">• <b>Với Android (Chrome)</b>: Nhấp biểu tượng <b>ổ khóa</b> bên trái thanh địa chỉ trình duyệt &rarr; Chọn <b>Quyền truy cập</b> (Permissions) &rarr; Chọn <b>Vị trí</b> và gạt nút sang <b>Cho phép</b> (Allow). Sau đó tải lại trang.</p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 dark:text-muted">Cách 2: Nếu mở qua Zalo, Facebook hoặc Viber</p>
                              <p className="pl-3 opacity-90">• Các ứng dụng này thường khóa định vị vì lý do bảo mật. Đồng chí vui lòng nhấp vào biểu tượng <b>Ba dấu chấm</b> ở góc trên cùng bên phải màn hình &rarr; Chọn <b>Mở bằng trình duyệt hệ thống</b> (Mở trong Safari hoặc Chrome) để định vị bình thường.</p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 dark:text-muted">Cách 3: Bật GPS trong cài đặt điện thoại</p>
                              <p className="pl-3 opacity-90">• Hãy chắc chắn điện thoại của đồng chí đã bật Định vị/Dịch vụ vị trí trong phần <b>Cài đặt chung</b> của máy.</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* BƯỚC NHẬP MÃ PIN ĐIỂM DANH */}
              {pinRequired && (
                <div className={`p-4 rounded-xl border transition-all ${
                  pinCompleted 
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-800 dark:text-emerald-300' 
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold normal-case flex items-center gap-1.5">
                      <Key size={16} className={pinCompleted ? 'text-emerald-500' : 'text-muted'} />
                      Bước {pinStep}: Nhập mã PIN phòng họp
                    </span>
                    {pinCompleted && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Check size={10} /> Đúng mã PIN
                      </span>
                    )}
                  </div>
                  {pinCompleted ? (
                    <p className="text-xs font-medium opacity-90">
                      Đã xác thực mã PIN phòng họp thành công.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted leading-relaxed">
                        Đồng chí vui lòng nhập mã PIN gồm 4 chữ số do Ban Tổ chức công bố tại hội trường:
                      </p>
                      <input 
                        type="text"
                        maxLength={4}
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-xs font-bold tracking-normal p-2 border border-slate-200 dark:border-slate-800 rounded-lg text-center focus:border-red-revolution"
                        placeholder="Nhập mã PIN gồm 4 chữ số..."
                      />
                    </div>
                  )}
                </div>
              )}

              {/* BƯỚC CHỤP ẢNH MINH CHỨNG */}
              {photoRequired && (
                <div className={`p-4 rounded-xl border transition-all ${
                  photoCompleted || photoFile
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-800 dark:text-emerald-300' 
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold normal-case flex items-center gap-1.5">
                      <Camera size={16} className={photoCompleted || photoFile ? 'text-emerald-500' : 'text-muted'} />
                      Bước {photoStep}: Chụp ảnh selfie tại chỗ
                    </span>
                    {(photoCompleted || photoFile) && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Check size={10} /> Đã chụp ảnh
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted leading-relaxed">
                      Vui lòng chụp ảnh selfie cận mặt tại phòng họp để làm minh chứng xác thực hiện diện (chụp ảnh thật tại chỗ).
                    </p>
                    
                    {photoPreview ? (
                      <div className="relative w-32 h-32 rounded-xl overflow-hidden border-2 border-slate-200 mx-auto shadow-sm">
                        <img src={photoPreview} alt="Selfie preview" className="w-full h-full object-cover" />
                        <label className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs font-bold normal-case text-center py-1.5 cursor-pointer">
                          Chụp lại
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="user" 
                            onChange={handlePhotoCapture} 
                            className="hidden" 
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-revolution hover:bg-red-dark text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm transition-all">
                          <Camera size={14} /> Chụp ảnh ngay
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="user" 
                            onChange={handlePhotoCapture} 
                            className="hidden" 
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4">
                <RevolutionaryButton
                  onClick={handleAttendanceClick}
                  loading={loading || gpsLoading || photoUploading}
                  disabled={isSubmitDisabled}
                  fullWidth
                >
                  <MapPin size={18} /> Xác nhận điểm danh
                </RevolutionaryButton>
                {loading && (
                  <p className="text-xs text-center text-red-revolution font-bold mt-2 animate-pulse">
                    Hệ thống đang tự động ghi nhận điểm danh. Vui lòng giữ nguyên màn hình...
                  </p>
                )}
                {isSubmitDisabled && !loading && (
                  <p className="text-xs text-center text-muted font-bold mt-2 flex items-center justify-center gap-1">
                    <AlertTriangle size={12} className="text-muted" /> Vui lòng hoàn thành tất cả các bước xác thực ở trên.
                  </p>
                )}
              </div>
            </div>
          )}
        </GlassCard>
      </main>
    </PatternBackground>
  )
}

export default Attendance
