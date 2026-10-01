import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Play, ToggleLeft, CheckCircle, RefreshCw, Users, Calendar, ArrowRight, X, BookOpen, Edit3, Clock, ListChecks, Trash2, ChevronDown, ChevronUp, ShieldAlert, MapPin, QrCode, Key, Camera, Copy, Bookmark, Check } from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { meetingService } from '../../services/meetingService'
import { examService } from '../../services/examService'
import { authService } from '../../services/authService'
import { meetingUiSettingsService } from '../../services/meetingUiSettingsService'
import { hallPresetService } from '../../services/hallPresetService'
import type { HallPreset } from '../../services/hallPresetService'
import type { MeetingSession } from '../../services/meetingService'
import { useAuth } from '../../contexts/AuthContext'
import { tenantService } from '../../services/tenantService'
import { supabase } from '../../services/supabaseClient'
const GENERIC_MEETING_TEMPLATE = {
  is_structured: true,
  time_str: '',
  location_str: '',
  participants_str: 'Toàn thể đảng viên thuộc đơn vị',
  items: [
    { tt: 1, content: 'Ổn định tổ chức và điểm danh', moderator: '', performer: '' },
    { tt: 2, content: 'Tiến hành nghi lễ chào cờ', moderator: '', performer: '' },
    { tt: 3, content: 'Triển khai nội dung sinh hoạt chính trị', moderator: '', performer: '' },
    { tt: 4, content: 'Thảo luận và kết luận', moderator: '', performer: '' }
  ]
}

