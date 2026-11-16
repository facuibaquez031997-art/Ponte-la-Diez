import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { Cancha, Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { CanchaFotosService } from './cancha-fotos.service.js'
import type { ComparteConDto } from './dto/comparte-con.dto.js'
import type { CreateCanchaDto } from './dto/create-cancha.dto.js'
import type { ListCanchasQuery } from './dto/list-canchas.query.js'
import type { UpdateCanchaDto } from './dto/update-cancha.dto.js'

// Oldest photo first: the first one is the cover.
const FOTOS_INCLUDE = {
  fotos: { orderBy: { createdAt: 'asc' as const }, select: { id: true, url: true } },
} satisfies Prisma.CanchaInclude

export type CanchaWithFotos = Prisma.CanchaGetPayload<{ include: typeof FOTOS_INCLUDE }>

/** A court of the owner that shares its physical space with a court of another entry. */
export interface ComparteCon {
  /** The other entry. */
  canchaId: string
  /** Which court of THIS entry (0 = all of them). */
  numero: number
  /** Which court of the OTHER entry (0 = all of them). */
  otraNumero: number
}

/** A court of the owner, with the courts of the other entries that share its physical space. */
export type CanchaMine = CanchaWithFotos & { comparteCon: ComparteCon[] }

@Injectable()
export class CanchasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fotos: CanchaFotosService
  ) {}

  create(ownerId: string, dto: CreateCanchaDto): Promise<Cancha> {
    const { comparteCon, ...data } = dto
    if (comparteCon === undefined) return this.prisma.cancha.create({ data: { ...data, ownerId } })

    return this.prisma.$transaction(async (tx) => {
      const cancha = await tx.cancha.create({ data: { ...data, ownerId } })
      await this.replaceLinks(tx, ownerId, cancha.id, comparteCon)
      return cancha
    })
  }

  async listMine(ownerId: string): Promise<CanchaMine[]> {
    const canchas = await this.prisma.cancha.findMany({
      where: { ownerId },
      orderBy: { nombre: 'asc' },
      include: {
        ...FOTOS_INCLUDE,
        comparteCon: { select: { otraCanchaId: true, numero: true, otraNumero: true } },
      },
    })
    return canchas.map(({ comparteCon, ...cancha }) => ({
      ...cancha,
      comparteCon: comparteCon.map((link) => ({
        canchaId: link.otraCanchaId,
        numero: link.numero,
        otraNumero: link.otraNumero,
      })),
    }))
  }

  list(filters: ListCanchasQuery): Promise<CanchaWithFotos[]> {
    const where: Prisma.CanchaWhereInput = {}
    if (filters.barrio) where.barrio = filters.barrio
    if (filters.tipoSuperficie) where.tipoSuperficie = filters.tipoSuperficie
    if (filters.jugadores !== undefined) where.jugadores = filters.jugadores
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
    const { comparteCon, ...data } = dto
    if (comparteCon === undefined && data.cantidad === undefined) {
      return this.prisma.cancha.update({ where: { id }, data })
    }

    return this.prisma.$transaction(async (tx) => {
      const cancha = await tx.cancha.update({ where: { id }, data })
      if (comparteCon !== undefined) {
        await this.replaceLinks(tx, ownerId, id, comparteCon)
      } else if (data.cantidad !== undefined) {
        // Fewer courts: the links to the courts that no longer exist have nothing to point to.
        await tx.canchaConflicto.deleteMany({
          where: {
            OR: [
              { canchaId: id, numero: { gt: data.cantidad } },
              { otraCanchaId: id, otraNumero: { gt: data.cantidad } },
            ],
          },
        })
      }
      return cancha
    })
  }

  /**
   * Sets which courts of this entry share the physical space with which courts of the owner's
   * other entries (0 = all the courts of that entry). A link is the same from both sides, so it is
   * stored both ways: a paid booking of either blocks the other.
   */
  private async replaceLinks(
    tx: Prisma.TransactionClient,
    ownerId: string,
    canchaId: string,
    links: ComparteConDto[]
  ): Promise<void> {
    if (links.some((link) => link.canchaId === canchaId)) {
      throw new BadRequestException('Una cancha no puede compartir el espacio consigo misma')
    }

    const wanted = [
      ...new Map(
        links.map((link) => {
          const item = {
            canchaId: link.canchaId,
            numero: link.numero ?? 0,
            otraNumero: link.otraNumero ?? 0,
          }
          return [`${item.canchaId}#${item.numero}#${item.otraNumero}`, item] as const
        })
      ).values(),
    ]

    const [self, others] = await Promise.all([
      tx.cancha.findUnique({ where: { id: canchaId }, select: { cantidad: true } }),
      tx.cancha.findMany({
        where: { id: { in: [...new Set(wanted.map((link) => link.canchaId))] }, ownerId },
        select: { id: true, cantidad: true },
      }),
    ])
    const quantity = new Map(others.map((other) => [other.id, other.cantidad]))
    if (quantity.size !== new Set(wanted.map((link) => link.canchaId)).size) {
      throw new BadRequestException('Solo podés vincular canchas tuyas')
    }
    for (const link of wanted) {
      if (link.numero > (self?.cantidad ?? 1)) {
        throw new BadRequestException(
          `Esta cancha tiene ${self?.cantidad ?? 1} y no hay una cancha número ${link.numero}`
        )
      }
      if (link.otraNumero > (quantity.get(link.canchaId) ?? 1)) {
        throw new BadRequestException(
          `La otra cancha tiene ${quantity.get(link.canchaId) ?? 1} y no hay una cancha número ${link.otraNumero}`
        )
      }
    }

    await tx.canchaConflicto.deleteMany({
      where: { OR: [{ canchaId }, { otraCanchaId: canchaId }] },
    })
    if (wanted.length > 0) {
      await tx.canchaConflicto.createMany({
        data: wanted.flatMap((link) => [
          {
            canchaId,
            numero: link.numero,
            otraCanchaId: link.canchaId,
            otraNumero: link.otraNumero,
          },
          {
            canchaId: link.canchaId,
            numero: link.otraNumero,
            otraCanchaId: canchaId,
            otraNumero: link.numero,
          },
        ]),
      })
    }
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
      // The history of a court is deleted with it. Keep it while it holds money that was paid:
      // a refund may still be pending and the payment id would be lost.
      const withMoney = await tx.historialReserva.count({
        where: { canchaId: id, montoPagado: { gt: 0 } },
      })
      if (withMoney > 0) {
        throw new ConflictException(
          'No se puede borrar una cancha con cobros o devoluciones en su historial'
        )
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
