import React from 'react'
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'

type AlertType = 'success' | 'warning' | 'error' | 'info'

interface AlertMessageProps {
  type: AlertType
  title?: string
  message: string
  className?: string
  onDismiss?: () => void
}

export const AlertMessage: React.FC<AlertMessageProps> = ({
  type,
  title,
  message,
  className = '',
  onDismiss
}) => {
  const alertStyles = {
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30',
      text: 'text-emerald-800 dark:text-emerald-300',
      icon: CheckCircle2
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30',
      text: 'text-amber-800 dark:text-amber-300',
      icon: AlertTriangle
    },
    error: {
      bg: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30',
      text: 'text-rose-800 dark:text-rose-300',
      icon: AlertCircle
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30',
      text: 'text-blue-800 dark:text-blue-300',
      icon: Info
    }
  }

  const currentStyle = alertStyles[type]
  const Icon = currentStyle.icon

  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`p-4 border rounded-card flex gap-3 relative ${currentStyle.bg} ${currentStyle.text} ${className}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1 pr-6">
        {title && <h4 className="font-bold text-sm md:text-base normal-case tracking-normal mb-0.5">{title}</h4>}
        <p className="text-xs md:text-sm font-semibold opacity-90 leading-relaxed">{message}</p>
      </div>
      {onDismiss && (
        <button 
          onClick={onDismiss}
          aria-label="Đóng thông báo"
          className="absolute top-1 right-1 min-w-11 min-h-11 flex items-center justify-center cursor-pointer"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
