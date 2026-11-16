import 'reflect-metadata'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common'
import { ConversacionesService } from './conversaciones.service.js'
import { ONLINE_MS, PresenceService, TYPING_MS } from './presence.service.js'

const PLAYER = 'player-1'
const OWNER = 'owner-1'
const STRANGER = 'stranger-1'
const CANCHA = 'cancha-1'
const START = new Date('2026-11-15T12:00:00.000Z')
const TURNO = new Date('2026-11-20T20:00:00.000Z')

interface Row {
  id: string
  reservaId: string | null
  canchaId: string
  jugadorId: string
  turnoInicio: Date | null
  jugadorLeyoHasta: Date | null
  duenoLeyoHasta: Date | null
  jugadorEliminoAt: Date | null
  duenoEliminoAt: Date | null
  ultimoMensajeAt: Date | null
}
interface Msg {
  id: string
  conversacionId: string
  autorId: string
  cuerpo: string
  createdAt: Date
  ofertaTurnoId: string | null
  ofertaInicio: Date | null
  ofertaCanchaId: string | null
}
interface Slot {
  canchaId: string
  /** Which court of the entry it is (1 to cantidad); 1 when the test does not care. */
  numero?: number
  estado: 'FREE' | 'RESERVED' | 'BLOCKED'
  fechaHoraInicio: Date
  /** A reserved slot whose booking still waits for its payment (it is not CONFIRMED). */
  pendiente?: boolean
}
interface Reserva {
  estado: string
  montoTotal: number
  pago: { estadoPago: string; monto: number } | null
}

// Courts besides the one of the conversation (CANCHA, a 5): another one of the same owner and one
// of somebody else.
const COURTS: Record<
  string,
  { nombre: string; precioHora: number; jugadores: number; ownerId: string }
> = {
  [CANCHA]: { nombre: 'El Mate', precioHora: 20000, jugadores: 5, ownerId: OWNER },
  'cancha-7': { nombre: 'La Grande', precioHora: 30000, jugadores: 7, ownerId: OWNER },
  'otra-cancha': { nombre: 'Ajena', precioHora: 10000, jugadores: 11, ownerId: 'otro-dueno' },
}

const advance = (seconds: number) => vi.setSystemTime(new Date(Date.now() + seconds * 1000))

