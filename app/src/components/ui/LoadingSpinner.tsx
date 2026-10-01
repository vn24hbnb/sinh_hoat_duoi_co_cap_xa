import React from 'react'

interface LoadingSpinnerProps {
  message?: string
  fullScreen?: boolean
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Đang tải dữ liệu...',
  fullScreen = false
}) => {
  const containerClass = fullScreen
    ? 'fixed inset-0 bg-cream/70 dark:bg-navy/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center'
    : 'flex flex-col items-center justify-center p-8'

  return (
    <div className={containerClass}>
      <div className="relative flex items-center justify-center">
        {/* Outer spinning ring */}
        <div className="w-14 h-14 border-4 border-red-revolution/10 border-t-red-revolution rounded-full animate-spin"></div>
        {/* Inner reverse spinning ring */}
        <div className="absolute w-10 h-10 border-4 border-gold/10 border-b-gold rounded-full animate-spin [animation-direction:reverse] [animation-duration:1.5s]"></div>
      </div>
      {message && (
        <p className="text-xs md:text-sm font-bold text-red-dark dark:text-gold mt-4 normal-case tracking-normal animate-pulse">
          {message}
        </p>
      )}
    </div>
  )
}
