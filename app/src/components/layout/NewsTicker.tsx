import React from 'react'

interface NewsTickerProps {
  messages?: string[]
}

export const NewsTicker: React.FC<NewsTickerProps> = ({
  messages = [
    'Chào mừng các đồng chí đến với buổi Sinh hoạt chính trị dưới nghi thức chào cờ.',
    'Đảng Cộng sản Việt Nam quang vinh muôn năm! 🇻🇳',
    'Nêu cao tinh thần trách nhiệm, kỷ cương, gương mẫu của mỗi cán bộ, đảng viên.',
    'Học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh.'
  ]
}) => {
  const combinedText = messages.join('   •   ')

  return (
    <div className="w-full bg-gold/9 border-y border-gold/30 py-1.5 overflow-hidden flex items-center relative select-none">
      {/* Ticker title block */}
      <div className="bg-red-revolution text-white text-xs font-black px-3 py-1 uppercase tracking-wider z-10 flex items-center shrink-0 shadow-md">
        Tin tức & Khẩu hiệu
      </div>
      
      {/* Scrolling Text Container */}
      <div className="relative flex items-center w-full overflow-hidden">
        <div className="animate-marquee whitespace-nowrap text-sm font-bold text-brown-text tracking-wide uppercase flex items-center pl-4">
          {combinedText}
        </div>
      </div>
    </div>
  )
}
