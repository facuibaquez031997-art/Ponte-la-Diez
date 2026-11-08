import 'reflect-metadata'
import { vi } from 'vitest'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { ConvocatoriasService } from './convocatorias.service.js'

const future = new Date(Date.now() + 86_400_000)

const makePrisma = () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    convocatoria: {
      create: vi.fn(async ({ data }: { data: object }) => ({
        id: 'c1',
        estado: 'ABIERTA',
        ...data,
      })),
      findMany: vi.fn(async (_args?: object) => []),
      findUnique: vi.fn(),
      update: vi.fn(async ({ data }: { data: object }) => ({ id: 'c1', ...data })),
    },
    respuestaConvocatoria: {
      findUnique: vi.fn(async (_args?: object) => null as unknown),
      findMany: vi.fn(async (_args?: object) => [] as unknown[]),
      count: vi.fn(async (_args?: object) => 0),
      create: vi.fn(async ({ data }: { data: object }) => ({ id: 'r1', ...data })),
    },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (run: (tx: unknown) => unknown) => run(prisma))
  return prisma
}

const makeService = (prisma = makePrisma()) => {
  const notifications = {
    notifyNewConvocatoria: vi.fn(async (_id: string) => undefined),
    clearForConvocatoria: vi.fn(async (_id: string) => undefined),
    notifyResponse: vi.fn(async (_id: string, _userId: string, _estado: string) => undefined),
    notifyCancelled: vi.fn(async (_id: string) => undefined),
  }
  return {
    prisma,
    notifications,
    service: new ConvocatoriasService(prisma as never, notifications as never),
  }
}

const baseDto = {
  fechaHora: future,
  posicion: 'ARQUERO' as const,
  jugadoresFaltantes: 1,
  mensaje: 'Traé botines',
}

