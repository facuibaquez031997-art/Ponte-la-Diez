import 'reflect-metadata'
import { vi } from 'vitest'
import { HOLD_MS, releaseExpiredHolds } from './holds.js'

const now = new Date('2026-11-14T15:00:00.000Z')

const expired = (n: number) => ({
  id: `r${n}`,
  turnoId: `t${n}`,
  userId: `u${n}`,
  montoTotal: 20000,
  createdAt: new Date('2026-11-14T14:30:00.000Z'),
  turno: {
    canchaId: 'c1',
    fechaHoraInicio: new Date('2026-11-15T20:00:00.000Z'),
    fechaHoraFin: new Date('2026-11-15T21:00:00.000Z'),
  },
})

const makePrisma = () => {
  const prisma = {
    reserva: {
      findMany: vi.fn(async (_args?: object) => [] as unknown[]),
      deleteMany: vi.fn(async (_args?: object) => ({ count: 1 })),
    },
    pago: { deleteMany: vi.fn(async (_args?: object) => ({ count: 1 })) },
    turno: { updateMany: vi.fn(async (_args?: object) => ({ count: 1 })) },
    historialReserva: { create: vi.fn(async (_args?: object) => ({})) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  }
  return prisma
}

const whereOf = (prisma: ReturnType<typeof makePrisma>) =>
  (prisma.reserva.findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where

describe('releaseExpiredHolds', () => {
  it('holds a booking for 15 minutes', () => {
    expect(HOLD_MS).toBe(15 * 60 * 1000)
  })

  it('looks only for PENDING bookings older than the hold', async () => {
    const prisma = makePrisma()
    await releaseExpiredHolds(prisma as never, now)
    expect(whereOf(prisma).estado).toBe('PENDING')
    expect(whereOf(prisma).createdAt).toEqual({ lt: new Date(now.getTime() - HOLD_MS) })
  })

  it('never selects a booking whose payment was APPROVED (it could not be deleted anyway)', async () => {
    const prisma = makePrisma()
    await releaseExpiredHolds(prisma as never, now)
    expect(whereOf(prisma).OR).toEqual([
      { pago: null },
      { pago: { estadoPago: { not: 'APPROVED' } } },
    ])
  })

  it('does nothing when no hold expired', async () => {
    const prisma = makePrisma()
    const released = await releaseExpiredHolds(prisma as never, now)
    expect(released).toBe(0)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('frees the slot and removes the unpaid booking and its payment', async () => {
    const prisma = makePrisma()
    prisma.reserva.findMany.mockResolvedValue([expired(1), expired(2)])
    const released = await releaseExpiredHolds(prisma as never, now)
    expect(released).toBe(2)
    expect(prisma.pago.deleteMany).toHaveBeenCalledWith({
      where: { reservaId: 'r1', estadoPago: { not: 'APPROVED' } },
    })
    expect(prisma.reserva.deleteMany).toHaveBeenCalledWith({
      where: { id: 'r2', estado: 'PENDING' },
    })
    expect(prisma.turno.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', estado: 'RESERVED', reserva: null },
      data: { estado: 'FREE' },
    })
  })

  it('leaves a history record of each booking that expired, with nothing paid', async () => {
    const prisma = makePrisma()
    prisma.reserva.findMany.mockResolvedValue([expired(1)])
    await releaseExpiredHolds(prisma as never, now)
    expect(prisma.historialReserva.create).toHaveBeenCalledTimes(1)
    expect(prisma.historialReserva.create).toHaveBeenCalledWith({
      data: {
        canchaId: 'c1',
        jugadorId: 'u1',
        turnoInicio: new Date('2026-11-15T20:00:00.000Z'),
        turnoFin: new Date('2026-11-15T21:00:00.000Z'),
        montoTotal: 20000,
        montoPagado: 0,
        mpPaymentId: null,
        motivo: 'VENCIDA',
        devolucion: 'NO_CORRESPONDE',
        reservadaAt: new Date('2026-11-14T14:30:00.000Z'),
      },
    })
  })

  it('does not record or free anything for a booking someone else already released', async () => {
    const prisma = makePrisma()
    prisma.reserva.findMany.mockResolvedValue([expired(1)])
    prisma.reserva.deleteMany.mockResolvedValue({ count: 0 })
    const released = await releaseExpiredHolds(prisma as never, now)
    expect(released).toBe(0)
    expect(prisma.historialReserva.create).not.toHaveBeenCalled()
    expect(prisma.turno.updateMany).not.toHaveBeenCalled()
  })

  it('can be limited to the courts of one owner', async () => {
    const prisma = makePrisma()
    await releaseExpiredHolds(prisma as never, now, { ownerId: 'o1' })
    expect(whereOf(prisma).turno).toEqual({ cancha: { ownerId: 'o1' } })
  })

  it('can be limited to one court or one player', async () => {
    const prisma = makePrisma()
    await releaseExpiredHolds(prisma as never, now, { canchaId: 'c1', userId: 'u1' })
    expect(whereOf(prisma).userId).toBe('u1')
    expect(whereOf(prisma).turno).toEqual({ canchaId: 'c1' })
  })
})