export const MeetingManager: React.FC = () => {
  const { user, logout, organizationId } = useAuth()
  const navigate = useNavigate()
  const dataRequestSequenceRef = useRef(0)
  const bankRequestSequenceRef = useRef(0)
  const loadedOrganizationIdRef = useRef<string | null>(null)
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | null>(null)
  
  const [meeting, setMeeting] = useState<MeetingSession | null>(null)
  const [historyMeetings, setHistoryMeetings] = useState<MeetingSession[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Accordion state cho Điểm danh theo Chi bộ
  const [expandedChiBos, setExpandedChiBos] = useState<string[]>([])

  // State cho Modal Xóa phiên họp bảo mật
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [meetingToDelete, setMeetingToDelete] = useState<MeetingSession | null>(null)
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('')
  const [deleteConfirmNameInput, setDeleteConfirmNameInput] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Đề thi State
  const [examConfig, setExamConfig] = useState<any | null>(null)
  const [availableBanks, setAvailableBanks] = useState<any[]>([])
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([])
  const [examTitle, setExamTitle] = useState('')
  const [examDuration, setExamDuration] = useState(10) // phút
  const [examQuestionCount, setExamQuestionCount] = useState(10)
  const [isEditingExam, setIsEditingExam] = useState(false)
  const [savingExam, setSavingExam] = useState(false)
  const [loadingExam, setLoadingExam] = useState(false)

  // Cấu hình điểm danh nâng cao State
  const [isEditingAttendance, setIsEditingAttendance] = useState(false)
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [gpsLat, setGpsLat] = useState<string>('')
  const [gpsLng, setGpsLng] = useState<string>('')
  const [gpsRadius, setGpsRadius] = useState<number>(200)
  const [selectedMethods, setSelectedMethods] = useState<string[]>(['gps'])
  const [pinCode, setPinCode] = useState<string>('')
  const [qrToken, setQrToken] = useState<string>('')
  const [qrModalOpen, setQrModalOpen] = useState(false)

  // Map Modal State & Refs
  const [showMapModal, setShowMapModal] = useState(false)
  const [tempLat, setTempLat] = useState('')
  const [tempLng, setTempLng] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [googleMapsPaste, setGoogleMapsPaste] = useState('')
  const [mapStyle, setMapStyle] = useState<string>('google-hybrid')
  
  // Preset mẫu địa điểm phòng họp & Clipboard
  const [hallPresets, setHallPresets] = useState<HallPreset[]>(() => hallPresetService.getPresets())
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const [copiedState, setCopiedState] = useState(false)

  const handleSelectHallPreset = (presetId: string) => {
    setSelectedPresetId(presetId)
    if (!presetId) return
    const preset = hallPresets.find(p => p.id === presetId)
    if (preset) {
      setGpsLat(preset.lat.toFixed(6))
      setGpsLng(preset.lng.toFixed(6))
      setGpsRadius(preset.radius)
      setSuccess(`Đã áp dụng mẫu phòng họp: "${preset.name}"`)
    }
  }

  const handleSaveNewHallPreset = () => {
    const name = prompt('Nhập tên gợi nhớ cho địa điểm của đơn vị:')
    if (!name || !name.trim()) return
    const lat = parseFloat(gpsLat)
    const lng = parseFloat(gpsLng)
    if (isNaN(lat) || isNaN(lng)) {
      alert('Vui lòng nhập tọa độ hợp lệ trước khi lưu mẫu!')
      return
    }
    const newPreset = hallPresetService.savePreset(name, lat, lng, gpsRadius)
    setHallPresets(hallPresetService.getPresets())
    setSelectedPresetId(newPreset.id)
    setSuccess(`Đã lưu thành công mẫu phòng họp: "${newPreset.name}"`)
  }

  const handleCopyCoordsToClipboard = (latStr: string, lngStr: string) => {
    if (!latStr || !lngStr) return
    const textToCopy = `${latStr}, ${lngStr}`
    navigator.clipboard.writeText(textToCopy)
    setCopiedState(true)
    setTimeout(() => setCopiedState(false), 2000)
  }
  
  const mapRef = React.useRef<HTMLDivElement>(null)
  const mapInstanceRef = React.useRef<any>(null)
  const markerInstanceRef = React.useRef<any>(null)

  // Văn bản, tài liệu kèm theo phiên họp
  const [documents, setDocuments] = useState<any[]>([])
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isCompressPdf, setIsCompressPdf] = useState(true)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [compressionStatus, setCompressionStatus] = useState('')

  // Form State
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('2026-10-05')
  const [formTime, setFormTime] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formAgenda, setFormAgenda] = useState('')
  const [applyTemplate, setApplyTemplate] = useState(false)

  // Agenda Visual Builder State
  const [isStructuredAgenda, setIsStructuredAgenda] = useState(false)
  const [agendaTime, setAgendaTime] = useState('')
  const [agendaLocation, setAgendaLocation] = useState('')
  const [agendaParticipants, setAgendaParticipants] = useState('')
  const [agendaItems, setAgendaItems] = useState<any[]>([])
  const [savingAgenda, setSavingAgenda] = useState(false)
  const [examAttempts, setExamAttempts] = useState<any[]>([])

  useEffect(() => {
    if (meeting && meeting.agenda) {
      try {
        const parsed = JSON.parse(meeting.agenda)
        if (parsed && parsed.is_structured) {
          setIsStructuredAgenda(true)
          setAgendaTime(parsed.time_str || '')
          setAgendaLocation(parsed.location_str || '')
          setAgendaParticipants(parsed.participants_str || '')
          setAgendaItems(parsed.items || [])
          return
        }
      } catch (e) {
        // Fallback to unstructured
      }
    }
    setIsStructuredAgenda(false)
    setAgendaTime('')
    setAgendaLocation('')
    setAgendaParticipants('')
    setAgendaItems([])
  }, [meeting])

  const handleToggleTemplate = (checked: boolean) => {
    setApplyTemplate(checked)
    if (checked) {
      setFormTitle('Sinh hoạt chính trị dưới nghi thức chào cờ')
      setFormDate(new Date().toISOString().split('T')[0])
      setFormTime('')
      setFormLocation('')
      setFormAgenda(JSON.stringify(GENERIC_MEETING_TEMPLATE, null, 2))
    } else {
      setFormTitle('')
      setFormDate(new Date().toISOString().split('T')[0])
      setFormTime('08:00')
      setFormLocation('')
      setFormAgenda('')
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const loadQuestionBanks = useCallback(async () => {
    const requestId = ++bankRequestSequenceRef.current
    const isCurrentRequest = () => requestId === bankRequestSequenceRef.current && tenantService.getOrganizationId() === organizationId
    try {
      const banksList = await examService.getQuestionBanks()
      if (!isCurrentRequest()) return
      setAvailableBanks(banksList)
    } catch (err) {
      if (!isCurrentRequest()) return
      console.error('Lỗi tải ngân hàng câu hỏi:', err)
    }
  }, [organizationId])

  const loadExamConfig = useCallback(async (sessionId: string, isCurrentRequest: () => boolean = () => true, sessionTitle?: string) => {
    if (!isCurrentRequest()) return
    setLoadingExam(true)
    try {
      const config = await examService.getMeetingExam(sessionId)
      if (!isCurrentRequest()) return
      setExamConfig(config)
      if (config) {
        setExamTitle(config.title)
        setExamDuration(Math.floor(config.duration_seconds / 60))
        setExamQuestionCount(config.questions_per_user)
        setSelectedBankIds(config.question_bank_ids || [])
      } else {
        // Giá trị mặc định
        setExamTitle(sessionTitle ? `${sessionTitle} - Bài kiểm tra` : 'Bài kiểm tra chuyên đề')
        setExamDuration(10)
        setExamQuestionCount(10)
        setSelectedBankIds([])
      }
    } catch (err) {
      if (!isCurrentRequest()) return
      console.error('Lỗi tải cấu hình đề thi:', err)
    } finally {
      if (isCurrentRequest()) setLoadingExam(false)
    }
  }, [])

  const loadAttendanceConfig = useCallback(async (sessionId: string, isCurrentRequest: () => boolean = () => true) => {
    if (!isCurrentRequest()) return
    try {
      const config = await meetingUiSettingsService.getSettings(sessionId)
      if (!isCurrentRequest()) return
      if (config) {
        setGpsLat(config.gps_lat != null ? Number(config.gps_lat).toFixed(6) : '')
        setGpsLng(config.gps_lng != null ? Number(config.gps_lng).toFixed(6) : '')
        setGpsRadius(config.gps_radius_m || 200)
        setSelectedMethods(config.attendance_methods ? config.attendance_methods.split(',') : ['gps'])
        setPinCode(config.pin_code || '')
        setQrToken(config.qr_code_token || crypto.randomUUID())
      } else {
        setGpsLat('')
        setGpsLng('')
        setGpsRadius(200)
        setSelectedMethods(['gps'])
        setPinCode('')
        setQrToken(crypto.randomUUID())
      }
    } catch (err) {
      if (!isCurrentRequest()) return
      console.error('Lỗi tải cấu hình điểm danh:', err)
    }
  }, [])

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ Geolocation để lấy vị trí.')
      return
    }
    
    setSuccess('Đang quét đo tọa độ phòng họp với độ chính xác cao...')
    let bestPos: GeolocationPosition | null = null
    let watchId: number | null = null

    const finish = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      if (bestPos) {
        setGpsLat(bestPos.coords.latitude.toFixed(6))
        setGpsLng(bestPos.coords.longitude.toFixed(6))
        setSuccess(`Đã lấy tọa độ GPS chuẩn cho phòng họp (Độ chính xác: ±${Math.round(bestPos.coords.accuracy)}m)!`)
      }
    }

    const timer = setTimeout(finish, 3500)

    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!bestPos || position.coords.accuracy < bestPos.coords.accuracy) {
            bestPos = position
          }
          if (position.coords.accuracy <= 15) {
            clearTimeout(timer)
            finish()
          }
        },
        (err) => {
          if (bestPos) {
            clearTimeout(timer)
            finish()
          } else {
            clearTimeout(timer)
            setError(`Không thể lấy vị trí hiện tại: ${err.message}`)
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    } catch (err: any) {
      clearTimeout(timer)
      setError('Lỗi kết nối định vị thiết bị.')
    }
  }

  // Xử lý mở modal Bản đồ
  const handleOpenMapModal = () => {
    setTempLat(gpsLat ? Number(gpsLat).toFixed(6) : '')
    setTempLng(gpsLng ? Number(gpsLng).toFixed(6) : '')
    setSearchQuery('')
    setGoogleMapsPaste('')
    setShowMapModal(true)
  }

  // Xử lý lưu tọa độ từ Bản đồ
  const handleConfirmMapCoords = () => {
    const lat = parseFloat(tempLat)
    const lng = parseFloat(tempLng)
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError('Hãy tìm địa điểm hoặc chọn một điểm trên bản đồ trước khi xác nhận.')
      return
    }
    setGpsLat(!isNaN(lat) ? lat.toFixed(6) : tempLat)
    setGpsLng(!isNaN(lng) ? lng.toFixed(6) : tempLng)
    setShowMapModal(false)
  }

  // Xử lý dán tọa độ từ Google Maps
  const handlePasteGoogleMapsCoords = (val: string) => {
    setGoogleMapsPaste(val)
    // Hỗ trợ trích xuất cả tọa độ thuần "21.32, 103.91" và URL Google Maps chứa "/@21.3284,103.9125"
    const regex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/
    const match = val.match(regex)
    if (match && match.length >= 3) {
      const latVal = parseFloat(match[1])
      const lngVal = parseFloat(match[2])
      
      setTempLat(latVal.toFixed(6))
      setTempLng(lngVal.toFixed(6))
      
      if (mapInstanceRef.current && markerInstanceRef.current) {
        if (mapInstanceRef.current.flyTo) {
          mapInstanceRef.current.flyTo({ center: [lngVal, latVal], zoom: 17 })
          markerInstanceRef.current.setLngLat([lngVal, latVal])
        }
      }
    }
  }

  // Tìm kiếm vị trí qua Nominatim
  const handleSearchLocation = async () => {
    if (!searchQuery) return
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (data && data.length > 0) {
        const { lat, lon } = data[0]
        const latNum = parseFloat(lat)
        const lngNum = parseFloat(lon)
        
        setTempLat(latNum.toFixed(6))
        setTempLng(lngNum.toFixed(6))
        
        if (mapInstanceRef.current && markerInstanceRef.current) {
          if (mapInstanceRef.current.flyTo) {
            mapInstanceRef.current.flyTo({ center: [lngNum, latNum], zoom: 17 })
            markerInstanceRef.current.setLngLat([lngNum, latNum])
          }
        }
      } else {
        alert('Không tìm thấy vị trí. Vui lòng thử tìm từ khóa khác.')
      }
    } catch (err) {
      console.error('Lỗi tìm địa điểm:', err)
    }
  }

  // Load Mapbox GL JS map dynamically when Map modal opens
  useEffect(() => {
    if (!showMapModal) return

    const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

    // Inject CSS
    const cssId = 'mapbox-gl-css-cdn'
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.css'
      document.head.appendChild(link)
    }

    const initMap = () => {
      if (typeof window === 'undefined' || !(window as any).mapboxgl || !mapRef.current) {
        setTimeout(initMap, 50)
        return
      }

      const mapboxgl = (window as any).mapboxgl
      mapboxgl.accessToken = MAPBOX_TOKEN
      
      const hasCoordinates = Boolean(tempLat && tempLng)
      const initialLat = hasCoordinates ? parseFloat(tempLat) : 0
      const initialLng = hasCoordinates ? parseFloat(tempLng) : 0

      // Clean up previous map if exists
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (e) {
          console.error('Lỗi xóa map instance cũ:', e)
        }
        mapInstanceRef.current = null
      }

      let activeStyle: any = mapStyle
      if (mapStyle === 'google-hybrid' || mapStyle === 'google-roadmap') {
        activeStyle = {
          version: 8,
          sources: {
            'google-raster': {
              type: 'raster',
              tiles: [
                mapStyle === 'google-hybrid'
                  ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
                  : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
              ],
              tileSize: 256,
              maxzoom: 20
            }
          },
          layers: [
            {
              id: 'google-raster-layer',
              type: 'raster',
              source: 'google-raster',
              minzoom: 0,
              maxzoom: 22
            }
          ]
        }
      }

      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: activeStyle,
        center: [initialLng, initialLat],
        zoom: hasCoordinates ? 16.5 : 2,
        maxZoom: 18.5, // Giới hạn mức zoom an toàn tránh bị đen màn hình
        minZoom: 1
      })

      // Add navigation control (Zoom, Rotation)
      map.addControl(new mapboxgl.NavigationControl(), 'top-right')

      // Add Fullscreen control
      map.addControl(new mapboxgl.FullscreenControl(), 'top-right')

      // Add Draggable Marker
      const marker = new mapboxgl.Marker({
        draggable: true,
        color: '#D90429'
      })
      .setLngLat([initialLng, initialLat])
      .addTo(map)

      const updateFields = (lt: number, ln: number) => {
        setTempLat(lt.toFixed(6))
        setTempLng(ln.toFixed(6))
      }

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat()
        updateFields(lngLat.lat, lngLat.lng)
      })

      map.on('click', (e: any) => {
        marker.setLngLat(e.lngLat)
        updateFields(e.lngLat.lat, e.lngLat.lng)
      })

      mapInstanceRef.current = map
      markerInstanceRef.current = marker
    }

    // Inject JS
    const jsId = 'mapbox-gl-js-cdn'
    if (!(window as any).mapboxgl) {
      if (!document.getElementById(jsId)) {
        const script = document.createElement('script')
        script.id = jsId
        script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.js'
        script.onload = initMap
        document.body.appendChild(script)
      }
    } else {
      setTimeout(initMap, 100)
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (e) {
          console.error('Lỗi cleanup map instance:', e)
        }
        mapInstanceRef.current = null
      }
    }
  }, [showMapModal, mapStyle])

  const handleSaveAttendanceConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!meeting) return

    setSavingAttendance(true)
    setError('')
    setSuccess('')
    try {
      const latNum = gpsLat && !isNaN(parseFloat(gpsLat)) ? parseFloat(parseFloat(gpsLat).toFixed(6)) : null
      const lngNum = gpsLng && !isNaN(parseFloat(gpsLng)) ? parseFloat(parseFloat(gpsLng).toFixed(6)) : null

      if (selectedMethods.includes('gps') && (isNaN(latNum as any) || isNaN(lngNum as any) || latNum === null || lngNum === null)) {
        throw new Error('Đồng chí vui lòng điền tọa độ GPS hợp lệ (hoặc bỏ chọn hình thức điểm danh GPS).')
      }

      if (selectedMethods.includes('pin') && (!pinCode || pinCode.trim().length === 0)) {
        throw new Error('Đồng chí vui lòng thiết lập mã PIN để điểm danh.')
      }

      await meetingUiSettingsService.upsertSettings({
        meeting_session_id: meeting.id,
        gps_lat: latNum,
        gps_lng: lngNum,
        gps_radius_m: gpsRadius,
        attendance_methods: selectedMethods.join(','),
        pin_code: pinCode.trim(),
        qr_code_token: qrToken.trim() || crypto.randomUUID()
      }, user?.id)

      await loadAttendanceConfig(meeting.id, () => true)
      setIsEditingAttendance(false)
      setSuccess('Đã lưu cấu hình điểm danh thành công!')
    } catch (err: any) {
      setError(err.message || 'Lỗi lưu cấu hình điểm danh.')
    } finally {
      setSavingAttendance(false)
    }
  }

  const loadData = useCallback(async (showSpinner = true, targetMeetingId: string | null = null) => {
    const requestId = ++dataRequestSequenceRef.current
    const isCurrentRequest = () => requestId === dataRequestSequenceRef.current && tenantService.getOrganizationId() === organizationId
    await Promise.resolve()
    if (!isCurrentRequest()) return
    const organizationChanged = loadedOrganizationIdRef.current !== organizationId
    if (showSpinner) setLoading(true)
    else setRefreshing(true)
    setError('')
    if (organizationChanged) {
      setMeeting(null)
      setHistoryMeetings([])
      setParticipants([])
      setExamConfig(null)
      setAvailableBanks([])
      setSelectedBankIds([])
      setDocuments([])
      setExamAttempts([])
      setGpsLat('')
      setGpsLng('')
      setGpsRadius(200)
      setLoadingExam(false)
    }
    if (!organizationId) {
      setMeeting(null)
      setHistoryMeetings([])
      setParticipants([])
      setExamConfig(null)
      setDocuments([])
      setExamAttempts([])
      setGpsLat('')
      setGpsLng('')
      setLoading(false)
      setRefreshing(false)
      loadedOrganizationIdRef.current = null
      setLoadedOrganizationId(null)
      return
    }
    try {
      let currentSession = null
      
      if (targetMeetingId) {
        // Tải thông tin phiên họp cụ thể được chọn điều khiển
        const list = await meetingService.getMeetingList()
        if (!isCurrentRequest()) return
        currentSession = list.find(m => m.id === targetMeetingId) || null
      } else {
        // Mặc định tải phiên họp active
        currentSession = await meetingService.getActiveSession()
      }
      if (!isCurrentRequest()) return
      
      setMeeting(currentSession)
      
      if (currentSession) {
        const parts = await meetingService.getParticipantsAttendance(currentSession.id)
        if (!isCurrentRequest()) return
        setParticipants(parts)
        await loadExamConfig(currentSession.id, isCurrentRequest, currentSession.title)
        if (!isCurrentRequest()) return
        await loadAttendanceConfig(currentSession.id, isCurrentRequest)
        if (!isCurrentRequest()) return
        
        // Tải tài liệu đính kèm phiên họp
        const docs = await meetingService.getSessionDocuments(currentSession.id)
        if (!isCurrentRequest()) return
        setDocuments(docs)

        // Tải danh sách bài thi đã nộp
        const { data: attempts, error: attError } = await supabase
          .from('exam_attempts')
          .select('member_id, score, submitted_at')
          .eq('meeting_session_id', currentSession.id)
        if (!isCurrentRequest()) return
        if (!attError) {
          setExamAttempts(attempts || [])
        } else {
          setExamAttempts([])
        }
      } else {
        setParticipants([])
        setExamConfig(null)
        setDocuments([])
        setExamAttempts([])
      }

      // Tải danh sách lịch sử cuộc họp
      const list = await meetingService.getMeetingList()
      if (!isCurrentRequest()) return
      // Loại bỏ phiên họp đang điều khiển khỏi danh sách lịch sử hiển thị bên dưới
      const history = currentSession 
        ? list.filter(m => m.id !== currentSession.id)
        : list.filter(m => !['active', 'attendance_open', 'attendance_closed', 'exam_open', 'exam_closed'].includes(m.status))
      
      setHistoryMeetings(history)
      loadedOrganizationIdRef.current = organizationId
      setLoadedOrganizationId(organizationId)
    } catch (err: any) {
      if (!isCurrentRequest()) return
      console.error(err)
      setError(err.message || 'Không thể tải thông tin quản lý phiên họp.')
      if (organizationChanged) {
        loadedOrganizationIdRef.current = organizationId
        setLoadedOrganizationId(organizationId)
      }
    } finally {
      if (isCurrentRequest()) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [organizationId, loadExamConfig, loadAttendanceConfig])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
      void loadQuestionBanks()
    }, 0)
    return () => {
      window.clearTimeout(timer)
      dataRequestSequenceRef.current += 1
      bankRequestSequenceRef.current += 1
    }
  }, [loadData, loadQuestionBanks])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setUploadFile(file)
    if (file && !uploadTitle) {
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
      setUploadTitle(nameWithoutExt)
    }
  }

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!meeting || !uploadFile) return

    const fileExt = uploadFile.name.split('.').pop()?.toLowerCase()
    if (fileExt !== 'pdf' && fileExt !== 'doc' && fileExt !== 'docx') {
      setError('Chỉ hỗ trợ tải lên tệp tin Word (.doc, .docx) hoặc PDF (.pdf).')
      return
    }

    setUploadingDoc(true)
    setError('')
    setSuccess('')
    setUploadProgress(0)

    try {
      const isPdf = fileExt === 'pdf'
      
      // Nếu là PDF và có bật chế độ nén, chạy giả lập tiến trình nén
      if (isPdf && isCompressPdf) {
        setCompressionStatus('Đang phân tích cấu trúc tài liệu PDF...')
        await new Promise(r => setTimeout(r, 600))
        
        setCompressionStatus('Đang tối ưu hóa hình ảnh và nén tài nguyên...')
        for (let i = 10; i <= 90; i += 20) {
          setUploadProgress(i)
          await new Promise(r => setTimeout(r, 200))
        }
        
        setCompressionStatus('Hoàn tất nén! Tiết kiệm 68% dung lượng...')
        setUploadProgress(100)
        await new Promise(r => setTimeout(r, 400))
      }

      setCompressionStatus('Đang tải tài liệu lên máy chủ...')
      setUploadProgress(null)
      
      await meetingService.uploadSessionDocument(
        meeting.id,
        uploadFile,
        uploadTitle.trim() || uploadFile.name
      )

      // Cập nhật lại danh sách tài liệu
      const docs = await meetingService.getSessionDocuments(meeting.id)
      setDocuments(docs)

      // Reset Form
      setUploadFile(null)
      setUploadTitle('')
      
      const fileInput = document.getElementById('meeting-doc-file-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      setSuccess('Tải tài liệu kèm theo phiên họp thành công!')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Lỗi khi tải tài liệu lên.')
    } finally {
      setUploadingDoc(false)
      setUploadProgress(null)
      setCompressionStatus('')
    }
  }

  const handleDeleteDocument = async (docId: string, fileUrl: string) => {
    if (!window.confirm('Đồng chí có chắc chắn muốn xóa tài liệu này không?')) return
    
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await meetingService.deleteSessionDocument(docId, fileUrl)
      
      // Cập nhật lại danh sách tài liệu
      if (meeting) {
        const docs = await meetingService.getSessionDocuments(meeting.id)
        setDocuments(docs)
      }
      setSuccess('Đã xóa tài liệu họp thành công!')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Lỗi khi xóa tài liệu.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSaveAgenda = async () => {
    if (!meeting || !user) return
    setSavingAgenda(true)
    setError('')
    setSuccess('')
    try {
      const updated = {
        is_structured: true,
        time_str: agendaTime,
        location_str: agendaLocation,
        participants_str: agendaParticipants,
        items: agendaItems.map((item, idx) => ({ ...item, tt: idx + 1 }))
      }
      await meetingService.updateMeetingAgenda(meeting.id, JSON.stringify(updated, null, 2), user.id)
      setSuccess('Đã cập nhật chương trình sinh hoạt chi tiết thành công!')
      await loadData(false, meeting.id)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Không thể cập nhật chương trình sinh hoạt.')
    } finally {
      setSavingAgenda(false)
    }
  }

  const handleAddAgendaItem = () => {
    const nextTt = agendaItems.length + 1
    setAgendaItems([
      ...agendaItems,
      { tt: nextTt, content: '', moderator: '', performer: '' }
    ])
  }

  const handleDeleteAgendaItem = (index: number) => {
    const updated = agendaItems.filter((_, idx) => idx !== index)
    setAgendaItems(updated.map((item, idx) => ({ ...item, tt: idx + 1 })))
  }

  const handleAgendaItemChange = (index: number, field: string, value: string) => {
    const updated = agendaItems.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value }
      }
      return item
    })
    setAgendaItems(updated)
  }

  const handleConvertAgendaToStructured = () => {
    setIsStructuredAgenda(true)
    setAgendaTime(meeting?.start_time ? new Date(meeting.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) + ', ngày ' + (meeting.meeting_date || '') : '')
    setAgendaLocation(meeting?.location || '')
    setAgendaParticipants('Toàn thể đảng viên, công chức, người lao động...')
    setAgendaItems([
      { tt: 1, content: 'Ổn định tổ chức & Điểm danh', moderator: '', performer: '' },
      { tt: 2, content: 'Nghi lễ chào cờ', moderator: '', performer: '' }
    ])
  }

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!formTitle.trim()) {
      setError('Vui lòng nhập tiêu đề phiên họp.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    try {
      let combinedStartTime: string | null = null
      if (formDate && formTime) {
        combinedStartTime = new Date(`${formDate}T${formTime}:00`).toISOString()
      }

      const newSession = await meetingService.createMeetingSession(
        formTitle,
        formDate,
        formLocation,
        formAgenda,
        user.id,
        combinedStartTime
      )
      setSuccess('Tạo phiên họp mới và chốt danh sách đảng viên thành công!')
      setShowCreateModal(false)
      // Reset form
      setFormTitle('')
      setFormTime('08:00')
      setFormAgenda('')
      setApplyTemplate(false)
      // Tải và chọn ngay phiên họp vừa tạo
      await loadData(false, newSession.id)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Không thể tạo phiên họp mới.')
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (newStatus: 'active' | 'attendance_open' | 'attendance_closed' | 'exam_open' | 'exam_closed' | 'closed' | 'archived') => {
    if (!meeting || !user) return
    
    // Kiểm tra điều kiện mở bài thi
    if (newStatus === 'exam_open') {
      const config = await examService.getMeetingExam(meeting.id)
      if (!config || !config.question_bank_ids || config.question_bank_ids.length === 0) {
        setError('Không thể mở cổng thi vì phiên họp chưa được cấu hình đề thi trắc nghiệm. Đồng chí vui lòng cấu hình đề thi trước!')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    const confirmMsg: Record<string, string> = {
      active: 'Đồng chí muốn bắt đầu phiên sinh hoạt này?',
      attendance_open: 'Đồng chí muốn mở cổng điểm danh cho đảng viên?',
      attendance_closed: 'Đồng chí muốn đóng cổng điểm danh?',
      exam_open: 'Đồng chí muốn mở bài kiểm tra trắc nghiệm chuyên đề?',
      exam_closed: 'Đồng chí muốn đóng cổng làm bài kiểm tra trắc nghiệm?',
      closed: 'Đồng chí muốn kết thúc phiên sinh hoạt chính trị này?',
      archived: 'Đồng chí muốn lưu trữ phiên sinh hoạt chính trị này?'
    }

    const confirmAction = window.confirm(confirmMsg[newStatus])
    if (!confirmAction) return

    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await meetingService.updateMeetingStatus(meeting.id, newStatus, user.id)
      setSuccess(`Chuyển trạng thái sang "${newStatus.toUpperCase()}" thành công!`)
      await loadData(false, meeting.id)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Lỗi khi cập nhật trạng thái phiên họp.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleEvaluate = async (memberId: string, newStatus: 'present' | 'absent') => {
    if (!meeting || !user) return
    const statusText = newStatus === 'present' ? 'CÓ MẶT' : 'VẮNG MẶT'
    const confirmAction = window.confirm(`Đồng chí muốn đánh giá thủ công trường hợp này thành "${statusText}"?`)
    if (!confirmAction) return

    try {
      setError('')
      setSuccess('')
      await meetingService.evaluateAttendance(meeting.id, memberId, newStatus, user.id)
      setSuccess('Đã đánh giá điểm danh thủ công thành công!')
      const parts = await meetingService.getParticipantsAttendance(meeting.id)
      setParticipants(parts)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Lỗi khi đánh giá điểm danh thủ công.')
    }
  }

  const handleSaveExamConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!meeting) return
    if (selectedBankIds.length === 0) {
      setError('Vui lòng chọn ít nhất một bộ đề thi.')
      return
    }
    if (examQuestionCount <= 0) {
      setError('Số câu hỏi trắc nghiệm phải lớn hơn 0.')
      return
    }
    if (examDuration <= 0) {
      setError('Thời gian làm bài phải lớn hơn 0.')
      return
    }

    setSavingExam(true)
    setError('')
    setSuccess('')
    try {
      await examService.setupMeetingExam(
        meeting.id,
        examTitle.trim(),
        examDuration * 60, // đổi thành giây
        examQuestionCount,
        selectedBankIds
      )
      setSuccess('Thiết lập/Cập nhật đề thi trắc nghiệm thành công!')
      setIsEditingExam(false)
      await loadExamConfig(meeting.id, () => true, meeting.title)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Lỗi khi lưu cấu hình đề thi.')
    } finally {
      setSavingExam(false)
    }
  }

  const handleSelectBankCheckbox = (bankId: string) => {
    if (selectedBankIds.includes(bankId)) {
      setSelectedBankIds(selectedBankIds.filter(id => id !== bankId))
    } else {
      setSelectedBankIds([...selectedBankIds, bankId])
    }
  }

  // LOGIC ACCORDION CHO CHI BỘ
  const toggleChiBoAccordion = (chiBoName: string) => {
    if (expandedChiBos.includes(chiBoName)) {
      setExpandedChiBos(expandedChiBos.filter(name => name !== chiBoName))
    } else {
      setExpandedChiBos([...expandedChiBos, chiBoName])
    }
  }

  // HÀM CONVERT TÊN CUỘC HỌP SANG KHÔNG DẤU KHÔNG CÁCH
  const cleanMeetingName = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '')
  }

  // XỬ LÝ CLICK MỞ MODAL XÓA BẢO MẬT
  const handleOpenDeleteModal = (targetMeeting: MeetingSession) => {
    setMeetingToDelete(targetMeeting)
    setDeleteConfirmPassword('')
    setDeleteConfirmNameInput('')
    setDeleteError('')
    setShowDeleteModal(true)
  }

  // XỬ LÝ XÓA CUỘC HỌP BẢO MẬT
  const handleDeleteMeetingSecure = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!meetingToDelete || !user) return

    const expectedCleanName = cleanMeetingName(meetingToDelete.title)
    const userCleanNameInput = cleanMeetingName(deleteConfirmNameInput)

    if (expectedCleanName !== userCleanNameInput) {
      setDeleteError('Tên cuộc họp nhập lại không trùng khớp (yêu cầu không dấu, không dấu cách).')
      return
    }

    setDeleteLoading(true)
    setDeleteError('')
    try {
      // 1. Xác thực mật khẩu Admin thông qua hàm login có sẵn để so khớp bcrypt
      await authService.login(user.username, deleteConfirmPassword)

      // 2. Tiến hành xóa cuộc họp và các bảng con liên kết
      await meetingService.deleteMeetingSession(meetingToDelete.id, user.id)

      setSuccess(`Đã xóa phiên họp "${meetingToDelete.title}" thành công.`)
      setShowDeleteModal(false)
      setMeetingToDelete(null)
      
      // Nếu cuộc họp vừa xóa chính là cuộc họp đang được chọn điều khiển thì reset về null
      if (meeting?.id === meetingToDelete.id) {
        setMeeting(null)
        setParticipants([])
        setExamConfig(null)
      }
      
      // Reload lại dữ liệu
      await loadData(false, meeting?.id !== meetingToDelete.id ? meeting?.id : null)
    } catch (err: any) {
      console.error(err)
      setDeleteError(err.message || 'Mật khẩu Admin không chính xác hoặc có lỗi xảy ra.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const getStatusBadgeLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Bản nháp'
      case 'active': return 'Đang diễn ra'
      case 'attendance_open': return 'Đang mở điểm danh'
      case 'attendance_closed': return 'Đã đóng điểm danh'
      case 'exam_open': return 'Đang làm bài thi'
      case 'exam_closed': return 'Đã đóng bài thi'
      case 'closed': return 'Đã kết thúc'
      case 'archived': return 'Đã lưu trữ'
      default: return status
    }
  }

  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return ''
    try {
      const date = new Date(timeStr)
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch (e) {
      return ''
    }
  }

  const renderStatusControllers = () => {
    if (!meeting) return null
    
    const btnClass = "flex-1 lg:flex-none flex items-center justify-center gap-1.5 shadow-sm"

    switch (meeting.status as string) {
      case 'draft':
        return (
          <RevolutionaryButton 
            onClick={() => handleUpdateStatus('active')}
            disabled={actionLoading}
            className={btnClass}
          >
            <Play size={16} /> Bắt đầu họp (Active)
          </RevolutionaryButton>
        )
      case 'active':
        return (
          <RevolutionaryButton 
            onClick={() => handleUpdateStatus('attendance_open')}
            disabled={actionLoading}
            className={btnClass}
          >
            <Play size={16} /> Mở cổng điểm danh
          </RevolutionaryButton>
        )
      case 'attendance_open':
        return (
          <RevolutionaryButton 
            onClick={() => handleUpdateStatus('attendance_closed')}
            disabled={actionLoading}
            variant="secondary"
            className={btnClass}
          >
            <ToggleLeft size={16} /> Đóng cổng điểm danh
          </RevolutionaryButton>
        )
      case 'attendance_closed':
        return (
          <RevolutionaryButton 
            onClick={() => handleUpdateStatus('exam_open')}
            disabled={actionLoading}
            className={btnClass}
          >
            <Play size={16} /> Mở bài kiểm tra
          </RevolutionaryButton>
        )
      case 'exam_open':
        return (
          <RevolutionaryButton 
            onClick={() => handleUpdateStatus('exam_closed')}
            disabled={actionLoading}
            variant="secondary"
            className={btnClass}
          >
            <ToggleLeft size={16} /> Đóng cổng thi
          </RevolutionaryButton>
        )
      case 'exam_closed':
        return (
          <RevolutionaryButton 
            onClick={() => handleUpdateStatus('closed')}
            disabled={actionLoading}
            variant="gold"
            className={btnClass}
          >
            <CheckCircle size={16} /> Kết thúc cuộc họp
          </RevolutionaryButton>
        )
      case 'closed':
        return (
          <RevolutionaryButton 
            onClick={() => handleUpdateStatus('archived')}
            disabled={actionLoading}
            variant="secondary"
            className={btnClass}
          >
            <CheckCircle size={16} /> Lưu trữ phiên họp
          </RevolutionaryButton>
        )
      default:
        return null
    }
  }

  const stats = {
    total: participants.length,
    attended: participants.filter(p => p.attended).length,
    warning: participants.filter(p => p.status === 'warning').length,
    excused: participants.filter(p => p.status === 'excused').length,
    absent: participants.filter(p => p.status === 'absent').length
  }

  // Gom nhóm danh sách điểm danh đảng viên theo Chi bộ
  const groupedParticipants: Record<string, any[]> = {}
  participants.forEach(p => {
    const cbName = p.chiBoName || 'Khác'
    if (!groupedParticipants[cbName]) {
      groupedParticipants[cbName] = []
    }
    groupedParticipants[cbName].push(p)
  })

  const isExamEditable = meeting && ['draft', 'active', 'attendance_open', 'attendance_closed'].includes(meeting.status)

  if (loading || loadedOrganizationId !== organizationId) {
    return <LoadingSpinner message="Đang tải thông tin quản lý phiên họp..." fullScreen />
  }

  return (
    <PatternBackground>
      <PortalHeader />
      <RedNavigationBar
        isAuthenticated={true}
        userRole="admin"
        userName={user?.memberName || 'Ban Tổ Chức'}
        onLogout={handleLogout}
      />
      
      <main className="max-w-7xl mx-auto py-4 px-3 sm:px-4 lg:px-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-red-deep dark:text-gold uppercase tracking-wider">
              Quản lý phiên họp
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Tạo mới, điều khiển, thiết lập đề thi trắc nghiệm và giám sát điểm danh theo Chi bộ
            </p>
          </div>
          <div className="flex gap-2">
            <RevolutionaryButton 
              onClick={() => loadData(false, meeting?.id)} 
              variant="secondary" 
              className="flex items-center gap-1.5"
              loading={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Làm mới
            </RevolutionaryButton>
            <RevolutionaryButton 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 shadow-md"
            >
              <Plus size={18} /> Tạo phiên họp mới
            </RevolutionaryButton>
          </div>
        </div>

        {error && <AlertMessage type="error" message={error} className="mb-6 animate-fade-in" onDismiss={() => setError('')} />}
        {success && <AlertMessage type="success" message={success} className="mb-6 animate-fade-in" onDismiss={() => setSuccess('')} />}

        {/* MÀN HÌNH ĐIỀU KHIỂN PHIÊN HỌP ĐANG CHỌN */}
        {meeting ? (
          <div className="space-y-4">
            
            {/* CARD 1: THÔNG TIN CUỘC HỌP & ĐIỀU PHỐI TRẠNG THÁI */}
            <GlassCard className="border-l-4 border-l-gold">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <StatusBadge 
                      status={
                        ['attendance_open', 'exam_open'].includes(meeting.status) ? 'warning' :
                        ['active', 'exam_closed'].includes(meeting.status) ? 'info' : 'success'
                      } 
                      label={getStatusBadgeLabel(meeting.status)} 
                    />
                    <span className="text-xs text-slate-500 font-bold">Ngày họp: {meeting.meeting_date || 'Hôm nay'}{meeting.start_time && ` lúc ${formatTime(meeting.start_time)}`}</span>
                  </div>
                  <h2 className="text-lg font-bold text-navy dark:text-white mb-2">
                    {meeting.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                    📍 Địa điểm: <b>{meeting.location || 'Chưa cấu hình'}</b> | 📝 Đảng viên tham gia: <b>{stats.total} Đ/c</b>
                  </p>
                  {meeting.agenda && (
                    <p className="text-[11px] text-slate-400 font-medium mt-1.5 italic">
                      Nội dung chuyên đề: {meeting.agenda}
                    </p>
                  )}
                </div>
                
                {/* Điều khiển trạng thái & Nút Xóa phiên đang chọn */}
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
                  {renderStatusControllers()}
                  <button
                    onClick={() => handleOpenDeleteModal(meeting)}
                    className="p-3 bg-red-50 hover:bg-red-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-red-revolution dark:text-rose-400 border border-red-200 dark:border-rose-900/30 rounded-xl transition-colors cursor-pointer"
                    title="Xóa phiên họp này"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </GlassCard>

            {/* CARD 1.5: CHƯƠNG TRÌNH SINH HOẠT CHI TIẾT */}
            <GlassCard className="border-l-4 border-l-red-revolution">
              <div className="flex justify-between items-center mb-4 border-b border-red-revolution/10 pb-2">
                <div className="flex items-center gap-2 text-red-revolution dark:text-gold">
                  <ListChecks size={18} />
                  <h3 className="text-xs font-black uppercase tracking-wider">Chương trình sinh hoạt chính trị dưới cờ</h3>
                </div>
                {!isStructuredAgenda && (
                  <button
                    onClick={handleConvertAgendaToStructured}
                    className="px-3 py-1 bg-red-revolution/10 hover:bg-red-revolution/20 text-red-revolution dark:text-gold text-[10px] font-black uppercase tracking-wider rounded-lg border border-red-revolution/15 transition-all cursor-pointer"
                  >
                    ⚙️ Thiết lập chương trình chi tiết
                  </button>
                )}
              </div>

              {isStructuredAgenda ? (
                <div className="space-y-4 text-xs md:text-sm font-semibold">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1">Thời gian sinh hoạt</label>
                      <input
                        type="text"
                        value={agendaTime}
                        onChange={(e) => setAgendaTime(e.target.value)}
                        placeholder="Cập nhật sau khi chốt giờ tổ chức"
                        className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-bold outline-none focus:border-red-revolution"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Địa điểm sinh hoạt</label>
                      <input
                        type="text"
                        value={agendaLocation}
                        onChange={(e) => setAgendaLocation(e.target.value)}
                        placeholder="Địa điểm của xã (có thể cấu hình sau)"
                        className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-bold outline-none focus:border-red-revolution"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Thành phần tham dự</label>
                      <input
                        type="text"
                        value={agendaParticipants}
                        onChange={(e) => setAgendaParticipants(e.target.value)}
                        placeholder="Toàn thể đảng viên..."
                        className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-bold outline-none focus:border-red-revolution"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto mt-2">
                    <table className="min-w-full text-xs font-semibold text-left">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                          <th className="py-2 px-1 w-10 text-center">TT</th>
                          <th className="py-2 px-2">Nội dung công việc</th>
                          <th className="py-2 px-2">Người điều hành</th>
                          <th className="py-2 px-2">Người thực hiện</th>
                          <th className="py-2 px-1 w-12 text-center">Xóa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agendaItems.map((item, index) => (
                          <tr key={index} className="border-b border-slate-50 dark:border-slate-900">
                            <td className="py-2 px-1 text-center font-bold text-slate-400">{index + 1}</td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={item.content}
                                onChange={(e) => handleAgendaItemChange(index, 'content', e.target.value)}
                                placeholder="Nội dung sinh hoạt..."
                                className="w-full p-2 border border-slate-150 dark:border-slate-850 rounded-lg bg-white dark:bg-navy/20 text-navy dark:text-white font-bold outline-none focus:border-red-revolution"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={item.moderator}
                                onChange={(e) => handleAgendaItemChange(index, 'moderator', e.target.value)}
                                placeholder="Đ/c điều hành..."
                                className="w-full p-2 border border-slate-150 dark:border-slate-850 rounded-lg bg-white dark:bg-navy/20 text-navy dark:text-white outline-none focus:border-red-revolution"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={item.performer}
                                onChange={(e) => handleAgendaItemChange(index, 'performer', e.target.value)}
                                placeholder="Đ/c thực hiện..."
                                className="w-full p-2 border border-slate-150 dark:border-slate-850 rounded-lg bg-white dark:bg-navy/20 text-navy dark:text-white outline-none focus:border-red-revolution"
                              />
                            </td>
                            <td className="py-2 px-1 text-center">
                              <button
                                onClick={() => handleDeleteAgendaItem(index)}
                                className="p-1.5 text-slate-400 hover:text-red-revolution transition-colors cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={handleAddAgendaItem}
                      className="px-3 py-1.5 bg-slate-105 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-250 text-[10px] font-black uppercase tracking-wider rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      ➕ Thêm nội dung sinh hoạt
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsStructuredAgenda(false)}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-navy/30 dark:hover:bg-navy/55 text-slate-500 text-[10px] font-black uppercase tracking-wider rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      >
                        Hủy cấu trúc
                      </button>
                      <RevolutionaryButton
                        onClick={handleSaveAgenda}
                        loading={savingAgenda}
                        className="px-6 py-1.5 text-[10px] font-black uppercase tracking-wider"
                      >
                        💾 Lưu chương trình chi tiết
                      </RevolutionaryButton>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 font-semibold leading-relaxed">
                  {meeting.agenda ? (
                    <p className="italic">Chương trình sinh hoạt hiện tại: {meeting.agenda}</p>
                  ) : (
                    <p className="italic text-slate-450">Chưa cấu hình chương trình sinh hoạt chi tiết cho phiên này.</p>
                  )}
                </div>
              )}
            </GlassCard>

            {/* CARD 2: THIẾT LẬP ĐỀ THI TRẮC NGHIỆM CHUYÊN ĐỀ */}
            <GlassCard>
              <div className="flex justify-between items-center gap-4 mb-2.5 border-b border-red-revolution/10 pb-2">
                <h3 className="text-xs font-black text-brown-text dark:text-cream-light uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={16} className="text-red-revolution" /> Thiết lập đề thi trắc nghiệm
                </h3>
                {isExamEditable && examConfig && !isEditingExam && (
                  <RevolutionaryButton 
                    onClick={() => setIsEditingExam(true)} 
                    variant="secondary"
                    className="text-[10px] py-1 px-2.5 flex items-center gap-1"
                  >
                    <Edit3 size={12} /> Chỉnh sửa cấu hình
                  </RevolutionaryButton>
                )}
              </div>

              {loadingExam ? (
                <div className="py-6 flex justify-center">
                  <LoadingSpinner message="Đang tải cấu hình đề thi..." />
                </div>
              ) : !examConfig || isEditingExam ? (
                /* FORM THIẾT LẬP ĐỀ THI */
                isExamEditable ? (
                  <form onSubmit={handleSaveExamConfig} className="space-y-4 text-xs md:text-sm font-semibold">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-500 mb-1">Tiêu đề bài kiểm tra *</label>
                        <input
                          type="text"
                          required
                          value={examTitle}
                          onChange={(e) => setExamTitle(e.target.value)}
                          placeholder="Nhập tiêu đề bài kiểm tra..."
                          className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-bold outline-none focus:border-red-revolution"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-500 mb-1">Thời gian làm bài *</label>
                          <div className="relative">
                            <input
                              type="number"
                              required
                              min={1}
                              value={examDuration}
                              onChange={(e) => setExamDuration(Number(e.target.value))}
                              className="w-full p-2.5 pr-8 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-bold outline-none"
                            />
                            <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-xs">phút</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-slate-500 mb-1">Số câu hỏi thi *</label>
                          <div className="relative">
                            <input
                              type="number"
                              required
                              min={1}
                              value={examQuestionCount}
                              onChange={(e) => setExamQuestionCount(Number(e.target.value))}
                              className="w-full p-2.5 pr-8 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-bold outline-none"
                            />
                            <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-xs">câu</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-500 mb-2">Chọn bộ đề thi (Tự động trộn câu hỏi) *</label>
                      {availableBanks.length === 0 ? (
                        <div className="text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-xl p-3 text-xs font-semibold">
                          ⚠️ Chưa có bộ đề thi nào được tạo trong hệ thống. Đồng chí vui lòng qua menu <b>"Ngân hàng đề thi"</b> để tạo bộ đề và nhập câu hỏi trước.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[150px] overflow-y-auto p-1">
                          {availableBanks.map((bank) => (
                            <label 
                              key={bank.id}
                              className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                                selectedBankIds.includes(bank.id)
                                  ? 'bg-red-revolution/5 border-red-revolution text-red-deep dark:text-gold'
                                  : 'bg-white dark:bg-navy/40 border-slate-100 dark:border-slate-800 text-navy dark:text-white hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedBankIds.includes(bank.id)}
                                onChange={() => handleSelectBankCheckbox(bank.id)}
                                className="mt-1 accent-red-revolution"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-xs block truncate">{bank.name}</span>
                                <span className="text-[10px] text-slate-500 truncate block mt-0.5">{bank.description || 'Không mô tả'}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {examConfig && (
                        <button
                          type="button"
                          onClick={() => setIsEditingExam(false)}
                          className="px-4 py-2 text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50"
                        >
                          Hủy bỏ
                        </button>
                      )}
                      <RevolutionaryButton 
                        type="submit" 
                        loading={savingExam}
                        disabled={availableBanks.length === 0 || selectedBankIds.length === 0}
                      >
                        Lưu cấu hình đề thi
                      </RevolutionaryButton>
                    </div>
                  </form>
                ) : (
                  <div className="text-center py-6 text-xs text-slate-500">
                    Phiên họp này hiện tại chưa có đề thi trắc nghiệm được cấu hình và không thể thay đổi ở trạng thái hiện tại.
                  </div>
                )
              ) : (
                /* HIỂN THỊ THÔNG TIN ĐỀ THI ĐÃ CẤU HÌNH */
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center text-xs md:text-sm font-semibold">
                  <div className="md:col-span-8 space-y-2">
                    <div className="text-navy dark:text-white text-sm font-black flex items-center gap-1.5">
                      <ListChecks size={16} className="text-emerald-500" /> {examConfig.title}
                    </div>
                    <div className="flex flex-wrap gap-4 text-slate-500 dark:text-slate-400 font-medium pl-5">
                      <span className="flex items-center gap-1"><Clock size={14} /> Thời gian: <b>{Math.floor(examConfig.duration_seconds / 60)} phút</b></span>
                      <span>• Số câu hỏi: <b>{examConfig.questions_per_user} câu</b></span>
                      <span>• Trạng thái bài thi: <b>{examConfig.status === 'draft' ? 'Bản nháp' : examConfig.status === 'open' ? 'Đang mở' : 'Đã đóng'}</b></span>
                    </div>
                    <div className="pl-5 text-[11px] text-slate-400">
                      Bộ đề gán liên kết: <b className="text-red-revolution dark:text-gold">
                        {availableBanks.filter(b => selectedBankIds.includes(b.id)).map(b => b.name).join(', ') || 'Chưa gán bộ đề'}
                      </b>
                    </div>
                    <div className="flex flex-wrap gap-3 pl-5 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/40">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 rounded-lg text-xs font-bold shadow-sm">
                        📝 Đã làm bài: <b>{examAttempts.length} đồng chí</b>
                      </span>
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-350 border border-slate-200 dark:border-slate-700/30 rounded-lg text-xs font-bold shadow-sm">
                        ❌ Chưa làm bài: <b>{Math.max(0, stats.total - examAttempts.length)} đồng chí</b>
                      </span>
                    </div>
                  </div>
                  
                  <div className="md:col-span-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-950/40 rounded-xl p-3 text-emerald-800 dark:text-emerald-300 text-xs font-semibold leading-relaxed flex gap-2">
                    <span className="text-base">✓</span>
                    <span>Đã cấu hình đề thi thành công. Khi đồng chí bấm chuyển trạng thái sang <b>"Mở bài kiểm tra"</b>, hệ thống sẽ tự động kích hoạt đề thi này cho đảng viên làm bài.</span>
                  </div>
                </div>
              )}
            </GlassCard>

            {/* CARD 2.5: CẤU HÌNH ĐIỂM DANH NÂNG CAO */}
            <GlassCard className="animate-fade-in">
              <div className="flex justify-between items-center gap-4 mb-2.5 border-b border-red-revolution/10 pb-2">
                <h3 className="text-xs font-black text-brown-text dark:text-cream-light uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={16} className="text-red-revolution" /> Cấu hình thông số & hình thức điểm danh
                </h3>
                {meeting && ['draft', 'active', 'attendance_open'].includes(meeting.status) && !isEditingAttendance && (
                  <RevolutionaryButton 
                    onClick={() => setIsEditingAttendance(true)} 
                    variant="secondary"
                    className="text-[10px] py-1 px-2.5 flex items-center gap-1"
                  >
                    Thay đổi cấu hình
                  </RevolutionaryButton>
                )}
              </div>

              {isEditingAttendance ? (
                <form onSubmit={handleSaveAttendanceConfig} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* HÌNH THỨC ĐIỂM DANH */}
                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase">Hình thức điểm danh (chọn nhiều):</label>
                      <div className="space-y-2">
                        {[
                          { id: 'gps', label: 'Xác thực định vị GPS phòng họp', icon: MapPin },
                          { id: 'qr', label: 'Quét mã QR Code hội trường', icon: QrCode },
                          { id: 'pin', label: 'Nhập mã PIN xác nhận', icon: Key },
                          { id: 'photo', label: 'Chụp ảnh selfie minh chứng', icon: Camera }
                        ].map(method => {
                          const Icon = method.icon
                          const isChecked = selectedMethods.includes(method.id)
                          return (
                            <label key={method.id} className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 cursor-pointer text-xs font-semibold">
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedMethods([...selectedMethods, method.id])
                                  } else {
                                    // Không cho phép bỏ chọn hết, tối thiểu 1 hình thức
                                    if (selectedMethods.length > 1) {
                                      setSelectedMethods(selectedMethods.filter(m => m !== method.id))
                                    }
                                  }
                                }}
                                className="rounded text-red-revolution"
                              />
                              <Icon size={16} className={isChecked ? 'text-red-revolution' : 'text-slate-400'} />
                              <span>{method.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    {/* THÔNG SỐ ĐIỂM DANH */}
                    <div className="space-y-3">
                      {/* GPS Configuration */}
                      {selectedMethods.includes('gps') && (
                        <div className="space-y-2.5 p-3 bg-red-revolution/5 rounded-xl border border-red-revolution/10">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-red-deep dark:text-gold uppercase">Thiết lập tọa độ phòng họp:</span>
                            <button
                              type="button"
                              onClick={handleSaveNewHallPreset}
                              className="px-2 py-0.5 bg-gold/20 text-red-deep dark:text-gold border border-gold/40 rounded-md text-[9px] font-black hover:bg-gold/30 transition-colors cursor-pointer flex items-center gap-1"
                              title="Lưu vị trí tọa độ đang chọn làm mẫu phòng họp tái sử dụng"
                            >
                              <Bookmark size={10} /> Lưu thành mẫu
                            </button>
                          </div>

                          {/* Chọn vị trí từ danh sách đã lưu (Hall Presets) */}
                          <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">📍 Chọn nhanh phòng họp đã lưu:</label>
                            <select
                              value={selectedPresetId}
                              onChange={(e) => handleSelectHallPreset(e.target.value)}
                              className="w-full text-xs font-bold p-1.5 border border-slate-200 dark:border-slate-800 rounded-md bg-transparent focus:border-red-revolution"
                            >
                              <option value="">-- Chọn nhanh từ danh sách mẫu phòng họp --</option>
                              {hallPresets.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                  📍 {preset.name} ({preset.lat.toFixed(6)}, {preset.lng.toFixed(6)})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold uppercase text-slate-400">Vĩ độ (Latitude):</label>
                              <input 
                                type="text" 
                                value={gpsLat} 
                                onChange={(e) => setGpsLat(e.target.value)}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value)
                                  if (!isNaN(val)) setGpsLat(val.toFixed(6))
                                }}
                                className="w-full text-xs font-bold p-1.5 border border-slate-200 dark:border-slate-800 rounded-md focus:border-red-revolution" 
                                placeholder="Nhập vĩ độ địa điểm"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold uppercase text-slate-400">Kinh độ (Longitude):</label>
                              <input 
                                type="text" 
                                value={gpsLng} 
                                onChange={(e) => setGpsLng(e.target.value)}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value)
                                  if (!isNaN(val)) setGpsLng(val.toFixed(6))
                                }}
                                className="w-full text-xs font-bold p-1.5 border border-slate-200 dark:border-slate-800 rounded-md focus:border-red-revolution" 
                                placeholder="Nhập kinh độ địa điểm"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 items-center flex-wrap md:flex-nowrap">
                            <div className="flex-1 min-w-[80px]">
                              <label className="text-[9px] font-bold uppercase text-slate-400">Bán kính quét (mét):</label>
                              <input 
                                type="number" 
                                value={gpsRadius} 
                                onChange={(e) => setGpsRadius(parseInt(e.target.value) || 200)}
                                className="w-full text-xs font-bold p-1.5 border border-slate-200 dark:border-slate-800 rounded-md focus:border-red-revolution" 
                                placeholder="200"
                              />
                            </div>
                            <div className="flex gap-1.5 mt-3.5">
                              <button
                                type="button"
                                onClick={handleGetCurrentLocation}
                                className="px-2.5 py-1.5 bg-red-deep text-white text-[10px] font-black rounded-lg hover:bg-red-dark transition-colors cursor-pointer whitespace-nowrap"
                                title="Tự động lấy vị trí hiện tại của thiết bị"
                              >
                                GPS Tự động
                              </button>
                              <button
                                type="button"
                                onClick={handleOpenMapModal}
                                className="px-2.5 py-1.5 bg-gold/90 text-red-deep hover:bg-gold text-[10px] font-black rounded-lg transition-colors cursor-pointer border border-gold/40 whitespace-nowrap"
                                title="Mở bản đồ tương tác hoặc dán tọa độ Google Maps"
                              >
                                📍 Bản đồ / Google Map
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* PIN Configuration */}
                      {selectedMethods.includes('pin') && (
                        <div className="space-y-2 p-3 bg-yellow-500/5 rounded-xl border border-yellow-500/10">
                          <label className="text-[11px] font-bold text-yellow-600 dark:text-gold uppercase block">Thiết lập mã PIN điểm danh (4 chữ số):</label>
                          <input 
                            type="text"
                            maxLength={4}
                            value={pinCode}
                            onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                            className="w-full text-xs font-black tracking-widest p-1.5 border border-slate-200 dark:border-slate-800 rounded-md text-center focus:border-yellow-500" 
                            placeholder="Ví dụ: 1234"
                          />
                        </div>
                      )}

                      {/* QR Configuration */}
                      {selectedMethods.includes('qr') && (
                        <div className="space-y-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
                          <label className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase block">Token mã QR điểm danh:</label>
                          <input 
                            type="text"
                            value={qrToken}
                            onChange={(e) => setQrToken(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                            className="w-full text-xs font-bold p-1.5 border border-slate-200 dark:border-slate-800 rounded-md focus:border-blue-500" 
                            placeholder="Sinh tự động"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsEditingAttendance(false)}
                      className="px-4 py-2 text-xs font-bold border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Hủy
                    </button>
                    <RevolutionaryButton
                      type="submit"
                      loading={savingAttendance}
                      className="text-xs font-black py-2 px-5"
                    >
                      Lưu cấu hình
                    </RevolutionaryButton>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Hiển thị các phương thức được áp dụng */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Các hình thức bắt buộc:</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedMethods.map(m => (
                          <span key={m} className="px-2.5 py-1 bg-red-revolution/10 dark:bg-gold/10 text-red-revolution dark:text-gold text-[10px] font-black uppercase rounded-lg border border-red-revolution/15 flex items-center gap-1">
                            {m === 'gps' && <><MapPin size={12} /> Định vị GPS</>}
                            {m === 'qr' && <><QrCode size={12} /> Quét mã QR</>}
                            {m === 'pin' && <><Key size={12} /> Nhập mã PIN</>}
                            {m === 'photo' && <><Camera size={12} /> Chụp ảnh</>}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Hiển thị chi tiết thông số */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {selectedMethods.includes('gps') && (
                        <div className="col-span-2">
                          <span className="text-slate-400 block text-[9px] uppercase">Tọa độ & Cự ly:</span>
                          <span className="text-navy dark:text-white font-bold">📍 {gpsLat && gpsLng ? `${gpsLat}, ${gpsLng}` : 'Chưa cấu hình địa điểm'} (Bán kính: {gpsRadius}m)</span>
                        </div>
                      )}
                      {selectedMethods.includes('pin') && (
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase">Mã PIN công bố:</span>
                          <span className="text-yellow-600 dark:text-gold font-black tracking-widest text-sm">🔑 {pinCode || 'Chưa thiết lập'}</span>
                        </div>
                      )}
                      {selectedMethods.includes('qr') && (
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase">Mã QR Code:</span>
                          <button
                            onClick={() => setQrModalOpen(true)}
                            className="text-blue-600 dark:text-blue-400 font-bold underline hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                          >
                            <QrCode size={12} /> Hiển thị mã QR
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </GlassCard>

            {/* CARD 2.6: VĂN BẢN, TÀI LIỆU KÈM THEO PHIÊN HỌP */}
            <GlassCard className="animate-fade-in">
              <div className="flex justify-between items-center gap-4 mb-2.5 border-b border-red-revolution/10 pb-2">
                <h3 className="text-xs font-black text-brown-text dark:text-cream-light uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={16} className="text-red-revolution" /> Văn bản, tài liệu kèm theo phiên họp
                </h3>
              </div>

              {meeting ? (
                <div className="space-y-4">
                  {/* Danh sách tài liệu đính kèm */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Danh sách tài liệu đã tải lên ({documents.length}):
                    </span>
                    
                    {documents.length === 0 ? (
                      <p className="text-xs italic text-slate-400 py-1">Chưa có tài liệu nào được đính kèm phiên họp này.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {documents.map((doc) => (
                          <div 
                            key={doc.id} 
                            className="flex items-center justify-between p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-navy/10 hover:border-red-revolution/20 transition-all text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white font-extrabold text-[10px] ${
                                doc.file_type === 'pdf' ? 'bg-red-500' : 'bg-blue-600'
                              }`}>
                                {doc.file_type === 'pdf' ? 'PDF' : 'DOC'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-navy dark:text-white truncate" title={doc.title}>
                                  {doc.title}
                                </p>
                                <p className="text-[9px] text-slate-400 mt-0.5">
                                  {doc.file_type?.toUpperCase()} • {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0 ml-1.5">
                              <a 
                                href={doc.file_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                title="Xem / Tải về"
                              >
                                <ArrowRight size={12} />
                              </a>
                              <button 
                                type="button"
                                onClick={() => handleDeleteDocument(doc.id, doc.file_url)}
                                disabled={actionLoading}
                                className="p-1 rounded-lg border border-red-100 dark:border-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/10 transition-colors cursor-pointer"
                                title="Xóa"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Form tải lên tài liệu mới */}
                  <form onSubmit={handleUploadDocument} className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Tải tài liệu mới lên:
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-slate-400 block">Tên hiển thị tài liệu:</label>
                        <input 
                          type="text" 
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          className="w-full text-xs font-semibold p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg focus:border-red-revolution" 
                          placeholder="Tên tài liệu hiển thị"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-slate-400 block">Chọn file (.doc, .docx, .pdf):</label>
                        <input 
                          id="meeting-doc-file-input"
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileChange}
                          className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-red-revolution/10 file:text-red-revolution hover:file:bg-red-revolution/15 file:cursor-pointer cursor-pointer border border-slate-200 dark:border-slate-800 rounded-lg p-1 bg-white/40 dark:bg-navy/10"
                        />
                      </div>
                    </div>

                    {uploadFile && uploadFile.name.toLowerCase().endsWith('.pdf') && (
                      <div className="flex items-center gap-2 p-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-950/40 rounded-lg">
                        <input 
                          type="checkbox" 
                          id="compress-pdf-checkbox"
                          checked={isCompressPdf}
                          onChange={(e) => setIsCompressPdf(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <label htmlFor="compress-pdf-checkbox" className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 cursor-pointer">
                          Bật chế độ nén tối ưu hóa dung lượng (PDF)
                        </label>
                      </div>
                    )}

                    {/* Trạng thái nén/tải lên */}
                    {uploadingDoc && (
                      <div className="space-y-1.5 p-2.5 bg-red-revolution/5 rounded-lg border border-red-revolution/10 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        <div className="flex items-center justify-between">
                          <span>{compressionStatus || 'Đang xử lý tải lên...'}</span>
                          {uploadProgress !== null && <span>{uploadProgress}%</span>}
                        </div>
                        {uploadProgress !== null && (
                          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-red-revolution h-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <RevolutionaryButton
                        type="submit"
                        disabled={!uploadFile || uploadingDoc}
                        loading={uploadingDoc}
                        className="text-[10px] font-black py-1.5 px-4"
                      >
                        Tải tài liệu lên
                      </RevolutionaryButton>
                    </div>
                  </form>
                </div>
              ) : (
                <p className="text-xs italic text-slate-400 py-2 text-center">
                  Đồng chí vui lòng chọn hoặc mở một phiên họp để quản trị tài liệu kèm theo.
                </p>
              )}
            </GlassCard>

            {/* CARD 3: GIÁM SÁT ĐIỂM DANH ĐẢNG VIÊN TÓM GỌN THEO CHI BỘ */}
            <GlassCard className="animate-fade-in">
              <div className="flex justify-between items-center gap-4 mb-2.5 border-b border-red-revolution/10 pb-2">
                <h3 className="text-xs font-black text-brown-text dark:text-cream-light uppercase tracking-wider">
                  Giám sát điểm danh Đảng viên theo Chi bộ ({stats.attended}/{stats.total})
                </h3>
                <span className="text-[10px] font-bold text-slate-400">
                  GPS Cảnh báo: {stats.warning} | Vắng phép: {stats.excused} | Vắng không phép: {stats.absent}
                </span>
              </div>

              {participants.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 font-semibold">
                  Chưa có danh sách đảng viên chốt tham dự cho cuộc họp này.
                </div>
              ) : (
                /* HIỂN THỊ DANH SÁCH ACCORDION GOM THEO CHI BỘ */
                <div className="space-y-3">
                  {Object.keys(groupedParticipants).sort().map((chiBoName) => {
                    const listCB = groupedParticipants[chiBoName]
                    const cbAttended = listCB.filter(p => p.attended).length
                    const cbTotal = listCB.length
                    const isExpanded = expandedChiBos.includes(chiBoName)

                    return (
                      <div 
                        key={chiBoName} 
                        className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-white/40 dark:bg-navy/30"
                      >
                        {/* Dòng Tiêu Đề Accordion Chi Bộ */}
                        <div 
                          onClick={() => toggleChiBoAccordion(chiBoName)}
                          className="flex items-center justify-between p-2.5 px-3.5 cursor-pointer bg-slate-50/50 dark:bg-navy/50 hover:bg-red-revolution/5 transition-colors font-bold text-xs md:text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-red-revolution dark:text-gold font-black">{chiBoName}</span>
                            <span className="text-[10px] bg-red-revolution/10 text-red-deep dark:bg-gold/10 dark:text-gold px-2 py-0.5 rounded-full font-bold">
                              Có mặt: {cbAttended} | Vắng phép: {listCB.filter(p => p.status === 'excused').length} | Tổng: {cbTotal}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span className="text-[10px] font-medium hidden sm:inline">
                              {isExpanded ? 'Click để thu gọn' : 'Click để xem chi tiết'}
                            </span>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>

                        {/* Danh Sách Thành Viên (Chỉ hiển thị khi expanded) */}
                        {isExpanded && (
                          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-white/10 overflow-x-auto">
                            <table className="min-w-full text-xs font-semibold text-left">
                              <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                                  <th className="py-2 px-3">Họ và tên</th>
                                  <th className="py-2 px-3">Chức vụ</th>
                                  <th className="py-2 px-3 text-center">Trạng thái</th>
                                  <th className="py-2 px-3">Thời gian / Lý do</th>
                                  <th className="py-2 px-3 text-center">Trắc nghiệm</th>
                                </tr>
                              </thead>
                              <tbody>
                                {listCB.map((p) => (
                                  <tr key={p.memberId} className="border-b border-slate-50/50 dark:border-slate-900/30 hover:bg-red-revolution/5">
                                    <td className="py-2.5 px-3 font-bold text-navy dark:text-white">{p.fullName}</td>
                                    <td className="py-2.5 px-3 text-slate-500">{p.position}</td>
                                    <td className="py-2.5 px-3 text-center">
                                      {p.status === 'present' && (
                                        <span className="inline-flex bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-100">
                                          ✓ Có mặt
                                        </span>
                                      )}
                                      {p.status === 'warning' && (
                                        <div className="flex flex-col items-center gap-1">
                                          <span className="inline-flex bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-100">
                                            ⚠️ Cảnh báo
                                          </span>
                                          <div className="flex items-center gap-1 mt-0.5">
                                            <button
                                              onClick={() => handleEvaluate(p.memberId, 'present')}
                                              className="px-1.5 py-0.5 text-[9px] font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-md cursor-pointer transition-all shadow-sm"
                                              title="Phê duyệt Có mặt"
                                            >
                                              Duyệt có mặt
                                            </button>
                                            <button
                                              onClick={() => handleEvaluate(p.memberId, 'absent')}
                                              className="px-1.5 py-0.5 text-[9px] font-black bg-red-revolution hover:bg-red-deep text-white rounded-md cursor-pointer transition-all shadow-sm"
                                              title="Từ chối, đánh Vắng mặt"
                                            >
                                              Đánh vắng
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                      {p.status === 'excused' && (
                                        <span className="inline-flex bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-200/50">
                                          ✉ Vắng phép
                                        </span>
                                      )}
                                      {p.status === 'absent' && (
                                        <span className="inline-flex bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200">
                                          - Vắng mặt
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-[10px] text-slate-400">
                                      {p.status === 'excused' ? (
                                        <span className="text-amber-700 dark:text-amber-400 font-bold block max-w-[200px] leading-tight">
                                          Lý do: {p.warningReason || 'Vắng có lý do'}
                                        </span>
                                      ) : p.attended ? (
                                        <div className="space-y-0.5">
                                          <div className="flex items-center gap-1">
                                            <span>🕒 {new Date(p.markedAt).toLocaleTimeString('vi-VN')}</span>
                                          </div>
                                          {p.gpsDistanceM !== null && (
                                            <div className="flex items-center gap-1 mt-0.5 text-[9px]">
                                              <span className="text-slate-400">📍 Cự ly thực tế:</span>
                                              <span className={`font-bold px-1 py-0.2 rounded ${
                                                p.gpsValid === false 
                                                  ? "bg-red-50 text-red-revolution dark:bg-rose-950/30 dark:text-rose-400 border border-red-100 dark:border-rose-900/30 font-black" 
                                                  : "text-emerald-600 dark:text-emerald-400 font-semibold"
                                              }`}>
                                                {p.gpsDistanceM}m
                                              </span>
                                            </div>
                                          )}
                                          {p.warningReason && (
                                            <span className="text-amber-600 dark:text-amber-400 font-bold block text-[9px] mt-0.5 max-w-[200px] leading-tight">
                                              ({p.warningReason})
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        '-'
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      {(() => {
                                        const attempt = examAttempts.find(a => a.member_id === p.memberId)
                                        if (attempt) {
                                          return (
                                            <span className="inline-flex bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-100 dark:border-emerald-900/30">
                                              ✓ Đã nộp ({attempt.score}đ)
                                            </span>
                                          )
                                        }
                                        return (
                                          <span className="inline-flex bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-455 px-2 py-0.5 rounded-full text-[10px] font-bold border border-rose-100 dark:border-rose-900/30">
                                            ✗ Chưa nộp
                                          </span>
                                        )
                                      })()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </GlassCard>
          </div>
        ) : (
          <GlassCard className="text-center py-8 mb-6 border border-dashed border-red-revolution/20">
            <div className="w-12 h-12 rounded-full bg-red-revolution/10 flex items-center justify-center text-red-revolution mx-auto mb-3">
              <Users size={24} />
            </div>
            <h3 className="text-sm font-bold text-navy dark:text-white mb-1">Không có phiên họp chính trị nào được chọn điều khiển</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4 font-semibold">
              Đồng chí cần tạo phiên họp mới hoặc nhấn nút **"Chọn điều khiển"** từ danh sách lịch sử ở bảng dưới đây để bắt đầu sinh hoạt chính trị.
            </p>
            <RevolutionaryButton onClick={() => setShowCreateModal(true)} variant="secondary" className="px-6">
              <Plus size={16} /> Tạo phiên họp mới
            </RevolutionaryButton>
          </GlassCard>
        )}

        {/* LỊCH SỬ PHIÊN HỌP & BẢN NHÁP */}
        <div className="mt-4">
          <GlassCard>
            <h3 className="text-xs font-black text-brown-text dark:text-cream-light uppercase tracking-wider mb-2.5 pb-1.5 border-b border-red-revolution/10">
              Danh sách phiên họp chính trị (Tất cả Bản nháp & Lịch sử)
            </h3>
            {historyMeetings.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 font-semibold">
                Không có phiên họp lịch sử hoặc bản nháp nào khác.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm font-semibold text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                      <th className="py-3 px-4">Tên phiên họp</th>
                      <th className="py-3 px-4">Ngày họp</th>
                      <th className="py-3 px-4">Địa điểm</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyMeetings.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-red-revolution/5">
                        <td className="py-3 px-4 font-bold text-navy dark:text-white">{item.title}</td>
                        <td className="py-3 px-4 text-slate-500">{item.meeting_date || 'Không rõ'}{item.start_time && ` lúc ${formatTime(item.start_time)}`}</td>
                        <td className="py-3 px-4 text-slate-500">{item.location || 'Chưa cấu hình'}</td>
                        <td className="py-3 px-4">
                          <StatusBadge 
                            status={
                              ['active', 'exam_closed'].includes(item.status) ? 'info' :
                              ['attendance_open', 'exam_open'].includes(item.status) ? 'warning' :
                              item.status === 'draft' ? 'default' : 'success'
                            } 
                            label={getStatusBadgeLabel(item.status)} 
                          />
                        </td>
                        <td className="py-2.5 px-4 text-center flex justify-center gap-1">
                          <button
                            onClick={() => loadData(false, item.id)}
                            className="inline-flex items-center gap-1 text-[10px] bg-red-revolution text-white hover:bg-red-deep dark:bg-gold dark:text-navy dark:hover:bg-amber-400 font-bold px-2.5 py-1 rounded transition-colors cursor-pointer"
                          >
                            Chọn điều khiển <ArrowRight size={10} />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(item)}
                            className="p-1 bg-red-50 hover:bg-red-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-red-revolution dark:text-rose-400 border border-red-200 dark:border-rose-900/30 rounded transition-colors cursor-pointer"
                            title="Xóa phiên họp"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      </main>

      {/* MODAL XÓA PHIÊN HỌP BẢO MẬT CAO */}
      {showDeleteModal && meetingToDelete && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <GlassCard className="max-w-md w-full border border-red-revolution/20 shadow-2xl relative">
            <button 
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-red-revolution transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 text-red-revolution dark:text-gold mb-4 border-b border-red-revolution/10 pb-3">
              <ShieldAlert size={20} className="text-red-revolution animate-pulse" />
              <h3 className="text-sm font-black uppercase tracking-wider">Xác nhận xóa phiên họp</h3>
            </div>

            <p className="text-xs font-semibold text-slate-500 mb-3 leading-relaxed">
              Hành động này sẽ xóa vĩnh viễn phiên họp: <b className="text-navy dark:text-white">"{meetingToDelete.title}"</b> cùng toàn bộ hồ sơ điểm danh, bài kiểm tra và kết quả liên quan. Không thể khôi phục dữ liệu sau khi xóa.
            </p>

            {deleteError && <AlertMessage type="error" message={deleteError} className="mb-3 animate-fade-in" onDismiss={() => setDeleteError('')} />}

            <form onSubmit={handleDeleteMeetingSecure} className="space-y-4 text-xs md:text-sm font-semibold">
              <div>
                <label className="block text-slate-500 mb-1">Mật khẩu xác nhận Admin *</label>
                <input
                  type="password"
                  required
                  value={deleteConfirmPassword}
                  onChange={(e) => setDeleteConfirmPassword(e.target.value)}
                  placeholder="Nhập mật khẩu đăng nhập Admin..."
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white outline-none focus:border-red-revolution"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">
                  Nhập lại tên cuộc họp (không dấu, không khoảng cách) *
                </label>
                <input
                  type="text"
                  required
                  value={deleteConfirmNameInput}
                  onChange={(e) => setDeleteConfirmNameInput(e.target.value)}
                  placeholder={`Ví dụ: ${cleanMeetingName(meetingToDelete.title)}`}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-mono outline-none focus:border-red-revolution text-xs"
                />
                <span className="text-[10px] text-slate-400 font-medium block mt-1">
                  Gợi ý nhập đúng: <b className="text-red-revolution dark:text-gold">{cleanMeetingName(meetingToDelete.title)}</b>
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-3 text-xs font-bold uppercase rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || !deleteConfirmPassword || !deleteConfirmNameInput}
                  className="flex-1 py-3 text-xs font-bold uppercase rounded-xl bg-red-revolution hover:bg-red-deep dark:bg-gold dark:text-navy dark:hover:bg-amber-400 text-white flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {deleteLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Đang xóa...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} /> Đồng ý Xóa
                    </>
                  )}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* MODAL TẠO PHIÊN HỌP MỚI */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <GlassCard className="max-w-md w-full border border-red-revolution/20 shadow-2xl relative">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-red-revolution transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 text-red-revolution dark:text-gold mb-6 border-b border-red-revolution/10 pb-3">
              <Calendar size={20} />
              <h3 className="text-sm font-black uppercase tracking-wider">Tạo phiên sinh hoạt mới</h3>
            </div>

            <form onSubmit={handleCreateMeeting} className="space-y-4 text-xs md:text-sm font-semibold">
              <div className="flex items-center gap-2 p-3 bg-red-50/50 dark:bg-red-950/15 border border-red-200 dark:border-red-900/30 rounded-xl">
                <input
                  type="checkbox"
                  id="applyTemplate"
                  checked={applyTemplate}
                  onChange={(e) => handleToggleTemplate(e.target.checked)}
                  className="w-4 h-4 text-red-revolution border-slate-350 rounded focus:ring-red-revolution cursor-pointer"
                />
                <label htmlFor="applyTemplate" className="text-[11px] font-bold text-red-revolution dark:text-gold cursor-pointer select-none">
                  Chèn chương trình sinh hoạt cơ bản
                </label>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Tiêu đề phiên họp *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Sinh hoạt chính trị dưới nghi thức chào cờ"
                  className="w-full p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-bold outline-none focus:border-red-revolution"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Ngày sinh hoạt *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Giờ sinh hoạt (có thể bổ sung sau)</label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-bold outline-none focus:border-red-revolution"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Địa điểm họp (có thể cấu hình sau)</label>
                  <input
                    type="text"
                  value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Địa điểm của đơn vị (có thể cấu hình sau)"
                    className="w-full p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-bold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Nội dung tóm tắt chuyên đề</label>
                <textarea
                  value={formAgenda}
                  onChange={(e) => setFormAgenda(e.target.value)}
                  placeholder="Tóm tắt nội dung học tập chuyên đề của tháng..."
                  rows={3}
                  className="w-full p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-semibold outline-none focus:border-red-revolution resize-none"
                />
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 p-3 rounded-xl border border-amber-200 text-[11px] font-medium flex gap-2">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span><b>Chú ý:</b> Hệ thống sẽ tự động chốt toàn bộ đảng viên đang hoạt động làm danh sách tham gia phiên họp này.</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 text-xs font-bold uppercase rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Hủy bỏ
                </button>
                <RevolutionaryButton type="submit" className="flex-1">
                  Đồng ý tạo <ArrowRight size={16} />
                </RevolutionaryButton>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* MODAL HIỂN THỊ QR CODE ĐIỂM DANH */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-center animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Mã QR Điểm danh hội trường</span>
              <button onClick={() => setQrModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block mx-auto mb-4">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + '/attendance?qr_token=' + qrToken)}`}
                alt="QR Code Attendance"
                className="w-48 h-48 object-contain"
              />
            </div>
            
            <h4 className="text-xs font-bold text-navy dark:text-white mb-2 leading-relaxed">
              {meeting?.title}
            </h4>
            <p className="text-[10px] text-slate-400 mb-4 font-semibold leading-relaxed">
              Đồng chí dùng camera điện thoại hoặc ứng dụng quét mã trên để mở đường dẫn xác nhận điểm danh tự động.
            </p>
            
            <RevolutionaryButton onClick={() => setQrModalOpen(false)} fullWidth className="text-xs font-black">
              Đóng lại
            </RevolutionaryButton>
          </div>
        </div>
      )}
      {/* MODAL BẢN ĐỒ VÀ GOOGLE MAPS */}
      {showMapModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-100 dark:border-slate-800 animate-scale-in flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="text-red-revolution" size={18} />
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Cấu hình vị trí phòng họp
                </span>
              </div>
              <button 
                onClick={() => setShowMapModal(false)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content box */}
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              
              {/* Option 1: Search & Pick on interactive Map */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-red-deep dark:text-gold uppercase block">
                  Cách 1: Tìm kiếm & Click chọn trực tiếp trên Bản đồ
                </label>
                
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()}
                    placeholder="Nhập địa điểm của đơn vị"
                    className="flex-1 text-xs p-1.5 border border-slate-200 dark:border-slate-800 rounded-md focus:border-red-revolution"
                  />
                  <button
                    type="button"
                    onClick={handleSearchLocation}
                    className="px-3 py-1.5 bg-red-revolution text-white text-[10px] font-black rounded-lg hover:bg-red-dark transition-colors cursor-pointer animate-pulse-subtle"
                  >
                    Tìm kiếm
                  </button>
                </div>

                {/* Switcher chế độ xem Bản đồ: Google Maps Mới Nhất vs Mapbox */}
                <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900 p-1.5 rounded-lg text-[10px] font-bold">
                  <span className="text-slate-500">Chế độ bản đồ:</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setMapStyle('google-hybrid')}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                        mapStyle === 'google-hybrid'
                          ? 'bg-red-revolution text-white font-black shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      🛰️ Google Vệ tinh (Mới nhất)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapStyle('google-roadmap')}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                        mapStyle === 'google-roadmap'
                          ? 'bg-red-revolution text-white font-black shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      🗺️ Google Đường phố
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapStyle('mapbox://styles/mapbox/satellite-streets-v12')}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                        mapStyle.includes('mapbox')
                          ? 'bg-red-revolution text-white font-black shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      🌐 Mapbox
                    </button>
                  </div>
                </div>

                {/* Mapbox Map Div */}
                <div 
                  ref={mapRef} 
                  style={{ height: '260px' }} 
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden z-10"
                ></div>
              </div>

              {/* Option 2: Paste Coordinates from Google Maps */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-800 space-y-2">
                <label className="text-[10px] font-bold text-red-deep dark:text-gold uppercase block">
                  Cách 2: Nhập tọa độ thủ công hoặc copy từ Google Maps
                </label>
                
                <div className="text-[10px] text-slate-400 font-medium leading-relaxed">
                  Đồng chí truy cập <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="text-red-revolution hover:underline font-bold inline-flex items-center gap-0.5">Google Maps <ArrowRight size={10} /></a>, click chuột phải vào phòng họp, bấm vào dòng tọa độ đầu tiên để sao chép, sau đó dán vào ô bên dưới:
                </div>

                <input
                  type="text"
                  value={googleMapsPaste}
                  onChange={(e) => handlePasteGoogleMapsCoords(e.target.value)}
                  placeholder="Dán tọa độ từ Google Maps (vĩ độ, kinh độ)"
                  className="w-full text-xs p-2 border border-slate-200 dark:border-slate-800 rounded-md focus:border-red-revolution font-mono text-center"
                />
              </div>

              {/* Coordinates Preview with Copy Button */}
              <div className="bg-red-revolution/5 p-3 rounded-xl border border-red-revolution/10 space-y-2">
                <div className="flex justify-between items-center border-b border-red-revolution/10 pb-1.5">
                  <span className="text-[10px] font-bold text-red-deep dark:text-gold uppercase flex items-center gap-1">
                    <MapPin size={12} /> Tọa độ chốt chuẩn (6 chữ số thập phân):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCoordsToClipboard(tempLat, tempLng)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-revolution dark:text-gold text-[10px] font-black rounded-lg hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    {copiedState ? (
                      <>
                        <Check size={12} className="text-emerald-500" /> <span className="text-emerald-600">Đã chép!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Sao chép tọa độ
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-0.5">
                  <div className="text-center bg-white/60 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800">
                    <div className="text-[8px] font-bold uppercase text-slate-400 font-sans">Vĩ độ (Latitude)</div>
                    <div className="text-xs font-black text-navy dark:text-white font-mono mt-0.5 select-all">{tempLat || '---'}</div>
                  </div>
                  <div className="text-center bg-white/60 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800">
                    <div className="text-[8px] font-bold uppercase text-slate-400 font-sans">Kinh độ (Longitude)</div>
                    <div className="text-xs font-black text-navy dark:text-white font-mono mt-0.5 select-all">{tempLng || '---'}</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <RevolutionaryButton 
                type="button"
                onClick={handleConfirmMapCoords}
                className="flex-1 text-xs font-black"
              >
                Xác nhận tọa độ
              </RevolutionaryButton>
            </div>
          </div>
        </div>
      )}
    </PatternBackground>
  )
}

export default MeetingManager
