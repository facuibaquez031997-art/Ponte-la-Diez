import { createContext } from 'react'
import type {
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  UserProfile,
} from '../types/auth'

export interface AuthContextValue {
  user: UserProfile | null
  loading: boolean
  login: (payload: LoginPayload) => Promise<UserProfile>
  register: (payload: RegisterPayload) => Promise<UserProfile>
  updateProfile: (payload: UpdateProfilePayload) => Promise<UserProfile>
  uploadAvatar: (file: File) => Promise<UserProfile>
  removeAvatar: () => Promise<UserProfile>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
