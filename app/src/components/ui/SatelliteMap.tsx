import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { AttendanceMapPoint, HallLocation } from '../../types/mapAttendance'

export type MapStyle = 'satellite' | 'street'
export interface MapPosition { latitude: number; longitude: number }
interface Props {
  position?: MapPosition | null
  hall?: HallLocation | null
  points?: AttendanceMapPoint[]
  focus?: MapPosition | null
  userPosition?: MapPosition | null
  style?: MapStyle
  onPick?: (position: MapPosition) => void
  className?: string
}
const EMPTY_POINTS: AttendanceMapPoint[] = []
const valid = (p?: MapPosition | null): p is MapPosition => !!p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180
const markerIcon = (color: string) => L.divIcon({ className: 'satellite-marker', html: `<span style="background:${color}"></span>`, iconSize: [24, 24], iconAnchor: [12, 12] })

/** Map display only: never writes attendance or changes server GPS verdicts. */
export function SatelliteMap({ position, hall, points = EMPTY_POINTS, focus, userPosition, style = 'satellite', onPick, className = 'h-80' }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const overlaysRef = useRef<L.LayerGroup | null>(null)
  const pickRef = useRef(onPick)
  const [tileError, setTileError] = useState(false)
  useEffect(() => { pickRef.current = onPick }, [onPick])

  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, { zoomControl: true, maxZoom: 19 }).setView([16, 106], 5)
    mapRef.current = map
    overlaysRef.current = L.layerGroup().addTo(map)
    map.on('click', (event: L.LeafletMouseEvent) => pickRef.current?.({ latitude: event.latlng.lat, longitude: event.latlng.lng }))
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; overlaysRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const layer = style === 'satellite'
      ? L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery © Esri, Vantor, Earthstar Geographics, GIS User Community' })
      : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' })
    layer.on('tileerror', () => setTileError(true))
    layer.on('tileload', () => setTileError(false))
    layer.addTo(map)
    return () => { layer.off(); layer.remove() }
  }, [style])

  useEffect(() => {
    const map = mapRef.current, layers = overlaysRef.current
    if (!map || !layers) return
    layers.clearLayers()
    const target = valid(position) ? position : valid(hall) ? hall : null
    if (target) {
      const marker = L.marker([target.latitude, target.longitude], { icon: markerIcon('#b5121b'), draggable: !!pickRef.current }).addTo(layers)
      marker.bindTooltip(pickRef.current ? 'Vị trí hội trường: kéo hoặc bấm để chọn' : 'Hội trường')
      marker.on('dragend', () => { const p = marker.getLatLng(); pickRef.current?.({ latitude: p.lat, longitude: p.lng }) })
    }
    if (valid(hall)) L.circle([hall.latitude, hall.longitude], { radius: hall.radiusM, color: '#b5121b', fillOpacity: 0.08, weight: 2 }).addTo(layers)
    if (valid(userPosition)) {
      L.marker([userPosition.latitude, userPosition.longitude], { icon: markerIcon('#2563eb') }).bindTooltip('Vị trí thiết bị').addTo(layers)
      if (valid(hall)) L.polyline([[hall.latitude, hall.longitude], [userPosition.latitude, userPosition.longitude]], { color: '#2563eb', dashArray: '6 6', weight: 2 }).addTo(layers)
    }
    for (const point of points) {
      if (!valid(point)) continue
      const text = document.createElement('div')
      text.textContent = `${point.fullName} — ${point.chiBoName}; ${point.locationStatus === 'inside_radius' ? 'Trong bán kính' : 'Ngoài bán kính'}; ${point.distanceM == null ? 'Chưa rõ khoảng cách' : Math.round(point.distanceM) + ' m'}; ${point.markedAt || 'Chưa rõ giờ'}`
      L.marker([point.latitude, point.longitude], { icon: markerIcon(point.locationStatus === 'inside_radius' ? '#059669' : '#b5121b') }).bindPopup(text).addTo(layers)
    }
  }, [position, hall, points, userPosition])

  const centerLat = position?.latitude ?? hall?.latitude, centerLng = position?.longitude ?? hall?.longitude
  const userLat = userPosition?.latitude, userLng = userPosition?.longitude
  useEffect(() => {
    const user = { latitude: userLat ?? NaN, longitude: userLng ?? NaN }
    const center = { latitude: centerLat ?? NaN, longitude: centerLng ?? NaN }
    if (valid(center) && valid(user)) mapRef.current?.fitBounds([[center.latitude, center.longitude], [user.latitude, user.longitude]], { padding: [40, 40], maxZoom: 17 })
    else if (valid(center)) mapRef.current?.setView([center.latitude, center.longitude], 16)
    else mapRef.current?.setView([16, 106], 5)
  }, [centerLat, centerLng, userLat, userLng])
  useEffect(() => { if (valid(focus)) mapRef.current?.setView([focus.latitude, focus.longitude], 18) }, [focus])

  const googlePosition = valid(position) ? position : valid(hall) ? hall : null
  return <div ref={rootRef} className={`relative isolate rounded-xl overflow-hidden border border-slate-200 ${className}`}>
    <div ref={containerRef} className="h-full w-full" aria-label="Bản đồ vị trí" />
    <div className="absolute top-2 right-2 z-[500] flex gap-2">
      {googlePosition && <a href={`https://www.google.com/maps/search/?api=1&query=${googlePosition.latitude},${googlePosition.longitude}`} target="_blank" rel="noopener noreferrer" className="bg-white text-slate-900 rounded-lg px-3 py-2 text-xs font-bold shadow">Mở Google Maps</a>}
      <button type="button" className="bg-white text-slate-900 rounded-lg px-3 py-2 text-xs font-bold shadow" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void rootRef.current?.requestFullscreen?.().catch(() => {}) }}>Toàn màn hình</button>
    </div>
    {tileError && <div role="status" className="absolute bottom-7 inset-x-2 z-[500] bg-white text-red-800 p-2 rounded-lg text-xs">Không tải được một số ảnh nền. Kiểm tra mạng hoặc chuyển sang Đường phố; dữ liệu điểm danh vẫn giữ nguyên.</div>}
  </div>
}
