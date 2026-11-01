export type Role = 'PLAYER' | 'OWNER'

export interface UserProfile {
  id: string
  nombre: string
  email: string
  rol: Role
  telefono: string | null
  barrioPontevedra: string | null
}

export interface AuthResponse {
  accessToken: string
  user: UserProfile
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  nombre: string
  email: string
  password: string
  rol?: Role
  telefono?: string
  barrioPontevedra?: string
}
