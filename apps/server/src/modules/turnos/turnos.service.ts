import { Injectable, NotFoundException } from '@nestjs/common'
import type { ReservaState, Turno, TurnoState } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { HOLD_MS, releaseExpiredHolds } from '../reservas/holds.js'
import {
  SLOT_MS,
  WINDOW_DAYS,
  buildSlots,
  localDateString,
  localDayBounds,
  windowEnd,
} from './turnos-slots.js'

export type FreeTurno = Pick<Turno, 'id' | 'fechaHoraInicio' | 'fechaHoraFin'>

/** The booking that holds a slot, as the owner of the court sees it in the agenda. */
export interface AgendaReserva {
  id: string
  estado: ReservaState
  jugador: { nombre: string; avatarUrl: string | null }
  montoTotal: number
  /** What the player already paid online (APPROVED payment only). */
  montoPagado: number
  /** What is left to collect at the court. */
  montoRestante: number
  /** When an unpaid booking stops holding the slot, or null once it is not waiting anymore. */
  expiraEl: Date | null
  /** The chat the player opened for this booking, once it has messages. */
  conversacionId: string | null
}

export interface AgendaTurno {
  id: string
  fechaHoraInicio: Date
  fechaHoraFin: Date
  estado: TurnoState
  reserva: AgendaReserva | null
}

export interface AgendaCancha {
  cancha: { id: string; nombre: string; tipoSuperficie: string; jugadores: number | null }
  turnos: AgendaTurno[]
}

export interface AgendaView {
  /** AAAA-MM-DD of the day shown. */
  fecha: string
  /** The day is further ahead than the slots are generated, so an empty day is not "closed". */
  fueraDeVentana: boolean
  canchas: AgendaCancha[]
}

@Injectable()
export class TurnosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Brings the slots of a court in line with its weekly schedule for the next days:
   * creates the missing ones and removes the FREE ones that left the schedule.
   * RESERVED and BLOCKED slots are never touched. Safe to run any number of times.
   */
  async sync(canchaId: string, now: Date = new Date(), days: number = WINDOW_DAYS): Promise<void> {
    const franjas = await this.prisma.horarioCancha.findMany({ where: { canchaId } })
    const desired = buildSlots(franjas, now, days)
    const desiredTimes = new Set(desired.map((slot) => slot.getTime()))

    const existing = await this.prisma.turno.findMany({
      where: { canchaId, fechaHoraInicio: { gte: now, lt: windowEnd(now, days) } },
      select: { id: true, fechaHoraInicio: true, estado: true },
    })
    const existingTimes = new Set(existing.map((turno) => turno.fechaHoraInicio.getTime()))

    const missing = desired.filter((slot) => !existingTimes.has(slot.getTime()))
    if (missing.length > 0) {
      await this.prisma.turno.createMany({
        data: missing.map((start) => ({
          canchaId,
          fechaHoraInicio: start,
          fechaHoraFin: new Date(start.getTime() + SLOT_MS),
        })),
        skipDuplicates: true,
      })
    }

    const stale = existing
      .filter(
        (turno) => turno.estado === 'FREE' && !desiredTimes.has(turno.fechaHoraInicio.getTime())
      )
      .map((turno) => turno.id)
    if (stale.length > 0) {
      await this.prisma.turno.deleteMany({
        where: { id: { in: stale }, estado: 'FREE', reserva: null },
      })
    }
  }

  /**
   * Every slot of every court of the owner on one day, free or not, with who booked it. Slots are
   * generated on read, so they are brought in line with the schedule first (like listFree does).
   */
  async agenda(ownerId: string, fecha?: string, now: Date = new Date()): Promise<AgendaView> {
    const date = fecha ?? localDateString(now)
    const day = localDayBounds(date)

    await releaseExpiredHolds(this.prisma, now, { ownerId })
    const canchas = await this.prisma.cancha.findMany({
      where: { ownerId },
      select: { id: true, nombre: true, tipoSuperficie: true, jugadores: true },
      orderBy: { nombre: 'asc' },
    })
    await Promise.all(canchas.map((cancha) => this.sync(cancha.id, now)))

    const turnos =
      canchas.length === 0
        ? []
        : await this.prisma.turno.findMany({
            where: {
              canchaId: { in: canchas.map((cancha) => cancha.id) },
              fechaHoraInicio: { gte: day.start, lt: day.end },
            },
            orderBy: { fechaHoraInicio: 'asc' },
            include: {
              reserva: {
                select: {
                  id: true,
                  estado: true,
                  montoTotal: true,
                  createdAt: true,
                  user: { select: { nombre: true, avatarUrl: true } },
                  pago: { select: { estadoPago: true, monto: true } },
                  conversacion: { select: { id: true, ultimoMensajeAt: true } },
                },
              },
            },
          })

    return {
      fecha: date,
      fueraDeVentana: day.start >= windowEnd(now, WINDOW_DAYS),
      canchas: canchas.map((cancha) => ({
        cancha,
        turnos: turnos
          .filter((turno) => turno.canchaId === cancha.id)
          .map((turno) => ({
            id: turno.id,
            fechaHoraInicio: turno.fechaHoraInicio,
            fechaHoraFin: turno.fechaHoraFin,
            estado: turno.estado,
            reserva: turno.reserva ? this.toAgendaReserva(turno.reserva) : null,
          })),
      })),
    }
  }

  private toAgendaReserva(reserva: {
    id: string
    estado: ReservaState
    montoTotal: number
    createdAt: Date
    user: { nombre: string; avatarUrl: string | null }
    pago: { estadoPago: string; monto: number } | null
    conversacion: { id: string; ultimoMensajeAt: Date | null } | null
  }): AgendaReserva {
    const montoPagado = reserva.pago?.estadoPago === 'APPROVED' ? reserva.pago.monto : 0
    return {
      id: reserva.id,
      estado: reserva.estado,
      // Only the name and the photo leave the server, whatever else the query brought.
      jugador: { nombre: reserva.user.nombre, avatarUrl: reserva.user.avatarUrl },
      montoTotal: reserva.montoTotal,
      montoPagado,
      montoRestante: Math.max(reserva.montoTotal - montoPagado, 0),
      expiraEl:
        reserva.estado === 'PENDING' ? new Date(reserva.createdAt.getTime() + HOLD_MS) : null,
      conversacionId: reserva.conversacion?.ultimoMensajeAt ? reserva.conversacion.id : null,
    }
  }

  async listFree(canchaId: string, fecha?: string, now: Date = new Date()): Promise<FreeTurno[]> {
    const day = fecha ? localDayBounds(fecha) : undefined
    const cancha = await this.prisma.cancha.findUnique({ where: { id: canchaId } })
    if (!cancha) throw new NotFoundException('La cancha no existe')

    await releaseExpiredHolds(this.prisma, now, { canchaId })
    await this.sync(canchaId, now)

    const from = day && day.start > now ? day.start : now
    return this.prisma.turno.findMany({
      where: {
        canchaId,
        estado: 'FREE',
        fechaHoraInicio: day ? { gte: from, lt: day.end } : { gte: from },
      },
      orderBy: { fechaHoraInicio: 'asc' },
      select: { id: true, fechaHoraInicio: true, fechaHoraFin: true },
    })
  }
}
