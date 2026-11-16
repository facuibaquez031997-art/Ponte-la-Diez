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
  ownerId: 'o1',
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

const makeNotifications = () => ({
  notifyBookingCancelled: vi.fn(async (_data?: object) => undefined),
})

const makePrisma = () => {
  const prisma = {
    turno: {
      findUnique: vi.fn(async (_args?: object) => turno() as unknown),
      // The other courts of the same hour, looked up only when the chosen slot was just taken.
      findMany: vi.fn(async (_args?: object) => [] as object[]),
      updateMany: vi.fn(async (_args?: object) => ({ count: 1 })),
      update: vi.fn(async (_args?: object) => ({})),
    },
    reserva: {
      create: vi.fn(
        async (_args?: object) => stored({ estadoPago: 'PENDING', monto: 5000 }) as unknown
      ),
      findMany: vi.fn(async (_args?: object) => [] as unknown[]),
      deleteMany: vi.fn(async (_args?: object) => ({ count: 1 })),
      findUnique: vi.fn(async (_args?: object) => null as unknown),
      updateMany: vi.fn(async (_args?: object) => ({ count: 1 })),
      delete: vi.fn(async (_args?: object) => ({})),
    },
    pago: {
      deleteMany: vi.fn(async (_args?: object) => ({ count: 0 })),
      findUnique: vi.fn(async (_args?: object) => null as unknown),
    },
    historialReserva: {
      create: vi.fn(async (_args?: object) => ({ id: 'h-new' }) as unknown),
      findMany: vi.fn(async (_args?: object) => [] as unknown[]),
      findFirst: vi.fn(async (_args?: object) => null as unknown),
      updateMany: vi.fn(async (_args?: object) => ({ count: 1 })),
    },
    // The lock per owner and hour taken before booking (a tagged template call).
    $executeRaw: vi.fn(async (..._args: unknown[]) => 0),
    // Entries that share the physical space with the one booked: none unless a test adds them.
    canchaConflicto: {
      findMany: vi.fn(async (_args?: object) => [] as { canchaId: string; otraCanchaId: string }[]),
    },
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
    await new ReservasService(prisma as never, makeNotifications() as never).create(
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
    await new ReservasService(prisma as never, makeNotifications() as never).create(
      'u1',
      { turnoId: 't1', tipoPago: 'TOTAL' },
      now
    )
    expect(createArgs(prisma).pago).toEqual({ create: { monto: 20000, estadoPago: 'PENDING' } })
  })

  it('answers what is charged now and what stays to pay at the court', async () => {
    const prisma = makePrisma()
    const view = await new ReservasService(prisma as never, makeNotifications() as never).create(
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
      new ReservasService(prisma as never, makeNotifications() as never).create(
        'u1',
        { turnoId: 't1', tipoPago: 'SENA' },
        now
      )
    ).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.reserva.create).not.toHaveBeenCalled()
  })

  describe('an entry with several courts has several slots at the same hour', () => {
    const book = (prisma: ReturnType<typeof makePrisma>) =>
      new ReservasService(prisma as never, makeNotifications() as never).create(
        'u1',
        { turnoId: 't1', tipoPago: 'SENA' },
        now
      )

    it('does not look for another court when the chosen one is free', async () => {
      const prisma = makePrisma()
      await book(prisma)
      expect(prisma.turno.findMany).not.toHaveBeenCalled()
      expect(createArgs(prisma).turnoId).toBe('t1')
    })

    it('books another free court of the same hour when the chosen one was just taken', async () => {
      const prisma = makePrisma()
      prisma.turno.updateMany.mockResolvedValueOnce({ count: 0 })
      prisma.turno.findMany.mockResolvedValue([{ id: 't2' }])

      await book(prisma)

      expect(prisma.turno.findMany).toHaveBeenCalledWith({
        where: {
          canchaId: 'c1',
          fechaHoraInicio: future,
          estado: 'FREE',
          id: { not: 't1' },
        },
        orderBy: { numero: 'asc' },
        select: { id: true },
      })
      expect(prisma.turno.updateMany).toHaveBeenLastCalledWith({
        where: { id: 't2', estado: 'FREE' },
        data: { estado: 'RESERVED' },
      })
      expect(createArgs(prisma).turnoId).toBe('t2')
    })

    it('goes on to the next court when another player takes the one it tried first', async () => {
      const prisma = makePrisma()
      prisma.turno.updateMany
        .mockResolvedValueOnce({ count: 0 }) // the chosen one
        .mockResolvedValueOnce({ count: 0 }) // t2, taken by somebody else in between
        .mockResolvedValueOnce({ count: 1 }) // t3
      prisma.turno.findMany.mockResolvedValue([{ id: 't2' }, { id: 't3' }])

      await book(prisma)

      expect(createArgs(prisma).turnoId).toBe('t3')
    })

    it('answers 409 only when no court is left at that hour, and books nothing', async () => {
      const prisma = makePrisma()
      prisma.turno.updateMany.mockResolvedValue({ count: 0 })
      prisma.turno.findMany.mockResolvedValue([{ id: 't2' }, { id: 't3' }])

      await expect(book(prisma)).rejects.toBeInstanceOf(ConflictException)

      expect(prisma.turno.updateMany).toHaveBeenCalledTimes(3)
      expect(prisma.reserva.create).not.toHaveBeenCalled()
    })

    it('charges the price of the court, whichever of its slots was taken', async () => {
      const prisma = makePrisma()
      prisma.turno.updateMany.mockResolvedValueOnce({ count: 0 })
      prisma.turno.findMany.mockResolvedValue([{ id: 't2' }])

      await book(prisma)

      const data = createArgs(prisma)
      expect(data.montoTotal).toBe(20000)
      expect(data.pago).toEqual({ create: { monto: 5000, estadoPago: 'PENDING' } })
    })
  })

  describe('entries that share the physical space (one court of 11 divided into 3 of 5)', () => {
    const book = (prisma: ReturnType<typeof makePrisma>) =>
      new ReservasService(prisma as never, makeNotifications() as never).create(
        'u1',
        { turnoId: 't1', tipoPago: 'SENA' },
        now
      )
    // The booked entry c1 shares the space with c-other.
    const linkedTo = (prisma: ReturnType<typeof makePrisma>, reserved: object[]) => {
      prisma.canchaConflicto.findMany.mockResolvedValue([
        { canchaId: 'c1', otraCanchaId: 'c-other' },
      ])
      prisma.turno.findMany.mockImplementation(async (args?: object) =>
        (args as { where: { estado: string } }).where.estado === 'RESERVED' ? reserved : []
      )
    }

    it('takes a lock per owner and hour before looking at the links and claiming the slot', async () => {
      const prisma = makePrisma()
      await book(prisma)

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1)
      const [strings, ...values] = prisma.$executeRaw.mock.calls[0] as unknown as [
        string[],
        ...unknown[],
      ]
      expect(strings.join('?')).toContain('pg_advisory_xact_lock')
      expect(values).toEqual(['o1', future.toISOString()])
      // The lock comes first: otherwise two bookings could both pass the check.
      expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.turno.updateMany.mock.invocationCallOrder[0]
      )
    })

    it('refuses the booking (409) when a linked entry is reserved at that hour, and claims nothing', async () => {
      const prisma = makePrisma()
      linkedTo(prisma, [{ canchaId: 'c-other', fechaHoraInicio: future }])

      await expect(book(prisma)).rejects.toBeInstanceOf(ConflictException)

      expect(prisma.turno.updateMany).not.toHaveBeenCalled()
      expect(prisma.reserva.create).not.toHaveBeenCalled()
    })

    it('asks for the reservations of the linked entries exactly at the hour of the slot', async () => {
      const prisma = makePrisma()
      linkedTo(prisma, [])

      await book(prisma)

      expect(prisma.turno.findMany).toHaveBeenCalledWith({
        where: {
          canchaId: { in: ['c-other'] },
          estado: 'RESERVED',
          fechaHoraInicio: { gte: future, lte: future },
        },
        select: { canchaId: true, fechaHoraInicio: true },
      })
    })

    it('books normally when the linked entry has nothing reserved at that hour', async () => {
      const prisma = makePrisma()
      linkedTo(prisma, [])

      await book(prisma)

      expect(createArgs(prisma).turnoId).toBe('t1')
    })

    it('frees the expired bookings of the whole owner first, so an expired one of a linked entry does not block', async () => {
      const prisma = makePrisma()

      await book(prisma)

      const release = prisma.reserva.findMany.mock.calls[0][0] as { where: Record<string, unknown> }
      expect(release.where.estado).toBe('PENDING')
      expect(release.where.turno).toEqual({ cancha: { ownerId: 'o1' } })
    })

    it('an entry that shares nothing is not slowed down by looking for reservations', async () => {
      const prisma = makePrisma()

      await book(prisma)

      expect(prisma.turno.findMany).not.toHaveBeenCalled()
    })
  })

  it('answers 404 for an unknown slot', async () => {
    const prisma = makePrisma()
    prisma.turno.findUnique.mockResolvedValue(null)
    await expect(
      new ReservasService(prisma as never, makeNotifications() as never).create(
        'u1',
        { turnoId: 't1', tipoPago: 'SENA' },
        now
      )
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('answers 400 for a slot that already started', async () => {
    const prisma = makePrisma()
    prisma.turno.findUnique.mockResolvedValue(
      turno({ fechaHoraInicio: new Date('2026-11-14T14:00:00.000Z') })
    )
    await expect(
      new ReservasService(prisma as never, makeNotifications() as never).create(
        'u1',
        { turnoId: 't1', tipoPago: 'SENA' },
        now
      )
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.turno.updateMany).not.toHaveBeenCalled()
  })

  it('answers 400 when the amount to charge is not above zero', async () => {
    const prisma = makePrisma()
    prisma.turno.findUnique.mockResolvedValue(turno({ cancha: { ...cancha, montoSena: 0 } }))
    await expect(
      new ReservasService(prisma as never, makeNotifications() as never).create(
        'u1',
        { turnoId: 't1', tipoPago: 'SENA' },
        now
      )
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.turno.updateMany).not.toHaveBeenCalled()
  })

  it('frees expired holds of that court before claiming the slot', async () => {
    const prisma = makePrisma()
    prisma.reserva.findMany.mockResolvedValue([
      {
        id: 'old',
        turnoId: 't1',
        userId: 'u9',
        montoTotal: 20000,
        createdAt: new Date('2026-11-14T14:30:00.000Z'),
        turno: { canchaId: 'c1', fechaHoraInicio: future, fechaHoraFin: future },
      },
    ])
    await new ReservasService(prisma as never, makeNotifications() as never).create(
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
    await new ReservasService(prisma as never, makeNotifications() as never).listMine('u1', now)
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
    const views = await new ReservasService(prisma as never, makeNotifications() as never).listMine(
      'u1',
      now
    )
    expect(views[0]).toMatchObject({ montoPagado: 5000, montoRestante: 15000, montoACobrar: null })
    expect(views[1]).toMatchObject({ montoPagado: 0, montoRestante: 20000, montoACobrar: 5000 })
  })

  it('shows nothing left to pay after paying the total', async () => {
    const prisma = makePrisma()
    prisma.reserva.findMany.mockResolvedValue([
      stored({ estadoPago: 'APPROVED', monto: 20000 }, 'CONFIRMED'),
    ])
    const [view] = await new ReservasService(
      prisma as never,
      makeNotifications() as never
    ).listMine('u1', now)
    expect(view).toMatchObject({ montoPagado: 20000, montoRestante: 0 })
  })
})

describe('ReservasService.listForOwner', () => {
  const ownerBooking = (pago: object | null, estado = 'PENDING', createdAt = now) => ({
    ...stored(pago, estado),
    createdAt,
    user: { nombre: 'Ana', avatarUrl: 'https://img.test/ana.jpg' },
  })

  it('lists only the bookings of the slots of the courts of that owner, soonest first', async () => {
    const prisma = makePrisma()
    await new ReservasService(prisma as never, makeNotifications() as never).listForOwner('o1', now)
    const call = prisma.reserva.findMany.mock.calls.at(-1)?.[0] as {
      where: object
      orderBy: object
    }
    expect(call.where).toEqual({ turno: { cancha: { ownerId: 'o1' } } })
    expect(call.orderBy).toEqual({ turno: { fechaHoraInicio: 'asc' } })
  })

  it('frees the expired holds of the courts of that owner before listing', async () => {
    const prisma = makePrisma()
    await new ReservasService(prisma as never, makeNotifications() as never).listForOwner('o1', now)
    const release = prisma.reserva.findMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(release.where.turno).toEqual({ cancha: { ownerId: 'o1' } })
    expect(release.where.estado).toBe('PENDING')
  })

  it('shows who booked, what was paid and what is left to collect at the court', async () => {
    const prisma = makePrisma()
    prisma.reserva.findMany.mockResolvedValue([
      ownerBooking({ estadoPago: 'APPROVED', monto: 5000 }, 'CONFIRMED'),
    ])
    const [view] = await new ReservasService(
      prisma as never,
      makeNotifications() as never
    ).listForOwner('o1', now)
    expect(view).toMatchObject({
      id: 'r1',
      estado: 'CONFIRMED',
      jugador: { nombre: 'Ana', avatarUrl: 'https://img.test/ana.jpg' },
      cancha: { id: 'c1', nombre: 'El Mate' },
      montoTotal: 20000,
      montoPagado: 5000,
      montoRestante: 15000,
      expiraEl: null,
    })
  })

  it('never exposes the contact data of the player', async () => {
    const prisma = makePrisma()
    prisma.reserva.findMany.mockResolvedValue([
      {
        ...ownerBooking({ estadoPago: 'APPROVED', monto: 5000 }, 'CONFIRMED'),
        user: { nombre: 'Ana', avatarUrl: null, email: 'ana@mail.com', telefono: '1155' },
      },
    ])
    const [view] = await new ReservasService(
      prisma as never,
      makeNotifications() as never
    ).listForOwner('o1', now)
    expect(view.jugador).toEqual({ nombre: 'Ana', avatarUrl: null })
    expect(JSON.stringify(view)).not.toContain('ana@mail.com')
    expect(JSON.stringify(view)).not.toContain('1155')
  })

  it('points to the chat of the booking only once the player wrote in it', async () => {
    const prisma = makePrisma()
    prisma.reserva.findMany.mockResolvedValue([
      { ...ownerBooking(null), conversacion: { id: 'conv-1', ultimoMensajeAt: now } },
      {
        ...ownerBooking(null),
        id: 'r2',
        conversacion: { id: 'conv-2', ultimoMensajeAt: null },
      },
      { ...ownerBooking(null), id: 'r3', conversacion: null },
    ])
    const views = await new ReservasService(
      prisma as never,
      makeNotifications() as never
    ).listForOwner('o1', now)
    expect(views.map((v) => v.conversacionId)).toEqual(['conv-1', null, null])
  })

  it('brings the chat id of the booking and nothing else of it', async () => {
    const prisma = makePrisma()
    await new ReservasService(prisma as never, makeNotifications() as never).listForOwner('o1', now)
    const call = prisma.reserva.findMany.mock.calls.at(-1)?.[0] as {
      include: { conversacion: unknown }
    }
    expect(call.include.conversacion).toEqual({ select: { id: true, ultimoMensajeAt: true } })
  })

  it('says when an unpaid booking stops holding the slot', async () => {
    const prisma = makePrisma()
    const createdAt = new Date('2026-11-14T14:55:00.000Z')
    prisma.reserva.findMany.mockResolvedValue([
      ownerBooking({ estadoPago: 'PENDING', monto: 5000 }, 'PENDING', createdAt),
    ])
    const [view] = await new ReservasService(
      prisma as never,
      makeNotifications() as never
    ).listForOwner('o1', now)
    expect(view.expiraEl).toEqual(new Date('2026-11-14T15:10:00.000Z'))
    expect(view).toMatchObject({ montoPagado: 0, montoACobrar: 5000 })
  })
})

describe('ReservasService.cancelByOwner', () => {
  const startsAt = new Date('2026-11-15T20:00:00.000Z')
  const bookedAt = new Date('2026-11-14T14:50:00.000Z')

  const booking = (overrides: object = {}) => ({
    id: 'r1',
    userId: 'u1',
    estado: 'CONFIRMED',
    montoTotal: 20000,
    createdAt: bookedAt,
    turnoId: 't1',
    turno: {
      id: 't1',
      canchaId: 'c1',
      fechaHoraInicio: startsAt,
      fechaHoraFin: new Date(startsAt.getTime() + 3_600_000),
      cancha: { id: 'c1', nombre: 'El Mate', ownerId: 'o1' },
    },
    ...overrides,
  })
  const approvedPago = { estadoPago: 'APPROVED', monto: 5000, mpPaymentId: '189744906496' }

  const setup = (reserva: unknown = booking(), pago: unknown = approvedPago) => {
    const prisma = makePrisma()
    const notifications = makeNotifications()
    prisma.reserva.findUnique.mockResolvedValue(reserva)
    prisma.pago.findUnique.mockResolvedValue(pago)
    return {
      prisma,
      notifications,
      service: new ReservasService(prisma as never, notifications as never),
    }
  }

  it('cancels a paid booking: history with the refund pending, booking gone, slot FREE', async () => {
    const { prisma, service } = setup()
    const result = await service.cancelByOwner('o1', 'r1', now)

    expect(prisma.reserva.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', estado: 'CONFIRMED' },
      data: { estado: 'CANCELLED' },
    })
    expect(prisma.historialReserva.create).toHaveBeenCalledWith({
      data: {
        canchaId: 'c1',
        jugadorId: 'u1',
        turnoInicio: startsAt,
        turnoFin: new Date(startsAt.getTime() + 3_600_000),
        montoTotal: 20000,
        montoPagado: 5000,
        mpPaymentId: '189744906496',
        motivo: 'CANCELADA_DUENO',
        devolucion: 'PENDIENTE',
        reservadaAt: bookedAt,
      },
    })
    expect(prisma.pago.deleteMany).toHaveBeenCalledWith({ where: { reservaId: 'r1' } })
    expect(prisma.reserva.delete).toHaveBeenCalledWith({ where: { id: 'r1' } })
    expect(prisma.turno.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { estado: 'FREE' },
    })
    expect(result).toMatchObject({ devolucion: 'PENDIENTE', montoPagado: 5000 })
  })

  it('cancels a booking that was never paid without any refund', async () => {
    const { prisma, service } = setup(booking({ estado: 'PENDING' }), {
      estadoPago: 'PENDING',
      monto: 5000,
      mpPaymentId: null,
    })
    const result = await service.cancelByOwner('o1', 'r1', now)

    const created = prisma.historialReserva.create.mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(created.data).toMatchObject({
      montoPagado: 0,
      mpPaymentId: null,
      motivo: 'CANCELADA_DUENO',
      devolucion: 'NO_CORRESPONDE',
    })
    expect(result.devolucion).toBe('NO_CORRESPONDE')
  })

  it('tells the player which turn was cancelled and how much is to be returned', async () => {
    const { notifications, service } = setup()
    await service.cancelByOwner('o1', 'r1', now)
    expect(notifications.notifyBookingCancelled).toHaveBeenCalledWith({
      jugadorId: 'u1',
      canchaNombre: 'El Mate',
      turnoInicio: startsAt,
      montoPagado: 5000,
    })
  })

  it('still cancels when the notification fails', async () => {
    const { notifications, service } = setup()
    notifications.notifyBookingCancelled.mockRejectedValue(new Error('push down'))
    await expect(service.cancelByOwner('o1', 'r1', now)).resolves.toMatchObject({
      devolucion: 'PENDIENTE',
    })
  })

  it('answers 404 for an unknown booking and for a court that belongs to another owner', async () => {
    const missing = setup(null)
    await expect(missing.service.cancelByOwner('o1', 'r1', now)).rejects.toBeInstanceOf(
      NotFoundException
    )
    const other = setup()
    await expect(other.service.cancelByOwner('another-owner', 'r1', now)).rejects.toBeInstanceOf(
      NotFoundException
    )
    expect(other.prisma.reserva.updateMany).not.toHaveBeenCalled()
    expect(other.prisma.turno.update).not.toHaveBeenCalled()
  })

  it('answers 409 for a turn that already started', async () => {
    const { prisma, service } = setup(
      booking({
        turno: {
          id: 't1',
          canchaId: 'c1',
          fechaHoraInicio: new Date('2026-11-14T14:00:00.000Z'),
          fechaHoraFin: new Date('2026-11-14T15:30:00.000Z'),
          cancha: { id: 'c1', nombre: 'El Mate', ownerId: 'o1' },
        },
      })
    )
    await expect(service.cancelByOwner('o1', 'r1', now)).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.reserva.updateMany).not.toHaveBeenCalled()
  })

  it('answers 409 and writes nothing when the booking changed meanwhile', async () => {
    const { prisma, notifications, service } = setup()
    prisma.reserva.updateMany.mockResolvedValue({ count: 0 })
    await expect(service.cancelByOwner('o1', 'r1', now)).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.historialReserva.create).not.toHaveBeenCalled()
    expect(prisma.turno.update).not.toHaveBeenCalled()
    expect(notifications.notifyBookingCancelled).not.toHaveBeenCalled()
  })
})

