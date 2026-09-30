import React from 'react'
import { useUiSettings } from '../../contexts/UiSettingsContext'
import defaultBronzeDrum from '../../assets/bronze_drum.png'

interface PatternBackgroundProps {
  children: React.ReactNode
  className?: string
  bgImageUrl?: string | null
}

export const PatternBackground: React.FC<PatternBackgroundProps> = ({
  children,
  className = '',
  bgImageUrl
}) => {
  const { settings } = useUiSettings()
  const [shouldRotate, setShouldRotate] = React.useState(true)

  React.useEffect(() => {
    // Đọc cài đặt có cho phép xoay hình nền hay không từ localStorage
    const localRotate = localStorage.getItem('fallback_home_background_rotate')
    setShouldRotate(localRotate !== 'false')
  }, [settings])

  // Sử dụng ảnh truyền vào hoặc ảnh cấu hình trong DB, nếu không có thì mặc định là ảnh trống đồng
  const activeBgUrl = bgImageUrl !== undefined 
    ? bgImageUrl 
    : (settings?.active_home_background?.file_url || defaultBronzeDrum)

  // Xác định xem đây là hình nền đăng nhập hay trang chủ
  const isLoginBg = bgImageUrl !== undefined && bgImageUrl === settings?.active_login_background?.file_url

  // Lấy tỷ lệ mờ (giá trị từ 0 đến 100)
  const opacityPercent = isLoginBg
    ? (settings?.login_background_opacity !== undefined ? settings?.login_background_opacity : 88)
    : (settings?.home_background_opacity !== undefined ? settings?.home_background_opacity : 88)

  const opacityDecimal = (opacityPercent / 100).toFixed(2)

  const bgStyle = activeBgUrl
    ? {
        backgroundImage: `var(--bg-overlay, linear-gradient(rgba(255, 244, 214, ${opacityDecimal}), rgba(255, 244, 214, ${opacityDecimal}))), url(${activeBgUrl})`,
        backgroundSize: activeBgUrl === defaultBronzeDrum ? 'contain' : 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat' as const
      }
    : undefined

  // Lấy tốc độ xoay (đơn vị: giây/vòng, mặc định 160)
  const spinSpeed = settings?.home_background_spin_speed !== undefined && settings?.home_background_spin_speed !== null
    ? settings.home_background_spin_speed
    : (() => {
        const localSpinSpeed = localStorage.getItem('fallback_home_background_spin_speed')
        return localSpinSpeed ? Number(localSpinSpeed) : 160
      })()

  return (
    <div className={`relative min-h-screen w-full text-navy dark:text-cream-light transition-colors duration-200 ${className}`}>
      {/* Base Solid Background Layer */}
      <div className="fixed inset-0 bg-cream dark:bg-navy -z-20 pointer-events-none transition-colors duration-200" />

      {/* Background layer that rotates slowly if rotate is enabled */}
      <div
        className={`fixed pointer-events-none -z-10 ${
          shouldRotate ? 'app-slow-spin-bg' : ''
        }`}
        style={{
          ...(bgStyle || {}),
          top: shouldRotate ? '-50%' : '0',
          left: shouldRotate ? '-50%' : '0',
          width: shouldRotate ? '200%' : '100%',
          height: shouldRotate ? '200%' : '100%',
          transformOrigin: 'center center'
        }}
      />

      <style>{`
        :root {
          --bg-overlay: linear-gradient(rgba(255, 244, 214, ${opacityDecimal}), rgba(255, 244, 214, ${opacityDecimal}));
        }
        html.dark {
          --bg-overlay: linear-gradient(rgba(17, 24, 39, ${opacityDecimal}), rgba(17, 24, 39, ${opacityDecimal}));
        }
        @keyframes slow-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(-360deg);
          }
        }
        .app-slow-spin-bg {
          animation: slow-spin ${spinSpeed}s linear infinite;
        }
      `}</style>
      
      {/* Content wrapper */}
      <div className="relative z-0 min-h-screen w-full">
        {children}
      </div>
    </div>
  )
}
