import { api } from './api'
import type { UpdateProfilePayload, UserProfile } from '../types/auth'

export const usersService = {
  barrios: () => api.get<string[]>('/users/barrios').then((r) => r.data),
  updateProfile: (payload: UpdateProfilePayload) =>
    api.patch<UserProfile>('/users/me', payload).then((r) => r.data),
}
