import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import type { UserProfileDto } from '../auth/dto/auth-response.dto.js'
import type { UpdateProfileDto } from './dto/update-profile.dto.js'
import { toUserProfile } from './user-profile.mapper.js'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfileDto> {
    const exists = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!exists) throw new NotFoundException('Usuario no encontrado')

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nombre: dto.nombre?.trim(),
        telefono: dto.telefono,
        barrioPontevedra: dto.barrioPontevedra,
      },
    })
    return toUserProfile(user)
  }
}
