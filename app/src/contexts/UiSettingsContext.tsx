import React, { createContext, useContext, useState, useEffect } from 'react'
import { uiSettingsService } from '../services/uiSettingsService'
import type { UiSettingsWithAssets } from '../services/uiSettingsService'
import { useAuth } from './AuthContext'

interface UiSettingsContextType {
  settings: UiSettingsWithAssets | null
  loading: boolean
  refreshSettings: () => Promise<void>
}

const UiSettingsContext = createContext<UiSettingsContextType | undefined>(undefined)

function darkenColor(hex: string, percent: number): string {
  try {
    if (!hex || !hex.startsWith('#')) return hex
    const num = parseInt(hex.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = (num >> 16) - amt
    const G = ((num >> 8) & 0x00ff) - amt
    const B = (num & 0x0000ff) - amt
    
    const clamp = (val: number) => (val < 0 ? 0 : val > 255 ? 255 : val)
    
    return (
      '#' +
      (0x1000000 + clamp(R) * 0x10000 + clamp(G) * 0x100 + clamp(B))
        .toString(16)
        .slice(1)
    )
  } catch (e) {
    return hex
  }
}

export const UiSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UiSettingsWithAssets | null>(null)
  const [loading, setLoading] = useState(true)
  const { organizationId } = useAuth()

  const applyThemeAndStyles = (ui: UiSettingsWithAssets) => {
    const root = document.documentElement

    // 1. Color Palette overrides
    if (ui.theme_color) {
      root.style.setProperty('--color-red-revolution', ui.theme_color)
      root.style.setProperty('--color-red-dark', darkenColor(ui.theme_color, 25))
      root.style.setProperty('--color-red-deep', darkenColor(ui.theme_color, 45))
    }
    if (ui.accent_color) {
      root.style.setProperty('--color-gold', ui.accent_color)
    }

    // 2. Font family
    if (ui.font_family) {
      root.style.setProperty('--font-sans', `"${ui.font_family}", "Be Vietnam Pro", system-ui, sans-serif`)
    }

    // 3. Dark mode implementation
    const handleDarkMode = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    if (ui.appearance === 'dark') {
      handleDarkMode(true)
    } else if (ui.appearance === 'light') {
      handleDarkMode(false)
    } else {
      // System preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      handleDarkMode(mediaQuery.matches)
    }

    // 4. Effects (disable animations if effects_enabled is false)
    if (ui.effects_enabled === false) {
      root.classList.add('disable-transitions')
    } else {
      root.classList.remove('disable-transitions')
    }
  }

  useEffect(() => {
    let cancelled = false
    setSettings(null)
    if (!organizationId) {
      setLoading(false)
      return
    }
    setLoading(true)
    void uiSettingsService.getActiveSettings().then(data => {
      if (cancelled) return
      setSettings(data)
      applyThemeAndStyles(data)
    }).catch(error => {
      console.error('Error loading UI settings context:', error)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [organizationId])

  useEffect(() => {
    if (!settings) return

    // Setup listener for system theme changes if appearance is 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (settings.appearance === 'system') {
        if (e.matches) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [settings?.appearance])

  const refreshSettings = async () => {
    try {
      const data = await uiSettingsService.getActiveSettings()
      setSettings(data)
      applyThemeAndStyles(data)
    } catch (error) {
      console.error('Error refreshing UI settings:', error)
    }
  }

  return (
    <UiSettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </UiSettingsContext.Provider>
  )
}

export const useUiSettings = () => {
  const context = useContext(UiSettingsContext)
  if (!context) {
    throw new Error('useUiSettings must be used within a UiSettingsProvider')
  }
  return context
}
