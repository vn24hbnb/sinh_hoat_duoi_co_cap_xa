import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../services/authService'
import type { UserSession } from '../services/authService'
import { supabase } from '../services/supabaseClient'
import { tenantService } from '../services/tenantService'
import type { Organization } from '../services/tenantService'
interface AuthContextType {
  user: UserSession | null; loading: boolean; organizationId: string | null; organizations: Organization[]
  login: (identifier: string, password: string) => Promise<UserSession>
  changePassword: (password: string) => Promise<void>; logout: () => Promise<void>; selectOrganization: (id: string) => void
}
const AuthContext = createContext<AuthContextType | undefined>(undefined)
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const applyProfile = useCallback(async (profile: UserSession | null) => {
    const directory = profile ? await tenantService.directory() : null
    const available = directory?.organizations || []
    const id = profile?.organizationId || (profile?.isGlobalAdmin ? available[0]?.id : null) || null
    tenantService.setOrganizationId(id); setOrganizationId(id); setOrganizations(available); setUser(profile)
  }, [])
  useEffect(() => {
    let disposed = false
    localStorage.removeItem('session_user')
    const refresh = async () => {
      try { const p = await authService.currentProfile(); if (!disposed) await applyProfile(p) }
      catch { if (!disposed) await applyProfile(null) }
      finally { if (!disposed) setLoading(false) }
    }
    void refresh()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      // Defer Auth calls until the event lock is released.
      if (event === 'SIGNED_OUT') { tenantService.setOrganizationId(null); setUser(null); setOrganizationId(null) }
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') setTimeout(() => { if (!disposed) void refresh() }, 0)
    })
    return () => { disposed = true; subscription.unsubscribe() }
  }, [applyProfile])
  const login = async (identifier: string, password: string) => { const p = await authService.login(identifier, password); await applyProfile(p); return p }
  const logout = async () => { await authService.logout(); await applyProfile(null) }
  const changePassword = async (password: string) => { if (!user) throw new Error('Vui lòng đăng nhập lại.'); await authService.changePassword(user.id, password) }
  const selectOrganization = (id: string) => {
    if (!user?.isGlobalAdmin || !organizations.some(item => item.id === id)) return
    tenantService.setOrganizationId(id); setOrganizationId(id)
  }
  return <AuthContext.Provider value={{ user, loading, login, logout, changePassword, organizationId, organizations, selectOrganization }}>{children}</AuthContext.Provider>
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within AuthProvider'); return context }
export default AuthContext