describe('ConvocatoriasService.create', () => {
  it('stores the position, message and BARRIO scope for the creator', async () => {
    const { prisma, service } = makeService()
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', barrioPontevedra: 'Barrio El Sol' })

    await service.create('u1', { ...baseDto, canchaId: 'ch1' })

    expect(prisma.convocatoria.create).toHaveBeenCalledWith({
      data: {
        creadorId: 'u1',
        canchaId: 'ch1',
        fechaHora: future,
        posicion: 'ARQUERO',
        jugadoresFaltantes: 1,
        mensaje: 'Traé botines',
        alcance: 'BARRIO',
      },
    })
  })

  it('stores the free-text court name', async () => {
    const { prisma, service } = makeService()
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', barrioPontevedra: 'Barrio El Sol' })

    await service.create('u1', { ...baseDto, canchaNombre: 'Cancha de Don Pepe' })

    expect(prisma.convocatoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ canchaNombre: 'Cancha de Don Pepe' }),
    })
  })

  it('notifies the neighborhood about the created call', async () => {
    const { prisma, notifications, service } = makeService()
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', barrioPontevedra: 'Barrio El Sol' })

    await service.create('u1', baseDto)

    expect(notifications.notifyNewConvocatoria).toHaveBeenCalledWith('c1')
  })

  it('still creates the call when notifying fails', async () => {
    const { prisma, notifications, service } = makeService()
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', barrioPontevedra: 'Barrio El Sol' })
    notifications.notifyNewConvocatoria.mockRejectedValue(new Error('push down'))

    await expect(service.create('u1', baseDto)).resolves.toMatchObject({ id: 'c1' })
  })

  it('does not notify when the creator has no neighborhood', async () => {
    const { prisma, notifications, service } = makeService()
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', barrioPontevedra: null })

    await expect(service.create('u1', baseDto)).rejects.toBeInstanceOf(BadRequestException)
    expect(notifications.notifyNewConvocatoria).not.toHaveBeenCalled()
  })

  it('rejects a creator without a neighborhood in the profile', async () => {
    const { prisma, service } = makeService()
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', barrioPontevedra: null })

    await expect(service.create('u1', baseDto)).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.convocatoria.create).not.toHaveBeenCalled()
  })

  it('rejects a date in the past', async () => {
    const { prisma, service } = makeService()
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', barrioPontevedra: 'Barrio El Sol' })

    await expect(
      service.create('u1', { ...baseDto, fechaHora: new Date(Date.now() - 1000) })
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})

describe('ConvocatoriasService.listForMyBarrio', () => {
  it('returns open, upcoming calls from creators of the same neighborhood', async () => {
    const { prisma, service } = makeService()
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', barrioPontevedra: 'Barrio El Sol' })

    await service.listForMyBarrio('u1')

    const args = prisma.convocatoria.findMany.mock.calls[0]?.[0] as unknown as {
      where: {
        estado: string
        alcance: string
        creador: { barrioPontevedra: string }
        fechaHora: { gte: Date }
      }
    }
    expect(args.where.estado).toBe('ABIERTA')
    expect(args.where.alcance).toBe('BARRIO')
    expect(args.where.creador.barrioPontevedra).toBe('Barrio El Sol')
    expect(args.where.fechaHora.gte).toBeInstanceOf(Date)
  })

  it('includes only the answer of the requesting player', async () => {
    const { prisma, service } = makeService()
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', barrioPontevedra: 'Barrio El Sol' })

    await service.listForMyBarrio('u1')

    const args = prisma.convocatoria.findMany.mock.calls[0]?.[0] as unknown as {
      include: { respuestas: { where: { userId: string }; select: { estado: boolean } } }
    }
    expect(args.include.respuestas.where).toEqual({ userId: 'u1' })
    expect(args.include.respuestas.select).toEqual({ estado: true })
  })

  it('includes only the creator name and photo, never other user fields', async () => {
    const { prisma, service } = makeService()
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', barrioPontevedra: 'Barrio El Sol' })

    await service.listForMyBarrio('u1')

    const args = prisma.convocatoria.findMany.mock.calls[0]?.[0] as unknown as {
      include: { creador: { select: Record<string, boolean> } }
    }
    expect(args.include.creador.select).toEqual({ nombre: true, avatarUrl: true })
  })

  it('returns an empty list when the player has no neighborhood', async () => {
    const { prisma, service } = makeService()
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', barrioPontevedra: null })

    await expect(service.listForMyBarrio('u1')).resolves.toEqual([])
    expect(prisma.convocatoria.findMany).not.toHaveBeenCalled()
  })
})

describe('ConvocatoriasService.close', () => {
  it('closes a call owned by the user', async () => {
    const { prisma, service } = makeService()
    prisma.convocatoria.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'u1' })

    await service.close('u1', 'c1')

    expect(prisma.convocatoria.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { estado: 'CERRADA' },
    })
  })

  it('removes the inbox notifications of the closed call', async () => {
    const { prisma, notifications, service } = makeService()
    prisma.convocatoria.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'u1' })

    await service.close('u1', 'c1')

    expect(notifications.clearForConvocatoria).toHaveBeenCalledWith('c1')
  })

  it('still closes the call when removing the notifications fails', async () => {
    const { prisma, notifications, service } = makeService()
    prisma.convocatoria.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'u1' })
    notifications.clearForConvocatoria.mockRejectedValue(new Error('db down'))

    await expect(service.close('u1', 'c1')).resolves.toMatchObject({ estado: 'CERRADA' })
  })

  it('forbids closing a call owned by someone else', async () => {
    const { prisma, notifications, service } = makeService()
    prisma.convocatoria.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'other' })

    await expect(service.close('u1', 'c1')).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.convocatoria.update).not.toHaveBeenCalled()
    expect(notifications.clearForConvocatoria).not.toHaveBeenCalled()
  })

  it('returns not found for an unknown call', async () => {
    const { prisma, service } = makeService()
    prisma.convocatoria.findUnique.mockResolvedValue(null)

    await expect(service.close('u1', 'nope')).rejects.toBeInstanceOf(NotFoundException)
  })
})

const openCall = {
  id: 'c1',
  creadorId: 'u1',
  estado: 'ABIERTA',
  fechaHora: future,
  jugadoresFaltantes: 2,
  creador: { barrioPontevedra: 'Barrio El Sol' },
}

