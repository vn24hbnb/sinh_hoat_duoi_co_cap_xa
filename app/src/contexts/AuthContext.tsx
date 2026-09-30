import React, { createContext, useContext, useState, useEffect } from 'react'
import { authService } from '../services/authService'
import type { UserSession } from '../services/authService'

interface AuthContextType {
  user: UserSession | null
  loading: boolean
  login: (username: string, passwordPlain: string) => Promise<UserSession>
  changePassword: (newPasswordPlain: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Attempt to restore user session from localStorage on startup
    const storedUser = localStorage.getItem('session_user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {
        console.error('Failed to parse stored user session:', e)
        localStorage.removeItem('session_user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (username: string, passwordPlain: string): Promise<UserSession> => {
    setLoading(true)
    try {
      const session = await authService.login(username, passwordPlain)
      setUser(session)
      localStorage.setItem('session_user', JSON.stringify(session))
      return session
    } catch (error) {
      setUser(null)
      localStorage.removeItem('session_user')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const changePassword = async (newPasswordPlain: string): Promise<void> => {
    if (!user) throw new Error('Không tìm thấy phiên đăng nhập hiện tại.')
    
    setLoading(true)
    try {
      await authService.changePassword(user.id, newPasswordPlain)
      
      // Update session locally to clear change password requirement flag
      const updatedSession: UserSession = {
        ...user,
        mustChangePassword: false
      }
      setUser(updatedSession)
      localStorage.setItem('session_user', JSON.stringify(updatedSession))
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    authService.logout(user?.id)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
export default AuthContext
