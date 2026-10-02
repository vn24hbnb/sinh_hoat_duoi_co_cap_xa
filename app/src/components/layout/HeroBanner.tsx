import React from 'react'
import { useUiSettings } from '../../contexts/UiSettingsContext'
import bronzeDrum from '../../assets/bronze_drum.png'

interface HeroBannerProps {
  title?: string
  slogan?: string
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  title,
  slogan
}) => {
  const { settings } = useUiSettings()

  const displayTitle = title || settings?.organization_name || 'ĐẢNG BỘ CẤP XÃ'
  const displaySlogan = slogan || settings?.main_slogan || 'ĐOÀN KẾT - KỶ CƯƠNG - GƯƠNG MẪU - TRÁCH NHIỆM'
  const activeBannerUrl = settings?.active_banner?.file_url

  const containerStyle = activeBannerUrl
    ? {
        backgroundImage: `linear-gradient(rgba(139, 0, 0, 0.85), rgba(101, 0, 0, 0.85)), url(${activeBannerUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : undefined

  return (
    <div
      style={containerStyle}
      aria-label={displayTitle}
      className="hero-banner w-full relative bg-red-dark border-b border-gold/30 py-8 px-4 text-center overflow-hidden flex flex-col items-center justify-center"
    >
      
      {/* Background bronze drum pattern (Trống Đồng chìm, xoay chậm) */}
      <div className="absolute inset-0 opacity-15 flex items-center justify-center pointer-events-none select-none mix-blend-screen">
        <img
          src={bronzeDrum}
          alt="Trống đồng"
          className="w-[300px] h-[300px] md:w-[480px] md:h-[480px] object-contain"
          style={{ animation: settings?.effects_enabled === false ? 'none' : 'spin-reverse 180s linear infinite' }}
        />
      </div>

      {/* Content wrapper with fade-in slide-up animation */}
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center gap-3 animate-slide-up">
        {/* Biểu trưng tùy chọn, do đơn vị cấu hình trong phần giao diện. */}
        {settings?.active_logo?.file_url && (
          <div className="w-18 h-18 md:w-20 md:h-20 rounded-full bg-white/10 border border-gold/40 flex items-center justify-center shadow-glow overflow-hidden p-1.5 backdrop-blur-none">
            <img src={settings.active_logo.file_url} alt="Biểu trưng đơn vị" className="w-full h-full object-contain" />
          </div>
        )}

        
        <h1 className="text-xl md:text-3xl font-bold text-white tracking-normal drop-shadow-sm normal-case leading-tight max-w-2xl font-serif">
          Hệ thống sinh hoạt chính trị điện tử
        </h1>

        <div className="flex items-center gap-2 mt-2 w-full justify-center">
          <div className="h-[1px] bg-gold/30 flex-1 max-w-[100px]"></div>
          <p className="text-xs md:text-xs font-bold text-gold tracking-normal normal-case bg-red-deep/40 px-3 py-1 rounded-full border border-gold/15">
            {displaySlogan}
          </p>
          <div className="h-[1px] bg-gold/30 flex-1 max-w-[100px]"></div>
        </div>
      </div>

      {/* Decorative wave at the bottom */}
      <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-gold via-yellow-400 to-gold opacity-70"></div>
    </div>
  )
}

export default HeroBanner
