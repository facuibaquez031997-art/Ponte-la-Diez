import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type {
  Cancha,
  EstadoDevolucion,
  MotivoCierre,
  Pago,
  Prisma,
  Reserva,
  ReservaState,
  Turno,
} from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import type { CreateReservaDto } from './dto/create-reserva.dto.js'
import { type Blocked, findBlocked } from '../turnos/conflicts.js'
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
  conversacion: { select: { id: true, ultimoMensajeAt: true } },
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
  /** The chat the player opened for this booking, once it has messages; the owner never starts one. */
  conversacionId: string | null
}

type StoredOwnerReserva = StoredReserva & {
  createdAt: Date
  user: { nombre: string; avatarUrl: string | null }
  conversacion?: { id: string; ultimoMensajeAt: Date | null } | null
}

function toOwnerView(reserva: StoredOwnerReserva): OwnerReservaView {
  return {
    ...toView(reserva),
    // Only these two fields leave the server, whatever else the query brought.
    jugador: { nombre: reserva.user.nombre, avatarUrl: reserva.user.avatarUrl },
    expiraEl: reserva.estado === 'PENDING' ? new Date(reserva.createdAt.getTime() + HOLD_MS) : null,
    conversacionId: reserva.conversacion?.ultimoMensajeAt ? reserva.conversacion.id : null,
  }
}

/** A booking that stopped existing, as the owner of the court sees it. */
export interface HistorialView {
  id: string
  motivo: MotivoCierre
  devolucion: EstadoDevolucion
  cancha: { id: string; nombre: string }
  jugador: { nombre: string; avatarUrl: string | null }
  turnoInicio: Date
  turnoFin: Date
  montoTotal: number
  /** What the player paid online (zero when the booking expired unpaid). */
  montoPagado: number
  devueltoAt: Date | null
  reservadaAt: Date
  cerradaAt: Date
}

const historialInclude = {
  cancha: { select: { id: true, nombre: true } },
  jugador: { select: { nombre: true, avatarUrl: true } },
} as const

type StoredHistorial = Omit<HistorialView, 'cancha' | 'jugador'> & {
  cancha: { id: string; nombre: string }
  jugador: { nombre: string; avatarUrl: string | null }
}

// Field by field on purpose: the payment id, the player id and any contact data stay inside.
function toHistorialView(row: StoredHistorial): HistorialView {
  return {
    id: row.id,
    motivo: row.motivo,
    devolucion: row.devolucion,
    turnoInicio: row.turnoInicio,
    turnoFin: row.turnoFin,
    montoTotal: row.montoTotal,
    montoPagado: row.montoPagado,
    devueltoAt: row.devueltoAt,
    reservadaAt: row.reservadaAt,
    cerradaAt: row.cerradaAt,
    cancha: { id: row.cancha.id, nombre: row.cancha.nombre },
    jugador: { nombre: row.jugador.nombre, avatarUrl: row.jugador.avatarUrl },
  }
}

export interface CancelResult {
  historialId: string
  /** What the player paid online and is entitled to get back from the owner. */
  montoPagado: number
  devolucion: EstadoDevolucion
}

@Injectable()
export class ReservasService {
  private readonly logger = new Logger(ReservasService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

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

    // The whole owner, not only this court: an unpaid booking that expired in an entry that shares
    // the space would keep this slot blocked.
    await releaseExpiredHolds(this.prisma, now, { ownerId: turno.cancha.ownerId })

    const reserva = await this.prisma.$transaction(async (tx) => {
      // Entries that share the physical space are checked together. One lock per owner and hour
      // makes two bookings of linked entries wait for each other, so the second one sees what the
      // first one confirmed instead of both going through. Only a confirmed (paid) booking blocks
      // the linked courts; one that still waits for its payment holds just its own slot.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${turno.cancha.ownerId}), hashtext(${turno.fechaHoraInicio.toISOString()}))`
      const blocked = await findBlocked(tx, [turno.canchaId], {
        gte: turno.fechaHoraInicio,
        lte: turno.fechaHoraInicio,
      })

      const claim = await this.claimSlot(tx, turno, blocked)
      if (!claim.turnoId) {
        throw new ConflictException(
          claim.blockedFree
            ? 'Ese horario no está disponible: otra cancha que comparte el espacio ya está confirmada'
            : 'El turno ya fue reservado'
        )
      }
      const turnoId = claim.turnoId

      return tx.reserva.create({
        data: {
          turnoId,
          userId,
          montoTotal: turno.cancha.precioHora,
          pago: { create: { monto, estadoPago: 'PENDING' } },
        },
        include: reservaInclude,
      })
    })
    return toView(reserva)
  }

