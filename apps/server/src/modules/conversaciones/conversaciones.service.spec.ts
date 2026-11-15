import 'reflect-metadata'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common'
import { ConversacionesService } from './conversaciones.service.js'

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
}
interface Reserva {
  estado: string
  montoTotal: number
  pago: { estadoPago: string; monto: number } | null
}

const advance = (seconds: number) => vi.setSystemTime(new Date(Date.now() + seconds * 1000))

/** In-memory stand-in for the Prisma calls the service makes. */
const makePrisma = (reservas: Record<string, Reserva> = {}) => {
  const conversaciones: Row[] = []
  const mensajes: Msg[] = []
  let seq = 0

  const withRelations = (row: Row) => ({
    ...row,
    cancha: {
      id: row.canchaId,
      nombre: 'El Mate',
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
    },
    reserva: {
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
        async (args: { data: { conversacionId: string; autorId: string; cuerpo: string } }) => {
          const msg: Msg = { id: `msg-${++seq}`, createdAt: new Date(), ...args.data }
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
  return prisma
}

const makeNotifications = () => ({
  notifyNewMessage: vi.fn(async (_id: string, _autorId: string, _texto: string) => undefined),
  markConversationRead: vi.fn(async (_userId: string, _id: string) => undefined),
})

const makeService = (
  reservas: Record<string, Reserva> = {},
  notifications: ReturnType<typeof makeNotifications> = makeNotifications()
) => new ConversacionesService(makePrisma(reservas) as never, notifications as never)

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
      const service = new ConversacionesService(prisma as never, makeNotifications() as never)
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
    it('hides the chat from the inbox of the player who deleted it, not from the owner', async () => {
      const service = makeService()
      const id = await openChat(service)
      advance(5)
      await service.remove(PLAYER, id)

      expect(await service.list(PLAYER)).toEqual([])
      expect(await service.list(OWNER)).toHaveLength(1)
      expect((await service.thread(OWNER, id)).mensajes).toHaveLength(1)
    })

    it('brings the player chat back with only the messages after the deletion', async () => {
      const service = makeService()
      const id = await openChat(service, 'Antes de borrar')
      advance(5)
      await service.remove(PLAYER, id)
      advance(5)
      await service.send(OWNER, id, 'Después de borrar')

      const [view] = await service.list(PLAYER)
      expect(view?.noLeidos).toBe(1)
      const player = await service.thread(PLAYER, id)
      expect(player.mensajes.map((m) => m.cuerpo)).toEqual(['Después de borrar'])
      const owner = await service.thread(OWNER, id)
      expect(owner.mensajes.map((m) => m.cuerpo)).toEqual(['Antes de borrar', 'Después de borrar'])
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