const setupRespond = (overrides: Partial<typeof openCall> = {}) => {
  const ctx = makeService()
  ctx.prisma.convocatoria.findUnique.mockResolvedValue({ ...openCall, ...overrides })
  ctx.prisma.user.findUnique.mockResolvedValue({ id: 'u2', barrioPontevedra: 'Barrio El Sol' })
  return ctx
}

describe('ConvocatoriasService.respond', () => {
  it('stores an accepted answer and tells the creator', async () => {
    const { prisma, notifications, service } = setupRespond()

    await service.respond('u2', 'c1', 'ACEPTADA')

    expect(prisma.respuestaConvocatoria.create).toHaveBeenCalledWith({
      data: { convocatoriaId: 'c1', userId: 'u2', estado: 'ACEPTADA' },
    })
    expect(notifications.notifyResponse).toHaveBeenCalledWith('c1', 'u2', 'ACEPTADA')
  })

  it('stores a declined answer and tells the creator', async () => {
    const { prisma, notifications, service } = setupRespond()

    await service.respond('u2', 'c1', 'DECLINADA')

    expect(prisma.respuestaConvocatoria.create).toHaveBeenCalledWith({
      data: { convocatoriaId: 'c1', userId: 'u2', estado: 'DECLINADA' },
    })
    expect(notifications.notifyResponse).toHaveBeenCalledWith('c1', 'u2', 'DECLINADA')
  })

  it('does not fail the answer when the notification fails', async () => {
    const { notifications, service } = setupRespond()
    notifications.notifyResponse.mockRejectedValue(new Error('push down'))

    await expect(service.respond('u2', 'c1', 'ACEPTADA')).resolves.toMatchObject({ id: 'r1' })
  })

  it('returns not found for an unknown call', async () => {
    const { prisma, service } = setupRespond()
    prisma.convocatoria.findUnique.mockResolvedValue(null)

    await expect(service.respond('u2', 'nope', 'ACEPTADA')).rejects.toBeInstanceOf(
      NotFoundException
    )
  })

  it('forbids the creator from answering their own call', async () => {
    const { prisma, service } = setupRespond()

    await expect(service.respond('u1', 'c1', 'ACEPTADA')).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.respuestaConvocatoria.create).not.toHaveBeenCalled()
  })

  it('forbids a player from another neighborhood', async () => {
    const { prisma, service } = setupRespond()
    prisma.user.findUnique.mockResolvedValue({ id: 'u2', barrioPontevedra: 'Barrio El Alto' })

    await expect(service.respond('u2', 'c1', 'ACEPTADA')).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.respuestaConvocatoria.create).not.toHaveBeenCalled()
  })

  it.each(['CERRADA', 'CANCELADA'])('refuses a %s call', async (estado) => {
    const { prisma, service } = setupRespond({ estado })

    await expect(service.respond('u2', 'c1', 'ACEPTADA')).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.respuestaConvocatoria.create).not.toHaveBeenCalled()
  })

  it('refuses a call whose date already passed', async () => {
    const { service } = setupRespond({ fechaHora: new Date(Date.now() - 1000) })

    await expect(service.respond('u2', 'c1', 'ACEPTADA')).rejects.toBeInstanceOf(ConflictException)
  })

  it('refuses a second answer from the same player', async () => {
    const { prisma, service } = setupRespond()
    prisma.respuestaConvocatoria.findUnique.mockResolvedValue({ id: 'r0', estado: 'DECLINADA' })

    await expect(service.respond('u2', 'c1', 'ACEPTADA')).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.respuestaConvocatoria.create).not.toHaveBeenCalled()
  })

  it('refuses to accept when the list is already full', async () => {
    const { prisma, notifications, service } = setupRespond()
    prisma.respuestaConvocatoria.count.mockResolvedValue(2)

    await expect(service.respond('u2', 'c1', 'ACEPTADA')).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.respuestaConvocatoria.create).not.toHaveBeenCalled()
    expect(notifications.notifyResponse).not.toHaveBeenCalled()
  })

  it('still lets a player decline when the list is full', async () => {
    const { prisma, service } = setupRespond()
    prisma.respuestaConvocatoria.count.mockResolvedValue(2)

    await service.respond('u2', 'c1', 'DECLINADA')

    expect(prisma.respuestaConvocatoria.create).toHaveBeenCalled()
  })

  it('maps a concurrent duplicate answer to a conflict', async () => {
    const { prisma, service } = setupRespond()
    prisma.respuestaConvocatoria.create.mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002' })
    )

    await expect(service.respond('u2', 'c1', 'ACEPTADA')).rejects.toBeInstanceOf(ConflictException)
  })
})

