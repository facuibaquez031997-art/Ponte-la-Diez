import 'reflect-metadata'
import { vi } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { NotificationsService } from './notifications.service.js'

const convocatoria = {
  id: 'c1',
  creadorId: 'creator',
  posicion: 'ARQUERO',
  mensaje: 'Traé botines',
  fechaHora: new Date('2026-11-10T21:00:00.000Z'),
  creador: { nombre: 'Facu', barrioPontevedra: 'Barrio El Sol' },
  cancha: { nombre: 'Cancha La 10' },
}

const sub = (endpoint: string) => ({ endpoint, keysP256: 'p', keysAuth: 'a' })

const makeDeps = () => {
  const prisma = {
    convocatoria: { findUnique: vi.fn(async (_args?: object) => convocatoria as unknown) },
    user: {
      findUnique: vi.fn(async (_args?: object) => ({ id: 'u2', nombre: 'Ana' }) as unknown),
      findMany: vi.fn(
        async (_args?: object) =>
          [
            { id: 'u1', subscriptions: [sub('e1'), sub('e2')] },
            { id: 'u2', subscriptions: [] },
          ] as unknown
      ),
    },
    notificacion: {
      createMany: vi.fn(async (_args?: object) => ({ count: 2 })),
      deleteMany: vi.fn(async (_args?: object) => ({ count: 2 })),
      findMany: vi.fn(async (_args?: object) => []),
      count: vi.fn(async (_args?: object) => 3),
      findUnique: vi.fn(async (_args?: object) => null as unknown),
      update: vi.fn(async (_args?: object) => ({})),
      updateMany: vi.fn(async (_args?: object) => ({ count: 2 })),
    },
    pushSubscription: {
      upsert: vi.fn(async (_args?: object) => ({})),
      deleteMany: vi.fn(async (_args?: object) => ({ count: 1 })),
    },
  }
  const push = { send: vi.fn(async (): Promise<'sent' | 'gone' | 'failed'> => 'sent') }
  return { prisma, push, service: new NotificationsService(prisma as never, push as never) }
}

describe('NotificationsService.clearForConvocatoria', () => {
  it('deletes the inbox entries of every user for that call', async () => {
    const { prisma, service } = makeDeps()

    await service.clearForConvocatoria('c1')

    expect(prisma.notificacion.deleteMany).toHaveBeenCalledWith({
      where: { convocatoriaId: 'c1' },
    })
  })
})

type Created = {
  data: Array<{ userId: string; convocatoriaId: string; titulo: string; cuerpo: string }>
}

describe('NotificationsService.notifyResponse', () => {
  const withCreator = (subscriptions = [sub('e1')]) => ({
    ...convocatoria,
    creador: { id: 'creator', nombre: 'Facu', barrioPontevedra: 'Barrio El Sol', subscriptions },
  })

  it('tells only the creator that a player accepted', async () => {
    const { prisma, service } = makeDeps()
    prisma.convocatoria.findUnique.mockResolvedValue(withCreator())

    await service.notifyResponse('c1', 'u2', 'ACEPTADA')

    const args = prisma.notificacion.createMany.mock.calls[0]?.[0] as unknown as Created
    expect(args.data).toHaveLength(1)
    expect(args.data[0]?.userId).toBe('creator')
    expect(args.data[0]?.convocatoriaId).toBe('c1')
    expect(args.data[0]?.titulo).toBe('Ana aceptó')
  })

  it('tells the creator that a player declined', async () => {
    const { prisma, service } = makeDeps()
    prisma.convocatoria.findUnique.mockResolvedValue(withCreator())

    await service.notifyResponse('c1', 'u2', 'DECLINADA')

    const args = prisma.notificacion.createMany.mock.calls[0]?.[0] as unknown as Created
    expect(args.data[0]?.titulo).toBe('Ana no aceptó')
  })

  it('sends a push to every subscription of the creator', async () => {
    const { prisma, push, service } = makeDeps()
    prisma.convocatoria.findUnique.mockResolvedValue(withCreator([sub('e1'), sub('e2')]))

    await service.notifyResponse('c1', 'u2', 'ACEPTADA')

    expect(push.send).toHaveBeenCalledTimes(2)
  })

  it('does nothing when the call or the player no longer exists', async () => {
    const { prisma, service } = makeDeps()
    prisma.convocatoria.findUnique.mockResolvedValue(null)

    await service.notifyResponse('c1', 'u2', 'ACEPTADA')

    expect(prisma.notificacion.createMany).not.toHaveBeenCalled()
  })
})

