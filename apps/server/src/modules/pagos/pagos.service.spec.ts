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
  turnoId: 't1',
  estado: 'PENDING',
  montoTotal: 20000,
  createdAt,
  pago: { id: 'p1', estadoPago: 'PENDING', monto: 5000 },
  turno: {
    canchaId: 'c1',
    numero: 1,
    fechaHoraInicio: new Date('2026-11-15T20:00:00.000Z'),
    fechaHoraFin: new Date('2026-11-15T21:00:00.000Z'),
    cancha: { nombre: 'El Mate', ownerId: 'o1' },
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
      delete: vi.fn(async (_args?: object) => ({})),
    },
    pago: {
      update: vi.fn(async (_args?: object) => ({})),
      deleteMany: vi.fn(async (_args?: object) => ({ count: 1 })),
    },
    turno: {
      // The confirmed bookings of the courts that share the space (none unless a test adds them).
      findMany: vi.fn(async (_args?: object) => [] as object[]),
      update: vi.fn(async (_args?: object) => ({})),
    },
    canchaConflicto: {
      findMany: vi.fn(
        async (_args?: object) =>
          [] as { canchaId: string; numero: number; otraCanchaId: string; otraNumero: number }[]
      ),
    },
    historialReserva: {
      create: vi.fn(async (_args?: object) => ({ id: 'h1' })),
      findFirst: vi.fn(async (_args?: object) => null as unknown),
    },
    // The lock per owner and hour taken before confirming (a tagged template call).
    $executeRaw: vi.fn(async (..._args: unknown[]) => 0),
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

const makeNotifications = () => ({
  notifyBookingConfirmed: vi.fn(async (_reservaId?: string) => undefined),
  notifyBookingSpaceTaken: vi.fn(async (_data?: object) => undefined),
  notifyOwnerSpaceTaken: vi.fn(async (_data?: object) => undefined),
})

