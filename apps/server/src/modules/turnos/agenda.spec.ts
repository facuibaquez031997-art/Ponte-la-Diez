import 'reflect-metadata'
import { vi } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { TurnosService } from './turnos.service.js'

const now = new Date('2026-11-09T15:00:00.000Z') // Mon 12:00 local
const canchas = [
  { id: 'c1', nombre: 'El Mate', tipoSuperficie: 'Sintético', jugadores: 5, cantidad: 2 },
  { id: 'c2', nombre: 'La Bombonera', tipoSuperficie: 'Cemento', jugadores: null, cantidad: 1 },
]

const turno = (
  id: string,
  canchaId: string,
  iso: string,
  estado = 'FREE',
  reserva: object | null = null,
  numero = 1
) => ({
  id,
  canchaId,
  fechaHoraInicio: new Date(iso),
  fechaHoraFin: new Date(new Date(iso).getTime() + 3_600_000),
  numero,
  estado,
  reserva,
})

const booking = (overrides: object = {}) => ({
  id: 'r1',
  estado: 'CONFIRMED',
  montoTotal: 20000,
  createdAt: new Date('2026-11-09T14:00:00.000Z'),
  user: { nombre: 'Ana', avatarUrl: 'https://img.test/ana.jpg' },
  pago: { estadoPago: 'APPROVED', monto: 5000 },
  conversacion: null,
  ...overrides,
})

const makePrisma = () => ({
  cancha: { findMany: vi.fn(async (_args?: object) => canchas as unknown[]) },
  reserva: { findMany: vi.fn(async (_args?: object) => [] as unknown[]) },
  turno: { findMany: vi.fn(async (_args?: object) => [] as unknown[]) },
})

const makeService = (prisma = makePrisma()) => {
  const service = new TurnosService(prisma as never)
  const sync = vi.spyOn(service, 'sync').mockResolvedValue(undefined)
  return { prisma, service, sync }
}

