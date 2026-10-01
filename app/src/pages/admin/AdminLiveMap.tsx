import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Map as MapIcon, RefreshCw, Users, Copy, Check, Radio, Search, Eye } from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { meetingService } from '../../services/meetingService'
import type { MeetingSession } from '../../services/meetingService'
import { mapAttendanceService } from '../../services/mapAttendanceService'
import type { SessionMapData } from '../../types/mapAttendance'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../services/supabaseClient'
import { tenantService } from '../../services/tenantService'

interface ChiBo {
  id: string
  name: string
}

interface MapboxMapInstance {
  remove: () => void
  addControl: (control: unknown, position?: string) => void
  on: (event: string, callback: () => void) => void
  flyTo: (options: { center: [number, number]; zoom?: number; speed?: number }) => void
  jumpTo: (options: { center: [number, number]; zoom?: number }) => void
  resize: () => void
}

interface MapboxMarkerInstance {
  setLngLat: (lngLat: [number, number]) => MapboxMarkerInstance
  setPopup: (popup: unknown) => MapboxMarkerInstance
  addTo: (map: MapboxMapInstance) => MapboxMarkerInstance
  remove: () => void
}

// Escape chuỗi an toàn chống XSS khi chèn vào Mapbox Popup HTML
const escapeHtml = (unsafe: string | null | undefined): string => {
  if (!unsafe) return ''
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Helper tạo GeoJSON Polygon hình tròn chuẩn đại diện cho bán kính điểm danh (Circle Polygon)
const createGeoJSONCircle = (center: [number, number], radiusInMeters: number, points = 64) => {
  const [lng, lat] = center
  const km = radiusInMeters / 1000
  const ret: [number, number][] = []

  const distanceX = km / (111.320 * Math.cos((lat * Math.PI) / 180))
  const distanceY = km / 110.574

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI)
    const x = distanceX * Math.cos(theta)
    const y = distanceY * Math.sin(theta)
    ret.push([lng + x, lat + y])
  }
  ret.push(ret[0])

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [ret]
    },
    properties: {}
  }
}

