import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import type { User } from '../types/chat'
import * as authService from '../services/auth'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = authService.getStoredAuth()
    if (stored) {
      setUser(stored.user)
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await authService.login({ email, password })
    setUser(response.user)
  }, [])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const response = await authService.signup({ name, email, password })
    setUser(response.user)
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
    window.location.href = '/';
  }, [])

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
