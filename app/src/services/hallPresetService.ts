import { tenantService } from './tenantService'
export interface HallPreset {
  id: string
  name: string
  lat: number
  lng: number
  radius: number
  createdAt: string
}

const storageKey = () => `meeting_hall_presets:${tenantService.getOrganizationId() || 'none'}`

// Địa điểm do từng xã cấu hình; không kế thừa tọa độ cơ quan cũ.
const DEFAULT_PRESETS: HallPreset[] = []

export const hallPresetService = {
  /**
   * Lấy danh sách tất cả các mẫu vị trí phòng họp đã lưu
   */
  getPresets(): HallPreset[] {
    try {
      const stored = localStorage.getItem(storageKey())
      if (!stored) {
        // Lưu mẫu mặc định nếu chưa từng tạo
        localStorage.setItem(storageKey(), JSON.stringify(DEFAULT_PRESETS))
        return DEFAULT_PRESETS
      }
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PRESETS
    } catch (e) {
      console.error('Lỗi đọc danh sách mẫu phòng họp:', e)
      return DEFAULT_PRESETS
    }
  },

  /**
   * Thêm mới một mẫu vị trí phòng họp
   */
  savePreset(name: string, lat: number, lng: number, radius: number): HallPreset {
    const presets = this.getPresets()
    const newPreset: HallPreset = {
      id: 'preset_' + Date.now().toString(36),
      name: name.trim(),
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      radius: Math.max(10, radius),
      createdAt: new Date().toISOString()
    }
    const updated = [newPreset, ...presets]
    localStorage.setItem(storageKey(), JSON.stringify(updated))
    return newPreset
  },

  /**
   * Xóa một mẫu phòng họp theo ID
   */
  deletePreset(id: string): HallPreset[] {
    const presets = this.getPresets()
    const updated = presets.filter(p => p.id !== id)
    localStorage.setItem(storageKey(), JSON.stringify(updated))
    return updated
  }
}
