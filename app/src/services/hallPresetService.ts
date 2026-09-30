export interface HallPreset {
  id: string
  name: string
  lat: number
  lng: number
  radius: number
  createdAt: string
}

const STORAGE_KEY = 'meeting_hall_presets'

// Mẫu địa điểm mặc định của Thanh tra tỉnh Sơn La
const DEFAULT_PRESETS: HallPreset[] = [
  {
    id: 'preset_tttsl_main',
    name: 'Hội trường chính Thanh tra tỉnh Sơn La (Tầng 4)',
    lat: 21.326812,
    lng: 103.917451,
    radius: 100,
    createdAt: new Date().toISOString()
  },
  {
    id: 'preset_tttsl_meeting_2',
    name: 'Phòng họp Chi bộ - Tầng 2',
    lat: 21.326750,
    lng: 103.917320,
    radius: 80,
    createdAt: new Date().toISOString()
  },
  {
    id: 'preset_sonla_center',
    name: 'Trung tâm Hội nghị tỉnh Sơn La',
    lat: 21.328400,
    lng: 103.912500,
    radius: 150,
    createdAt: new Date().toISOString()
  }
]

export const hallPresetService = {
  /**
   * Lấy danh sách tất cả các mẫu vị trí phòng họp đã lưu
   */
  getPresets(): HallPreset[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        // Lưu mẫu mặc định nếu chưa từng tạo
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PRESETS))
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    return newPreset
  },

  /**
   * Xóa một mẫu phòng họp theo ID
   */
  deletePreset(id: string): HallPreset[] {
    const presets = this.getPresets()
    const updated = presets.filter(p => p.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    return updated
  }
}
