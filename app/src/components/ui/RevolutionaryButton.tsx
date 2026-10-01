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
  const baseClasses = 'min-h-[48px] px-6 py-3 rounded-control font-semibold text-sm md:text-base transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none'
  
  const variantClasses = {
    primary: 'bg-primary text-white border border-primary hover:bg-primary-hover',
    secondary: 'bg-surface text-ink border border-line hover:bg-surface-muted',
    gold: 'bg-[#f4e8c8] text-[#4a090c] border border-accent hover:bg-[#e2c576]',
    danger: 'bg-[#b42318] text-white border border-[#b42318] hover:bg-[#8c1c13]'
  }

  const widthClass = fullWidth ? 'w-full flex' : ''

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
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
