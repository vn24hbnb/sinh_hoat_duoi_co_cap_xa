import React from 'react'

interface RevolutionaryButtonProps {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'gold' | 'danger'
  disabled?: boolean
  loading?: boolean
  className?: string
  fullWidth?: boolean
}

export const RevolutionaryButton: React.FC<RevolutionaryButtonProps> = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  loading = false,
  className = '',
  fullWidth = false
}) => {
  // Base classes for mobile-friendly size, centering, animations, and active state
  const baseClasses = 'min-h-[48px] px-6 py-2.5 rounded-xl font-bold uppercase tracking-wider text-sm md:text-base transition-all duration-200 active:scale-[0.98] inline-flex items-center justify-center gap-2 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-red-revolution to-red-dark text-white border border-red-deep hover:from-red-dark hover:to-red-deep focus:ring-red-revolution hover:shadow-lg',
    secondary: 'bg-white text-red-dark border border-red-revolution/20 hover:bg-cream-light focus:ring-red-revolution',
    gold: 'bg-gradient-to-r from-gold to-yellow-500 text-brown-text border border-yellow-600 hover:from-yellow-500 hover:to-yellow-600 focus:ring-gold hover:shadow-lg',
    danger: 'bg-red-deep text-white border border-red-900 hover:bg-red-950 focus:ring-red-deep'
  }

  const widthClass = fullWidth ? 'w-full flex' : ''

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${widthClass} ${className}`}
    >
      {loading ? (
        <>
          {/* Spinner icon */}
          <svg className="animate-spin h-5 w-5 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Đang tải...
        </>
      ) : (
        children
      )}
    </button>
  )
}
