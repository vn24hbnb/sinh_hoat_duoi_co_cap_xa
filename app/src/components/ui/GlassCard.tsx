import React from 'react'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      className={`glass-card hover-lift p-4 md:p-5.5 transition-all duration-300 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