describe('TurnosService.agenda', () => {
  it('reads only the courts of that owner, in the Argentina day asked for', async () => {
    const { prisma, service } = makeService()

    await service.agenda('o1', '2026-11-10', now)

    expect(prisma.cancha.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'o1' } })
    )
    const call = prisma.turno.findMany.mock.calls[0][0] as {
      where: { canchaId: { in: string[] }; fechaHoraInicio: { gte: Date; lt: Date } }
    }
    expect(call.where.canchaId).toEqual({ in: ['c1', 'c2'] })
    expect(call.where.fechaHoraInicio.gte.toISOString()).toBe('2026-11-10T03:00:00.000Z')
    expect(call.where.fechaHoraInicio.lt.toISOString()).toBe('2026-11-11T03:00:00.000Z')
  })

  it('frees the expired holds of the owner and generates the slots before reading', async () => {
    const { prisma, service, sync } = makeService()

    await service.agenda('o1', '2026-11-10', now)

    const release = prisma.reserva.findMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(release.where.turno).toEqual({ cancha: { ownerId: 'o1' } })
    expect(sync).toHaveBeenCalledWith('c1', now)
    expect(sync).toHaveBeenCalledWith('c2', now)
  })

  it('groups the slots by court, free ones included, in time order', async () => {
    const { prisma, service } = makeService()
    prisma.turno.findMany.mockResolvedValue([
      turno('t1', 'c1', '2026-11-10T20:00:00.000Z'),
      turno('t2', 'c2', '2026-11-10T20:00:00.000Z', 'RESERVED', booking()),
      turno('t3', 'c1', '2026-11-10T21:00:00.000Z', 'BLOCKED'),
    ])

    const view = await service.agenda('o1', '2026-11-10', now)

    expect(view.fecha).toBe('2026-11-10')
    expect(
      view.canchas.map((c) => [c.cancha.nombre, c.turnos.map((t) => [t.id, t.estado])])
    ).toEqual([
      [
        'El Mate',
        [
          ['t1', 'FREE'],
          ['t3', 'BLOCKED'],
        ],
      ],
      ['La Bombonera', [['t2', 'RESERVED']]],
    ])
  })

  it('shows who booked, what was paid and what is left to collect at the court', async () => {
    const { prisma, service } = makeService()
    prisma.turno.findMany.mockResolvedValue([
      turno('t2', 'c2', '2026-11-10T20:00:00.000Z', 'RESERVED', booking()),
    ])

    const view = await service.agenda('o1', '2026-11-10', now)

    expect(view.canchas[1].turnos[0].reserva).toMatchObject({
      estado: 'CONFIRMED',
      jugador: { nombre: 'Ana', avatarUrl: 'https://img.test/ana.jpg' },
      montoTotal: 20000,
      montoPagado: 5000,
      montoRestante: 15000,
      expiraEl: null,
    })
  })

  it('says until when an unpaid booking holds the slot and counts nothing as paid', async () => {
    const { prisma, service } = makeService()
    prisma.turno.findMany.mockResolvedValue([
      turno(
        't2',
        'c1',
        '2026-11-10T20:00:00.000Z',
        'RESERVED',
        booking({
          estado: 'PENDING',
          pago: { estadoPago: 'PENDING', monto: 5000 },
          createdAt: new Date('2026-11-09T14:55:00.000Z'),
        })
      ),
    ])

    const [{ reserva }] = (await service.agenda('o1', '2026-11-10', now)).canchas[0].turnos

    expect(reserva).toMatchObject({ estado: 'PENDING', montoPagado: 0, montoRestante: 20000 })
    expect(reserva?.expiraEl?.toISOString()).toBe('2026-11-09T15:10:00.000Z')
  })

  it('points to the chat of the booking only once the player wrote in it', async () => {
    const { prisma, service } = makeService()
    prisma.turno.findMany.mockResolvedValue([
      turno(
        't1',
        'c1',
        '2026-11-10T20:00:00.000Z',
        'RESERVED',
        booking({ conversacion: { id: 'conv-1', ultimoMensajeAt: now } })
      ),
      turno(
        't2',
        'c1',
        '2026-11-10T21:00:00.000Z',
        'RESERVED',
        booking({ id: 'r2', conversacion: { id: 'conv-2', ultimoMensajeAt: null } })
      ),
    ])

    const turnos = (await service.agenda('o1', '2026-11-10', now)).canchas[0].turnos

    expect(turnos.map((t) => t.reserva?.conversacionId)).toEqual(['conv-1', null])
  })

  it('never exposes the contact data of the player', async () => {
    const { prisma, service } = makeService()
    prisma.turno.findMany.mockResolvedValue([
      turno(
        't1',
        'c1',
        '2026-11-10T20:00:00.000Z',
        'RESERVED',
        booking({
          user: { nombre: 'Ana', avatarUrl: null, email: 'ana@mail.com', telefono: '1155' },
        })
      ),
    ])

    const view = await service.agenda('o1', '2026-11-10', now)

    expect(view.canchas[0].turnos[0].reserva?.jugador).toEqual({ nombre: 'Ana', avatarUrl: null })
    expect(JSON.stringify(view)).not.toContain('ana@mail.com')
    expect(JSON.stringify(view)).not.toContain('1155')
  })

  it('brings the size of every court, and none for a court that has not set it yet', async () => {
    const { prisma, service } = makeService()

    const view = await service.agenda('o1', '2026-11-10', now)

    expect(view.canchas.map((c) => [c.cancha.nombre, c.cancha.jugadores])).toEqual([
      ['El Mate', 5],
      ['La Bombonera', null],
    ])
    expect(prisma.cancha.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, nombre: true, tipoSuperficie: true, jugadores: true, cantidad: true },
      })
    )
  })

  it('brings how many courts every entry has', async () => {
    const { service } = makeService()

    const view = await service.agenda('o1', '2026-11-10', now)

    expect(view.canchas.map((c) => [c.cancha.nombre, c.cancha.cantidad])).toEqual([
      ['El Mate', 2],
      ['La Bombonera', 1],
    ])
  })

  it('shows each court of the same hour as its own slot, in order, one booked and one free', async () => {
    const { prisma, service } = makeService()
    prisma.turno.findMany.mockResolvedValue([
      turno('a1', 'c1', '2026-11-10T21:00:00.000Z', 'RESERVED', booking(), 1),
      turno('a2', 'c1', '2026-11-10T21:00:00.000Z', 'FREE', null, 2),
    ])

    const { turnos } = (await service.agenda('o1', '2026-11-10', now)).canchas[0]

    expect(turnos.map((t) => [t.numero, t.estado])).toEqual([
      [1, 'RESERVED'],
      [2, 'FREE'],
    ])
    expect(turnos[0].reserva?.jugador.nombre).toBe('Ana')
    expect(turnos[1].reserva).toBeNull()
    const call = prisma.turno.findMany.mock.calls[0][0] as { orderBy: unknown }
    // By hour, and within one hour by the number of the court.
    expect(call.orderBy).toEqual([{ fechaHoraInicio: 'asc' }, { numero: 'asc' }])
  })

  it('answers with an empty list when the owner has no courts, without reading slots', async () => {
    const { prisma, service } = makeService()
    prisma.cancha.findMany.mockResolvedValue([])

    const view = await service.agenda('o1', '2026-11-10', now)

    expect(view.canchas).toEqual([])
    expect(prisma.turno.findMany).not.toHaveBeenCalled()
  })

  it('shows a court with no slots that day as an empty list, not as missing', async () => {
    const { service } = makeService()

    const view = await service.agenda('o1', '2026-11-10', now)

    expect(view.canchas.map((c) => c.turnos)).toEqual([[], []])
  })

  it('uses today in Argentina when no day is given', async () => {
    const { prisma, service } = makeService()

    const view = await service.agenda('o1', undefined, now)

    expect(view.fecha).toBe('2026-11-09')
    const call = prisma.turno.findMany.mock.calls[0][0] as {
      where: { fechaHoraInicio: { gte: Date } }
    }
    expect(call.where.fechaHoraInicio.gte.toISOString()).toBe('2026-11-09T03:00:00.000Z')
  })

  it('warns when the day is further ahead than the generated slots', async () => {
    const { service } = makeService()

    expect((await service.agenda('o1', '2026-11-22', now)).fueraDeVentana).toBe(false)
    expect((await service.agenda('o1', '2026-11-23', now)).fueraDeVentana).toBe(true)
  })

  it('rejects a day that does not exist', async () => {
    const { service } = makeService()

    await expect(service.agenda('o1', '2026-02-30', now)).rejects.toBeInstanceOf(
      BadRequestException
    )
  })
})