  /**
   * Takes the slot the player chose, or, when somebody took it a moment ago, another court of the
   * same entry at the same hour (an entry with two courts has two slots per hour). Every try is a
   * single conditional update, so two players racing never get the same slot. Returns the id of
   * the slot taken, or null when the hour has no free court left.
   */
  private async claimSlot(
    tx: Prisma.TransactionClient,
    turno: Pick<Turno, 'id' | 'canchaId' | 'fechaHoraInicio' | 'numero' | 'estado'>,
    blocked: Blocked
  ): Promise<{ turnoId: string | null; blockedFree: boolean }> {
    // A free court that was left out only because a linked court holds its space.
    let blockedFree = false
    const usable = (numero: number, free: boolean): boolean => {
      if (!blocked.of(turno.canchaId, turno.fechaHoraInicio, numero)) return true
      if (free) blockedFree = true
      return false
    }
    const take = async (id: string): Promise<boolean> => {
      const claimed = await tx.turno.updateMany({
        where: { id, estado: 'FREE' },
        data: { estado: 'RESERVED' },
      })
      return claimed.count === 1
    }

    if (usable(turno.numero, turno.estado === 'FREE') && (await take(turno.id))) {
      return { turnoId: turno.id, blockedFree }
    }

    const others = await tx.turno.findMany({
      where: {
        canchaId: turno.canchaId,
        fechaHoraInicio: turno.fechaHoraInicio,
        estado: 'FREE',
        id: { not: turno.id },
      },
      orderBy: { numero: 'asc' },
      select: { id: true, numero: true },
    })
    for (const other of others) {
      if (usable(other.numero, true) && (await take(other.id))) {
        return { turnoId: other.id, blockedFree }
      }
    }
    return { turnoId: null, blockedFree }
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

  /**
   * The owner cancels a booking that has not started (for example nobody can play). The slot goes
   * back to FREE and a history record keeps what was paid: the refund is made by the owner outside
   * the app and stays "pending" until the owner marks it as done.
   */
  async cancelByOwner(
    ownerId: string,
    reservaId: string,
    now: Date = new Date()
  ): Promise<CancelResult> {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id: reservaId },
      include: { turno: { include: { cancha: true } } },
    })
    // Another owner's booking answers 404 so its existence is not revealed.
    if (!reserva || reserva.turno.cancha.ownerId !== ownerId) {
      throw new NotFoundException('La reserva no existe')
    }
    if (reserva.turno.fechaHoraInicio <= now) {
      throw new ConflictException('El turno ya empezó: no se puede cancelar')
    }
    if (reserva.estado !== 'PENDING' && reserva.estado !== 'CONFIRMED') {
      throw new ConflictException('La reserva ya no está activa')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Compare and set on the state that was read: a webhook confirming the booking at the same
      // moment either wins before this point (and we stop) or finds nothing to confirm after it.
      const claimed = await tx.reserva.updateMany({
        where: { id: reserva.id, estado: reserva.estado },
        data: { estado: 'CANCELLED' },
      })
      if (claimed.count === 0) {
        throw new ConflictException(
          'La reserva cambió mientras la cancelabas: revisala y probá de nuevo'
        )
      }

      const pago = await tx.pago.findUnique({ where: { reservaId: reserva.id } })
      const montoPagado = pago?.estadoPago === 'APPROVED' ? pago.monto : 0
      const devolucion: EstadoDevolucion = montoPagado > 0 ? 'PENDIENTE' : 'NO_CORRESPONDE'

      const historial = await tx.historialReserva.create({
        data: {
          canchaId: reserva.turno.canchaId,
          jugadorId: reserva.userId,
          turnoInicio: reserva.turno.fechaHoraInicio,
          turnoFin: reserva.turno.fechaHoraFin,
          montoTotal: reserva.montoTotal,
          montoPagado,
          mpPaymentId: pago?.mpPaymentId ?? null,
          motivo: 'CANCELADA_DUENO',
          devolucion,
          reservadaAt: reserva.createdAt,
        },
      })
      await tx.pago.deleteMany({ where: { reservaId: reserva.id } })
      await tx.reserva.delete({ where: { id: reserva.id } })
      await tx.turno.update({ where: { id: reserva.turnoId }, data: { estado: 'FREE' } })
      return { historialId: historial.id, montoPagado, devolucion }
    })

    // The cancellation already happened: a failed notice must not undo or hide it.
    try {
      await this.notifications.notifyBookingCancelled({
        jugadorId: reserva.userId,
        canchaNombre: reserva.turno.cancha.nombre,
        turnoInicio: reserva.turno.fechaHoraInicio,
        montoPagado: result.montoPagado,
      })
    } catch (error) {
      this.logger.error(
        `Could not tell the player about the cancelled booking ${reserva.id}`,
        error
      )
    }
    return result
  }

  /** Bookings of the courts of this owner that no longer exist (expired or cancelled), newest first. */
  async listHistorial(ownerId: string): Promise<HistorialView[]> {
    const rows = await this.prisma.historialReserva.findMany({
      where: { cancha: { ownerId } },
      orderBy: { cerradaAt: 'desc' },
      include: historialInclude,
    })
    return rows.map(toHistorialView)
  }

  /**
   * The owner says the refund was made (outside the app). Answers the same when it was already
   * marked; refuses when the record had nothing to return.
   */
  async markRefunded(
    ownerId: string,
    historialId: string,
    now: Date = new Date()
  ): Promise<HistorialView> {
    const updated = await this.prisma.historialReserva.updateMany({
      where: { id: historialId, devolucion: 'PENDIENTE', cancha: { ownerId } },
      data: { devolucion: 'HECHA', devueltoAt: now },
    })
    const row = await this.prisma.historialReserva.findFirst({
      where: { id: historialId, cancha: { ownerId } },
      include: historialInclude,
    })
    // Another owner's record answers 404 so its existence is not revealed.
    if (!row) throw new NotFoundException('El registro no existe')
    if (updated.count === 0 && row.devolucion === 'NO_CORRESPONDE') {
      throw new ConflictException('Esa reserva no tenía nada para devolver')
    }
    return toHistorialView(row)
  }
}