describe('ReservasService history of the owner', () => {
  const row = (overrides: object = {}) => ({
    id: 'h1',
    motivo: 'CANCELADA_DUENO',
    devolucion: 'PENDIENTE',
    turnoInicio: new Date('2026-11-15T20:00:00.000Z'),
    turnoFin: new Date('2026-11-15T21:00:00.000Z'),
    montoTotal: 20000,
    montoPagado: 5000,
    devueltoAt: null,
    reservadaAt: new Date('2026-11-14T14:50:00.000Z'),
    cerradaAt: new Date('2026-11-14T16:00:00.000Z'),
    cancha: { id: 'c1', nombre: 'El Mate' },
    jugador: { nombre: 'Ana', avatarUrl: 'https://img.test/ana.jpg' },
    ...overrides,
  })

  describe('listHistorial', () => {
    it('lists only the records of the courts of that owner, newest first', async () => {
      const prisma = makePrisma()
      await new ReservasService(prisma as never, makeNotifications() as never).listHistorial('o1')
      const call = prisma.historialReserva.findMany.mock.calls[0][0] as {
        where: object
        orderBy: object
      }
      expect(call.where).toEqual({ cancha: { ownerId: 'o1' } })
      expect(call.orderBy).toEqual({ cerradaAt: 'desc' })
    })

    it('shows who, which court, the amounts and the refund state', async () => {
      const prisma = makePrisma()
      prisma.historialReserva.findMany.mockResolvedValue([row()])
      const [view] = await new ReservasService(
        prisma as never,
        makeNotifications() as never
      ).listHistorial('o1')
      expect(view).toEqual({
        id: 'h1',
        motivo: 'CANCELADA_DUENO',
        devolucion: 'PENDIENTE',
        turnoInicio: new Date('2026-11-15T20:00:00.000Z'),
        turnoFin: new Date('2026-11-15T21:00:00.000Z'),
        montoTotal: 20000,
        montoPagado: 5000,
        devueltoAt: null,
        reservadaAt: new Date('2026-11-14T14:50:00.000Z'),
        cerradaAt: new Date('2026-11-14T16:00:00.000Z'),
        cancha: { id: 'c1', nombre: 'El Mate' },
        jugador: { nombre: 'Ana', avatarUrl: 'https://img.test/ana.jpg' },
      })
    })

    it('never exposes the payment id or the contact data of the player', async () => {
      const prisma = makePrisma()
      prisma.historialReserva.findMany.mockResolvedValue([
        row({
          mpPaymentId: '189744906496',
          jugadorId: 'u1',
          jugador: { nombre: 'Ana', avatarUrl: null, email: 'ana@mail.com', telefono: '1155' },
        }),
      ])
      const [view] = await new ReservasService(
        prisma as never,
        makeNotifications() as never
      ).listHistorial('o1')
      const text = JSON.stringify(view)
      expect(text).not.toContain('189744906496')
      expect(text).not.toContain('ana@mail.com')
      expect(text).not.toContain('1155')
      expect(text).not.toContain('u1')
    })
  })

  describe('markRefunded', () => {
    const service = (prisma: ReturnType<typeof makePrisma>) =>
      new ReservasService(prisma as never, makeNotifications() as never)

    it('marks a pending refund as done, with the time, only for a court of that owner', async () => {
      const prisma = makePrisma()
      prisma.historialReserva.findFirst.mockResolvedValue(
        row({ devolucion: 'HECHA', devueltoAt: now })
      )
      const view = await service(prisma).markRefunded('o1', 'h1', now)
      expect(prisma.historialReserva.updateMany).toHaveBeenCalledWith({
        where: { id: 'h1', devolucion: 'PENDIENTE', cancha: { ownerId: 'o1' } },
        data: { devolucion: 'HECHA', devueltoAt: now },
      })
      expect(view).toMatchObject({ id: 'h1', devolucion: 'HECHA', devueltoAt: now })
    })

    it('answers the same when it was already marked (no error, nothing changes again)', async () => {
      const prisma = makePrisma()
      prisma.historialReserva.updateMany.mockResolvedValue({ count: 0 })
      prisma.historialReserva.findFirst.mockResolvedValue(
        row({ devolucion: 'HECHA', devueltoAt: new Date('2026-11-14T18:00:00.000Z') })
      )
      const view = await service(prisma).markRefunded('o1', 'h1', now)
      expect(view.devolucion).toBe('HECHA')
      expect(view.devueltoAt).toEqual(new Date('2026-11-14T18:00:00.000Z'))
    })

    it('answers 409 when there was nothing to return', async () => {
      const prisma = makePrisma()
      prisma.historialReserva.updateMany.mockResolvedValue({ count: 0 })
      prisma.historialReserva.findFirst.mockResolvedValue(
        row({ devolucion: 'NO_CORRESPONDE', montoPagado: 0 })
      )
      await expect(service(prisma).markRefunded('o1', 'h1', now)).rejects.toBeInstanceOf(
        ConflictException
      )
    })

    it('answers 404 for an unknown record and for another owner', async () => {
      const prisma = makePrisma()
      prisma.historialReserva.updateMany.mockResolvedValue({ count: 0 })
      prisma.historialReserva.findFirst.mockResolvedValue(null)
      await expect(service(prisma).markRefunded('o2', 'h1', now)).rejects.toBeInstanceOf(
        NotFoundException
      )
      expect(prisma.historialReserva.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'h1', cancha: { ownerId: 'o2' } } })
      )
    })
  })
})
