import React from 'react'
import { useUiSettings } from '../../contexts/UiSettingsContext'
import { useAuth } from '../../contexts/AuthContext'
import presidentHoAndFlags from '../../assets/president_ho_and_flags.png'

interface PortalHeaderProps {
  systemTitle?: string
  subtitle?: string
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({
  systemTitle,
  subtitle
}) => {
  const { settings } = useUiSettings()
  const { user, organizationId, organizations, selectOrganization } = useAuth()

  const displayTitle = systemTitle || settings?.organization_name || 'ĐẢNG BỘ CẤP XÃ'
  const displaySubtitle = subtitle || settings?.site_name || 'SINH HOẠT CHÍNH TRỊ DƯỚI NGHI THỨC CHÀO CỜ'
  const activeBannerUrl = settings?.active_banner?.file_url

  const headerStyle = activeBannerUrl
    ? {
        backgroundImage: `linear-gradient(rgba(150, 0, 0, 0.8), rgba(100, 0, 0, 0.9)), url(${activeBannerUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : undefined

  return (
    <header
      style={headerStyle}
      className="banner-shine w-full bg-gradient-to-r from-red-dark via-red-revolution to-red-dark border-b-4 border-gold py-3 md:py-4 px-4 md:px-8 text-white relative shadow-lg"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left emblem: Portrait & Flags (replacing Logo) */}
        <div className="order-first md:order-none flex items-center justify-center md:justify-start">
          <img
            src={presidentHoAndFlags}
            alt="Bác Hồ và Cờ Đảng, Cờ Tổ Quốc"
            className="h-16 md:h-20 w-auto object-contain drop-shadow-[0_2px_10px_rgba(255,215,0,0.5)] transition-all duration-300 hover:scale-105"
          />
        </div>

        {/* Central Titles */}
        <div className="text-center flex-1">
          <h1 className="text-base md:text-xl lg:text-2xl font-black tracking-wider text-gold drop-shadow-lg uppercase">
            {displayTitle}
          </h1>
          <h2 className="text-[10px] md:text-xs lg:text-sm font-bold mt-1.5 tracking-widest text-white/95 drop-shadow-md uppercase">
            {displaySubtitle}
          </h2>
          <div className="w-20 h-[2px] bg-gold mx-auto mt-2 rounded-full opacity-80"></div>
          {user?.isGlobalAdmin && <label className="mt-2 inline-flex items-center gap-2 text-xs font-semibold"><span>Đang quản lý:</span><select aria-label="Chọn xã đang quản lý" value={organizationId || ''} onChange={e => selectOrganization(e.target.value)} className="rounded-md border border-gold/50 bg-red-dark px-2 py-1 text-white"><option value="">Chọn xã</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
        </div>

        {/* Right side placeholder for symmetry on desktop */}
        <div className="hidden md:block w-16 md:w-20"></div>
      </div>
    </header>
  )
}
