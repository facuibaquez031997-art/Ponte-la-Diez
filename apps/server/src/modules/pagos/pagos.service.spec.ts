import 'reflect-metadata'
import { vi } from 'vitest'
import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
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

const payment = (overrides: object = {}) => ({
  id: '123456',
  status: 'approved',
  externalReference: 'r1',
  transactionAmount: 5000,
  ...overrides,
})

const makePrisma = () => {
  const prisma = {
    reserva: {
      findUnique: vi.fn(async (_args?: object) => reserva() as unknown),
      findMany: vi.fn(async (_args?: object) => [] as unknown[]),
      updateMany: vi.fn(async (_args?: object) => ({ count: 1 })),
    },
    pago: { update: vi.fn(async (_args?: object) => ({})) },
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)(prisma)
        : Promise.all(arg as Promise<unknown>[])
    ),
  }
  return prisma
}

const makeGateway = () => ({
  isConfigured: vi.fn(() => true),
  getWebhookSecret: vi.fn(() => 'secret' as string | undefined),
  getPayment: vi.fn(async (_id?: string) => payment() as unknown),
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

describe('PagosService.handlePaymentNotification', () => {
  it('confirms the booking and stores the payment id when the payment is approved', async () => {
    const { service, prisma, gateway } = build()
    const result = await service.handlePaymentNotification('123456')
    expect(result).toBe('confirmed')
    expect(gateway.getPayment).toHaveBeenCalledWith('123456')
    expect(prisma.reserva.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', estado: 'PENDING' },
      data: { estado: 'CONFIRMED' },
    })
    expect(prisma.pago.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { estadoPago: 'APPROVED', mpPaymentId: '123456' },
    })
  })

  it('does nothing when the same approval arrives again', async () => {
    const { service, prisma } = build()
    prisma.reserva.findUnique.mockResolvedValue(
      reserva({ estado: 'CONFIRMED', pago: { id: 'p1', estadoPago: 'APPROVED', monto: 5000 } })
    )
    expect(await service.handlePaymentNotification('123456')).toBe('duplicate')
    expect(prisma.reserva.updateMany).not.toHaveBeenCalled()
    expect(prisma.pago.update).not.toHaveBeenCalled()
  })

  it('does not confirm when the amount paid is lower than the amount charged', async () => {
    const { service, prisma, gateway } = build()
    gateway.getPayment.mockResolvedValue(payment({ transactionAmount: 4999 }))
    expect(await service.handlePaymentNotification('123456')).toBe('ignored')
    expect(prisma.reserva.updateMany).not.toHaveBeenCalled()
    expect(prisma.pago.update).not.toHaveBeenCalled()
  })

  it('does not touch anything when the booking was already released', async () => {
    const { service, prisma } = build()
    prisma.reserva.findUnique.mockResolvedValue(null)
    expect(await service.handlePaymentNotification('123456')).toBe('ignored')
    expect(prisma.pago.update).not.toHaveBeenCalled()
  })

  it('does not update the payment when the booking stopped being PENDING meanwhile', async () => {
    const { service, prisma } = build()
    prisma.reserva.updateMany.mockResolvedValue({ count: 0 })
    expect(await service.handlePaymentNotification('123456')).toBe('ignored')
    expect(prisma.pago.update).not.toHaveBeenCalled()
  })

  it.each(['rejected', 'cancelled', 'pending', 'in_process'])(
    'changes nothing for a %s payment so the player can retry until the hold ends',
    async (status) => {
      const { service, prisma, gateway } = build()
      gateway.getPayment.mockResolvedValue(payment({ status }))
      expect(await service.handlePaymentNotification('123456')).toBe('ignored')
      expect(prisma.reserva.updateMany).not.toHaveBeenCalled()
      expect(prisma.pago.update).not.toHaveBeenCalled()
    }
  )

  it('ignores a payment that Mercado Pago does not know', async () => {
    const { service, gateway, prisma } = build()
    gateway.getPayment.mockResolvedValue(null)
    expect(await service.handlePaymentNotification('123456')).toBe('ignored')
    expect(prisma.reserva.findUnique).not.toHaveBeenCalled()
  })

  it('ignores a payment that is not linked to a booking', async () => {
    const { service, gateway, prisma } = build()
    gateway.getPayment.mockResolvedValue(payment({ externalReference: undefined }))
    expect(await service.handlePaymentNotification('123456')).toBe('ignored')
    expect(prisma.reserva.findUnique).not.toHaveBeenCalled()
  })

  it('fails when Mercado Pago cannot be reached so it retries the notification', async () => {
    const { service, gateway } = build()
    gateway.getPayment.mockRejectedValue(new Error('network down'))
    await expect(service.handlePaymentNotification('123456')).rejects.toThrow('network down')
  })
})

describe('PagosService.handleWebhook', () => {
  const request = (overrides: object = {}) => ({
    xSignature: 'ts=1,v1=abc',
    xRequestId: 'req-1',
    dataId: '123456',
    type: 'payment',
    ...overrides,
  })

  it('answers 503 and reads nothing when the webhook secret is not configured', async () => {
    const { service, gateway } = build()
    gateway.getWebhookSecret.mockReturnValue(undefined)
    await expect(service.handleWebhook(request())).rejects.toBeInstanceOf(
      ServiceUnavailableException
    )
    expect(gateway.getPayment).not.toHaveBeenCalled()
  })

  it('answers 401 for a bad signature and never asks Mercado Pago for the payment', async () => {
    const { service, gateway } = build()
    await expect(service.handleWebhook(request())).rejects.toBeInstanceOf(UnauthorizedException)
    expect(gateway.getPayment).not.toHaveBeenCalled()
  })

  it('processes a signed payment notification', async () => {
    const { service, prisma } = build()
    const { createHmac } = await import('node:crypto')
    const v1 = createHmac('sha256', 'secret')
      .update('id:123456;request-id:req-1;ts:1;')
      .digest('hex')
    const result = await service.handleWebhook(request({ xSignature: `ts=1,v1=${v1}` }))
    expect(result).toEqual({ result: 'confirmed' })
    expect(prisma.pago.update).toHaveBeenCalled()
  })

  it('ignores signed notifications of other topics or without a payment id', async () => {
    const { service, gateway } = build()
    const { createHmac } = await import('node:crypto')
    const v1 = createHmac('sha256', 'secret')
      .update('id:123456;request-id:req-1;ts:1;')
      .digest('hex')
    const xSignature = `ts=1,v1=${v1}`
    expect(await service.handleWebhook(request({ xSignature, type: 'merchant_order' }))).toEqual({
      result: 'ignored',
    })
    expect(gateway.getPayment).not.toHaveBeenCalled()
  })
})
