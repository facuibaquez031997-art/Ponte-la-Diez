import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { TOKEN_KEY } from '../services/api'
import { authService } from '../services/auth.service'
import type { AuthResponse, LoginPayload, RegisterPayload, UserProfile } from '../types/auth'
import { AuthContext, type AuthContextValue } from './AuthContext'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(() => !!localStorage.getItem(TOKEN_KEY))

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return
    authService
      .me()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  const startSession = useCallback((res: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, res.accessToken)
    setUser(res.user)
    return res.user
  }, [])

  const login = useCallback(
    (payload: LoginPayload) => authService.login(payload).then(startSession),
    [startSession]
  )

  const register = useCallback(
    (payload: RegisterPayload) => authService.register(payload).then(startSession),
    [startSession]
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