/** In-memory stand-in for the Prisma calls the service makes. */
const makePrisma = (reservas: Record<string, Reserva> = {}) => {
  const conversaciones: Row[] = []
  const mensajes: Msg[] = []
  // Slots the owner can offer; tests add, take or move them.
  const turnos: Record<string, Slot> = {}
  const links: { canchaId: string; numero: number; otraCanchaId: string; otraNumero: number }[] = []
  let seq = 0

  const withRelations = (row: Row) => ({
    ...row,
    cancha: {
      id: row.canchaId,
      nombre: 'El Mate',
      barrio: 'Barrio El Sol',
      precioHora: 20000,
      montoSena: 5000,
      jugadores: 5,
      ownerId: OWNER,
      owner: { nombre: 'Dueño', avatarUrl: null },
    },
    jugador: { nombre: 'Jugador', avatarUrl: null },
    reserva: row.reservaId ? (reservas[row.reservaId] ?? null) : null,
  })
  const blank = (data: Partial<Row>): Row => ({
    id: `conv-${++seq}`,
    reservaId: null,
    canchaId: CANCHA,
    jugadorId: PLAYER,
    turnoInicio: null,
    jugadorLeyoHasta: null,
    duenoLeyoHasta: null,
    jugadorEliminoAt: null,
    duenoEliminoAt: null,
    ultimoMensajeAt: null,
    ...data,
  })
  type Range = { gt?: Date; lt?: Date }
  const inRange = (date: Date, range?: Range) =>
    (!range?.gt || date > range.gt) && (!range?.lt || date < range.lt)

  const prisma = {
    cancha: {
      findUnique: vi.fn(async (args: { where: { id: string } }) =>
        args.where.id === CANCHA ? { id: CANCHA } : null
      ),
      // The other courts of the owner that a slot can be offered from.
      findMany: vi.fn(async (args: { where: { id: { in: string[] } } }) =>
        args.where.id.in
          .filter((id) => COURTS[id])
          .map((id) => ({ id, ...COURTS[id], barrio: 'Barrio El Sol', montoSena: 5000 }))
      ),
    },
    turno: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        const slot = turnos[args.where.id]
        return slot ? { ...slot, cancha: { ownerId: COURTS[slot.canchaId]?.ownerId } } : null
      }),
      // Two kinds of look-up: the free slots of the courts and hours of the offers (one per court
      // of the entry), and the reservations of the entries that share the space with an offered one.
      findMany: vi.fn(
        async (args: {
          where: {
            estado: string
            canchaId?: { in: string[] }
            fechaHoraInicio?: { gte?: Date; lte?: Date }
            reserva?: { is: { estado: string } }
            OR?: { canchaId: string; fechaHoraInicio: Date }[]
          }
        }) => {
          const { where } = args
          return Object.values(turnos)
            .filter((slot) => {
              if (slot.estado !== where.estado) return false
              if (where.canchaId) {
                const { gte, lte } = where.fechaHoraInicio ?? {}
                // Only CONFIRMED bookings count for the links: a reserved slot that still waits for
                // its payment is left out.
                if (where.reserva?.is.estado === 'CONFIRMED' && slot.pendiente) return false
                return (
                  where.canchaId.in.includes(slot.canchaId) &&
                  (!gte || slot.fechaHoraInicio >= gte) &&
                  (!lte || slot.fechaHoraInicio <= lte)
                )
              }
              return (
                slot.fechaHoraInicio > new Date() &&
                (where.OR ?? []).some(
                  (wanted) =>
                    wanted.canchaId === slot.canchaId &&
                    wanted.fechaHoraInicio.getTime() === slot.fechaHoraInicio.getTime()
                )
              )
            })
            .map((slot) => ({
              canchaId: slot.canchaId,
              numero: slot.numero ?? 1,
              fechaHoraInicio: slot.fechaHoraInicio,
            }))
        }
      ),
    },
    // Entries of the owner that share the physical space; tests add them in `links`.
    canchaConflicto: {
      findMany: vi.fn(async (args: { where: { canchaId: { in: string[] } } }) =>
        links.filter((link) => args.where.canchaId.in.includes(link.canchaId))
      ),
    },
    reserva: {
      // No unpaid booking is ever old enough to release in these tests.
      findMany: vi.fn(async (_args?: object) => [] as unknown[]),
      findUnique: vi.fn(async (args: { where: { id: string } }) =>
        args.where.id === 'reserva-mia'
          ? { userId: PLAYER, turno: { canchaId: CANCHA, fechaHoraInicio: TURNO } }
          : args.where.id === 'reserva-ajena'
            ? { userId: STRANGER, turno: { canchaId: CANCHA, fechaHoraInicio: TURNO } }
            : null
      ),
    },
    conversacion: {
      findUnique: vi.fn(async (args: { where: { id: string } }) => {
        const row = conversaciones.find((c) => c.id === args.where.id)
        return row ? withRelations(row) : null
      }),
      findFirst: vi.fn(
        async (args: { where: { jugadorId: string; canchaId: string; reservaId: null } }) =>
          conversaciones.find(
            (c) =>
              c.jugadorId === args.where.jugadorId &&
              c.canchaId === args.where.canchaId &&
              c.reservaId === null
          ) ?? null
      ),
      create: vi.fn(async (args: { data: Partial<Row> }) => {
        const row = blank(args.data)
        conversaciones.push(row)
        return row
      }),
      upsert: vi.fn(async (args: { where: { reservaId: string }; create: Partial<Row> }) => {
        const found = conversaciones.find((c) => c.reservaId === args.where.reservaId)
        if (found) return found
        const row = blank(args.create)
        conversaciones.push(row)
        return row
      }),
      findMany: vi.fn(async (args: { where: { OR: { jugadorId?: string }[] } }) => {
        const userId = args.where.OR[0]?.jugadorId
        // The real query also matches the owner of the court; here both ids are known.
        return conversaciones
          .filter((c) => c.ultimoMensajeAt !== null && (c.jugadorId === userId || userId === OWNER))
          .map(withRelations)
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Partial<Row> }) => {
        const row = conversaciones.find((c) => c.id === args.where.id)
        if (row) Object.assign(row, args.data)
        return row
      }),
    },
    mensaje: {
      create: vi.fn(
        async (args: {
          data: {
            conversacionId: string
            autorId: string
            cuerpo: string
            ofertaTurnoId?: string
            ofertaInicio?: Date
            ofertaCanchaId?: string
          }
        }) => {
          const msg: Msg = {
            id: `msg-${++seq}`,
            createdAt: new Date(),
            ofertaTurnoId: null,
            ofertaInicio: null,
            ofertaCanchaId: null,
            ...args.data,
          }
          mensajes.push(msg)
          return msg
        }
      ),
      findMany: vi.fn(
        async (args: { where: { conversacionId: string; createdAt?: Range }; take: number }) =>
          mensajes
            .filter(
              (m) =>
                m.conversacionId === args.where.conversacionId &&
                inRange(m.createdAt, args.where.createdAt)
            )
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, args.take)
      ),
      findFirst: vi.fn(
        async (args: { where: { conversacionId: string; createdAt?: Range } }) =>
          mensajes
            .filter(
              (m) =>
                m.conversacionId === args.where.conversacionId &&
                inRange(m.createdAt, args.where.createdAt)
            )
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
      ),
      count: vi.fn(
        async (args: {
          where: { conversacionId?: string; autorId: string | { not: string }; createdAt?: Range }
        }) =>
          mensajes.filter((m) => {
            const { conversacionId, autorId, createdAt } = args.where
            if (conversacionId && m.conversacionId !== conversacionId) return false
            if (typeof autorId === 'string' ? m.autorId !== autorId : m.autorId === autorId.not) {
              return false
            }
            return inRange(m.createdAt, createdAt)
          }).length
      ),
    },
  }
  return Object.assign(prisma, { turnos, links })
}

