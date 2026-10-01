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
    <div className="news-strip w-full bg-surface-muted border-b border-line py-3 px-4 flex flex-col md:flex-row gap-2 relative">
      {/* Ticker title block */}
      <div className="text-primary dark:text-accent-text text-xs font-semibold shrink-0">
        Tin tức & Khẩu hiệu
      </div>
      
      {/* Scrolling Text Container */}
      <div className="relative flex items-center w-full min-w-0">
        <div className="text-xs text-muted leading-relaxed">
          {combinedText}
        </div>
      </div>
    </div>
  )
}
