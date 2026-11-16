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
  reserva: { findMany: vi.fn(async (_args?: object) => [] as unknown[]) },
  // Entries that share the physical space with the one asked about: none unless a test adds them.
  canchaConflicto: {
    findMany: vi.fn(async (_args?: object) => [] as { canchaId: string; otraCanchaId: string }[]),
  },
  turno: {
    findMany: vi.fn(async (_args?: object) => [] as unknown[]),
    createMany: vi.fn(async (_args?: object) => ({ count: 0 })),
    deleteMany: vi.fn(async (_args?: object) => ({ count: 0 })),
  },
})

const existing = (id: string, iso: string, estado: string, numero = 1) => ({
  id,
  fechaHoraInicio: slot(iso),
  estado,
  numero,
})

type Created = { data: { fechaHoraInicio: Date; numero: number }[] }
const created = (prisma: ReturnType<typeof makePrisma>) =>
  (prisma.turno.createMany.mock.calls[0]?.[0] as Created | undefined)?.data.map(
    (d) => `${d.fechaHoraInicio.toISOString().slice(11, 16)}#${d.numero}`
  )

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

describe('TurnosService.sync with several courts of the same size', () => {
  const withCourts = (cantidad: number) => {
    const prisma = makePrisma()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', cantidad })
    return prisma
  }

  it('numbers the slots of a single court 1, as before', async () => {
    const prisma = makePrisma()
    await new TurnosService(prisma as never).sync('c1', now, 1)
    expect(created(prisma)).toEqual(['20:00#1', '21:00#1', '22:00#1'])
  })

  it('creates as many slots per hour as courts the entry has', async () => {
    const prisma = withCourts(2)
    await new TurnosService(prisma as never).sync('c1', now, 1)
    expect(created(prisma)).toEqual([
      '20:00#1',
      '20:00#2',
      '21:00#1',
      '21:00#2',
      '22:00#1',
      '22:00#2',
    ])
  })

  it('only adds the missing courts when the quantity goes up', async () => {
    const prisma = withCourts(2)
    prisma.turno.findMany.mockResolvedValue([
      existing('a', '2026-11-09T20:00:00.000Z', 'FREE', 1),
      existing('b', '2026-11-09T21:00:00.000Z', 'RESERVED', 1),
      existing('c', '2026-11-09T22:00:00.000Z', 'FREE', 1),
    ])
    await new TurnosService(prisma as never).sync('c1', now, 1)
    expect(created(prisma)).toEqual(['20:00#2', '21:00#2', '22:00#2'])
    expect(prisma.turno.deleteMany).not.toHaveBeenCalled()
  })

  it('removes the FREE slots above the quantity when it goes down, and keeps the booked one', async () => {
    const prisma = withCourts(1)
    prisma.turno.findMany.mockResolvedValue([
      existing('a1', '2026-11-09T20:00:00.000Z', 'FREE', 1),
      existing('a2', '2026-11-09T20:00:00.000Z', 'FREE', 2),
      existing('b1', '2026-11-09T21:00:00.000Z', 'FREE', 1),
      existing('b2', '2026-11-09T21:00:00.000Z', 'RESERVED', 2),
      existing('c1', '2026-11-09T22:00:00.000Z', 'FREE', 1),
      existing('c2', '2026-11-09T22:00:00.000Z', 'BLOCKED', 2),
    ])
    await new TurnosService(prisma as never).sync('c1', now, 1)
    expect(prisma.turno.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['a2'] }, estado: 'FREE', reserva: null },
    })
    expect(prisma.turno.createMany).not.toHaveBeenCalled()
  })

  it('is idempotent: with all the courts already there it creates and removes nothing', async () => {
    const prisma = withCourts(2)
    prisma.turno.findMany.mockResolvedValue(
      ['20', '21', '22'].flatMap((hour) => [
        existing(`${hour}-1`, `2026-11-09T${hour}:00:00.000Z`, 'FREE', 1),
        existing(`${hour}-2`, `2026-11-09T${hour}:00:00.000Z`, 'FREE', 2),
      ])
    )
    await new TurnosService(prisma as never).sync('c1', now, 1)
    expect(prisma.turno.createMany).not.toHaveBeenCalled()
    expect(prisma.turno.deleteMany).not.toHaveBeenCalled()
  })

  it('a court that does not exist anymore is treated as a single court', async () => {
    const prisma = makePrisma()
    prisma.cancha.findUnique.mockResolvedValue(null)
    await new TurnosService(prisma as never).sync('c1', now, 1)
    expect(created(prisma)).toEqual(['20:00#1', '21:00#1', '22:00#1'])
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
    // By hour, and within one hour by the number of the court.
    expect(listCall.orderBy).toEqual([{ fechaHoraInicio: 'asc' }, { numero: 'asc' }])
  })

  it('brings the number of the court of each free slot', async () => {
    const prisma = makePrisma()
    await new TurnosService(prisma as never).listFree('c1', '2026-11-09', now)
    const calls = prisma.turno.findMany.mock.calls
    const listCall = calls[calls.length - 1][0] as { select: Record<string, boolean> }
    expect(listCall.select).toEqual({
      id: true,
      fechaHoraInicio: true,
      fechaHoraFin: true,
      numero: true,
    })
  })

  it('frees the expired holds of that court before it syncs and lists', async () => {
    const prisma = makePrisma()
    await new TurnosService(prisma as never).listFree('c1', undefined, now)
    const where = (prisma.reserva.findMany.mock.calls[0][0] as { where: Record<string, unknown> })
      .where
    expect(where.estado).toBe('PENDING')
    expect(where.turno).toEqual({ canchaId: 'c1' })
    expect(prisma.reserva.findMany.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.horarioCancha.findMany.mock.invocationCallOrder[0]
    )
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

describe('TurnosService.listFree with entries that share the physical space', () => {
  const start = (iso: string) => new Date(iso)
  const free = (id: string, iso: string, numero = 1) => ({
    id,
    fechaHoraInicio: start(iso),
    fechaHoraFin: new Date(start(iso).getTime() + HOUR),
    numero,
  })
  // Court of 11 (c-11) linked with this entry (c1, courts of 5): the two directions are stored.
  const withLinks = (reservedOfTheOther: { canchaId: string; fechaHoraInicio: Date }[]) => {
    const prisma = makePrisma()
    prisma.canchaConflicto.findMany.mockResolvedValue([{ canchaId: 'c1', otraCanchaId: 'c-11' }])
    prisma.turno.findMany.mockImplementation(async (args?: object) => {
      const { estado } = (args as { where: { estado?: string } }).where
      if (estado === 'RESERVED') return reservedOfTheOther
      if (estado === 'FREE') {
        return [
          free('a1', '2026-11-09T20:00:00.000Z', 1),
          free('a2', '2026-11-09T20:00:00.000Z', 2),
          free('b1', '2026-11-09T21:00:00.000Z', 1),
        ]
      }
      return []
    })
    return prisma
  }

  it('hides every court of the hour the linked entry is reserved, and only that hour', async () => {
    const prisma = withLinks([
      { canchaId: 'c-11', fechaHoraInicio: start('2026-11-09T20:00:00.000Z') },
    ])

    const list = await new TurnosService(prisma as never).listFree('c1', '2026-11-09', now)

    expect(list.map((t) => t.id)).toEqual(['b1'])
  })

  it('shows everything when the linked entry has nothing reserved', async () => {
    const prisma = withLinks([])

    const list = await new TurnosService(prisma as never).listFree('c1', '2026-11-09', now)

    expect(list.map((t) => t.id)).toEqual(['a1', 'a2', 'b1'])
  })

  it('a reservation of the same entry does not block its own other courts', async () => {
    // Only c1 itself has a reserved court: the linked c-11 has nothing, so a2 stays free.
    const prisma = withLinks([
      { canchaId: 'c1', fechaHoraInicio: start('2026-11-09T20:00:00.000Z') },
    ])

    const list = await new TurnosService(prisma as never).listFree('c1', '2026-11-09', now)

    expect(list.map((t) => t.id)).toEqual(['a1', 'a2', 'b1'])
  })

  it('looks for the reservations of the linked entries only in the range that is listed', async () => {
    const prisma = withLinks([])

    await new TurnosService(prisma as never).listFree('c1', '2026-11-09', now)

    const reservedCall = prisma.turno.findMany.mock.calls
      .map((call) => call[0] as { where: { estado?: string; fechaHoraInicio?: unknown } })
      .find((args) => args.where.estado === 'RESERVED')
    expect(reservedCall?.where.fechaHoraInicio).toEqual({
      gte: new Date('2026-11-09T15:00:00.000Z'),
      lt: new Date('2026-11-10T03:00:00.000Z'),
    })
  })
})