const makeNotifications = () => ({
  notifyNewMessage: vi.fn(async (_id: string, _autorId: string, _texto: string) => undefined),
  markConversationRead: vi.fn(async (_userId: string, _id: string) => undefined),
})

const makeService = (
  reservas: Record<string, Reserva> = {},
  notifications: ReturnType<typeof makeNotifications> = makeNotifications(),
  presence: PresenceService = new PresenceService()
) => new ConversacionesService(makePrisma(reservas) as never, notifications as never, presence)

/** The player opens a chat and writes the first message. */
const openChat = async (service: ConversacionesService, text = 'Hola, ¿tenés turno?') => {
  const { id } = await service.create(PLAYER, { canchaId: CANCHA })
  await service.send(PLAYER, id, text)
  return id
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
})
afterEach(() => vi.useRealTimers())

describe('ConversacionesService', () => {
  describe('create', () => {
    it('returns the same conversation when the player asks again', async () => {
      const service = makeService()
      const first = await service.create(PLAYER, { canchaId: CANCHA })
      const second = await service.create(PLAYER, { canchaId: CANCHA })
      expect(second.id).toBe(first.id)
    })

    it('rejects an unknown court', async () => {
      await expect(makeService().create(PLAYER, { canchaId: 'nope' })).rejects.toBeInstanceOf(
        NotFoundException
      )
    })

    it('rejects a booking that belongs to someone else', async () => {
      await expect(
        makeService().create(PLAYER, { canchaId: CANCHA, reservaId: 'reserva-ajena' })
      ).rejects.toBeInstanceOf(NotFoundException)
    })

    it('hangs the conversation from the booking and copies the slot time', async () => {
      const service = makeService({
        'reserva-mia': { estado: 'PENDING', montoTotal: 20000, pago: null },
      })
      const { id } = await service.create(PLAYER, { canchaId: CANCHA, reservaId: 'reserva-mia' })
      await service.send(PLAYER, id, 'Hola')
      const [view] = await service.list(PLAYER)
      expect(view?.turno).toMatchObject({ fechaHoraInicio: TURNO, estado: 'PENDING' })
    })
  })

  describe('participants', () => {
    it('answers 404 to anyone who is not the player or the owner of the court', async () => {
      const service = makeService()
      const id = await openChat(service)
      await expect(service.thread(STRANGER, id)).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.send(STRANGER, id, 'hola')).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.markRead(STRANGER, id)).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.remove(STRANGER, id)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('lets the owner answer and the player read the whole thread', async () => {
      const service = makeService()
      const id = await openChat(service, 'Primero')
      advance(5)
      await service.send(OWNER, id, 'Segundo')
      const { mensajes } = await service.thread(PLAYER, id)
      expect(mensajes.map((m) => [m.cuerpo, m.propio])).toEqual([
        ['Primero', true],
        ['Segundo', false],
      ])
    })
  })

  describe('inbox and unread', () => {
    it('does not list a conversation that has no messages yet', async () => {
      const service = makeService()
      await service.create(PLAYER, { canchaId: CANCHA })
      expect(await service.list(PLAYER)).toEqual([])
      expect(await service.list(OWNER)).toEqual([])
    })

    it('counts unread for the other side only and clears them when read', async () => {
      const service = makeService()
      const id = await openChat(service)
      advance(5)
      await service.send(PLAYER, id, 'Otro más')

      expect((await service.list(OWNER))[0]?.noLeidos).toBe(2)
      expect((await service.list(PLAYER))[0]?.noLeidos).toBe(0)
      expect(await service.unreadCount(OWNER)).toEqual({ count: 2 })

      advance(5)
      await service.markRead(OWNER, id)
      expect((await service.list(OWNER))[0]?.noLeidos).toBe(0)
    })

    it('shows the last message and who wrote it', async () => {
      const service = makeService()
      const id = await openChat(service)
      advance(5)
      await service.send(OWNER, id, 'Sí, a las 20')
      expect((await service.list(PLAYER))[0]?.ultimoMensaje).toMatchObject({
        cuerpo: 'Sí, a las 20',
        propio: false,
      })
    })
  })

  describe('banner', () => {
    it('says the slot is free again when the booking was released', async () => {
      const prisma = makePrisma()
      const service = new ConversacionesService(
        prisma as never,
        makeNotifications() as never,
        new PresenceService()
      )
      const { id } = await service.create(PLAYER, { canchaId: CANCHA, reservaId: 'reserva-mia' })
      await service.send(PLAYER, id, 'Hola')
      // The booking expired: the foreign key sets reservaId to null and the copy stays.
      await prisma.conversacion.update({ where: { id }, data: { reservaId: null } })
      expect((await service.list(PLAYER))[0]?.turno).toMatchObject({
        liberado: true,
        estado: null,
        fechaHoraInicio: TURNO,
      })
    })

    it('shows what was paid and what is left to pay at the court', async () => {
      const service = makeService({
        'reserva-mia': {
          estado: 'CONFIRMED',
          montoTotal: 20000,
          pago: { estadoPago: 'APPROVED', monto: 5000 },
        },
      })
      const { id } = await service.create(PLAYER, { canchaId: CANCHA, reservaId: 'reserva-mia' })
      await service.send(PLAYER, id, 'Hola')
      expect((await service.list(PLAYER))[0]?.turno).toMatchObject({
        estado: 'CONFIRMED',
        liberado: false,
        montoPagado: 5000,
        montoRestante: 15000,
      })
    })
  })

  describe('deleting is individual', () => {
    it('keeps the chat of the player in the inbox too, only empty, and the owner keeps everything', async () => {
      const service = makeService()
      const id = await openChat(service, 'Hola, ¿hay turno el 20?')
      advance(5)
      await service.remove(PLAYER, id)

      const [view] = await service.list(PLAYER)
      expect(view?.id).toBe(id)
      expect(view?.ultimoMensaje).toBeNull()
      expect(view?.noLeidos).toBe(0)
      expect((await service.thread(PLAYER, id)).mensajes).toEqual([])
      expect(await service.list(OWNER)).toHaveLength(1)
      expect((await service.thread(OWNER, id)).mensajes).toHaveLength(1)
    })

    it('shows the player only the new messages after emptying the chat', async () => {
      const service = makeService()
      const id = await openChat(service, 'Antes de vaciar')
      advance(5)
      await service.remove(PLAYER, id)
      advance(5)
      await service.send(OWNER, id, 'Después de vaciar')

      const [view] = await service.list(PLAYER)
      expect(view?.ultimoMensaje?.cuerpo).toBe('Después de vaciar')
      expect(view?.noLeidos).toBe(1)
      const player = await service.thread(PLAYER, id)
      expect(player.mensajes.map((m) => m.cuerpo)).toEqual(['Después de vaciar'])
      const owner = await service.thread(OWNER, id)
      expect(owner.mensajes.map((m) => m.cuerpo)).toEqual(['Antes de vaciar', 'Después de vaciar'])
    })

    it('keeps the chat of the owner in the inbox, only empty, so no inquiry is lost', async () => {
      const service = makeService()
      const id = await openChat(service, 'Hola, ¿hay turno el 20?')
      advance(5)
      await service.remove(OWNER, id)

      const [view] = await service.list(OWNER)
      expect(view?.id).toBe(id)
      expect(view?.ultimoMensaje).toBeNull()
      expect(view?.noLeidos).toBe(0)
      expect((await service.thread(OWNER, id)).mensajes).toEqual([])
      // The player still has everything.
      expect((await service.thread(PLAYER, id)).mensajes).toHaveLength(1)
      expect(await service.list(PLAYER)).toHaveLength(1)
    })

    it('shows the owner only the new messages after emptying the chat', async () => {
      const service = makeService()
      const id = await openChat(service, 'Antes de vaciar')
      advance(5)
      await service.remove(OWNER, id)
      advance(5)
      await service.send(PLAYER, id, 'Después de vaciar')

      const [view] = await service.list(OWNER)
      expect(view?.ultimoMensaje?.cuerpo).toBe('Después de vaciar')
      expect(view?.noLeidos).toBe(1)
      expect((await service.thread(OWNER, id)).mensajes.map((m) => m.cuerpo)).toEqual([
        'Después de vaciar',
      ])
    })

    it('keeps the whole history for someone who never deleted', async () => {
      const service = makeService()
      const id = await openChat(service, 'Uno')
      advance(5)
      await service.send(OWNER, id, 'Dos')
      expect((await service.thread(PLAYER, id)).mensajes).toHaveLength(2)
      expect((await service.thread(OWNER, id)).mensajes).toHaveLength(2)
    })
  })

  describe('connected and typing', () => {
    const setup = () => {
      const presence = new PresenceService()
      const service = makeService({}, makeNotifications(), presence)
      return { presence, service }
    }

    it('shows the other person as disconnected until their app says it is open', async () => {
      const { service } = setup()
      const id = await openChat(service)

      expect((await service.thread(PLAYER, id)).conversacion.otro.conectado).toBe(false)
      expect((await service.list(PLAYER))[0]?.otro.conectado).toBe(false)
    })

    it('shows the other person as connected after their heartbeat, from both sides', async () => {
      const { service } = setup()
      const id = await openChat(service)

      service.heartbeat(OWNER)

      expect((await service.thread(PLAYER, id)).conversacion.otro.conectado).toBe(true)
      expect((await service.list(PLAYER))[0]?.otro.conectado).toBe(true)
      // The owner is connected, but the player is not: each one only sees the other.
      expect((await service.thread(OWNER, id)).conversacion.otro.conectado).toBe(false)
      service.heartbeat(PLAYER)
      expect((await service.list(OWNER))[0]?.otro.conectado).toBe(true)
    })

    it('shows disconnected again when the heartbeats stop', async () => {
      const { service } = setup()
      const id = await openChat(service)
      service.heartbeat(OWNER)

      advance(ONLINE_MS / 1000 + 1)

      expect((await service.thread(PLAYER, id)).conversacion.otro.conectado).toBe(false)
    })

    it('shows "typing" to the other side only, in the inbox and in the pulse', async () => {
      const { service } = setup()
      const id = await openChat(service)

      await service.typing(OWNER, id)

      expect((await service.list(PLAYER))[0]?.escribiendo).toBe(true)
      expect((await service.pulse(PLAYER, id)).escribiendo).toBe(true)
      expect((await service.list(OWNER))[0]?.escribiendo).toBe(false)
      expect((await service.pulse(OWNER, id)).escribiendo).toBe(false)
    })

    it('stops showing "typing" a few seconds after the last keystroke', async () => {
      const { service } = setup()
      const id = await openChat(service)
      await service.typing(OWNER, id)

      advance(TYPING_MS / 1000 + 1)

      expect((await service.pulse(PLAYER, id)).escribiendo).toBe(false)
    })

    it('stops showing "typing" as soon as the message is sent', async () => {
      const { service } = setup()
      const id = await openChat(service)
      await service.typing(OWNER, id)

      await service.send(OWNER, id, 'Sí, a las 20')

      expect((await service.pulse(PLAYER, id)).escribiendo).toBe(false)
    })

    it('typing counts as being connected', async () => {
      const { service } = setup()
      const id = await openChat(service)

      await service.typing(OWNER, id)

      expect((await service.pulse(PLAYER, id)).conectado).toBe(true)
    })

    it('the pulse tells the last message time and marks the one who asks as connected', async () => {
      const { service } = setup()
      const id = await openChat(service)
      const last = (await service.thread(PLAYER, id)).mensajes.at(-1)?.createdAt

      const pulse = await service.pulse(OWNER, id)

      expect(pulse.ultimoMensajeAt).toEqual(last)
      // The owner asked, so the player now sees the owner as connected.
      expect((await service.thread(PLAYER, id)).conversacion.otro.conectado).toBe(true)
    })

    it('answers 404 to a stranger for the pulse and for typing', async () => {
      const { service } = setup()
      const id = await openChat(service)

      await expect(service.pulse(STRANGER, id)).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.typing(STRANGER, id)).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('offers', () => {
    const setup = () => {
      const prisma = makePrisma()
      const notifications = makeNotifications()
      const service = new ConversacionesService(
        prisma as never,
        notifications as never,
        new PresenceService()
      )
      prisma.turnos['t-free'] = { canchaId: CANCHA, estado: 'FREE', fechaHoraInicio: TURNO }
      return { prisma, notifications, service }
    }

    it('lets the owner offer a free slot and the player sees it ready to book', async () => {
      const { service } = setup()
      const id = await openChat(service)
      advance(5)

      const sent = await service.send(OWNER, id, 'Tengo el sábado a las 17', 't-free')

      expect(sent.oferta).toMatchObject({
        turnoId: 't-free',
        fechaHoraInicio: TURNO,
        disponible: true,
        cancha: { id: CANCHA, nombre: 'El Mate', precioHora: 20000, montoSena: 5000 },
      })
      const seen = await service.thread(PLAYER, id)
      expect(seen.mensajes.at(-1)?.oferta).toMatchObject({ turnoId: 't-free', disponible: true })
      expect(seen.mensajes[0]?.oferta).toBeNull()
    })

    it('shows the size of the court in the offer', async () => {
      const { service } = setup()
      const id = await openChat(service)
      advance(5)

      const sent = await service.send(OWNER, id, 'Tengo el sábado a las 17', 't-free')

      expect(sent.oferta?.cancha).toMatchObject({ jugadores: 5 })
    })

    it('lets the owner answer an inquiry about a 5 with a slot of their court of 7', async () => {
      const { prisma, service } = setup()
      prisma.turnos['t-siete'] = {
        canchaId: 'cancha-7',
        estado: 'FREE',
        fechaHoraInicio: TURNO,
      }
      const id = await openChat(service)
      advance(5)

      const sent = await service.send(OWNER, id, 'Para 7 tengo este', 't-siete')

      expect(sent.oferta).toMatchObject({
        turnoId: 't-siete',
        disponible: true,
        cancha: { id: 'cancha-7', nombre: 'La Grande', precioHora: 30000, jugadores: 7 },
      })
      // The player gets the court of the offer, not the one of the conversation.
      const seen = (await service.thread(PLAYER, id)).mensajes.at(-1)?.oferta
      expect(seen?.cancha).toMatchObject({ id: 'cancha-7', jugadores: 7 })
    })

    it('keeps each offer with its own court when the owner offers two courts', async () => {
      const { prisma, service } = setup()
      prisma.turnos['t-siete'] = {
        canchaId: 'cancha-7',
        estado: 'FREE',
        fechaHoraInicio: TURNO,
      }
      const id = await openChat(service)
      advance(5)
      await service.send(OWNER, id, 'Para 5', 't-free')
      advance(5)
      await service.send(OWNER, id, 'Para 7', 't-siete')

      const offers = (await service.thread(PLAYER, id)).mensajes.flatMap((m) => m.oferta ?? [])

      expect(offers.map((o) => [o.cancha.id, o.cancha.jugadores])).toEqual([
        [CANCHA, 5],
        ['cancha-7', 7],
      ])
    })

    it('shows the size of the court of the conversation in its header', async () => {
      const { service } = setup()
      const id = await openChat(service)

      expect((await service.thread(PLAYER, id)).conversacion.cancha.jugadores).toBe(5)
    })

    it('does not let the player offer a slot', async () => {
      const { service } = setup()
      const id = await openChat(service)

      await expect(service.send(PLAYER, id, 'Reservame este', 't-free')).rejects.toBeInstanceOf(
        BadRequestException
      )
    })

    it.each([
      ['unknown', 'nope'],
      ['of another court', 'otra'],
      ['already booked', 'tomado'],
      ['in the past', 'pasado'],
    ])('rejects a slot that is %s, and sends nothing', async (_name, turnoId) => {
      const { prisma, notifications, service } = setup()
      prisma.turnos.otra = { canchaId: 'otra-cancha', estado: 'FREE', fechaHoraInicio: TURNO }
      prisma.turnos.tomado = { canchaId: CANCHA, estado: 'RESERVED', fechaHoraInicio: TURNO }
      prisma.turnos.pasado = {
        canchaId: CANCHA,
        estado: 'FREE',
        fechaHoraInicio: new Date('2026-11-14T20:00:00.000Z'),
      }
      const id = await openChat(service)
      advance(5)

      await expect(service.send(OWNER, id, 'Tengo este', turnoId)).rejects.toThrow(
        'Ese horario ya no está disponible'
      )

      expect((await service.thread(PLAYER, id)).mensajes).toHaveLength(1)
      expect(notifications.notifyNewMessage).toHaveBeenCalledTimes(1)
    })

    it('keeps the offer on screen but not bookable once somebody took the slot', async () => {
      const { prisma, service } = setup()
      const id = await openChat(service)
      advance(5)
      await service.send(OWNER, id, 'Tengo el sábado a las 17', 't-free')

      prisma.turnos['t-free'].estado = 'RESERVED'

      const offer = (await service.thread(PLAYER, id)).mensajes.at(-1)?.oferta
      expect(offer).toMatchObject({ turnoId: 't-free', fechaHoraInicio: TURNO, disponible: false })
    })

    it('keeps the offer bookable while another court of that hour is still free', async () => {
      const { prisma, service } = setup()
      // The entry has two courts: a second slot at the same hour.
      prisma.turnos['t-free-2'] = { canchaId: CANCHA, estado: 'FREE', fechaHoraInicio: TURNO }
      const id = await openChat(service)
      advance(5)
      await service.send(OWNER, id, 'Tengo el sábado a las 17', 't-free')

      // A player books the offered court: the other one of the hour is still there.
      prisma.turnos['t-free'].estado = 'RESERVED'
      expect((await service.thread(PLAYER, id)).mensajes.at(-1)?.oferta?.disponible).toBe(true)

      // Now the last court of that hour goes too.
      prisma.turnos['t-free-2'].estado = 'RESERVED'
      expect((await service.thread(PLAYER, id)).mensajes.at(-1)?.oferta?.disponible).toBe(false)
    })

    it('does not mix hours or courts: another hour or another court being free is not enough', async () => {
      const { prisma, service } = setup()
      prisma.turnos['otra-hora'] = {
        canchaId: CANCHA,
        estado: 'FREE',
        fechaHoraInicio: new Date(TURNO.getTime() + 3_600_000),
      }
      prisma.turnos['otro-lugar'] = {
        canchaId: 'cancha-7',
        estado: 'FREE',
        fechaHoraInicio: TURNO,
      }
      const id = await openChat(service)
      advance(5)
      await service.send(OWNER, id, 'Tengo el sábado a las 17', 't-free')

      prisma.turnos['t-free'].estado = 'RESERVED'

      expect((await service.thread(PLAYER, id)).mensajes.at(-1)?.oferta?.disponible).toBe(false)
    })

    describe('entries that share the physical space', () => {
      // The conversation is about the court of 5 (CANCHA); 'cancha-7' stands for the other entry.
      const linkBothWays = (prisma: ReturnType<typeof setup>['prisma']) =>
        prisma.links.push(
          { canchaId: CANCHA, numero: 0, otraCanchaId: 'cancha-7', otraNumero: 0 },
          { canchaId: 'cancha-7', numero: 0, otraCanchaId: CANCHA, otraNumero: 0 }
        )

      it('does not let the owner offer a slot while the linked entry is reserved at that hour', async () => {
        const { prisma, service } = setup()
        linkBothWays(prisma)
        prisma.turnos['t-linked'] = {
          canchaId: 'cancha-7',
          estado: 'RESERVED',
          fechaHoraInicio: TURNO,
        }
        const id = await openChat(service)
        advance(5)

        await expect(service.send(OWNER, id, 'Tengo este', 't-free')).rejects.toThrow(
          'Ese horario ya no está disponible'
        )
        expect((await service.thread(PLAYER, id)).mensajes).toHaveLength(1)
      })

      it('lets the owner offer it when the linked entry is reserved at ANOTHER hour', async () => {
        const { prisma, service } = setup()
        linkBothWays(prisma)
        prisma.turnos['t-linked'] = {
          canchaId: 'cancha-7',
          estado: 'RESERVED',
          fechaHoraInicio: new Date(TURNO.getTime() + 3_600_000),
        }
        const id = await openChat(service)
        advance(5)

        const sent = await service.send(OWNER, id, 'Tengo este', 't-free')

        expect(sent.oferta?.disponible).toBe(true)
      })

      it('an offer already made stops being bookable when the linked entry gets reserved', async () => {
        const { prisma, service } = setup()
        linkBothWays(prisma)
        const id = await openChat(service)
        advance(5)
        await service.send(OWNER, id, 'Tengo el sábado a las 17', 't-free')
        expect((await service.thread(PLAYER, id)).mensajes.at(-1)?.oferta?.disponible).toBe(true)

        // Somebody books the other entry at that hour: the space is taken.
        prisma.turnos['t-linked'] = {
          canchaId: 'cancha-7',
          estado: 'RESERVED',
          fechaHoraInicio: TURNO,
        }

        expect((await service.thread(PLAYER, id)).mensajes.at(-1)?.oferta?.disponible).toBe(false)
      })

      it('and bookable again when that reservation goes away', async () => {
        const { prisma, service } = setup()
        linkBothWays(prisma)
        const id = await openChat(service)
        advance(5)
        await service.send(OWNER, id, 'Tengo el sábado a las 17', 't-free')
        prisma.turnos['t-linked'] = {
          canchaId: 'cancha-7',
          estado: 'RESERVED',
          fechaHoraInicio: TURNO,
        }
        expect((await service.thread(PLAYER, id)).mensajes.at(-1)?.oferta?.disponible).toBe(false)

        // The booking expired or the owner cancelled it: nothing was stored, so it frees itself.
        delete prisma.turnos['t-linked']

        expect((await service.thread(PLAYER, id)).mensajes.at(-1)?.oferta?.disponible).toBe(true)
      })

      it('a booking of the linked entry that still waits for its payment does not block the offer', async () => {
        const { prisma, service } = setup()
        linkBothWays(prisma)
        prisma.turnos['t-linked'] = {
          canchaId: 'cancha-7',
          estado: 'RESERVED',
          pendiente: true,
          fechaHoraInicio: TURNO,
        }
        const id = await openChat(service)
        advance(5)

        const sent = await service.send(OWNER, id, 'Tengo este', 't-free')
        expect(sent.oferta?.disponible).toBe(true)

        // Once that booking is paid, the offer is no longer bookable.
        prisma.turnos['t-linked'].pendiente = false
        expect((await service.thread(PLAYER, id)).mensajes.at(-1)?.oferta?.disponible).toBe(false)
      })

      it('only the court of the entry that is linked is blocked, not its other courts', async () => {
        const { prisma, service } = setup()
        // The court 2 of CANCHA is divided into the courts of cancha-7; the court 1 is a pure one.
        prisma.links.push(
          { canchaId: CANCHA, numero: 2, otraCanchaId: 'cancha-7', otraNumero: 0 },
          { canchaId: 'cancha-7', numero: 0, otraCanchaId: CANCHA, otraNumero: 2 }
        )
        prisma.turnos['t-court-2'] = {
          canchaId: CANCHA,
          numero: 2,
          estado: 'FREE',
          fechaHoraInicio: TURNO,
        }
        prisma.turnos['t-linked'] = {
          canchaId: 'cancha-7',
          estado: 'RESERVED',
          fechaHoraInicio: TURNO,
        }
        const id = await openChat(service)
        advance(5)

        // The pure court 1 (t-free) can be offered; the divided court 2 cannot.
        const sent = await service.send(OWNER, id, 'Tengo la 1', 't-free')
        expect(sent.oferta?.disponible).toBe(true)
        await expect(service.send(OWNER, id, 'Tengo la 2', 't-court-2')).rejects.toThrow(
          'Ese horario ya no está disponible'
        )
      })

      it('without links an offer is not affected by what other entries have reserved', async () => {
        const { prisma, service } = setup()
        prisma.turnos['t-other'] = {
          canchaId: 'cancha-7',
          estado: 'RESERVED',
          fechaHoraInicio: TURNO,
        }
        const id = await openChat(service)
        advance(5)

        const sent = await service.send(OWNER, id, 'Tengo el sábado a las 17', 't-free')

        expect(sent.oferta?.disponible).toBe(true)
      })
    })

    it('keeps the offer, not bookable, when the slot left the schedule and was deleted', async () => {
      const { prisma, service } = setup()
      const id = await openChat(service)
      advance(5)
      await service.send(OWNER, id, 'Tengo el sábado a las 17', 't-free')

      delete prisma.turnos['t-free']

      const offer = (await service.thread(PLAYER, id)).mensajes.at(-1)?.oferta
      expect(offer).toMatchObject({ fechaHoraInicio: TURNO, disponible: false })
    })

    it('stops offering a slot once its time has passed', async () => {
      const { service } = setup()
      const id = await openChat(service)
      advance(5)
      await service.send(OWNER, id, 'Tengo el sábado a las 17', 't-free')

      vi.setSystemTime(new Date(TURNO.getTime() + 60_000))

      const offer = (await service.thread(PLAYER, id)).mensajes.at(-1)?.oferta
      expect(offer?.disponible).toBe(false)
    })
  })

  describe('notifications', () => {
    it('tells the other side about the new message, with the trimmed text', async () => {
      const notifications = makeNotifications()
      const service = makeService({}, notifications)
      const { id } = await service.create(PLAYER, { canchaId: CANCHA })

      await service.send(PLAYER, id, '  ¿Hay turno el sábado?  ')

      expect(notifications.notifyNewMessage).toHaveBeenCalledWith(
        id,
        PLAYER,
        '¿Hay turno el sábado?'
      )
    })

    it('does not notify when the message is rejected', async () => {
      const notifications = makeNotifications()
      const service = makeService({}, notifications)
      const { id } = await service.create(PLAYER, { canchaId: CANCHA })

      await expect(service.send(PLAYER, id, '   ')).rejects.toBeInstanceOf(BadRequestException)

      expect(notifications.notifyNewMessage).not.toHaveBeenCalled()
    })

    it('still sends the message when the notification fails', async () => {
      const notifications = makeNotifications()
      notifications.notifyNewMessage.mockRejectedValue(new Error('push down'))
      const service = makeService({}, notifications)
      const { id } = await service.create(PLAYER, { canchaId: CANCHA })

      await expect(service.send(PLAYER, id, 'Hola')).resolves.toMatchObject({ cuerpo: 'Hola' })
      expect((await service.thread(PLAYER, id)).mensajes).toHaveLength(1)
    })

    it('clears the pending notification when the conversation is read', async () => {
      const notifications = makeNotifications()
      const service = makeService({}, notifications)
      const id = await openChat(service)

      await service.markRead(OWNER, id)

      expect(notifications.markConversationRead).toHaveBeenCalledWith(OWNER, id)
    })
  })

  describe('sending', () => {
    it('rejects an empty message and one over 1000 characters', async () => {
      const service = makeService()
      const { id } = await service.create(PLAYER, { canchaId: CANCHA })
      await expect(service.send(PLAYER, id, '   ')).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.send(PLAYER, id, 'a'.repeat(1001))).rejects.toBeInstanceOf(
        BadRequestException
      )
      await expect(service.send(PLAYER, id, 'a'.repeat(1000))).resolves.toMatchObject({
        propio: true,
      })
    })

    it('answers 429 after 20 messages in a minute and recovers afterwards', async () => {
      const service = makeService()
      const { id } = await service.create(PLAYER, { canchaId: CANCHA })
      for (let i = 0; i < 20; i++) await service.send(PLAYER, id, `m${i}`)

      const blocked = await service.send(PLAYER, id, 'uno más').catch((e: unknown) => e)
      expect(blocked).toBeInstanceOf(HttpException)
      expect((blocked as HttpException).getStatus()).toBe(429)

      advance(61)
      await expect(service.send(PLAYER, id, 'ya puedo')).resolves.toMatchObject({
        cuerpo: 'ya puedo',
      })
    })

    it('trims the text before saving it', async () => {
      const service = makeService()
      const { id } = await service.create(PLAYER, { canchaId: CANCHA })
      const sent = await service.send(PLAYER, id, '  hola  ')
      expect(sent.cuerpo).toBe('hola')
    })
  })

  describe('thread paging', () => {
    it('returns the latest page in order and tells there is more', async () => {
      const service = makeService()
      const { id } = await service.create(PLAYER, { canchaId: CANCHA })
      for (let i = 1; i <= 55; i++) {
        advance(10)
        await service.send(i % 2 === 0 ? OWNER : PLAYER, id, `m${i}`)
      }
      const page = await service.thread(PLAYER, id)
      expect(page.mensajes).toHaveLength(50)
      expect(page.hayMas).toBe(true)
      expect(page.mensajes[0]?.cuerpo).toBe('m6')
      expect(page.mensajes.at(-1)?.cuerpo).toBe('m55')

      const older = await service.thread(PLAYER, id, page.mensajes[0]?.createdAt)
      expect(older.mensajes.map((m) => m.cuerpo)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5'])
      expect(older.hayMas).toBe(false)
    })
  })
})
