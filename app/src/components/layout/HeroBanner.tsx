import React from 'react'
import { useUiSettings } from '../../contexts/UiSettingsContext'
import governmentInspectorateLogo from '../../assets/government_inspectorate_logo.png'
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

  const displayTitle = title || settings?.organization_name || 'ĐẢNG BỘ THANH TRA TỈNH SƠN LA'
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
      className="w-full relative bg-gradient-to-br from-red-dark via-red-revolution to-red-deep border-b border-gold/30 py-10 px-4 text-center overflow-hidden shadow-inner flex flex-col items-center justify-center min-h-[220px]"
    >
      
      {/* Background bronze drum pattern (Trống Đồng chìm, xoay chậm) */}
      <div className="absolute inset-0 opacity-15 flex items-center justify-center pointer-events-none select-none mix-blend-screen">
        <img
          src={bronzeDrum}
          alt="Trống đồng"
          className="w-[300px] h-[300px] md:w-[480px] md:h-[480px] object-contain"
          style={{ animation: 'spin-reverse 180s linear infinite' }}
        />
      </div>

      {/* Content wrapper with fade-in slide-up animation */}
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center gap-3 animate-slide-up">
        {/* Government Inspectorate Logo */}
        <div className="w-18 h-18 md:w-20 md:h-20 rounded-full bg-white/10 border border-gold/40 flex items-center justify-center shadow-glow overflow-hidden p-1.5 backdrop-blur-sm">
          <img
            src={governmentInspectorateLogo}
            alt="Logo Thanh tra Chính phủ"
            className="w-full h-full object-contain"
          />
        </div>

        <h2 className="text-sm md:text-lg font-black tracking-widest text-gold drop-shadow-md uppercase mt-2">
          {displayTitle}
        </h2>
        
        <h1 className="text-xl md:text-3xl font-black text-white tracking-wide drop-shadow-lg uppercase leading-tight max-w-2xl font-serif">
          HỆ THỐNG SINH HOẠT CHÍNH TRỊ ĐIỆN TỬ
        </h1>

        <div className="flex items-center gap-2 mt-2 w-full justify-center">
          <div className="h-[1px] bg-gold/30 flex-1 max-w-[100px]"></div>
          <p className="text-[11px] md:text-xs font-bold text-gold tracking-widest uppercase bg-red-deep/40 px-3 py-1 rounded-full border border-gold/15">
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