export const AdminLiveMap: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout, organizationId } = useAuth()

  // State quản lý phiên họp & lọc
  const [meetings, setMeetings] = useState<MeetingSession[]>([])
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('')
  const [chiBos, setChiBos] = useState<ChiBo[]>([])

  // Model dữ liệu bản đồ hợp đồng duy nhất từ mapAttendanceService
  const [mapData, setMapData] = useState<SessionMapData | null>(null)
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | null>(null)
  const currentMapData = mapData?.meetingSessionId === selectedMeetingId ? mapData : null

  // Bộ lọc UI
  const [selectedChiBoId, setSelectedChiBoId] = useState<string>('all')
  const [selectedLocationStatus, setSelectedLocationStatus] = useState<'all' | 'inside_radius' | 'outside_radius'>('all')
  const [searchMemberQuery, setSearchMemberQuery] = useState<string>('')

  // Trạng thái tải & làm mới
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')

  // State Chế độ Động (Auto-refresh) vs Tĩnh (Static) - Mặc định là Chế độ Tĩnh (false)
  const [isDynamicMode, setIsDynamicMode] = useState<boolean>(false)
  const [mapStyle, setMapStyle] = useState<string>('google-hybrid')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Map Refs & Control Tokens
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null)
  const markersRef = useRef<MapboxMarkerInstance[]>([])

  const activeAbortControllerRef = useRef<AbortController | null>(null)
  const initializationSequenceRef = useRef(0)
  const requestSequenceRef = useRef<number>(0)
  const isFetchingRef = useRef<boolean>(false)
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 1. Tải lại danh sách Chi bộ & Phiên họp mỗi khi admin@ đổi xã.
  useEffect(() => {
    const requestId = ++initializationSequenceRef.current
    const requestOrganizationId = organizationId
    let cancelled = false
    const isCurrentRequest = () => !cancelled && requestId === initializationSequenceRef.current && tenantService.getOrganizationId() === requestOrganizationId

    activeAbortControllerRef.current?.abort()
    activeAbortControllerRef.current = null
    requestSequenceRef.current += 1
    isFetchingRef.current = false
    const initData = async () => {
      await Promise.resolve()
      if (!isCurrentRequest()) return
      setLoadedOrganizationId(null)
      setMeetings([])
      setSelectedMeetingId('')
      setChiBos([])
      setMapData(null)
      setSelectedChiBoId('all')
      setSelectedLocationStatus('all')
      setSearchMemberQuery('')
      setIsDynamicMode(false)
      setLoadError('')
      setInitialLoading(Boolean(requestOrganizationId))
      if (!requestOrganizationId) {
        setInitialLoading(false)
        return
      }
      try {
        const { data: cbData } = await supabase.from('chi_bos').select('id, name').order('name')
        if (!isCurrentRequest()) return
        if (cbData) setChiBos(cbData)

        const allSessions = await meetingService.getMeetingList()
        if (!isCurrentRequest()) return
        setMeetings(allSessions)

        const active = allSessions.find((s: MeetingSession) => s.status === 'attendance_open' || s.status === 'active') || allSessions[0]
        setSelectedMeetingId(active?.id || '')
        setLoadedOrganizationId(requestOrganizationId)
      } catch (err: unknown) {
        if (!isCurrentRequest()) return
        const message = err instanceof Error ? err.message : String(err)
        setLoadError('Lỗi tải dữ liệu phiên họp: ' + message)
      } finally {
        if (isCurrentRequest()) setInitialLoading(false)
      }
    }

    void initData()
    return () => {
      cancelled = true
      initializationSequenceRef.current += 1
      activeAbortControllerRef.current?.abort()
      requestSequenceRef.current += 1
      isFetchingRef.current = false
    }
  }, [organizationId])

  // 2. Hàm điều phối tải dữ liệu trung tâm qua mapAttendanceService
  const loadSessionMapData = useCallback(async (
    targetMeetingId: string,
    mode: 'initial' | 'manual' | 'background'
  ) => {
    if (!targetMeetingId || loadedOrganizationId !== organizationId || tenantService.getOrganizationId() !== organizationId) return
    if (mode === 'background' && isFetchingRef.current) return

    // Reserve a sequence before yielding so a later request invalidates this one.
    const currentSeq = ++requestSequenceRef.current
    isFetchingRef.current = true
    await Promise.resolve()
    if (currentSeq !== requestSequenceRef.current || tenantService.getOrganizationId() !== organizationId) return

    // Hủy request cũ đang chạy nếu có
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort()
    }
    const abortController = new AbortController()
    activeAbortControllerRef.current = abortController

    if (mode === 'initial') {
      setInitialLoading(true)
      setLoadError('')
      setMapData(null) // Xóa dữ liệu phiên cũ lập tức
    } else if (mode === 'manual') {
      setRefreshing(true)
    }

    try {
      const data = await mapAttendanceService.getSessionMapData(targetMeetingId, {
        forceReloadSettings: mode === 'manual'
      })

      if (abortController.signal.aborted || currentSeq !== requestSequenceRef.current) return

      setMapData(data)
      setLoadError('')
    } catch (err: unknown) {
      if (abortController.signal.aborted || currentSeq !== requestSequenceRef.current) return
      const message = err instanceof Error ? err.message : String(err)
      setLoadError(message || 'Không thể tải dữ liệu vị trí của phiên họp. Vui lòng thử lại.')
      console.error('Lỗi tải dữ liệu bản đồ:', message)
    } finally {
      if (currentSeq === requestSequenceRef.current) {
        isFetchingRef.current = false
        if (mode === 'initial') setInitialLoading(false)
        if (mode === 'manual') setRefreshing(false)
      }
    }
  }, [loadedOrganizationId, organizationId])

  // 3. Tải lại khi thay đổi phiên họp
  useEffect(() => {
    if (loadedOrganizationId !== organizationId) return
    if (selectedMeetingId && meetings.some(meeting => meeting.id === selectedMeetingId)) {
      activeAbortControllerRef.current?.abort()
      requestSequenceRef.current += 1
      isFetchingRef.current = false
      const timer = window.setTimeout(() => { void loadSessionMapData(selectedMeetingId, 'initial') }, 0)
      return () => {
        window.clearTimeout(timer)
        requestSequenceRef.current += 1
        activeAbortControllerRef.current?.abort()
      }
    }
  }, [selectedMeetingId, meetings, organizationId, loadedOrganizationId, loadSessionMapData])

  // 4. Polling đệ quy an toàn bằng setTimeout & Page Visibility API
  useEffect(() => {
    if (!isDynamicMode || !selectedMeetingId || initialLoading) return

    const scheduleNextPoll = () => {
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current)
      pollingTimerRef.current = setTimeout(async () => {
        if (document.visibilityState === 'visible' && isDynamicMode) {
          await loadSessionMapData(selectedMeetingId, 'background')
        }
        if (isDynamicMode) scheduleNextPoll()
      }, 5000)
    }

    scheduleNextPoll()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isDynamicMode && selectedMeetingId) {
        loadSessionMapData(selectedMeetingId, 'background')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isDynamicMode, selectedMeetingId, initialLoading, loadSessionMapData])

  // 5. Derived state: Lọc danh sách điểm danh sử dụng useMemo
  const filteredPoints = useMemo(() => {
    if (!currentMapData) return []
    return currentMapData.points.filter((pt) => {
      if (selectedChiBoId !== 'all') {
        if (pt.chiBoId !== selectedChiBoId && pt.chiBoName !== selectedChiBoId) {
          const matchedCb = chiBos.find(c => c.id === selectedChiBoId)
          if (matchedCb && pt.chiBoName !== matchedCb.name) return false
        }
      }

      if (selectedLocationStatus === 'inside_radius' && pt.locationStatus !== 'inside_radius') return false
      if (selectedLocationStatus === 'outside_radius' && pt.locationStatus !== 'outside_radius') return false

      if (searchMemberQuery.trim() !== '') {
        const query = searchMemberQuery.trim().toLocaleLowerCase('vi-VN')
        const matchName = pt.fullName.toLocaleLowerCase('vi-VN').includes(query)
        const matchChiBo = pt.chiBoName.toLocaleLowerCase('vi-VN').includes(query)
        if (!matchName && !matchChiBo) return false
      }
      return true
    })
  }, [currentMapData, selectedChiBoId, selectedLocationStatus, searchMemberQuery, chiBos])

  // 6. Hàm vẽ/cập nhật toàn bộ Markers trên Mapbox (Tách riêng khỏi khởi tạo map)
  const renderMapMarkers = useCallback((map: MapboxMapInstance, mapboxgl: unknown) => {
    // Inject CSS keyframe cho hiệu ứng quay Ra-đa nếu chưa có
    const styleId = 'radar-sweep-animation-style'
    if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
      const styleEl = document.createElement('style')
      styleEl.id = styleId
      styleEl.innerHTML = `
        @keyframes radar-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `
      document.head.appendChild(styleEl)
    }

    // Xóa markers cũ
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    if (!currentMapData?.hall) return

    const hall = currentMapData.hall
    const mapboxGlobal = mapboxgl as {
      Marker: new (element: HTMLElement, options?: { anchor?: string }) => MapboxMarkerInstance
      Popup: new (options?: { offset?: number }) => { setHTML: (html: string) => unknown }
    }

    // (A) Ghim Tâm Hội trường
    const areaHa = ((Math.PI * Math.pow(hall.radiusM, 2)) / 10000).toFixed(4)

    const hallEl = document.createElement('div')
    hallEl.className = 'w-8 h-8 rounded-full bg-red-revolution border-2 border-white dark:border-slate-900 shadow-xl flex items-center justify-center text-white text-[10px] font-black cursor-pointer animate-pulse z-10'
    hallEl.innerHTML = 'HT'
    hallEl.title = `Tâm Hội trường (Bán kính: ${hall.radiusM}m ~ Diện tích: ${areaHa} ha)`

    const hallPopup = new mapboxGlobal.Popup({ offset: 25 }).setHTML(`
      <div style="font-family: sans-serif; padding: 6px;">
        <div style="font-weight: bold; color: #D90429; font-size: 13px;">🏛️ TÂM HỘI TRƯỜNG PHIÊN HỌP</div>
        <div style="font-size: 11px; margin-top: 4px; color: #475569;">Bán kính điểm danh: <b>${hall.radiusM}m</b></div>
        <div style="font-size: 11px; color: #475569;">Diện tích quy phủ: <b style="color: #D90429;">${areaHa} ha</b></div>
        <div style="font-size: 10px; font-family: monospace; color: #0f172a; background: #f1f5f9; padding: 4px; border-radius: 4px; margin-top: 6px;">
          Tọa độ chuẩn: <b>${hall.latitude.toFixed(6)}, ${hall.longitude.toFixed(6)}</b>
        </div>
      </div>
    `)

    const hallMarker = new mapboxGlobal.Marker(hallEl)
      .setLngLat([hall.longitude, hall.latitude])
      .setPopup(hallPopup)
      .addTo(map)

    markersRef.current.push(hallMarker)

    // (A.1) Vẽ các Vòng tròn Phân cách Đồng tâm (100m..600m) - Chỉ có bán kính điểm danh chính là màu Đỏ (#D90429)
    const baseRadii = [100, 200, 300, 400, 500, 600]
    const ringRadii = Array.from(new Set([...baseRadii, hall.radiusM])).sort((a, b) => a - b)

    const concentricFeatures = ringRadii.map((radius) => {
      const circle = createGeoJSONCircle([hall.longitude, hall.latitude], radius)
      const isHallRadius = radius === hall.radiusM
      circle.properties = {
        radius,
        color: isHallRadius ? '#D90429' : '#64748B', // Chỉ có bán kính điểm danh quy định là màu Đỏ, các vòng còn lại màu Xám
        isHallRadius
      }
      return circle
    })

    const concentricGeoJSON = {
      type: 'FeatureCollection' as const,
      features: concentricFeatures
    }

    const mapWithLayers = map as unknown as {
      getSource: (id: string) => { setData: (data: unknown) => void } | undefined
      addSource: (id: string, source: unknown) => void
      addLayer: (layer: unknown) => void
    }

    try {
      if (mapWithLayers.getSource('concentric-rings-source')) {
        mapWithLayers.getSource('concentric-rings-source')?.setData(concentricGeoJSON)
      } else {
        mapWithLayers.addSource('concentric-rings-source', {
          type: 'geojson',
          data: concentricGeoJSON
        })

        // Vùng phủ bán kính (Chỉ vùng bán kính điểm danh chính màu đỏ mới có độ mờ 5%)
        mapWithLayers.addLayer({
          id: 'concentric-rings-fill',
          type: 'fill',
          source: 'concentric-rings-source',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': [
              'case',
              ['get', 'isHallRadius'],
              0.05,
              0.0
            ]
          }
        })

        // Viền vòng tròn phân cách (Chỉ vòng bán kính điểm danh chính là nét viền đỏ đậm)
        mapWithLayers.addLayer({
          id: 'concentric-rings-line',
          type: 'line',
          source: 'concentric-rings-source',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': [
              'case',
              ['get', 'isHallRadius'],
              2.5,
              1.2
            ],
            'line-dasharray': [3, 2]
          }
        })
      }
    } catch (err: unknown) {
      console.warn('Bỏ qua lỗi vẽ các vòng tròn bán kính đồng tâm:', err)
    }

    // (A.2) Hiệu ứng Quét Ra-đa quay chuẩn 100% trung điểm Hội trường, bán kính khớp theo mét & chu kỳ quay 5s bằng nhịp làm mới
    if (isDynamicMode) {
      // 1. Container định vị của Mapbox (Không chứa animation quay để không đè lên translate của Mapbox)
      const radarContainer = document.createElement('div')
      radarContainer.className = 'pointer-events-none flex items-center justify-center'
      radarContainer.style.position = 'relative'
      radarContainer.style.boxSizing = 'border-box'

      // 2. Element con xoay tròn 360 độ nằm bên trong container
      const radarSweep = document.createElement('div')
      radarSweep.style.width = '100%'
      radarSweep.style.height = '100%'
      radarSweep.style.borderRadius = '50%'
      radarSweep.style.boxSizing = 'border-box'
      radarSweep.style.transformOrigin = 'center center'
      radarSweep.style.background = 'conic-gradient(from 0deg, transparent 0deg, transparent 310deg, rgba(217, 4, 41, 0.04) 310deg, rgba(217, 4, 41, 0.45) 360deg)'
      radarSweep.style.border = '1.5px solid rgba(217, 4, 41, 0.35)'
      radarSweep.style.boxShadow = '0 0 20px rgba(217, 4, 41, 0.2) inset, 0 0 10px rgba(217, 4, 41, 0.2)'
      radarSweep.style.animation = 'radar-spin 5s linear infinite'

      radarContainer.appendChild(radarSweep)

      const mapWithProj = map as unknown as {
        project: (lngLat: [number, number]) => { x: number; y: number }
        on: (event: string, fn: () => void) => void
      }

      // Tính kích thước đường kính pixel khớp chuẩn tuyệt đối 100.00% với lớp GeoJSON Circle
      const updateRadarSize = () => {
        try {
          const centerPx = mapWithProj.project([hall.longitude, hall.latitude])
          const edgeLng = hall.longitude + (hall.radiusM / (111320 * Math.cos((hall.latitude * Math.PI) / 180)))
          const edgePx = mapWithProj.project([edgeLng, hall.latitude])
          const radiusPx = Math.hypot(edgePx.x - centerPx.x, edgePx.y - centerPx.y)
          const diameterPx = Math.max(20, Math.round(radiusPx * 2))

          radarContainer.style.width = `${diameterPx}px`
          radarContainer.style.height = `${diameterPx}px`
        } catch (err: unknown) {
          console.warn('Radar size notice:', err)
          radarContainer.style.width = '240px'
          radarContainer.style.height = '240px'
        }
      }

      updateRadarSize()
      mapWithProj.on('zoom', updateRadarSize)
      mapWithProj.on('render', updateRadarSize)

      const radarMarker = new mapboxGlobal.Marker(radarContainer, { anchor: 'center' })
        .setLngLat([hall.longitude, hall.latitude])
        .addTo(map)

      markersRef.current.push(radarMarker)
    }

    // (B) Ghim Marker cho từng Đảng viên trong danh sách sau khi lọc
    filteredPoints.forEach(pt => {
      const isOk = pt.locationStatus === 'inside_radius'
      const pinColor = isOk ? '#10B981' : '#F59E0B' // Xanh lá hoặc Vàng

      const el = document.createElement('div')
      el.className = `w-7 h-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[9px] font-black cursor-pointer transition-transform hover:scale-125 z-20`
      el.style.backgroundColor = pinColor
      el.innerHTML = escapeHtml(pt.fullName.substring(0, 1).toUpperCase())

      const lat6 = pt.latitude.toFixed(6)
      const lng6 = pt.longitude.toFixed(6)

      const safeName = escapeHtml(pt.fullName)
      const safeChiBo = escapeHtml(pt.chiBoName)
      const safePosition = escapeHtml(pt.position)
      const safeWarning = pt.warningReason ? escapeHtml(pt.warningReason) : null
      const displayDistance = pt.distanceM !== null ? `cách ${Math.round(pt.distanceM)} m` : 'Chưa rõ khoảng cách'
      const displayTime = pt.markedAt || 'Chưa xác định'

      const popupHtml = `
        <div style="font-family: sans-serif; padding: 6px; min-width: 220px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            <span style="font-weight: bold; color: #0f172a; font-size: 13px;">Đ/c ${safeName}</span>
            <span style="background: ${isOk ? '#D1FAE5' : '#FEF3C7'}; color: ${isOk ? '#065F46' : '#92400E'}; font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 10px;">
              ${isOk ? 'Hợp lệ' : 'Cảnh báo GPS'}
            </span>
          </div>
          <div style="font-size: 11px; margin-top: 6px; color: #475569;">
            <div>Chức vụ: <b>${safePosition}</b></div>
            <div>Chi bộ: <b>${safeChiBo}</b></div>
            <div>Giờ điểm danh: <b>${displayTime}</b></div>
            <div>Cự ly tính theo mét: <b style="color: ${isOk ? '#10B981' : '#D97706'};">${displayDistance}</b> (Bán kính <= ${hall.radiusM}m)</div>
            ${safeWarning ? `<div style="color: #DC2626; font-size: 10px; margin-top: 4px;">⚠️ Lý do: <b>${safeWarning}</b></div>` : ''}
          </div>
          <div style="font-size: 10px; font-family: monospace; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; margin-top: 8px; text-align: center;">
            <div style="color: #64748b; font-size: 8px; text-transform: uppercase;">Tọa độ GPS 6 số:</div>
            <div style="font-weight: bold; color: #0f172a; font-size: 11px; margin-top: 2px;">${lat6}, ${lng6}</div>
          </div>
        </div>
      `

      const popup = new mapboxGlobal.Popup({ offset: 25 }).setHTML(popupHtml)

      const marker = new mapboxGlobal.Marker(el)
        .setLngLat([pt.longitude, pt.latitude])
        .setPopup(popup)
        .addTo(map)

      markersRef.current.push(marker)
    })
  }, [currentMapData, filteredPoints, isDynamicMode])

  const renderMapMarkersRef = useRef(renderMapMarkers)
  useEffect(() => {
    renderMapMarkersRef.current = renderMapMarkers
  }, [renderMapMarkers])

  // 7. Khởi tạo bản đồ Mapbox GL JS (Chỉ khởi tạo 1 lần khi mount container hoặc đổi mapStyle)
  useEffect(() => {
    if (!mapContainerRef.current) return

    const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

    const cssId = 'mapbox-gl-css-cdn'
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.css'
      document.head.appendChild(link)
    }

    const initMapbox = () => {
      if (typeof window === 'undefined' || !(window as unknown as Record<string, unknown>).mapboxgl || !mapContainerRef.current) {
        setTimeout(initMapbox, 50)
        return
      }

      const mapboxgl = (window as unknown as Record<string, unknown>).mapboxgl as {
        accessToken: string
        Map: new (options: unknown) => MapboxMapInstance
        NavigationControl: new () => unknown
        FullscreenControl: new () => unknown
      }
      mapboxgl.accessToken = MAPBOX_TOKEN

      const hallLat = currentMapData?.hall?.latitude ?? 0
      const hallLng = currentMapData?.hall?.longitude ?? 0
      const hasVenue = Boolean(currentMapData?.hall)

      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (e: unknown) {
          console.warn('Map cleanup notice:', e)
        }
        mapInstanceRef.current = null
      }

      let activeStyle: unknown = mapStyle
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
              maxzoom: 22
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
        container: mapContainerRef.current,
        style: activeStyle,
        center: [hallLng, hallLat],
        zoom: hasVenue ? 15.0 : 2,
        maxZoom: 18.5,
        minZoom: hasVenue ? 5 : 1
      })

      map.addControl(new mapboxgl.NavigationControl(), 'top-right')
      map.addControl(new mapboxgl.FullscreenControl(), 'top-right')

      mapInstanceRef.current = map

      map.on('load', () => {
        renderMapMarkersRef.current(map, mapboxgl)
      })
    }

    const jsId = 'mapbox-gl-js-cdn'
    if (!(window as unknown as Record<string, unknown>).mapboxgl) {
      if (!document.getElementById(jsId)) {
        const script = document.createElement('script')
        script.id = jsId
        script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.js'
        script.onload = initMapbox
        document.body.appendChild(script)
      }
    } else {
      setTimeout(initMapbox, 100)
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (cleanupErr: unknown) {
          console.warn('Map cleanup notice:', cleanupErr)
        }
        mapInstanceRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle])

  // Font size, menus and responsive layout can resize the canvas without a window resize.
  useEffect(() => {
    const container = mapContainerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => mapInstanceRef.current?.resize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [mapStyle, selectedMeetingId, initialLoading])

  // 8. Cập nhật lại markers khi filteredPoints hoặc mapData thay đổi mà không khởi tạo lại Map
  useEffect(() => {
    const mapboxglObj = (window as unknown as Record<string, unknown>).mapboxgl
    if (mapInstanceRef.current && mapboxglObj) {
      renderMapMarkers(mapInstanceRef.current, mapboxglObj)
      if (currentMapData?.hall) {
        mapInstanceRef.current.flyTo({
          center: [currentMapData.hall.longitude, currentMapData.hall.latitude],
          zoom: 15,
          speed: 1.2
        })
      } else {
        mapInstanceRef.current.jumpTo({ center: [0, 0], zoom: 2 })
      }
    }
  }, [filteredPoints, currentMapData, renderMapMarkers])

  // Hàm bay tới vị trí Đảng viên (Focus on map)
  const handleFlyToMember = (lat: number, lng: number) => {
    if (mapInstanceRef.current && mapInstanceRef.current.flyTo) {
      mapInstanceRef.current.flyTo({
        center: [lng, lat],
        zoom: 17.8,
        speed: 1.2
      })
    }
  }

  // Hàm sao chép tọa độ vào bộ nhớ tạm
  const handleCopyCoords = (id: string, lat: number, lng: number) => {
    const str = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    navigator.clipboard.writeText(str)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (initialLoading || loadedOrganizationId !== organizationId) {
    return <LoadingSpinner message="Đang tải bản đồ giám sát điểm danh..." fullScreen />
  }

  const summary = currentMapData?.summary || {
    totalAttendance: 0,
    positioned: 0,
    missingGps: 0,
    insideRadius: 0,
    outsideRadius: 0,
    unknown: 0
  }

  const hall = currentMapData?.hall ?? null

  return (
    <PatternBackground>
      <PortalHeader />
      <RedNavigationBar
        isAuthenticated={true}
        userRole="admin"
        userName={user?.memberName || 'Ban Tổ Chức'}
        onLogout={handleLogout}
      />

      <main className="container mx-auto px-3 sm:px-4 py-6 max-w-7xl">
        {/* HEADER BẢN ĐỒ GIÁM SÁT */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold normal-case text-red-deep dark:text-gold tracking-normal flex items-center gap-2">
              <MapIcon className="text-red-revolution" size={24} /> Bản đồ Giám sát Vị trí Điểm danh
            </h1>
            <p className="text-xs text-muted dark:text-muted mt-1">
              Theo dõi tọa độ GPS thực tế của Đảng viên theo thời gian thực (Google Maps Vệ tinh & Vector)
            </p>
          </div>

          {/* CÔNG TẮC BẬT/TẮT CHẾ ĐỘ ĐỘNG & NÚT LÀM MỚI */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex-wrap">
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Radio size={14} className={isDynamicMode ? 'text-emerald-500 animate-pulse' : 'text-muted'} />
              <span className="text-xs font-bold text-slate-700 dark:text-muted">
                {isDynamicMode ? 'Chế độ Động (Tự động làm mới)' : 'Chế độ Tĩnh'}
              </span>
              <button
                type="button"
                onClick={() => setIsDynamicMode(!isDynamicMode)}
                className={`ml-1 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isDynamicMode ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isDynamicMode ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <RevolutionaryButton
              onClick={() => loadSessionMapData(selectedMeetingId, 'manual')}
              variant="secondary"
              className="flex items-center gap-1.5 text-xs font-bold"
              loading={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Làm mới
            </RevolutionaryButton>
          </div>
        </div>

        {loadError && <AlertMessage type="error" message={loadError} className="mb-6" onDismiss={() => setLoadError('')} />}

        {/* BỘ LỌC THÔNG MINH */}
        <GlassCard className="p-4 mb-6 border border-red-revolution/20 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Lọc phiên họp */}
            <div>
              <label className="text-xs font-bold normal-case text-muted block mb-1">Phiên họp sinh hoạt:</label>
              <select
                value={selectedMeetingId}
                onChange={(e) => setSelectedMeetingId(e.target.value)}
                className="w-full text-xs font-bold p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:border-red-revolution"
              >
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.status === 'attendance_open' ? '🔴 [ĐANG MỞ] ' : ''}{m.title} ({m.meeting_date})
                  </option>
                ))}
              </select>
            </div>

            {/* Lọc chi bộ */}
            <div>
              <label className="text-xs font-bold normal-case text-muted block mb-1">Lọc theo Chi bộ:</label>
              <select
                value={selectedChiBoId}
                onChange={(e) => setSelectedChiBoId(e.target.value)}
                className="w-full text-xs font-bold p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:border-red-revolution"
              >
                <option value="all">-- Tất cả {chiBos.length} chi bộ --</option>
                {chiBos.map((cb) => (
                  <option key={cb.id} value={cb.id}>{cb.name}</option>
                ))}
              </select>
            </div>

            {/* Lọc bán kính GPS */}
            <div>
              <label className="text-xs font-bold normal-case text-muted block mb-1">Trạng thái bán kính:</label>
              <select
                value={selectedLocationStatus}
                onChange={(e) => setSelectedLocationStatus(e.target.value as 'all' | 'inside_radius' | 'outside_radius')}
                className="w-full text-xs font-bold p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:border-red-revolution"
              >
                <option value="all">Tất cả vị trí điểm danh</option>
                <option value="inside_radius">🟢 Trong bán kính cho phép</option>
                <option value="outside_radius">🟡 Ngoài bán kính cho phép (Cảnh báo)</option>
              </select>
            </div>

            {/* Tìm kiếm Đảng viên */}
            <div>
              <label className="text-xs font-bold normal-case text-muted block mb-1">Tìm kiếm theo tên:</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchMemberQuery}
                  onChange={(e) => setSearchMemberQuery(e.target.value)}
                  placeholder="Nhập tên Đảng viên..."
                  className="w-full text-xs p-2 pl-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:border-red-revolution"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-muted" />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* THỐNG KÊ NHANH & SWITCHER BẢN ĐỒ MAPBOX */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* KHUNG BẢN ĐỒ MAPBOX 3 CỘT */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex-wrap gap-2">
              {/* Thống kê chuẩn từ summary bất biến */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold text-slate-700 dark:text-muted">
                  Đã định vị: <b className="text-emerald-600 dark:text-emerald-400">{summary.positioned}</b> đồng chí
                </span>
                {summary.missingGps > 0 && (
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 ml-2">
                    • Không có GPS: <b>{summary.missingGps}</b> lượt
                  </span>
                )}
                <span className="text-xs font-bold text-muted dark:text-muted ml-2">
                  • Tổng điểm danh: <b>{summary.totalAttendance}</b>
                </span>
                {hall ? (
                  <span className="text-xs text-muted ml-1">
                    (Bán kính: <b>{hall.radiusM}m</b> • Diện tích: <b className="text-red-revolution dark:text-gold">{((Math.PI * Math.pow(hall.radiusM, 2)) / 10000).toFixed(4)} ha</b>)
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 ml-1">Chưa cấu hình vị trí điểm danh cho phiên này</span>
                )}
              </div>

              {/* Nút chuyển chế độ bản đồ: Google Maps Mới Nhất vs Mapbox */}
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMapStyle('google-hybrid')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    mapStyle === 'google-hybrid'
                      ? 'bg-red-revolution text-white font-bold shadow-sm'
                      : 'text-muted dark:text-muted'
                  }`}
                >
                  Google Vệ tinh
                </button>
                <button
                  type="button"
                  onClick={() => setMapStyle('google-roadmap')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    mapStyle === 'google-roadmap'
                      ? 'bg-red-revolution text-white font-bold shadow-sm'
                      : 'text-muted dark:text-muted'
                  }`}
                >
                  Google Đường phố
                </button>
                <button
                  type="button"
                  onClick={() => setMapStyle('mapbox://styles/mapbox/satellite-streets-v12')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    mapStyle.includes('mapbox')
                      ? 'bg-red-revolution text-white font-bold shadow-sm'
                      : 'text-muted dark:text-muted'
                  }`}
                >
                  Mapbox
                </button>
              </div>
            </div>

            {/* MAP CONTAINER */}
            <div className="relative w-full h-[520px] rounded-card border-2 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-[#e5e3df] dark:bg-slate-800">
              <div ref={mapContainerRef} className="w-full h-full"></div>
            </div>
          </div>

          {/* SIDE PANEL: DANH SÁCH ĐẢNG VIÊN ĐIỂM DANH 1 CỘT */}
          <div className="space-y-4">
            <GlassCard className="p-4 border border-slate-200 dark:border-slate-800 flex flex-col h-[575px]">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
                <h3 className="text-xs font-bold normal-case text-red-deep dark:text-gold flex items-center gap-1.5">
                  <Users size={16} /> Danh sách vị trí
                </h3>
                <span className="text-xs font-bold bg-red-revolution/10 text-red-revolution px-2 py-0.5 rounded-full">
                  {filteredPoints.length} / {summary.positioned} Vị trí
                </span>
              </div>

              {/* Scrollable member list */}
              <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
                {loadError ? null : summary.totalAttendance === 0 ? (
                  <div className="text-center py-12 text-muted text-xs italic">
                    Phiên họp chưa có dữ liệu điểm danh.
                  </div>
                ) : summary.positioned === 0 ? (
                  <div className="text-center py-12 text-muted text-xs italic px-2">
                    Có <b>{summary.totalAttendance}</b> lượt điểm danh nhưng chưa có tọa độ GPS.
                  </div>
                ) : filteredPoints.length === 0 ? (
                  <div className="text-center py-12 text-muted text-xs italic">
                    Không tìm thấy kết quả phù hợp với bộ lọc.
                  </div>
                ) : (
                  filteredPoints.map((pt) => {
                    const isOk = pt.locationStatus === 'inside_radius'
                    const lat6 = pt.latitude.toFixed(6)
                    const lng6 = pt.longitude.toFixed(6)
                    const displayDistance = pt.distanceM !== null ? `cách ${Math.round(pt.distanceM)} m` : 'Chưa rõ khoảng cách'
                    const displayTime = pt.markedAt || 'Chưa xác định'

                    return (
                      <div
                        key={pt.attendanceId}
                        className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:border-red-revolution/40 transition-all space-y-1.5"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                              <span>{pt.fullName}</span>
                            </div>
                            <div className="text-xs text-muted">{pt.chiBoName} • {displayTime}</div>
                          </div>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                            isOk ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}>
                            {displayDistance}
                          </span>
                        </div>

                        {/* Tọa độ 6 số thập phân + nút copy + bay tới */}
                        <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-md text-xs font-mono">
                          <span className="text-muted dark:text-muted">{lat6}, {lng6}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyCoords(pt.attendanceId, pt.latitude, pt.longitude)}
                              className="text-muted hover:text-red-revolution cursor-pointer p-0.5"
                              title="Sao chép tọa độ chuẩn 6 chữ số thập phân"
                            >
                              {copiedId === pt.attendanceId ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFlyToMember(pt.latitude, pt.longitude)}
                              className="text-red-revolution font-bold hover:underline cursor-pointer flex items-center gap-0.5 ml-1"
                              title="Bay đến vị trí trên bản đồ"
                            >
                              <Eye size={12} /> Dõi
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      </main>
    </PatternBackground>
  )
}

export default AdminLiveMap
