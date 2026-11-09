import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { Cancha, Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { CanchaFotosService } from './cancha-fotos.service.js'
import type { CreateCanchaDto } from './dto/create-cancha.dto.js'
import type { ListCanchasQuery } from './dto/list-canchas.query.js'
import type { UpdateCanchaDto } from './dto/update-cancha.dto.js'

// Oldest photo first: the first one is the cover.
const FOTOS_INCLUDE = {
  fotos: { orderBy: { createdAt: 'asc' as const }, select: { id: true, url: true } },
} satisfies Prisma.CanchaInclude

export type CanchaWithFotos = Prisma.CanchaGetPayload<{ include: typeof FOTOS_INCLUDE }>

@Injectable()
export class CanchasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fotos: CanchaFotosService
  ) {}

  create(ownerId: string, dto: CreateCanchaDto): Promise<Cancha> {
    return this.prisma.cancha.create({ data: { ...dto, ownerId } })
  }

  listMine(ownerId: string): Promise<CanchaWithFotos[]> {
    return this.prisma.cancha.findMany({
      where: { ownerId },
      orderBy: { nombre: 'asc' },
      include: FOTOS_INCLUDE,
    })
  }

  list(filters: ListCanchasQuery): Promise<CanchaWithFotos[]> {
    const where: Prisma.CanchaWhereInput = {}
    if (filters.barrio) where.barrio = filters.barrio
    if (filters.tipoSuperficie) where.tipoSuperficie = filters.tipoSuperficie
    if (filters.precioMax !== undefined) where.precioHora = { lte: filters.precioMax }
    return this.prisma.cancha.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: FOTOS_INCLUDE,
    })
  }

  async findOne(id: string): Promise<CanchaWithFotos> {
    const cancha = await this.prisma.cancha.findUnique({
      where: { id },
      include: FOTOS_INCLUDE,
    })
    if (!cancha) throw new NotFoundException('La cancha no existe')
    return cancha
  }

  async update(ownerId: string, id: string, dto: UpdateCanchaDto): Promise<Cancha> {
    await this.assertOwner(ownerId, id)
    return this.prisma.cancha.update({ where: { id }, data: dto })
  }

  async remove(ownerId: string, id: string): Promise<void> {
    await this.assertOwner(ownerId, id)
    let publicIds: string[] = []
    await this.prisma.$transaction(async (tx) => {
      const booked = await tx.turno.count({
        where: { canchaId: id, OR: [{ estado: 'RESERVED' }, { reserva: { isNot: null } }] },
      })
      if (booked > 0) {
        throw new ConflictException('No se puede borrar una cancha con reservas')
      }
      const fotos = await tx.canchaFoto.findMany({
        where: { canchaId: id },
        select: { publicId: true },
      })
      publicIds = fotos.map((foto) => foto.publicId)
      await tx.turno.deleteMany({ where: { canchaId: id } })
      await tx.cancha.delete({ where: { id } })
    })
    await this.fotos.destroyAssets(publicIds)
  }

  private async assertOwner(ownerId: string, id: string): Promise<Cancha> {
    const cancha = await this.findOne(id)
    if (cancha.ownerId !== ownerId) {
      throw new ForbiddenException('Esta cancha no es tuya')
    }
    return cancha
  }
}
