import React from 'react'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  trend?: string
  trendType?: 'positive' | 'negative' | 'neutral'
  className?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  description,
  trend,
  trendType = 'neutral',
  className = ''
}) => {
  const trendColor = {
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-rose-600 dark:text-rose-400',
    neutral: 'text-slate-500 dark:text-slate-400'
  }

  return (
    <div className={`glass-card p-6 flex items-center justify-between gap-4 border border-red-revolution/10 shadow-sm ${className}`}>
      <div className="flex-1">
        <span className="text-xs font-bold text-brown-text/80 dark:text-cream-light/60 normal-case tracking-normal block mb-1">
          {title}
        </span>
        <h3 className="text-2xl md:text-3xl font-bold text-ink tracking-tight">
          {value}
        </h3>
        {description && (
          <p className="text-xs font-semibold text-muted dark:text-muted mt-1">
            {description}
          </p>
        )}
        {trend && (
          <span className={`text-xs font-bold mt-1.5 flex items-center gap-1 ${trendColor[trendType]}`}>
            {trend}
          </span>
        )}
      </div>
      
      {/* Icon block */}
      <div className="w-12 h-12 rounded-xl bg-red-revolution/10 dark:bg-gold/10 border border-red-revolution/20 dark:border-gold/20 flex items-center justify-center text-red-revolution dark:text-gold shrink-0">
        <Icon size={24} />
      </div>
    </div>
  )
}
