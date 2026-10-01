import React from 'react'
import { useLocation } from 'react-router-dom'
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
  const { pathname } = useLocation()
  const compact = !['/', '/login'].includes(pathname)
  const { user, organizationId, organizations, selectOrganization } = useAuth()

  const displayTitle = systemTitle || settings?.organization_name || 'ĐẢNG BỘ CẤP XÃ'
  const displaySubtitle = subtitle || settings?.site_name || 'SINH HOẠT CHÍNH TRỊ DƯỚI NGHI THỨC CHÀO CỜ'
  const activeBannerUrl = settings?.active_banner?.file_url || (pathname === '/member' ? settings?.active_home_background?.file_url : undefined)

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
      className={`w-full bg-red-dark border-b-2 border-gold px-4 md:px-6 text-white relative ${compact ? 'py-3' : 'py-5 md:py-6'}`}
    >
      <div className={`max-w-7xl mx-auto flex items-center justify-between gap-3 ${compact ? 'flex-wrap' : 'flex-col md:flex-row'}`}>
        
        {/* Left emblem: Portrait & Flags (replacing Logo) */}
        <div className="order-first md:order-none flex items-center justify-center md:justify-start">
          <img
            src={presidentHoAndFlags}
            alt="Bác Hồ và Cờ Đảng, Cờ Tổ Quốc"
            className={compact ? 'h-10 w-auto object-contain' : 'h-16 md:h-20 w-auto object-contain'}
          />
        </div>

        {/* Central Titles */}
        <div className={`min-w-0 flex-1 ${compact ? 'text-left' : 'text-center'}`}>
          <h1 className="text-base md:text-xl font-bold text-[#f4e8c8]">
            {displayTitle}
          </h1>
          <h2 className="text-xs font-sans font-medium mt-1 text-white">
            {displaySubtitle}
          </h2>
          {user?.isGlobalAdmin && <label className="mt-2 inline-flex flex-wrap items-center gap-2 text-xs font-medium"><span>Đang quản lý:</span><select aria-label="Chọn xã đang quản lý" value={organizationId || ''} onChange={e => selectOrganization(e.target.value)} className="min-h-11 max-w-full rounded-control border border-gold/50 bg-red-dark px-3 text-white"><option value="">Chọn xã</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
        </div>

        {/* Right side placeholder for symmetry on desktop */}
        <div className="hidden md:block w-16 md:w-20"></div>
      </div>
    </header>
  )
}
