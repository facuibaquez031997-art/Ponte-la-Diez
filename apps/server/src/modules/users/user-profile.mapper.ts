import type { User } from '@prisma/client'
import type { UserProfileDto } from '../auth/dto/auth-response.dto.js'

export const toUserProfile = (user: User): UserProfileDto => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  rol: user.rol,
  telefono: user.telefono,
  barrioPontevedra: user.barrioPontevedra,
})
