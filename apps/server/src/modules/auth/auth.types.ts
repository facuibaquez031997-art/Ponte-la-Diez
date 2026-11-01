import type { Role } from '@prisma/client'

export interface JwtPayload {
  sub: string
  email: string
  rol: Role
}

export interface AuthUser {
  id: string
  email: string
  rol: Role
}

export interface AuthenticatedRequest {
  user: AuthUser
}
