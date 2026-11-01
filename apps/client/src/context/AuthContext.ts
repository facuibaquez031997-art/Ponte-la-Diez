import { createContext } from 'react'
import type { LoginPayload, RegisterPayload, UserProfile } from '../types/auth'

export interface AuthContextValue {
  user: UserProfile | null
  loading: boolean
  login: (payload: LoginPayload) => Promise<UserProfile>
  register: (payload: RegisterPayload) => Promise<UserProfile>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
