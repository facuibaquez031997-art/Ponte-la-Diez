import { api } from './api'
import type { AvatarUploadSignature, UpdateProfilePayload, UserProfile } from '../types/auth'

export const usersService = {
  barrios: () => api.get<string[]>('/users/barrios').then((r) => r.data),
  updateProfile: (payload: UpdateProfilePayload) =>
    api.patch<UserProfile>('/users/me', payload).then((r) => r.data),
  avatarSignature: () =>
    api.post<AvatarUploadSignature>('/users/me/avatar/signature').then((r) => r.data),
  confirmAvatar: () => api.post<UserProfile>('/users/me/avatar').then((r) => r.data),
  removeAvatar: () => api.delete<UserProfile>('/users/me/avatar').then((r) => r.data),
}
