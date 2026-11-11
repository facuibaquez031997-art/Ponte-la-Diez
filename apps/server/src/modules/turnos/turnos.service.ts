import { Injectable, NotFoundException } from '@nestjs/common'
import type { Turno } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { SLOT_MS, WINDOW_DAYS, buildSlots, localDayBounds, windowEnd } from './turnos-slots.js'

export type FreeTurno = Pick<Turno, 'id' | 'fechaHoraInicio' | 'fechaHoraFin'>

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

  async listFree(canchaId: string, fecha?: string, now: Date = new Date()): Promise<FreeTurno[]> {
    const day = fecha ? localDayBounds(fecha) : undefined
    const cancha = await this.prisma.cancha.findUnique({ where: { id: canchaId } })
    if (!cancha) throw new NotFoundException('La cancha no existe')

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
