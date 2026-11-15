import 'reflect-metadata'
import { vi } from 'vitest'
import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { HOLD_MS } from '../reservas/holds.js'
import { PagosService } from './pagos.service.js'

const now = new Date('2026-11-14T15:00:00.000Z')
const createdAt = new Date('2026-11-14T14:55:00.000Z')

const reserva = (overrides: object = {}) => ({
  id: 'r1',
  userId: 'u1',
  estado: 'PENDING',
  createdAt,
  pago: { id: 'p1', estadoPago: 'PENDING', monto: 5000 },
  turno: {
    fechaHoraInicio: new Date('2026-11-15T20:00:00.000Z'),
    cancha: { nombre: 'El Mate' },
  },
  ...overrides,
})

const makePrisma = () => ({
  reserva: {
    findUnique: vi.fn(async (_args?: object) => reserva() as unknown),
    findMany: vi.fn(async (_args?: object) => [] as unknown[]),
  },
  pago: { update: vi.fn(async (_args?: object) => ({})) },
})

const makeGateway = () => ({
  isConfigured: vi.fn(() => true),
  createPreference: vi.fn(async (_input?: object) => ({
    preferenceId: 'pref-1',
    initPoint: 'https://mp.test/checkout/pref-1',
  })),
})

const build = (prisma = makePrisma(), gateway = makeGateway()) => ({
  prisma,
  gateway,
  service: new PagosService(prisma as never, gateway as never),
})

describe('PagosService.createPreference', () => {
  it('creates the preference for the amount stored in the payment and saves its id', async () => {
    const { service, prisma, gateway } = build()
    const result = await service.createPreference('u1', 'r1', now)
    expect(result).toEqual({
      preferenceId: 'pref-1',
      initPoint: 'https://mp.test/checkout/pref-1',
    })
    const input = gateway.createPreference.mock.calls[0][0] as {
      reservaId: string
      title: string
      monto: number
      expiresAt: Date
    }
    expect(input.reservaId).toBe('r1')
    expect(input.monto).toBe(5000)
    expect(input.title).toContain('El Mate')
    expect(input.expiresAt).toEqual(new Date(createdAt.getTime() + HOLD_MS))
    expect(prisma.pago.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { mpPreferenceId: 'pref-1' },
    })
  })

  it('answers 503 when Mercado Pago is not configured, without touching the database', async () => {
    const { service, prisma, gateway } = build()
    gateway.isConfigured.mockReturnValue(false)
    await expect(service.createPreference('u1', 'r1', now)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    )
    expect(prisma.reserva.findUnique).not.toHaveBeenCalled()
  })

  it('answers 404 for an unknown booking', async () => {
    const { service, prisma } = build()
    prisma.reserva.findUnique.mockResolvedValue(null)
    await expect(service.createPreference('u1', 'r1', now)).rejects.toBeInstanceOf(
      NotFoundException
    )
  })

  it("answers 404 for another player's booking and never calls Mercado Pago", async () => {
    const { service, gateway } = build()
    await expect(service.createPreference('someone-else', 'r1', now)).rejects.toBeInstanceOf(
      NotFoundException
    )
    expect(gateway.createPreference).not.toHaveBeenCalled()
  })

  it('answers 409 when the booking is not PENDING anymore', async () => {
    const { service, prisma, gateway } = build()
    prisma.reserva.findUnique.mockResolvedValue(reserva({ estado: 'CONFIRMED' }))
    await expect(service.createPreference('u1', 'r1', now)).rejects.toBeInstanceOf(
      ConflictException
    )
    expect(gateway.createPreference).not.toHaveBeenCalled()
  })

  it('answers 409 when the payment is not PENDING anymore', async () => {
    const { service, prisma } = build()
    prisma.reserva.findUnique.mockResolvedValue(
      reserva({ pago: { id: 'p1', estadoPago: 'APPROVED', monto: 5000 } })
    )
    await expect(service.createPreference('u1', 'r1', now)).rejects.toBeInstanceOf(
      ConflictException
    )
  })

  it('answers 409 and releases the hold when the booking already expired', async () => {
    const { service, prisma, gateway } = build()
    prisma.reserva.findUnique.mockResolvedValue(
      reserva({ createdAt: new Date(now.getTime() - HOLD_MS - 1000) })
    )
    await expect(service.createPreference('u1', 'r1', now)).rejects.toBeInstanceOf(
      ConflictException
    )
    expect(prisma.reserva.findMany).toHaveBeenCalled()
    expect(gateway.createPreference).not.toHaveBeenCalled()
  })

  it('answers 502 and keeps the payment untouched when Mercado Pago fails', async () => {
    const { service, prisma, gateway } = build()
    gateway.createPreference.mockRejectedValue(new Error('boom'))
    await expect(service.createPreference('u1', 'r1', now)).rejects.toBeInstanceOf(
      BadGatewayException
    )
    expect(prisma.pago.update).not.toHaveBeenCalled()
  })
})
