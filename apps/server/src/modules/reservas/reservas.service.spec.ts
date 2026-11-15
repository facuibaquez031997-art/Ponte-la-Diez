import 'reflect-metadata'
import { vi } from 'vitest'
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { ReservasService } from './reservas.service.js'

const now = new Date('2026-11-14T15:00:00.000Z')
const future = new Date('2026-11-15T20:00:00.000Z')

const cancha = {
  id: 'c1',
  nombre: 'El Mate',
  direccion: 'Calle 1',
  barrio: 'Centro',
  precioHora: 20000,
  montoSena: 5000,
}
const turno = (overrides: object = {}) => ({
  id: 't1',
  canchaId: 'c1',
  estado: 'FREE',
  fechaHoraInicio: future,
  fechaHoraFin: new Date(future.getTime() + 3_600_000),
  cancha,
  ...overrides,
})

const stored = (pago: object | null, estado = 'PENDING') => ({
  id: 'r1',
  estado,
  montoTotal: 20000,
  turno: turno(),
  pago,
})

const makePrisma = () => {
  const prisma = {
    turno: {
      findUnique: vi.fn(async (_args?: object) => turno() as unknown),
      updateMany: vi.fn(async (_args?: object) => ({ count: 1 })),
    },
    reserva: {
      create: vi.fn(
        async (_args?: object) => stored({ estadoPago: 'PENDING', monto: 5000 }) as unknown
      ),
      findMany: vi.fn(async (_args?: object) => [] as unknown[]),
      deleteMany: vi.fn(async (_args?: object) => ({ count: 0 })),
    },
    pago: { deleteMany: vi.fn(async (_args?: object) => ({ count: 0 })) },
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)(prisma)
        : Promise.all(arg as Promise<unknown>[])
    ),
  }
  return prisma
}

const createArgs = (prisma: ReturnType<typeof makePrisma>) =>
  (prisma.reserva.create.mock.calls[0][0] as { data: Record<string, unknown> }).data

describe('ReservasService.create', () => {
  it('books the slot with the seña: PENDING booking, PENDING payment of the seña, full price as total', async () => {
    const prisma = makePrisma()
    await new ReservasService(prisma as never).create(
      'u1',
      { turnoId: 't1', tipoPago: 'SENA' },
      now
    )
    expect(prisma.turno.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', estado: 'FREE' },
      data: { estado: 'RESERVED' },
    })
    const data = createArgs(prisma)
    expect(data.turnoId).toBe('t1')
    expect(data.userId).toBe('u1')
    expect(data.montoTotal).toBe(20000)
    expect(data.pago).toEqual({ create: { monto: 5000, estadoPago: 'PENDING' } })
  })

  it('charges the full price when the player chooses TOTAL', async () => {
    const prisma = makePrisma()
    await new ReservasService(prisma as never).create(
      'u1',
      { turnoId: 't1', tipoPago: 'TOTAL' },
      now
    )
    expect(createArgs(prisma).pago).toEqual({ create: { monto: 20000, estadoPago: 'PENDING' } })
  })

  it('answers what is charged now and what stays to pay at the court', async () => {
    const prisma = makePrisma()
    const view = await new ReservasService(prisma as never).create(
      'u1',
      { turnoId: 't1', tipoPago: 'SENA' },
      now
    )
    expect(view).toMatchObject({
      id: 'r1',
      estado: 'PENDING',
      montoTotal: 20000,
      montoACobrar: 5000,
      montoPagado: 0,
      montoRestante: 20000,
      cancha: { id: 'c1', nombre: 'El Mate' },
    })
  })

  it('answers 409 when another player took the slot first', async () => {
    const prisma = makePrisma()
    prisma.turno.updateMany.mockResolvedValue({ count: 0 })
    await expect(
      new ReservasService(prisma as never).create('u1', { turnoId: 't1', tipoPago: 'SENA' }, now)
    ).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.reserva.create).not.toHaveBeenCalled()
  })

  it('answers 404 for an unknown slot', async () => {
    const prisma = makePrisma()
    prisma.turno.findUnique.mockResolvedValue(null)
    await expect(
      new ReservasService(prisma as never).create('u1', { turnoId: 't1', tipoPago: 'SENA' }, now)
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('answers 400 for a slot that already started', async () => {
    const prisma = makePrisma()
    prisma.turno.findUnique.mockResolvedValue(
      turno({ fechaHoraInicio: new Date('2026-11-14T14:00:00.000Z') })
    )
    await expect(
      new ReservasService(prisma as never).create('u1', { turnoId: 't1', tipoPago: 'SENA' }, now)
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.turno.updateMany).not.toHaveBeenCalled()
  })

  it('answers 400 when the amount to charge is not above zero', async () => {
    const prisma = makePrisma()
    prisma.turno.findUnique.mockResolvedValue(turno({ cancha: { ...cancha, montoSena: 0 } }))
    await expect(
      new ReservasService(prisma as never).create('u1', { turnoId: 't1', tipoPago: 'SENA' }, now)
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.turno.updateMany).not.toHaveBeenCalled()
  })

  it('frees expired holds of that court before claiming the slot', async () => {
    const prisma = makePrisma()
    prisma.reserva.findMany.mockResolvedValue([{ id: 'old', turnoId: 't1' }])
    await new ReservasService(prisma as never).create(
      'u1',
      { turnoId: 't1', tipoPago: 'SENA' },
      now
    )
    const order = [
      prisma.reserva.findMany.mock.invocationCallOrder[0],
      prisma.turno.updateMany.mock.invocationCallOrder.at(-1) as number,
    ]
    expect(order[0]).toBeLessThan(order[1])
    expect(prisma.reserva.deleteMany).toHaveBeenCalled()
  })
})

describe('ReservasService.listMine', () => {
  it('lists only my bookings, newest slot first', async () => {
    const prisma = makePrisma()
    await new ReservasService(prisma as never).listMine('u1', now)
    const call = prisma.reserva.findMany.mock.calls.at(-1)?.[0] as {
      where: object
      orderBy: object
    }
    expect(call.where).toEqual({ userId: 'u1' })
    expect(call.orderBy).toEqual({ turno: { fechaHoraInicio: 'desc' } })
  })

  it('counts as paid only an APPROVED payment and shows what is left to pay at the court', async () => {
    const prisma = makePrisma()
    prisma.reserva.findMany.mockResolvedValue([
      stored({ estadoPago: 'APPROVED', monto: 5000 }, 'CONFIRMED'),
      stored({ estadoPago: 'PENDING', monto: 5000 }),
    ])
    const views = await new ReservasService(prisma as never).listMine('u1', now)
    expect(views[0]).toMatchObject({ montoPagado: 5000, montoRestante: 15000, montoACobrar: null })
    expect(views[1]).toMatchObject({ montoPagado: 0, montoRestante: 20000, montoACobrar: 5000 })
  })

  it('shows nothing left to pay after paying the total', async () => {
    const prisma = makePrisma()
    prisma.reserva.findMany.mockResolvedValue([
      stored({ estadoPago: 'APPROVED', monto: 20000 }, 'CONFIRMED'),
    ])
    const [view] = await new ReservasService(prisma as never).listMine('u1', now)
    expect(view).toMatchObject({ montoPagado: 20000, montoRestante: 0 })
  })
})
