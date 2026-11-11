import 'reflect-metadata'
import { vi } from 'vitest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { TurnosService } from './turnos.service.js'

const now = new Date('2026-11-09T15:00:00.000Z') // Mon 12:00 local
const slot = (iso: string) => new Date(iso)
const HOUR = 3_600_000

// Monday 17:00-20:00 local = 20:00, 21:00, 22:00 UTC
const mondaySchedule = [{ diaSemana: 1, minutoInicio: 1020, minutoFin: 1200 }]

const makePrisma = () => ({
  cancha: { findUnique: vi.fn(async (_args?: object) => ({ id: 'c1' }) as unknown) },
  horarioCancha: { findMany: vi.fn(async (_args?: object) => mondaySchedule as unknown[]) },
  turno: {
    findMany: vi.fn(async (_args?: object) => [] as unknown[]),
    createMany: vi.fn(async (_args?: object) => ({ count: 0 })),
    deleteMany: vi.fn(async (_args?: object) => ({ count: 0 })),
  },
})

const existing = (id: string, iso: string, estado: string) => ({
  id,
  fechaHoraInicio: slot(iso),
  estado,
})

describe('TurnosService.sync', () => {
  it('creates the missing slots with a one-hour end', async () => {
    const prisma = makePrisma()
    await new TurnosService(prisma as never).sync('c1', now, 1)
    const call = prisma.turno.createMany.mock.calls[0][0] as {
      data: { canchaId: string; fechaHoraInicio: Date; fechaHoraFin: Date }[]
      skipDuplicates: boolean
    }
    expect(call.skipDuplicates).toBe(true)
    expect(call.data.map((d) => d.fechaHoraInicio.toISOString())).toEqual([
      '2026-11-09T20:00:00.000Z',
      '2026-11-09T21:00:00.000Z',
      '2026-11-09T22:00:00.000Z',
    ])
    expect(call.data.every((d) => d.canchaId === 'c1')).toBe(true)
    expect(call.data[0].fechaHoraFin.getTime() - call.data[0].fechaHoraInicio.getTime()).toBe(HOUR)
  })

  it('does not recreate slots that already exist and is idempotent', async () => {
    const prisma = makePrisma()
    prisma.turno.findMany.mockResolvedValue([
      existing('t1', '2026-11-09T20:00:00.000Z', 'FREE'),
      existing('t2', '2026-11-09T21:00:00.000Z', 'FREE'),
      existing('t3', '2026-11-09T22:00:00.000Z', 'FREE'),
    ])
    await new TurnosService(prisma as never).sync('c1', now, 1)
    expect(prisma.turno.createMany).not.toHaveBeenCalled()
    expect(prisma.turno.deleteMany).not.toHaveBeenCalled()
  })

  it('creates only the slots that are missing', async () => {
    const prisma = makePrisma()
    prisma.turno.findMany.mockResolvedValue([existing('t1', '2026-11-09T20:00:00.000Z', 'FREE')])
    await new TurnosService(prisma as never).sync('c1', now, 1)
    const call = prisma.turno.createMany.mock.calls[0][0] as { data: { fechaHoraInicio: Date }[] }
    expect(call.data).toHaveLength(2)
  })

  it('prunes FREE slots that left the schedule', async () => {
    const prisma = makePrisma()
    prisma.turno.findMany.mockResolvedValue([
      existing('t1', '2026-11-09T20:00:00.000Z', 'FREE'),
      existing('t2', '2026-11-09T21:00:00.000Z', 'FREE'),
      existing('t3', '2026-11-09T22:00:00.000Z', 'FREE'),
      existing('gone', '2026-11-09T23:00:00.000Z', 'FREE'),
    ])
    await new TurnosService(prisma as never).sync('c1', now, 1)
    expect(prisma.turno.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['gone'] }, estado: 'FREE', reserva: null },
    })
  })

  it('never prunes RESERVED or BLOCKED slots, even outside the schedule', async () => {
    const prisma = makePrisma()
    prisma.turno.findMany.mockResolvedValue([
      existing('t1', '2026-11-09T20:00:00.000Z', 'FREE'),
      existing('t2', '2026-11-09T21:00:00.000Z', 'FREE'),
      existing('t3', '2026-11-09T22:00:00.000Z', 'FREE'),
      existing('booked', '2026-11-09T23:00:00.000Z', 'RESERVED'),
      existing('blocked', '2026-11-10T00:00:00.000Z', 'BLOCKED'),
    ])
    await new TurnosService(prisma as never).sync('c1', now, 1)
    expect(prisma.turno.deleteMany).not.toHaveBeenCalled()
  })

  it('a booked slot inside the schedule is kept and not duplicated', async () => {
    const prisma = makePrisma()
    prisma.turno.findMany.mockResolvedValue([
      existing('booked', '2026-11-09T20:00:00.000Z', 'RESERVED'),
    ])
    await new TurnosService(prisma as never).sync('c1', now, 1)
    const call = prisma.turno.createMany.mock.calls[0][0] as { data: { fechaHoraInicio: Date }[] }
    expect(call.data.map((d) => d.fechaHoraInicio.toISOString())).not.toContain(
      '2026-11-09T20:00:00.000Z'
    )
  })

  it('an empty schedule prunes every FREE future slot', async () => {
    const prisma = makePrisma()
    prisma.horarioCancha.findMany.mockResolvedValue([])
    prisma.turno.findMany.mockResolvedValue([existing('t1', '2026-11-09T20:00:00.000Z', 'FREE')])
    await new TurnosService(prisma as never).sync('c1', now, 1)
    expect(prisma.turno.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['t1'] }, estado: 'FREE', reserva: null },
    })
    expect(prisma.turno.createMany).not.toHaveBeenCalled()
  })

  it('only looks at slots that have not started and are inside the window', async () => {
    const prisma = makePrisma()
    await new TurnosService(prisma as never).sync('c1', now, 14)
    const where = (prisma.turno.findMany.mock.calls[0][0] as { where: Record<string, unknown> })
      .where
    expect(where.canchaId).toBe('c1')
    expect(where.fechaHoraInicio).toEqual({
      gte: now,
      lt: new Date('2026-11-23T03:00:00.000Z'),
    })
  })
})