const build = (
  prisma = makePrisma(),
  gateway = makeGateway(),
  notifications = makeNotifications()
) => ({
  prisma,
  gateway,
  notifications,
  service: new PagosService(prisma as never, gateway as never, notifications as never),
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

describe('PagosService notifies the owner of the confirmed booking', () => {
  it('notifies once, with the booking id, when the payment confirms the booking', async () => {
    const { service, notifications } = build()
    expect(await service.handlePaymentNotification('123456')).toBe('confirmed')
    expect(notifications.notifyBookingConfirmed).toHaveBeenCalledTimes(1)
    expect(notifications.notifyBookingConfirmed).toHaveBeenCalledWith('r1')
  })

  it('does not notify again when the same approval arrives twice', async () => {
    const { service, prisma, notifications } = build()
    prisma.reserva.findUnique.mockResolvedValue(
      reserva({ estado: 'CONFIRMED', pago: { id: 'p1', estadoPago: 'APPROVED', monto: 5000 } })
    )
    expect(await service.handlePaymentNotification('123456')).toBe('duplicate')
    expect(notifications.notifyBookingConfirmed).not.toHaveBeenCalled()
  })

  it('does not notify when nothing was confirmed', async () => {
    const { service, prisma, gateway, notifications } = build()
    gateway.getPayment.mockResolvedValue(payment({ status: 'rejected' }))
    expect(await service.handlePaymentNotification('123456')).toBe('ignored')
    prisma.reserva.updateMany.mockResolvedValue({ count: 0 })
    gateway.getPayment.mockResolvedValue(payment())
    expect(await service.handlePaymentNotification('123456')).toBe('ignored')
    expect(notifications.notifyBookingConfirmed).not.toHaveBeenCalled()
  })

  it('still answers confirmed when the notification itself fails', async () => {
    const { service, notifications } = build()
    notifications.notifyBookingConfirmed.mockRejectedValue(new Error('push down'))
    expect(await service.handlePaymentNotification('123456')).toBe('confirmed')
  })
})

describe('PagosService: courts that share the physical space', () => {
  // The booking is for the court 1 of c1, which shares the space with every court of c-other.
  const shared = (prisma: ReturnType<typeof makePrisma>, confirmedOfTheOther: object[]) => {
    prisma.canchaConflicto.findMany.mockResolvedValue([
      { canchaId: 'c1', numero: 0, otraCanchaId: 'c-other', otraNumero: 0 },
    ])
    prisma.turno.findMany.mockResolvedValue(confirmedOfTheOther)
  }
  const taken = [
    { canchaId: 'c-other', numero: 1, fechaHoraInicio: new Date('2026-11-15T20:00:00.000Z') },
  ]

  describe('the payment link', () => {
    it('is refused (409) when a court that shares the space is already confirmed, and the gateway is not called', async () => {
      const { prisma, gateway, service } = build()
      shared(prisma, taken)

      await expect(service.createPreference('u1', 'r1', now)).rejects.toBeInstanceOf(
        ConflictException
      )

      expect(gateway.createPreference).not.toHaveBeenCalled()
    })

    it('is given when the linked courts have nothing confirmed at that hour', async () => {
      const { prisma, gateway, service } = build()
      shared(prisma, [])

      await service.createPreference('u1', 'r1', now)

      expect(gateway.createPreference).toHaveBeenCalled()
    })
  })

  describe('confirming an approved payment', () => {
    it('takes the lock of the owner and the hour before it looks at the links and confirms', async () => {
      const { prisma, service } = build()

      await service.handlePaymentNotification('123456')

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1)
      const [strings, ...values] = prisma.$executeRaw.mock.calls[0] as unknown as [
        string[],
        ...unknown[],
      ]
      expect(strings.join('?')).toContain('pg_advisory_xact_lock')
      expect(values).toEqual(['o1', '2026-11-15T20:00:00.000Z'])
      expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.reserva.updateMany.mock.invocationCallOrder[0]
      )
    })

    it('confirms as before when no court that shares the space is confirmed', async () => {
      const { prisma, notifications, service } = build()
      shared(prisma, [])

      await expect(service.handlePaymentNotification('123456')).resolves.toBe('confirmed')

      expect(prisma.reserva.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', estado: 'PENDING' },
        data: { estado: 'CONFIRMED' },
      })
      expect(prisma.pago.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { estadoPago: 'APPROVED', mpPaymentId: '123456' },
      })
      expect(notifications.notifyBookingConfirmed).toHaveBeenCalledWith('r1')
      expect(prisma.historialReserva.create).not.toHaveBeenCalled()
    })

    describe('when a court that shares the space was confirmed first', () => {
      it('does not confirm: it closes the booking with the refund pending', async () => {
        const { prisma, service } = build()
        shared(prisma, taken)

        await expect(service.handlePaymentNotification('123456')).resolves.toBe('conflict')

        expect(prisma.reserva.updateMany).toHaveBeenCalledWith({
          where: { id: 'r1', estado: 'PENDING' },
          data: { estado: 'CANCELLED' },
        })
        expect(prisma.pago.update).not.toHaveBeenCalled()
        expect(prisma.historialReserva.create).toHaveBeenCalledWith({
          data: {
            canchaId: 'c1',
            jugadorId: 'u1',
            turnoInicio: new Date('2026-11-15T20:00:00.000Z'),
            turnoFin: new Date('2026-11-15T21:00:00.000Z'),
            montoTotal: 20000,
            montoPagado: 5000,
            mpPaymentId: '123456',
            motivo: 'ESPACIO_OCUPADO',
            devolucion: 'PENDIENTE',
            reservadaAt: createdAt,
          },
        })
      })

      it('removes the booking and its payment and frees the slot', async () => {
        const { prisma, service } = build()
        shared(prisma, taken)

        await service.handlePaymentNotification('123456')

        expect(prisma.pago.deleteMany).toHaveBeenCalledWith({ where: { reservaId: 'r1' } })
        expect(prisma.reserva.delete).toHaveBeenCalledWith({ where: { id: 'r1' } })
        expect(prisma.turno.update).toHaveBeenCalledWith({
          where: { id: 't1' },
          data: { estado: 'FREE' },
        })
      })

      it('keeps the money that was really paid as the refund, not the amount that was charged', async () => {
        const { prisma, gateway, service } = build()
        gateway.getPayment.mockResolvedValue(payment({ transactionAmount: 20000 }))
        shared(prisma, taken)

        await service.handlePaymentNotification('123456')

        const call = prisma.historialReserva.create.mock.calls[0][0] as {
          data: { montoPagado: number }
        }
        expect(call.data.montoPagado).toBe(20000)
      })

      it('tells the player, with what they paid, and does not tell the owner it was confirmed', async () => {
        const { prisma, notifications, service } = build()
        shared(prisma, taken)

        await service.handlePaymentNotification('123456')

        expect(notifications.notifyBookingSpaceTaken).toHaveBeenCalledWith({
          jugadorId: 'u1',
          canchaNombre: 'El Mate',
          turnoInicio: new Date('2026-11-15T20:00:00.000Z'),
          montoPagado: 5000,
        })
        expect(notifications.notifyBookingConfirmed).not.toHaveBeenCalled()
      })

      it('tells the owner too: who paid, how much, and that the refund is theirs to make', async () => {
        const { prisma, notifications, service } = build()
        shared(prisma, taken)

        await service.handlePaymentNotification('123456')

        expect(notifications.notifyOwnerSpaceTaken).toHaveBeenCalledWith({
          ownerId: 'o1',
          jugadorId: 'u1',
          canchaNombre: 'El Mate',
          turnoInicio: new Date('2026-11-15T20:00:00.000Z'),
          montoPagado: 5000,
        })
      })

      it('does not tell the owner anything when the payment is confirmed normally', async () => {
        const { prisma, notifications, service } = build()
        shared(prisma, [])

        await service.handlePaymentNotification('123456')

        expect(notifications.notifyOwnerSpaceTaken).not.toHaveBeenCalled()
        expect(notifications.notifyBookingSpaceTaken).not.toHaveBeenCalled()
      })

      it('the notice to the owner still goes out when the one to the player fails', async () => {
        const { prisma, notifications, service } = build()
        shared(prisma, taken)
        notifications.notifyBookingSpaceTaken.mockRejectedValue(new Error('push down'))

        await expect(service.handlePaymentNotification('123456')).resolves.toBe('conflict')

        expect(notifications.notifyOwnerSpaceTaken).toHaveBeenCalled()
      })

      it('the notice to the player still goes out when the one to the owner fails', async () => {
        const { prisma, notifications, service } = build()
        shared(prisma, taken)
        notifications.notifyOwnerSpaceTaken.mockRejectedValue(new Error('push down'))

        await expect(service.handlePaymentNotification('123456')).resolves.toBe('conflict')

        expect(notifications.notifyBookingSpaceTaken).toHaveBeenCalled()
      })

      it('still answers the webhook when the notice to the player fails', async () => {
        const { prisma, notifications, service } = build()
        shared(prisma, taken)
        notifications.notifyBookingSpaceTaken.mockRejectedValue(new Error('push down'))

        await expect(service.handlePaymentNotification('123456')).resolves.toBe('conflict')
      })

      it('does nothing when the booking changed meanwhile (it is not PENDING anymore)', async () => {
        const { prisma, service } = build()
        shared(prisma, taken)
        prisma.reserva.updateMany.mockResolvedValue({ count: 0 })

        await expect(service.handlePaymentNotification('123456')).resolves.toBe('ignored')

        expect(prisma.historialReserva.create).not.toHaveBeenCalled()
        expect(prisma.reserva.delete).not.toHaveBeenCalled()
      })

      it('a retried notification of that same payment is a duplicate, not an error to review', async () => {
        const { prisma, service } = build()
        // The booking is gone (it was closed); its history keeps the payment id.
        prisma.reserva.findUnique.mockResolvedValue(null)
        prisma.historialReserva.findFirst.mockResolvedValue({ id: 'h1' })

        await expect(service.handlePaymentNotification('123456')).resolves.toBe('duplicate')

        expect(prisma.historialReserva.findFirst).toHaveBeenCalledWith({
          where: { mpPaymentId: '123456' },
          select: { id: true },
        })
      })
    })
  })
})
