import 'reflect-metadata'
import { vi } from 'vitest'
import { HOLD_MS, releaseExpiredHolds } from './holds.js'

const now = new Date('2026-11-14T15:00:00.000Z')

const makePrisma = () => ({
  reserva: {
    findMany: vi.fn(async (_args?: object) => [] as unknown[]),
    deleteMany: vi.fn(async (_args?: object) => ({ count: 0 })),
  },
  pago: { deleteMany: vi.fn(async (_args?: object) => ({ count: 0 })) },
  turno: { updateMany: vi.fn(async (_args?: object) => ({ count: 0 })) },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
})

describe('releaseExpiredHolds', () => {
  it('holds a booking for 15 minutes', () => {
    expect(HOLD_MS).toBe(15 * 60 * 1000)
  })

  it('looks only for PENDING bookings older than the hold', async () => {
    const prisma = makePrisma()
    await releaseExpiredHolds(prisma as never, now)
    const where = (prisma.reserva.findMany.mock.calls[0][0] as { where: Record<string, unknown> })
      .where
    expect(where.estado).toBe('PENDING')
    expect(where.createdAt).toEqual({ lt: new Date(now.getTime() - HOLD_MS) })
  })

  it('never selects a booking whose payment was APPROVED (it could not be deleted anyway)', async () => {
    const prisma = makePrisma()
    await releaseExpiredHolds(prisma as never, now)
    const where = (prisma.reserva.findMany.mock.calls[0][0] as { where: Record<string, unknown> })
      .where
    expect(where.OR).toEqual([{ pago: null }, { pago: { estadoPago: { not: 'APPROVED' } } }])
  })

  it('does nothing when no hold expired', async () => {
    const prisma = makePrisma()
    const released = await releaseExpiredHolds(prisma as never, now)
    expect(released).toBe(0)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('frees the slot and removes the unpaid booking and its payment', async () => {
    const prisma = makePrisma()
    prisma.reserva.findMany.mockResolvedValue([
      { id: 'r1', turnoId: 't1' },
      { id: 'r2', turnoId: 't2' },
    ])
    const released = await releaseExpiredHolds(prisma as never, now)
    expect(released).toBe(2)
    expect(prisma.pago.deleteMany).toHaveBeenCalledWith({
      where: { reservaId: { in: ['r1', 'r2'] }, estadoPago: { not: 'APPROVED' } },
    })
    expect(prisma.reserva.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['r1', 'r2'] }, estado: 'PENDING' },
    })
    expect(prisma.turno.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['t1', 't2'] }, estado: 'RESERVED', reserva: null },
      data: { estado: 'FREE' },
    })
  })

  it('can be limited to the courts of one owner', async () => {
    const prisma = makePrisma()
    await releaseExpiredHolds(prisma as never, now, { ownerId: 'o1' })
    const where = (prisma.reserva.findMany.mock.calls[0][0] as { where: Record<string, unknown> })
      .where
    expect(where.turno).toEqual({ cancha: { ownerId: 'o1' } })
  })

  it('can be limited to one court or one player', async () => {
    const prisma = makePrisma()
    await releaseExpiredHolds(prisma as never, now, { canchaId: 'c1', userId: 'u1' })
    const where = (prisma.reserva.findMany.mock.calls[0][0] as { where: Record<string, unknown> })
      .where
    expect(where.userId).toBe('u1')
    expect(where.turno).toEqual({ canchaId: 'c1' })
  })
})
