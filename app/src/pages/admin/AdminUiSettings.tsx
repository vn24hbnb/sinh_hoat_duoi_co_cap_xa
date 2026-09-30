import React, { useState, useEffect } from 'react'
import {
  Settings,
  Palette,
  Image as ImageIcon,
  Check,
  Trash2,
  Sparkles,
  Info,
  Type
} from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useUiSettings } from '../../contexts/UiSettingsContext'
import { uiSettingsService } from '../../services/uiSettingsService'
import type { UiAsset } from '../../services/uiSettingsService'
import { ImageUploader } from '../../components/ui/ImageUploader'
import { useAuth } from '../../contexts/AuthContext'

type TabType = 'general' | 'appearance' | 'assets'

export const AdminUiSettings: React.FC = () => {
  const { user } = useAuth()
  const { settings, loading: contextLoading, refreshSettings } = useUiSettings()
  
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [assetSubTab, setAssetSubTab] = useState<UiAsset['asset_type']>('logo')
  
  // Settings Form State
  const [siteName, setSiteName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [mainSlogan, setMainSlogan] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [primaryButtonText, setPrimaryButtonText] = useState('')
  
  // Theme state
  const [themeColor, setThemeColor] = useState('#D40000')
  const [accentColor, setAccentColor] = useState('#FACC15')
  const [fontFamily, setFontFamily] = useState('Inter')
  const [appearance, setAppearance] = useState<'light' | 'dark' | 'system'>('light')
  const [effectsEnabled, setEffectsEnabled] = useState(true)
  const [bgRotate, setBgRotate] = useState(true)
  const [bgSpinSpeed, setBgSpinSpeed] = useState<number>(160)
  const [homeOpacity, setHomeOpacity] = useState(88)
  const [loginOpacity, setLoginOpacity] = useState(88)
  const [savingOpacity, setSavingOpacity] = useState(false)
  const [dbWarning, setDbWarning] = useState<string | null>(null)

  // Assets List State
  const [assets, setAssets] = useState<UiAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  
  // Form submission / UI states
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // System pre-defined color palettes
  const colorPalettes = [
    { name: 'Đỏ Cách mạng (Mặc định)', primary: '#D40000', accent: '#FACC15' },
    { name: 'Đỏ Cờ Truyền thống', primary: '#C8102E', accent: '#FFD700' },
    { name: 'Navy Trang nghiêm', primary: '#1B365D', accent: '#EAA135' },
    { name: 'Đỏ Ruby Quý phái', primary: '#A20025', accent: '#FFC72C' }
  ]

  // System pre-defined fonts
  const fontFamilies = [
    { id: 'Be Vietnam Pro', name: 'Be Vietnam Pro (Mềm mại, Hiện đại)' },
    { id: 'Inter', name: 'Inter (Hiện đại, Đọc rõ ràng)' },
    { id: 'Open Sans', name: 'Open Sans (Thân thiện, Phổ biến)' },
    { id: 'Roboto', name: 'Roboto (Tiêu chuẩn, Rõ nét)' },
    { id: 'Lora', name: 'Lora (Chân phương, Serif truyền thống)' },
    { id: 'Playfair Display', name: 'Playfair Display (Trang trọng, Đậm nét nghệ thuật)' }
  ]

  useEffect(() => {
    if (settings) {
      setSiteName(settings.site_name)
      setOrganizationName(settings.organization_name)
      setMainSlogan(settings.main_slogan)
      setWelcomeMessage(settings.welcome_message)
      setPrimaryButtonText(settings.primary_button_text)
      setThemeColor(settings.theme_color)
      setAccentColor(settings.accent_color)
      setFontFamily(settings.font_family)
      setAppearance(settings.appearance)
      setEffectsEnabled(settings.effects_enabled)
      setHomeOpacity(settings.home_background_opacity !== undefined ? settings.home_background_opacity : 88)
      setLoginOpacity(settings.login_background_opacity !== undefined ? settings.login_background_opacity : 88)
      setBgRotate(localStorage.getItem('fallback_home_background_rotate') !== 'false')
      const localSpinSpeed = localStorage.getItem('fallback_home_background_spin_speed')
      setBgSpinSpeed(settings.home_background_spin_speed !== undefined && settings.home_background_spin_speed !== null ? settings.home_background_spin_speed : (localSpinSpeed ? Number(localSpinSpeed) : 160))
    }
  }, [settings])

  const loadAssetsList = async (type: UiAsset['asset_type']) => {
    setAssetsLoading(true)
    try {
      const data = await uiSettingsService.getAssetsByType(type)
      setAssets(data)
    } catch (err) {
      console.error('Lỗi lấy danh sách ảnh:', err)
    } finally {
      setAssetsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'assets') {
      loadAssetsList(assetSubTab)
    }
  }, [activeTab, assetSubTab])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setError(null)
    setSuccessMsg(null)

    try {
      await uiSettingsService.updateSettings(
        {
          site_name: siteName,
          organization_name: organizationName,
          main_slogan: mainSlogan,
          welcome_message: welcomeMessage,
          primary_button_text: primaryButtonText,
          theme_color: themeColor,
          accent_color: accentColor,
          font_family: fontFamily,
          appearance,
          effects_enabled: effectsEnabled,
          home_background_spin_speed: bgSpinSpeed
        },
        user.id
      )

      localStorage.setItem('fallback_home_background_rotate', String(bgRotate))
      localStorage.setItem('fallback_home_background_spin_speed', String(bgSpinSpeed))
      await refreshSettings()
      setSuccessMsg('Đã lưu cấu hình giao diện thành công!')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      setError(err.message || 'Lỗi xảy ra khi lưu cấu hình. Vui lòng kiểm tra lại.')
    } finally {
      setSaving(false)
    }
  }

  const handleActivateAsset = async (assetId: string) => {
    if (!user) return
    setError(null)
    setSuccessMsg(null)
    try {
      await uiSettingsService.activateAsset(assetId, assetSubTab, user.id)
      await refreshSettings()
      await loadAssetsList(assetSubTab)
      setSuccessMsg(`Đã kích hoạt ảnh ${getFriendlySubTabName(assetSubTab)} thành công!`)
    } catch (err: any) {
      setError(err.message || 'Không thể kích hoạt hình ảnh này.')
    }
  }

  const handleDeleteAsset = async (asset: UiAsset) => {
    if (!user) return
    if (asset.is_active) {
      setError('Không thể xóa hình ảnh đang được sử dụng. Vui lòng kích hoạt ảnh khác trước khi xóa.')
      return
    }

    if (!window.confirm(`Đồng chí có chắc chắn muốn xóa tệp ảnh "${asset.asset_name}" khỏi hệ thống?`)) {
      return
    }

    setError(null)
    setSuccessMsg(null)
    try {
      await uiSettingsService.deleteAsset(asset.id, asset.file_path, user.id)
      await loadAssetsList(assetSubTab)
      setSuccessMsg('Đã xóa hình ảnh khỏi hệ thống.')
    } catch (err: any) {
      setError(err.message || 'Lỗi xảy ra khi xóa hình ảnh.')
    }
  }

  const handleSaveOpacity = async () => {
    if (!user) return
    setSavingOpacity(true)
    setError(null)
    setSuccessMsg(null)
    setDbWarning(null)
    try {
      const result = await uiSettingsService.updateSettings(
        {
          home_background_opacity: homeOpacity,
          login_background_opacity: loginOpacity
        },
        user.id
      )
      
      await refreshSettings()
      
      if ((result as any)._db_missing_columns) {
        setDbWarning(
          'Đã lưu tỷ lệ mờ tạm thời trên thiết bị này. Lưu ý: Cần chạy câu lệnh SQL thêm cột trong database để áp dụng cho toàn bộ người dùng.'
        )
      } else {
        setSuccessMsg('Đã lưu cài đặt tỷ lệ mờ của ảnh nền thành công!')
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      setError(err.message || 'Lỗi xảy ra khi lưu tỷ lệ mờ.')
    } finally {
      setSavingOpacity(false)
    }
  }

  const getFriendlySubTabName = (type: UiAsset['asset_type']) => {
    switch (type) {
      case 'logo': return 'Logo / Ảnh thay thế ô đỏ thương hiệu'
      case 'banner': return 'Banner'
      case 'home_background': return 'Ảnh nền trang chủ'
      case 'login_background': return 'Ảnh nền đăng nhập'
      default: return 'Hình ảnh'
    }
  }

  if (contextLoading) {
    return <LoadingSpinner message="Đang nạp cấu hình hệ thống..." fullScreen />
  }

  return (
    <PatternBackground bgImageUrl={settings?.active_home_background?.file_url}>
      <PortalHeader
        systemTitle={settings?.organization_name}
        subtitle={settings?.site_name}
      />
      <RedNavigationBar isAuthenticated={true} userRole="admin" />
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        {/* Page Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-black text-red-deep dark:text-gold uppercase tracking-wider">
              Quản trị giao diện
            </h1>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
              Tùy biến tiêu đề, slogan, bảng màu và hình ảnh hiển thị
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto scrollbar-none gap-2">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'general'
                ? 'border-red-revolution text-red-revolution dark:text-gold dark:border-gold'
                : 'border-transparent text-slate-500 hover:text-red-revolution dark:hover:text-gold'
            }`}
          >
            <Settings size={16} />
            Cấu hình Văn bản
          </button>
          
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'appearance'
                ? 'border-red-revolution text-red-revolution dark:text-gold dark:border-gold'
                : 'border-transparent text-slate-500 hover:text-red-revolution dark:hover:text-gold'
            }`}
          >
            <Palette size={16} />
            Màu sắc & Chủ đề
          </button>
          
          <button
            onClick={() => setActiveTab('assets')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'assets'
                ? 'border-red-revolution text-red-revolution dark:text-gold dark:border-gold'
                : 'border-transparent text-slate-500 hover:text-red-revolution dark:hover:text-gold'
            }`}
          >
            <ImageIcon size={16} />
            Kho Hình ảnh
          </button>
        </div>

        {/* Action Alerts */}
        {error && <AlertMessage type="error" message={error} className="mb-6 animate-fade-in" />}
        {successMsg && <AlertMessage type="success" message={successMsg} className="mb-6 animate-fade-in" />}
        {dbWarning && <AlertMessage type="warning" message={dbWarning} className="mb-6 animate-fade-in" />}

        {/* TAB 1: GENERAL TEXT CONFIG */}
        {activeTab === 'general' && (
          <GlassCard className="border border-red-revolution/20">
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-red-revolution/10">
                <Type size={18} className="text-red-revolution dark:text-gold" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-red-deep dark:text-gold">
                  Nội dung chữ hệ thống
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Site Name */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-cream-light mb-2">
                    Tên phần mềm (Tiêu đề phụ / Slogan trang chủ)
                  </label>
                  <input
                    type="text"
                    required
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="block w-full min-h-[44px] px-3.5 rounded-xl border border-red-revolution/25 bg-white/70 dark:bg-navy/35 text-navy dark:text-white focus:outline-none focus:ring-2 focus:ring-red-revolution/50 text-sm font-semibold"
                    placeholder="Sinh hoạt chính trị dưới nghi thức chào cờ"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                    Hiển thị ở phía dưới tiêu đề chính trên thanh banner header.
                  </p>
                </div>

                {/* Organization Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-cream-light mb-2">
                    Tiêu đề chính (Đơn vị tổ chức)
                  </label>
                  <input
                    type="text"
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="block w-full min-h-[44px] px-3.5 rounded-xl border border-red-revolution/25 bg-white/70 dark:bg-navy/35 text-navy dark:text-white focus:outline-none focus:ring-2 focus:ring-red-revolution/50 text-sm font-semibold"
                    placeholder="ĐẢNG BỘ THANH TRA TỈNH SƠN LA"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                    Tên cơ quan, tổ chức hiển thị to nhất ở trung tâm Header.
                  </p>
                </div>

                {/* Slogan */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-cream-light mb-2">
                    Khẩu hiệu hành động
                  </label>
                  <input
                    type="text"
                    required
                    value={mainSlogan}
                    onChange={(e) => setMainSlogan(e.target.value)}
                    className="block w-full min-h-[44px] px-3.5 rounded-xl border border-red-revolution/25 bg-white/70 dark:bg-navy/35 text-navy dark:text-white focus:outline-none focus:ring-2 focus:ring-red-revolution/50 text-sm font-semibold"
                    placeholder="ĐOÀN KẾT - KỶ CƯƠNG - GƯƠNG MẪU - TRÁCH NHIỆM"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                    Khẩu hiệu hành động chạy chữ hoặc hiển thị tại banner.
                  </p>
                </div>

                {/* Welcome Message */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-cream-light mb-2">
                    Dòng mô tả chào mừng (Login/Home)
                  </label>
                  <textarea
                    rows={2}
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    className="block w-full py-2.5 px-3.5 rounded-xl border border-red-revolution/25 bg-white/70 dark:bg-navy/35 text-navy dark:text-white focus:outline-none focus:ring-2 focus:ring-red-revolution/50 text-sm font-semibold"
                    placeholder="Chào mừng các đồng chí đảng viên tham dự phiên sinh hoạt"
                  />
                </div>

                {/* Primary Button Text */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-cream-light mb-2">
                    Tên nút hành động chính
                  </label>
                  <input
                    type="text"
                    required
                    value={primaryButtonText}
                    onChange={(e) => setPrimaryButtonText(e.target.value)}
                    className="block w-full min-h-[44px] px-3.5 rounded-xl border border-red-revolution/25 bg-white/70 dark:bg-navy/35 text-navy dark:text-white focus:outline-none focus:ring-2 focus:ring-red-revolution/50 text-sm font-semibold"
                    placeholder="TIẾP TỤC"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                    Chữ hiển thị trên nút chính điều hướng luồng Đảng viên (vd: TIẾP TỤC, BẮT ĐẦU).
                  </p>
                </div>

                {/* General Animation Toggles */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-red-revolution/10">
                  {/* Light animations toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex gap-2">
                      <Sparkles className="text-red-revolution dark:text-gold mt-0.5 shrink-0" size={18} />
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Bật hiệu ứng chuyển động nhẹ
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          Khi bật, các hiệu ứng lướt sáng banner, chạy chữ và hiệu ứng trượt sẽ hoạt động.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={effectsEnabled}
                        onChange={(e) => setEffectsEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-revolution"></div>
                    </label>
                  </div>

                  {/* Background rotation toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex gap-2">
                      <ImageIcon className="text-red-revolution dark:text-gold mt-0.5 shrink-0" size={18} />
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Cho phép hình nền Trống đồng xoay tròn
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          Khi bật, hình nền Trống đồng chìm của trang chủ và các mục quản trị sẽ tự động xoay tròn chậm.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bgRotate}
                        onChange={(e) => setBgRotate(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-revolution"></div>
                    </label>
                  </div>

                  {/* Background rotation speed */}
                  {bgRotate && (
                    <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 gap-4">
                      <div className="flex gap-2">
                        <ImageIcon className="text-red-revolution dark:text-gold mt-0.5 shrink-0" size={18} />
                        <div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Tốc độ xoay của Trống đồng
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            Lựa chọn thời gian hoàn thành 1 vòng quay (Mức 160s là nhanh nhất).
                          </p>
                        </div>
                      </div>
                      <select
                        value={bgSpinSpeed}
                        onChange={(e) => setBgSpinSpeed(Number(e.target.value))}
                        className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy text-xs font-bold text-slate-700 dark:text-cream-light focus:border-red-revolution cursor-pointer outline-none min-w-[200px]"
                      >
                        <option value={160}>Mức 1: Nhanh (160 giây/vòng)</option>
                        <option value={240}>Mức 2: Trung bình (240 giây/vòng)</option>
                        <option value={360}>Mức 3: Chậm (360 giây/vòng)</option>
                        <option value={480}>Mức 4: Rất chậm (480 giây/vòng)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex justify-end">
                <RevolutionaryButton type="submit" loading={saving}>
                  Lưu cấu hình chữ
                </RevolutionaryButton>
              </div>
            </form>
          </GlassCard>
        )}

        {/* TAB 2: APPEARANCE & THEME COLOR */}
        {activeTab === 'appearance' && (
          <GlassCard className="border border-red-revolution/20">
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="flex items-center gap-2 pb-3 border-b border-red-revolution/10">
                <Palette size={18} className="text-red-revolution dark:text-gold" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-red-deep dark:text-gold">
                  Chủ đề & Màu sắc hiển thị
                </h3>
              </div>

              {/* Preset Palettes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-cream-light mb-3">
                  Chọn nhanh bảng màu cách mạng đề xuất
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {colorPalettes.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setThemeColor(p.primary)
                        setAccentColor(p.accent)
                      }}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all hover:scale-[1.01] ${
                        themeColor === p.primary && accentColor === p.accent
                          ? 'border-red-revolution bg-red-revolution/5 dark:bg-gold/5 dark:border-gold'
                          : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-navy/20'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {p.name}
                        </p>
                        <div className="flex gap-1.5 mt-2">
                          <span
                            className="w-5 h-5 rounded-full inline-block border border-black/10"
                            style={{ backgroundColor: p.primary }}
                          />
                          <span
                            className="w-5 h-5 rounded-full inline-block border border-black/10"
                            style={{ backgroundColor: p.accent }}
                          />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Custom Color Picker: Primary */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-cream-light mb-2">
                    Màu chủ đạo (Theme Color)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="w-12 h-11 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer bg-white"
                    />
                    <input
                      type="text"
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="block flex-1 min-h-[44px] px-3.5 rounded-xl border border-red-revolution/25 bg-white/70 dark:bg-navy/35 text-navy dark:text-white focus:outline-none text-sm font-semibold uppercase"
                    />
                  </div>
                </div>

                {/* Custom Color Picker: Accent */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-cream-light mb-2">
                    Màu nhấn / Màu chữ Vàng (Accent Color)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-12 h-11 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer bg-white"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="block flex-1 min-h-[44px] px-3.5 rounded-xl border border-red-revolution/25 bg-white/70 dark:bg-navy/35 text-navy dark:text-white focus:outline-none text-sm font-semibold uppercase"
                    />
                  </div>
                </div>

                {/* Font Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-cream-light mb-2">
                    Font chữ hệ thống (Font Family)
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="block w-full min-h-[44px] px-3.5 rounded-xl border border-red-revolution/25 bg-white/70 dark:bg-navy/35 text-navy dark:text-white focus:outline-none text-sm font-semibold"
                  >
                    {fontFamilies.map((font) => (
                      <option key={font.id} value={font.id}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Appearance mode Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-cream-light mb-2">
                    Chế độ Sáng / Tối (Appearance Mode)
                  </label>
                  <select
                    value={appearance}
                    onChange={(e) => setAppearance(e.target.value as any)}
                    className="block w-full min-h-[44px] px-3.5 rounded-xl border border-red-revolution/25 bg-white/70 dark:bg-navy/35 text-navy dark:text-white focus:outline-none text-sm font-semibold"
                  >
                    <option value="light">Chế độ Sáng (Mặc định)</option>
                    <option value="dark">Chế độ Tối (Đỏ sẫm / Navy)</option>
                    <option value="system">Chế độ Hệ thống (Đồng bộ với thiết bị)</option>
                  </select>
                </div>

                {/* Light animations toggle */}
                <div className="md:col-span-2 flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex gap-2">
                    <Sparkles className="text-red-revolution dark:text-gold mt-0.5 shrink-0" size={18} />
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Bật hiệu ứng chuyển động nhẹ
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        Khi bật, các hiệu ứng lướt sáng banner, chạy chữ và hiệu ứng trượt sẽ hoạt động.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={effectsEnabled}
                      onChange={(e) => setEffectsEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-revolution"></div>
                  </label>
                </div>

                  {/* Background rotation toggle */}
                  <div className="md:col-span-2 flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex gap-2">
                      <ImageIcon className="text-red-revolution dark:text-gold mt-0.5 shrink-0" size={18} />
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Cho phép hình nền Trống đồng xoay tròn
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          Khi bật, hình nền Trống đồng chìm của trang chủ và các mục quản trị sẽ tự động xoay tròn chậm.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bgRotate}
                        onChange={(e) => setBgRotate(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-revolution"></div>
                    </label>
                  </div>

                  {/* Background rotation speed */}
                  {bgRotate && (
                    <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 gap-4">
                      <div className="flex gap-2">
                        <ImageIcon className="text-red-revolution dark:text-gold mt-0.5 shrink-0" size={18} />
                        <div>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Tốc độ xoay của Trống đồng
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            Lựa chọn thời gian hoàn thành 1 vòng quay (Mức 160s là nhanh nhất).
                          </p>
                        </div>
                      </div>
                      <select
                        value={bgSpinSpeed}
                        onChange={(e) => setBgSpinSpeed(Number(e.target.value))}
                        className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy text-xs font-bold text-slate-700 dark:text-cream-light focus:border-red-revolution cursor-pointer outline-none min-w-[200px]"
                      >
                        <option value={160}>Mức 1: Nhanh (160 giây/vòng)</option>
                        <option value={240}>Mức 2: Trung bình (240 giây/vòng)</option>
                        <option value={360}>Mức 3: Chậm (360 giây/vòng)</option>
                        <option value={480}>Mức 4: Rất chậm (480 giây/vòng)</option>
                      </select>
                    </div>
                  )}
                </div>

              {/* Submit Button */}
              <div className="pt-4 flex justify-end">
                <RevolutionaryButton type="submit" loading={saving}>
                  Lưu giao diện
                </RevolutionaryButton>
              </div>
            </form>
          </GlassCard>
        )}

        {/* TAB 3: MEDIA ASSETS PREVIEW AND UPLOAD */}
        {activeTab === 'assets' && (
          <div className="space-y-6">
            <GlassCard className="border border-red-revolution/20">
              {/* Asset Type Selection Sub-tabs */}
              <div className="flex items-center gap-2 pb-3 border-b border-red-revolution/10 mb-5">
                <ImageIcon size={18} className="text-red-revolution dark:text-gold" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-red-deep dark:text-gold">
                  Kho tệp tin ảnh và hình nền
                </h3>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {(['logo', 'banner', 'home_background', 'login_background'] as UiAsset['asset_type'][]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAssetSubTab(type)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      assetSubTab === type
                        ? 'bg-red-revolution text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {getFriendlySubTabName(type)}
                  </button>
                ))}
              </div>

              {/* Info panel */}
              <div className="flex gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                <Info size={16} className="text-red-revolution shrink-0 mt-0.5" />
                <div>
                  <p>
                    Vui lòng tải tệp ảnh lên cho mục <b>{getFriendlySubTabName(assetSubTab)}</b>. Sau khi tải lên, nhấp <b>"Kích hoạt (Sử dụng)"</b> trên ảnh mong muốn để cập nhật giao diện trực tiếp trên phần mềm.
                  </p>
                </div>
              </div>

              {/* Opacity settings (Luôn hiển thị ở đầu Tab Kho hình ảnh) */}
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200/50 dark:border-slate-800/40 space-y-4">
                <div className="pb-2 border-b border-red-revolution/10">
                  <h4 className="text-xs font-black uppercase tracking-wider text-red-deep dark:text-gold">
                    Cài đặt tỷ lệ mờ của ảnh nền hệ thống
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Độ mờ của lớp phủ màu lên hình nền (giá trị phần trăm càng cao, ảnh nền càng mờ và chữ càng hiển thị rõ ràng).
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Home background opacity slider */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Độ mờ ảnh nền trang chủ:
                      </span>
                      <span className="text-xs font-black text-red-revolution dark:text-gold">
                        {homeOpacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={homeOpacity}
                      onChange={(e) => setHomeOpacity(Number(e.target.value))}
                      className="w-full accent-red-revolution cursor-pointer h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
                    />
                  </div>

                  {/* Login background opacity slider */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Độ mờ ảnh nền đăng nhập:
                      </span>
                      <span className="text-xs font-black text-red-revolution dark:text-gold">
                        {loginOpacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={loginOpacity}
                      onChange={(e) => setLoginOpacity(Number(e.target.value))}
                      className="w-full accent-red-revolution cursor-pointer h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <RevolutionaryButton
                    onClick={handleSaveOpacity}
                    loading={savingOpacity}
                  >
                    Lưu tỷ lệ mờ nền
                  </RevolutionaryButton>
                </div>
              </div>

              {/* Uploader Component */}
              <div className="mb-8">
                <ImageUploader
                  assetType={assetSubTab}
                  onUploadSuccess={() => loadAssetsList(assetSubTab)}
                />
              </div>

              {/* Grid of existing assets */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-1.5">
                  Danh sách {getFriendlySubTabName(assetSubTab)} đã tải lên
                </h4>

                {assetsLoading ? (
                  <div className="py-8 flex justify-center">
                    <LoadingSpinner message="Đang nạp danh sách ảnh..." />
                  </div>
                ) : assets.length === 0 ? (
                  <div className="py-12 text-center text-xs font-bold text-slate-400 border border-slate-100 dark:border-slate-800/40 rounded-xl bg-slate-50/50 dark:bg-slate-950/10">
                    Chưa có hình ảnh nào được tải lên cho mục này.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assets.map((asset) => (
                      <div
                        key={asset.id}
                        className={`relative rounded-xl overflow-hidden border bg-white dark:bg-slate-950 flex flex-col transition-all ${
                          asset.is_active
                            ? 'border-red-revolution shadow-glow ring-2 ring-red-revolution/25 dark:border-gold dark:ring-gold/25'
                            : 'border-slate-200 dark:border-slate-800 hover:shadow-md'
                        }`}
                      >
                        {/* Image Thumbnail Container */}
                        <div className="h-32 w-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 overflow-hidden relative group">
                          <img
                            src={asset.file_url}
                            alt={asset.asset_name}
                            className="max-h-full max-w-full object-contain transition-transform group-hover:scale-[1.02]"
                          />
                          {asset.is_active && (
                            <div className="absolute top-2 left-2 bg-emerald-500 text-white rounded-full p-1 shadow-md" title="Đang kích hoạt">
                              <Check size={14} />
                            </div>
                          )}
                        </div>

                        {/* Image Info */}
                        <div className="p-3 flex-1 flex flex-col justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate" title={asset.asset_name}>
                              {asset.asset_name}
                            </p>
                            {asset.description && (
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-1 line-clamp-2">
                                {asset.description}
                              </p>
                            )}
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 font-bold">
                              Kích thước: {asset.size_bytes ? `${(asset.size_bytes / 1024).toFixed(1)} KB` : 'N/A'}
                            </p>
                          </div>

                          {/* Control Buttons */}
                          <div className="flex gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                            {asset.is_active ? (
                              <button
                                disabled
                                className="flex-1 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center gap-1 border border-emerald-200 dark:border-emerald-900/30"
                              >
                                <Check size={12} />
                                Đang sử dụng
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivateAsset(asset.id)}
                                className="flex-1 py-1.5 rounded-lg bg-red-revolution hover:bg-red-dark text-white text-[10px] font-bold transition-colors shadow-sm"
                              >
                                Sử dụng
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteAsset(asset)}
                              disabled={asset.is_active}
                              className={`p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 transition-colors ${
                                asset.is_active
                                  ? 'opacity-30 cursor-not-allowed'
                                  : 'hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 hover:border-rose-200'
                              }`}
                              title="Xóa tệp ảnh này"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        )}
      </main>
    </PatternBackground>
  )
}

export default AdminUiSettings
