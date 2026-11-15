import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { Cancha, Pago, Reserva, ReservaState, Turno } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import type { CreateReservaDto } from './dto/create-reserva.dto.js'
import { HOLD_MS, releaseExpiredHolds } from './holds.js'

type StoredReserva = Pick<Reserva, 'id' | 'estado' | 'montoTotal'> & {
  turno: Pick<Turno, 'fechaHoraInicio' | 'fechaHoraFin'> & {
    cancha: Pick<Cancha, 'id' | 'nombre' | 'direccion' | 'barrio'>
  }
  pago: Pick<Pago, 'estadoPago' | 'monto'> | null
}

export interface ReservaView {
  id: string
  estado: ReservaState
  fechaHoraInicio: Date
  fechaHoraFin: Date
  cancha: Pick<Cancha, 'id' | 'nombre' | 'direccion' | 'barrio'>
  /** Full price of the slot. */
  montoTotal: number
  /** What is waiting to be paid online right now, or null when nothing is pending. */
  montoACobrar: number | null
  /** What the player already paid online (APPROVED payment only). */
  montoPagado: number
  /** What is left to pay at the court to the owner. */
  montoRestante: number
}

const reservaInclude = {
  turno: {
    select: {
      fechaHoraInicio: true,
      fechaHoraFin: true,
      cancha: { select: { id: true, nombre: true, direccion: true, barrio: true } },
    },
  },
  pago: { select: { estadoPago: true, monto: true } },
} as const

const ownerInclude = {
  ...reservaInclude,
  user: { select: { nombre: true, avatarUrl: true } },
} as const

function toView(reserva: StoredReserva): ReservaView {
  const montoPagado = reserva.pago?.estadoPago === 'APPROVED' ? reserva.pago.monto : 0
  return {
    id: reserva.id,
    estado: reserva.estado,
    fechaHoraInicio: reserva.turno.fechaHoraInicio,
    fechaHoraFin: reserva.turno.fechaHoraFin,
    cancha: reserva.turno.cancha,
    montoTotal: reserva.montoTotal,
    montoACobrar: reserva.pago?.estadoPago === 'PENDING' ? reserva.pago.monto : null,
    montoPagado,
    montoRestante: Math.max(reserva.montoTotal - montoPagado, 0),
  }
}

/** A booking as the owner of the court sees it: no contact data of the player. */
export interface OwnerReservaView extends ReservaView {
  jugador: { nombre: string; avatarUrl: string | null }
  /** When an unpaid booking stops holding the slot, or null once it is not waiting anymore. */
  expiraEl: Date | null
}

type StoredOwnerReserva = StoredReserva & {
  createdAt: Date
  user: { nombre: string; avatarUrl: string | null }
}

function toOwnerView(reserva: StoredOwnerReserva): OwnerReservaView {
  return {
    ...toView(reserva),
    // Only these two fields leave the server, whatever else the query brought.
    jugador: { nombre: reserva.user.nombre, avatarUrl: reserva.user.avatarUrl },
    expiraEl: reserva.estado === 'PENDING' ? new Date(reserva.createdAt.getTime() + HOLD_MS) : null,
  }
}

@Injectable()
export class ReservasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateReservaDto,
    now: Date = new Date()
  ): Promise<ReservaView> {
    const turno = await this.prisma.turno.findUnique({
      where: { id: dto.turnoId },
      include: { cancha: true },
    })
    if (!turno) throw new NotFoundException('El turno no existe')
    if (turno.fechaHoraInicio <= now) throw new BadRequestException('El turno ya empezó')

    const monto = dto.tipoPago === 'SENA' ? turno.cancha.montoSena : turno.cancha.precioHora
    if (!(monto > 0)) throw new BadRequestException('El monto a pagar debe ser mayor a cero')

    await releaseExpiredHolds(this.prisma, now, { canchaId: turno.canchaId })

    const reserva = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.turno.updateMany({
        where: { id: turno.id, estado: 'FREE' },
        data: { estado: 'RESERVED' },
      })
      if (claimed.count === 0) throw new ConflictException('El turno ya fue reservado')

      return tx.reserva.create({
        data: {
          turnoId: turno.id,
          userId,
          montoTotal: turno.cancha.precioHora,
          pago: { create: { monto, estadoPago: 'PENDING' } },
        },
        include: reservaInclude,
      })
    })
    return toView(reserva)
  }

  async listMine(userId: string, now: Date = new Date()): Promise<ReservaView[]> {
    await releaseExpiredHolds(this.prisma, now, { userId })
    const reservas = await this.prisma.reserva.findMany({
      where: { userId },
      orderBy: { turno: { fechaHoraInicio: 'desc' } },
      include: reservaInclude,
    })
    return reservas.map(toView)
  }

  /** Bookings of the slots of the courts of this owner, soonest first. */
  async listForOwner(ownerId: string, now: Date = new Date()): Promise<OwnerReservaView[]> {
    await releaseExpiredHolds(this.prisma, now, { ownerId })
    const reservas = await this.prisma.reserva.findMany({
      where: { turno: { cancha: { ownerId } } },
      orderBy: { turno: { fechaHoraInicio: 'asc' } },
      include: ownerInclude,
    })
    return reservas.map(toOwnerView)
  }
}
