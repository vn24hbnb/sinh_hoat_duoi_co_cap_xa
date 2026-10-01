import { SatelliteMap } from '../../components/ui/SatelliteMap'
import type { MapStyle, MapPosition } from '../../components/ui/SatelliteMap'
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
  const [mapStyle, setMapStyle] = useState<MapStyle>('satellite')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [mapFocus, setMapFocus] = useState<MapPosition | null>(null)

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
      setMapFocus(null)
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
        const { data: cbData, error: cbError } = await supabase.from('chi_bos').select('id, name').eq('organization_id', requestOrganizationId).order('name')
        if (!isCurrentRequest()) return
        if (cbError) throw new Error('Không tải được chi bộ của xã đang chọn: ' + cbError.message)
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
      if (selectedChiBoId !== 'all' && pt.chiBoId !== selectedChiBoId) return false

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
  }, [currentMapData, selectedChiBoId, selectedLocationStatus, searchMemberQuery])

  const handleFlyToMember = (lat: number, lng: number) => setMapFocus({ latitude: lat, longitude: lng })

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
              Theo dõi tọa độ GPS của Đảng viên theo đúng xã và phiên họp (nền vệ tinh Esri)
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

        {/* THỐNG KÊ NHANH & SWITCHER BẢN ĐỒ VỆ TINH */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* KHUNG BẢN ĐỒ VỆ TINH 3 CỘT */}
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

              {/* Nút chuyển chế độ bản đồ: Esri vệ tinh / OpenStreetMap */}
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMapStyle('satellite')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    mapStyle === 'satellite'
                      ? 'bg-red-revolution text-white font-bold shadow-sm'
                      : 'text-muted dark:text-muted'
                  }`}
                >
                  Vệ tinh Esri
                </button>
                <button
                  type="button"
                  onClick={() => setMapStyle('street')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    mapStyle === 'street'
                      ? 'bg-red-revolution text-white font-bold shadow-sm'
                      : 'text-muted dark:text-muted'
                  }`}
                >
                  Đường phố
                </button>
              </div>
            </div>

            {/* MAP CONTAINER */}
            <SatelliteMap key={`${organizationId}:${selectedMeetingId}`} style={mapStyle} hall={hall} points={filteredPoints} focus={mapFocus} className="h-[520px] w-full" />
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