describe('TurnosService.listFree', () => {
  it('404 when the court does not exist', async () => {
    const prisma = makePrisma()
    prisma.cancha.findUnique.mockResolvedValue(null)
    await expect(new TurnosService(prisma as never).listFree('nope')).rejects.toBeInstanceOf(
      NotFoundException
    )
  })

  it('400 for an impossible date', async () => {
    const service = new TurnosService(makePrisma() as never)
    await expect(service.listFree('c1', '2026-02-30', now)).rejects.toBeInstanceOf(
      BadRequestException
    )
  })

  it('syncs first and lists only FREE slots of that local day, ordered', async () => {
    const prisma = makePrisma()
    await new TurnosService(prisma as never).listFree('c1', '2026-11-09', now)
    const calls = prisma.turno.findMany.mock.calls
    const listCall = calls[calls.length - 1][0] as {
      where: Record<string, unknown>
      orderBy: unknown
    }
    expect(listCall.where).toEqual({
      canchaId: 'c1',
      estado: 'FREE',
      fechaHoraInicio: {
        gte: new Date('2026-11-09T15:00:00.000Z'),
        lt: new Date('2026-11-10T03:00:00.000Z'),
      },
    })
    expect(listCall.orderBy).toEqual({ fechaHoraInicio: 'asc' })
  })

  it('without a date lists every FREE slot that has not started', async () => {
    const prisma = makePrisma()
    await new TurnosService(prisma as never).listFree('c1', undefined, now)
    const calls = prisma.turno.findMany.mock.calls
    const listCall = calls[calls.length - 1][0] as { where: Record<string, unknown> }
    expect(listCall.where).toEqual({
      canchaId: 'c1',
      estado: 'FREE',
      fechaHoraInicio: { gte: now },
    })
  })
})