describe('NotificationsService.notifyCancelled', () => {
  const withAccepted = (users: Array<{ id: string; subscriptions: object[] }>) => ({
    ...convocatoria,
    respuestas: users.map((user) => ({ user })),
  })

  it('removes the old entries and notifies the accepted players', async () => {
    const { prisma, service } = makeDeps()
    prisma.convocatoria.findUnique.mockResolvedValue(
      withAccepted([
        { id: 'u2', subscriptions: [sub('e1')] },
        { id: 'u3', subscriptions: [] },
      ])
    )

    await service.notifyCancelled('c1')

    expect(prisma.notificacion.deleteMany).toHaveBeenCalledWith({
      where: { convocatoriaId: 'c1' },
    })
    const args = prisma.notificacion.createMany.mock.calls[0]?.[0] as unknown as Created
    expect(args.data.map((n) => n.userId)).toEqual(['u2', 'u3'])
    expect(args.data[0]?.titulo).toBe('Partido cancelado')
    expect(args.data[0]?.cuerpo).toContain('Facu')
    const clearedAt = prisma.notificacion.deleteMany.mock.invocationCallOrder[0] ?? 0
    const createdAt = prisma.notificacion.createMany.mock.invocationCallOrder[0] ?? 0
    expect(clearedAt).toBeLessThan(createdAt)
  })

  it('sends a push to the subscriptions of the accepted players', async () => {
    const { prisma, push, service } = makeDeps()
    prisma.convocatoria.findUnique.mockResolvedValue(
      withAccepted([{ id: 'u2', subscriptions: [sub('e1'), sub('e2')] }])
    )

    await service.notifyCancelled('c1')

    expect(push.send).toHaveBeenCalledTimes(2)
  })

  it('still removes the old entries when nobody had accepted', async () => {
    const { prisma, service } = makeDeps()
    prisma.convocatoria.findUnique.mockResolvedValue(withAccepted([]))

    await service.notifyCancelled('c1')

    expect(prisma.notificacion.deleteMany).toHaveBeenCalled()
    expect(prisma.notificacion.createMany).not.toHaveBeenCalled()
  })
})

