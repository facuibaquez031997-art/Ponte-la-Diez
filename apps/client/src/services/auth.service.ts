import { api } from './api'
import type { AuthResponse, LoginPayload, RegisterPayload, UserProfile } from '../types/auth'

export const authService = {
  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', payload).then((r) => r.data),
  register: (payload: RegisterPayload) =>
    api.post<AuthResponse>('/auth/register', payload).then((r) => r.data),
  me: () => api.get<UserProfile>('/auth/me').then((r) => r.data),
}
