import 'reflect-metadata'
import { vi } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { DevolucionesService } from './devoluciones.service.js'

const now = new Date('2026-11-17T12:00:00.000Z')

const historial = (overrides: object = {}) => ({
  id: 'h1',
  devolucion: 'PENDIENTE',
  mpPaymentId: 'mp-1',
  montoPagado: 5000,
  cancha: { ownerId: 'o1' },
  ...overrides,
})

const setup = (row: object | null = historial()) => {
  const prisma = {
    historialReserva: {
      findUnique: vi.fn(async (_args?: object) => row as unknown),
      updateMany: vi.fn(async (_args?: object) => ({ count: 1 })),
    },
  }
  const gateway = {
    getPayment: vi.fn(async (_id?: string, _token?: string) => ({ status: 'approved' }) as unknown),
    refundPayment: vi.fn(async (_id?: string, _token?: string, _key?: string) => undefined),
  }
  const cuentas = { getAccessToken: vi.fn(async (_ownerId?: string, _now?: Date) => 'owner-token') }
  const service = new DevolucionesService(prisma as never, gateway as never, cuentas as never)
  return { service, prisma, gateway, cuentas }
}

describe('DevolucionesService.refund', () => {
  it("refunds from the owner's account and only then marks the record as done", async () => {
    const { service, prisma, gateway, cuentas } = setup()

    await expect(service.refund('h1', now)).resolves.toBe('refunded')

    expect(cuentas.getAccessToken).toHaveBeenCalledWith('o1', now)
    expect(gateway.getPayment).toHaveBeenCalledWith('mp-1', 'owner-token')
    expect(gateway.refundPayment).toHaveBeenCalledWith('mp-1', 'owner-token', 'refund-h1')
    expect(prisma.historialReserva.updateMany).toHaveBeenCalledWith({
      where: { id: 'h1', devolucion: 'PENDIENTE' },
      data: { devolucion: 'HECHA', devueltoAt: now },
    })
  })

  it('answers not_found for a record that does not exist', async () => {
    const { service, gateway } = setup(null)
    await expect(service.refund('nope', now)).resolves.toBe('not_found')
    expect(gateway.refundPayment).not.toHaveBeenCalled()
  })

  it('does not refund twice a record that was already done', async () => {
    const { service, gateway } = setup(historial({ devolucion: 'HECHA' }))
    await expect(service.refund('h1', now)).resolves.toBe('already_refunded')
    expect(gateway.getPayment).not.toHaveBeenCalled()
    expect(gateway.refundPayment).not.toHaveBeenCalled()
  })

  it('does not refund a record that had nothing to return', async () => {
    const { service, gateway } = setup(historial({ devolucion: 'NO_CORRESPONDE' }))
    await expect(service.refund('h1', now)).resolves.toBe('nothing_to_refund')
    expect(gateway.refundPayment).not.toHaveBeenCalled()
  })

  it('marks the record without refunding when Mercado Pago says it was already refunded', async () => {
    const { service, prisma, gateway } = setup()
    gateway.getPayment.mockResolvedValue({ status: 'refunded' })

    await expect(service.refund('h1', now)).resolves.toBe('already_refunded')

    expect(gateway.refundPayment).not.toHaveBeenCalled()
    expect(prisma.historialReserva.updateMany).toHaveBeenCalledWith({
      where: { id: 'h1', devolucion: 'PENDIENTE' },
      data: { devolucion: 'HECHA', devueltoAt: now },
    })
  })

  it('stays pending when the owner has no linked account', async () => {
    const { service, prisma, gateway, cuentas } = setup()
    cuentas.getAccessToken.mockRejectedValue(new NotFoundException('sin cuenta'))

    await expect(service.refund('h1', now)).resolves.toBe('failed')

    expect(gateway.refundPayment).not.toHaveBeenCalled()
    expect(prisma.historialReserva.updateMany).not.toHaveBeenCalled()
  })

  it('stays pending when the record has no payment to refund', async () => {
    const { service, prisma, gateway } = setup(historial({ mpPaymentId: null }))

    await expect(service.refund('h1', now)).resolves.toBe('failed')

    expect(gateway.refundPayment).not.toHaveBeenCalled()
    expect(prisma.historialReserva.updateMany).not.toHaveBeenCalled()
  })

  it("stays pending when the payment is not on the owner's account", async () => {
    const { service, prisma, gateway } = setup()
    gateway.getPayment.mockResolvedValue(null)

    await expect(service.refund('h1', now)).resolves.toBe('failed')

    expect(gateway.refundPayment).not.toHaveBeenCalled()
    expect(prisma.historialReserva.updateMany).not.toHaveBeenCalled()
  })

  it('stays pending when the payment is not approved', async () => {
    const { service, prisma, gateway } = setup()
    gateway.getPayment.mockResolvedValue({ status: 'cancelled' })

    await expect(service.refund('h1', now)).resolves.toBe('failed')

    expect(gateway.refundPayment).not.toHaveBeenCalled()
    expect(prisma.historialReserva.updateMany).not.toHaveBeenCalled()
  })

  it('stays pending when Mercado Pago rejects the refund', async () => {
    const { service, prisma, gateway } = setup()
    gateway.refundPayment.mockRejectedValue(new Error('insufficient funds'))

    await expect(service.refund('h1', now)).resolves.toBe('failed')

    expect(prisma.historialReserva.updateMany).not.toHaveBeenCalled()
  })

  it('never throws: the booking is already closed, so a database failure is just a failed refund', async () => {
    const { service, prisma, gateway } = setup()
    prisma.historialReserva.findUnique.mockRejectedValue(new Error('db down'))

    await expect(service.refund('h1', now)).resolves.toBe('failed')

    expect(gateway.refundPayment).not.toHaveBeenCalled()
  })

  it('stays pending when Mercado Pago cannot be reached to read the payment', async () => {
    const { service, prisma, gateway } = setup()
    gateway.getPayment.mockRejectedValue(new Error('network down'))

    await expect(service.refund('h1', now)).resolves.toBe('failed')

    expect(gateway.refundPayment).not.toHaveBeenCalled()
    expect(prisma.historialReserva.updateMany).not.toHaveBeenCalled()
  })
})