describe('NotificationsService.notifyNewConvocatoria', () => {
  it('looks for players of the creator barrio, excluding the creator', async () => {
    const { prisma, service } = makeDeps()

    await service.notifyNewConvocatoria('c1')

    const args = prisma.user.findMany.mock.calls[0]?.[0] as unknown as {
      where: { barrioPontevedra: string; id: { not: string } }
    }
    expect(args.where.barrioPontevedra).toBe('Barrio El Sol')
    expect(args.where.id).toEqual({ not: 'creator' })
  })

  it('stores one inbox entry per recipient, even without push subscriptions', async () => {
    const { prisma, service } = makeDeps()

    await service.notifyNewConvocatoria('c1')

    const args = prisma.notificacion.createMany.mock.calls[0]?.[0] as unknown as {
      data: Array<{ userId: string; convocatoriaId: string; titulo: string; cuerpo: string }>
    }
    expect(args.data.map((n) => n.userId)).toEqual(['u1', 'u2'])
    expect(args.data[0]?.convocatoriaId).toBe('c1')
    expect(args.data[0]?.titulo).toBe('Falta un arquero')
    expect(args.data[0]?.cuerpo).toContain('Facu')
    expect(args.data[0]?.cuerpo).toContain('Traé botines')
  })

  it('asks for "un jugador" when any position is welcome', async () => {
    const { prisma, service } = makeDeps()
    prisma.convocatoria.findUnique.mockResolvedValue({ ...convocatoria, posicion: 'TODOS' })

    await service.notifyNewConvocatoria('c1')

    const args = prisma.notificacion.createMany.mock.calls[0]?.[0] as unknown as {
      data: Array<{ titulo: string }>
    }
    expect(args.data[0]?.titulo).toBe('Falta un jugador')
  })

  it('names the linked court in the body', async () => {
    const { prisma, service } = makeDeps()

    await service.notifyNewConvocatoria('c1')

    const args = prisma.notificacion.createMany.mock.calls[0]?.[0] as unknown as {
      data: Array<{ cuerpo: string }>
    }
    expect(args.data[0]?.cuerpo).toContain('Cancha La 10')
  })

  it('names the free-text court when there is no linked court', async () => {
    const { prisma, service } = makeDeps()
    prisma.convocatoria.findUnique.mockResolvedValue({
      ...convocatoria,
      cancha: null,
      canchaNombre: 'Cancha de Don Pepe',
    })

    await service.notifyNewConvocatoria('c1')

    const args = prisma.notificacion.createMany.mock.calls[0]?.[0] as unknown as {
      data: Array<{ cuerpo: string }>
    }
    expect(args.data[0]?.cuerpo).toContain('Cancha de Don Pepe')
  })

  it('sends a push to every subscription of every recipient', async () => {
    const { push, service } = makeDeps()

    await service.notifyNewConvocatoria('c1')

    expect(push.send).toHaveBeenCalledTimes(2)
  })

  it('removes subscriptions the push service reports as gone', async () => {
    const { prisma, push, service } = makeDeps()
    push.send.mockResolvedValueOnce('gone').mockResolvedValueOnce('sent')

    await service.notifyNewConvocatoria('c1')

    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: { in: ['e1'] } },
    })
  })

  it('keeps the inbox entries when a push fails', async () => {
    const { prisma, push, service } = makeDeps()
    push.send.mockResolvedValue('failed')

    await expect(service.notifyNewConvocatoria('c1')).resolves.toBeUndefined()
    expect(prisma.notificacion.createMany).toHaveBeenCalledTimes(1)
    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled()
  })

  it('does nothing when the creator has no neighborhood', async () => {
    const { prisma, push, service } = makeDeps()
    prisma.convocatoria.findUnique.mockResolvedValue({
      ...convocatoria,
      creador: { nombre: 'Facu', barrioPontevedra: null },
    })

    await service.notifyNewConvocatoria('c1')

    expect(prisma.user.findMany).not.toHaveBeenCalled()
    expect(push.send).not.toHaveBeenCalled()
  })
})

describe('NotificationsService subscriptions', () => {
  it('upserts by endpoint so a device moves to the latest user', async () => {
    const { prisma, service } = makeDeps()

    await service.subscribe('u1', { endpoint: 'e1', keys: { p256dh: 'p', auth: 'a' } })

    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: 'e1' },
      create: { userId: 'u1', endpoint: 'e1', keysP256: 'p', keysAuth: 'a' },
      update: { userId: 'u1', keysP256: 'p', keysAuth: 'a' },
    })
  })

  it('only removes subscriptions owned by the user', async () => {
    const { prisma, service } = makeDeps()

    await service.unsubscribe('u1', 'e1')

    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', endpoint: 'e1' },
    })
  })
})

describe('NotificationsService inbox', () => {
  it('lists the newest notifications of the user first', async () => {
    const { prisma, service } = makeDeps()

    await service.list('u1')

    expect(prisma.notificacion.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  })

  it('counts only unread notifications', async () => {
    const { prisma, service } = makeDeps()

    await expect(service.unreadCount('u1')).resolves.toEqual({ count: 3 })
    expect(prisma.notificacion.count).toHaveBeenCalledWith({
      where: { userId: 'u1', leida: false },
    })
  })

  it('marks a notification as read only for its owner', async () => {
    const { prisma, service } = makeDeps()
    prisma.notificacion.findUnique.mockResolvedValue({ id: 'n1', userId: 'someone-else' })

    await expect(service.markRead('u1', 'n1')).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.notificacion.update).not.toHaveBeenCalled()
  })

  it('marks the notification as read', async () => {
    const { prisma, service } = makeDeps()
    prisma.notificacion.findUnique.mockResolvedValue({ id: 'n1', userId: 'u1' })

    await service.markRead('u1', 'n1')

    expect(prisma.notificacion.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { leida: true },
    })
  })

  it('marks every unread notification of the user as read', async () => {
    const { prisma, service } = makeDeps()

    await service.markAllRead('u1')

    expect(prisma.notificacion.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', leida: false },
      data: { leida: true },
    })
  })
})
