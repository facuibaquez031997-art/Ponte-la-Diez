import type { Role } from '@prisma/client'

export interface UserProfileDto {
  id: string
  nombre: string
  email: string
  rol: Role
  telefono: string | null
  barrioPontevedra: string | null
}

export interface AuthResponseDto {
  accessToken: string
  user: UserProfileDto
}
