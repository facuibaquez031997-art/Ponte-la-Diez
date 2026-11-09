import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { Cancha, Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import type { CreateCanchaDto } from './dto/create-cancha.dto.js'
import type { ListCanchasQuery } from './dto/list-canchas.query.js'
import type { UpdateCanchaDto } from './dto/update-cancha.dto.js'

@Injectable()
export class CanchasService {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, dto: CreateCanchaDto): Promise<Cancha> {
    return this.prisma.cancha.create({ data: { ...dto, ownerId } })
  }

  listMine(ownerId: string): Promise<Cancha[]> {
    return this.prisma.cancha.findMany({ where: { ownerId }, orderBy: { nombre: 'asc' } })
  }

  list(filters: ListCanchasQuery): Promise<Cancha[]> {
    const where: Prisma.CanchaWhereInput = {}
    if (filters.barrio) where.barrio = filters.barrio
    if (filters.tipoSuperficie) where.tipoSuperficie = filters.tipoSuperficie
    if (filters.precioMax !== undefined) where.precioHora = { lte: filters.precioMax }
    return this.prisma.cancha.findMany({ where, orderBy: { nombre: 'asc' } })
  }

  async findOne(id: string): Promise<Cancha> {
    const cancha = await this.prisma.cancha.findUnique({ where: { id } })
    if (!cancha) throw new NotFoundException('La cancha no existe')
    return cancha
  }

  async update(ownerId: string, id: string, dto: UpdateCanchaDto): Promise<Cancha> {
    await this.assertOwner(ownerId, id)
    return this.prisma.cancha.update({ where: { id }, data: dto })
  }

  async remove(ownerId: string, id: string): Promise<void> {
    await this.assertOwner(ownerId, id)
    await this.prisma.$transaction(async (tx) => {
      const booked = await tx.turno.count({
        where: { canchaId: id, OR: [{ estado: 'RESERVED' }, { reserva: { isNot: null } }] },
      })
      if (booked > 0) {
        throw new ConflictException('No se puede borrar una cancha con reservas')
      }
      await tx.turno.deleteMany({ where: { canchaId: id } })
      await tx.cancha.delete({ where: { id } })
    })
  }

  private async assertOwner(ownerId: string, id: string): Promise<Cancha> {
    const cancha = await this.findOne(id)
    if (cancha.ownerId !== ownerId) {
      throw new ForbiddenException('Esta cancha no es tuya')
    }
    return cancha
  }
}