describe('ConvocatoriasService.getTeam', () => {
  const accepted = [
    { userId: 'u2', user: { nombre: 'Ana', avatarUrl: null } },
    { userId: 'u3', user: { nombre: 'Beto', avatarUrl: 'http://img/b.jpg' } },
  ]

  const setupTeam = () => {
    const ctx = makeService()
    ctx.prisma.convocatoria.findUnique.mockResolvedValue(openCall)
    ctx.prisma.respuestaConvocatoria.findMany.mockResolvedValue(accepted)
    return ctx
  }

  it('shows the creator the slots and the accepted players', async () => {
    const { service } = setupTeam()

    await expect(service.getTeam('u1', 'c1')).resolves.toEqual({
      jugadoresFaltantes: 2,
      aceptados: [
        { userId: 'u2', nombre: 'Ana', avatarUrl: null },
        { userId: 'u3', nombre: 'Beto', avatarUrl: 'http://img/b.jpg' },
      ],
    })
  })

  it('shows an accepted player the same list', async () => {
    const { service } = setupTeam()

    await expect(service.getTeam('u3', 'c1')).resolves.toMatchObject({ jugadoresFaltantes: 2 })
  })

  it('hides the list from a player who did not accept', async () => {
    const { service } = setupTeam()

    await expect(service.getTeam('u9', 'c1')).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('returns not found for an unknown call', async () => {
    const { prisma, service } = setupTeam()
    prisma.convocatoria.findUnique.mockResolvedValue(null)

    await expect(service.getTeam('u1', 'nope')).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('ConvocatoriasService.cancel', () => {
  it('cancels an open call owned by the user and notifies the players', async () => {
    const { prisma, notifications, service } = makeService()
    prisma.convocatoria.findUnique.mockResolvedValue(openCall)

    await service.cancel('u1', 'c1')

    expect(prisma.convocatoria.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { estado: 'CANCELADA' },
    })
    expect(notifications.notifyCancelled).toHaveBeenCalledWith('c1')
  })

  it('still cancels when the notification fails', async () => {
    const { prisma, notifications, service } = makeService()
    prisma.convocatoria.findUnique.mockResolvedValue(openCall)
    notifications.notifyCancelled.mockRejectedValue(new Error('push down'))

    await expect(service.cancel('u1', 'c1')).resolves.toMatchObject({ estado: 'CANCELADA' })
  })

  it('forbids cancelling a call owned by someone else', async () => {
    const { prisma, notifications, service } = makeService()
    prisma.convocatoria.findUnique.mockResolvedValue({ ...openCall, creadorId: 'other' })

    await expect(service.cancel('u1', 'c1')).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.convocatoria.update).not.toHaveBeenCalled()
    expect(notifications.notifyCancelled).not.toHaveBeenCalled()
  })

  it('refuses to cancel a call that is not open', async () => {
    const { prisma, service } = makeService()
    prisma.convocatoria.findUnique.mockResolvedValue({ ...openCall, estado: 'CERRADA' })

    await expect(service.cancel('u1', 'c1')).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.convocatoria.update).not.toHaveBeenCalled()
  })

  it('returns not found for an unknown call', async () => {
    const { prisma, service } = makeService()
    prisma.convocatoria.findUnique.mockResolvedValue(null)

    await expect(service.cancel('u1', 'nope')).rejects.toBeInstanceOf(NotFoundException)
  })
})
