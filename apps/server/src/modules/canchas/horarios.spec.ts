import 'reflect-metadata'
import { vi } from 'vitest'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { formatMinutes, normalizeFranjas } from './horarios.js'
import { HorariosService } from './horarios.service.js'

describe('normalizeFranjas', () => {
  it('turns "15:00" to "00:00" into minutes, midnight meaning 24:00', () => {
    expect(normalizeFranjas([{ dia: 5, desde: '15:00', hasta: '00:00' }])).toEqual([
      { diaSemana: 5, minutoInicio: 900, minutoFin: 1440 },
    ])
  })

  it('accepts 24:00 as the end of the day', () => {
    expect(normalizeFranjas([{ dia: 0, desde: '17:00', hasta: '24:00' }])[0].minutoFin).toBe(1440)
  })

  it('lets each day have its own range (el mate vs el sol)', () => {
    const result = normalizeFranjas([
      { dia: 1, desde: '15:00', hasta: '00:00' },
      { dia: 2, desde: '17:00', hasta: '20:00' },
    ])
    expect(result.map((f) => [f.diaSemana, f.minutoInicio, f.minutoFin])).toEqual([
      [1, 900, 1440],
      [2, 1020, 1200],
    ])
  })

  it('allows several non-overlapping ranges in the same day', () => {
    expect(
      normalizeFranjas([
        { dia: 3, desde: '10:00', hasta: '13:00' },
        { dia: 3, desde: '16:00', hasta: '22:00' },
      ])
    ).toHaveLength(2)
  })

  it('allows touching ranges (13:00-16:00 and 16:00-20:00)', () => {
    expect(
      normalizeFranjas([
        { dia: 3, desde: '13:00', hasta: '16:00' },
        { dia: 3, desde: '16:00', hasta: '20:00' },
      ])
    ).toHaveLength(2)
  })

  it('rejects a range that ends before it starts', () => {
    expect(() => normalizeFranjas([{ dia: 1, desde: '20:00', hasta: '17:00' }])).toThrow(
      BadRequestException
    )
  })

  it('rejects an empty range', () => {
    expect(() => normalizeFranjas([{ dia: 1, desde: '17:00', hasta: '17:00' }])).toThrow(
      BadRequestException
    )
  })

  it('rejects overlapping ranges on the same day but not on different days', () => {
    expect(() =>
      normalizeFranjas([
        { dia: 1, desde: '15:00', hasta: '20:00' },
        { dia: 1, desde: '19:00', hasta: '22:00' },
      ])
    ).toThrow(BadRequestException)
    expect(() =>
      normalizeFranjas([
        { dia: 1, desde: '15:00', hasta: '20:00' },
        { dia: 2, desde: '19:00', hasta: '22:00' },
      ])
    ).not.toThrow()
  })

  it('formats minutes back, using 24:00 for the end of the day', () => {
    expect(formatMinutes(900)).toBe('15:00')
    expect(formatMinutes(1440)).toBe('24:00')
  })
})

const makePrisma = () => {
  const prisma = {
    cancha: { findUnique: vi.fn(async (_args?: object) => null as unknown) },
    horarioCancha: {
      findMany: vi.fn(async (_args?: object) => [] as unknown[]),
      deleteMany: vi.fn(async (_args?: object) => ({ count: 0 })),
      createMany: vi.fn(async (_args?: object) => ({ count: 0 })),
    },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (run: (tx: unknown) => unknown) => run(prisma))
  return prisma
}

describe('HorariosService', () => {
  it('returns the schedule with readable times, ordered by day and start', async () => {
    const prisma = makePrisma()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'o1' })
    prisma.horarioCancha.findMany.mockResolvedValue([
      { diaSemana: 1, minutoInicio: 900, minutoFin: 1440 },
    ])
    const service = new HorariosService(prisma as never)
    expect(await service.get('c1')).toEqual([{ dia: 1, desde: '15:00', hasta: '24:00' }])
    expect(prisma.horarioCancha.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { canchaId: 'c1' },
        orderBy: [{ diaSemana: 'asc' }, { minutoInicio: 'asc' }],
      })
    )
  })

  it('404 when the court does not exist', async () => {
    const service = new HorariosService(makePrisma() as never)
    await expect(service.get('nope')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('replaces the whole schedule of my court in one transaction', async () => {
    const prisma = makePrisma()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'o1' })
    const service = new HorariosService(prisma as never)
    await service.replace('o1', 'c1', [{ dia: 2, desde: '17:00', hasta: '20:00' }])
    expect(prisma.horarioCancha.deleteMany).toHaveBeenCalledWith({ where: { canchaId: 'c1' } })
    expect(prisma.horarioCancha.createMany).toHaveBeenCalledWith({
      data: [{ canchaId: 'c1', diaSemana: 2, minutoInicio: 1020, minutoFin: 1200 }],
    })
  })

  it('an empty schedule closes the court', async () => {
    const prisma = makePrisma()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'o1' })
    const service = new HorariosService(prisma as never)
    await service.replace('o1', 'c1', [])
    expect(prisma.horarioCancha.deleteMany).toHaveBeenCalled()
    expect(prisma.horarioCancha.createMany).not.toHaveBeenCalled()
  })

  it("refuses to change another owner's schedule and keeps the old one", async () => {
    const prisma = makePrisma()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'other' })
    const service = new HorariosService(prisma as never)
    await expect(
      service.replace('o1', 'c1', [{ dia: 2, desde: '17:00', hasta: '20:00' }])
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.horarioCancha.deleteMany).not.toHaveBeenCalled()
  })

  it('does not touch the stored schedule when the ranges are invalid', async () => {
    const prisma = makePrisma()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'o1' })
    const service = new HorariosService(prisma as never)
    await expect(
      service.replace('o1', 'c1', [{ dia: 2, desde: '20:00', hasta: '17:00' }])
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.horarioCancha.deleteMany).not.toHaveBeenCalled()
  })
})
