export type Role = 'PLAYER' | 'OWNER'

export interface UserProfile {
  id: string
  nombre: string
  email: string
  rol: Role
  telefono: string | null
  barrioPontevedra: string | null
  avatarUrl: string | null
}

export interface AvatarUploadSignature {
  cloudName: string
  apiKey: string
  timestamp: number
  signature: string
  publicId: string
  allowedFormats: string
  overwrite: boolean
  invalidate: boolean
}

export interface AuthResponse {
  accessToken: string
  user: UserProfile
}

export interface LoginPayload {
  email: string
  password: string
}

export interface UpdateProfilePayload {
  nombre?: string
  telefono?: string
  barrioPontevedra?: string
}

export interface RegisterPayload {
  nombre: string
  email: string
  password: string
  rol?: Role
  telefono?: string
  barrioPontevedra?: string
}
