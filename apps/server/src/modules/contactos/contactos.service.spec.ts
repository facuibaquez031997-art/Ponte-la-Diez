import 'reflect-metadata'
import { vi } from 'vitest'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { ContactosService } from './contactos.service.js'

type Row = { id: string; estado: string; solicitanteId: string; destinatarioId: string }

const makeService = () => {
  const prisma = {
    user: { findUnique: vi.fn(async (_args?: object) => ({ id: 'u2' }) as unknown) },
    contacto: {
      findUnique: vi.fn(async (_args?: object) => null as unknown),
      findMany: vi.fn(async (_args?: object) => [] as unknown[]),
      create: vi.fn(async ({ data }: { data: object }) => ({ id: 'k1', ...data })),
      update: vi.fn(async ({ data }: { data: object }) => ({ id: 'k1', ...data })),
      delete: vi.fn(async (_args?: object) => ({})),
    },
  }
  const notifications = {
    notifyContactRequest: vi.fn(async (_id: string) => undefined),
    notifyContactAccepted: vi.fn(async (_id: string) => undefined),
  }
  const service = new ContactosService(prisma as never, notifications as never)

  // The service looks up the request sent by the player and the one sent by the other side.
  const setRows = (rows: { sent?: Row; received?: Row }) => {
    prisma.contacto.findUnique.mockImplementation(async (args?: object) => {
      const key = (args as { where: { solicitanteId_destinatarioId: { solicitanteId: string } } })
        .where.solicitanteId_destinatarioId
      return (key.solicitanteId === 'u1' ? rows.sent : rows.received) ?? null
    })
  }

  return { prisma, notifications, service, setRows }
}

describe('ContactosService.request', () => {
  it('creates a pending request and notifies the other player', async () => {
    const { prisma, notifications, service } = makeService()

    await service.request('u1', 'ana@example.com')

    expect(prisma.contacto.create).toHaveBeenCalledWith({
      data: { solicitanteId: 'u1', destinatarioId: 'u2' },
    })
    expect(notifications.notifyContactRequest).toHaveBeenCalledWith('k1')
  })

  it('looks the email up trimmed and lower-cased', async () => {
    const { prisma, service } = makeService()

    await service.request('u1', '  Ana@Example.COM ')

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'ana@example.com' } })
  })

  it('answers the same way for an unknown email, without creating anything', async () => {
    const { prisma, notifications, service } = makeService()
    prisma.user.findUnique.mockResolvedValue(null)

    await expect(service.request('u1', 'nadie@example.com')).resolves.toBeUndefined()
    expect(prisma.contacto.create).not.toHaveBeenCalled()
    expect(notifications.notifyContactRequest).not.toHaveBeenCalled()
  })

  it('ignores a request to oneself', async () => {
    const { prisma, service } = makeService()
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' })

    await expect(service.request('u1', 'yo@example.com')).resolves.toBeUndefined()
    expect(prisma.contacto.create).not.toHaveBeenCalled()
  })

  it('ignores a request that is already pending or accepted', async () => {
    const { prisma, notifications, service, setRows } = makeService()
    setRows({ sent: { id: 'k0', estado: 'PENDIENTE', solicitanteId: 'u1', destinatarioId: 'u2' } })

    await service.request('u1', 'ana@example.com')

    expect(prisma.contacto.create).not.toHaveBeenCalled()
    expect(notifications.notifyContactRequest).not.toHaveBeenCalled()
  })

  it('ignores a request when they are already contacts', async () => {
    const { prisma, service, setRows } = makeService()
    setRows({
      received: { id: 'k0', estado: 'ACEPTADO', solicitanteId: 'u2', destinatarioId: 'u1' },
    })

    await service.request('u1', 'ana@example.com')

    expect(prisma.contacto.create).not.toHaveBeenCalled()
    expect(prisma.contacto.update).not.toHaveBeenCalled()
  })

  it('accepts the other side request instead of creating a crossed one', async () => {
    const { prisma, notifications, service, setRows } = makeService()
    setRows({
      received: { id: 'k0', estado: 'PENDIENTE', solicitanteId: 'u2', destinatarioId: 'u1' },
    })

    await service.request('u1', 'ana@example.com')

    expect(prisma.contacto.update).toHaveBeenCalledWith({
      where: { id: 'k0' },
      data: { estado: 'ACEPTADO' },
    })
    expect(prisma.contacto.create).not.toHaveBeenCalled()
    expect(notifications.notifyContactAccepted).toHaveBeenCalledWith('k0')
  })

  it('swallows a duplicate created at the same time', async () => {
    const { prisma, service } = makeService()
    prisma.contacto.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))

    await expect(service.request('u1', 'ana@example.com')).resolves.toBeUndefined()
  })

  it('does not fail the request when the notification fails', async () => {
    const { notifications, service } = makeService()
    notifications.notifyContactRequest.mockRejectedValue(new Error('push down'))

    await expect(service.request('u1', 'ana@example.com')).resolves.toBeUndefined()
  })
})

describe('ContactosService.list', () => {
  const user = (id: string, nombre: string) => ({ id, nombre, avatarUrl: null })

  it('splits the rows into contacts, received and sent requests', async () => {
    const { prisma, service } = makeService()
    prisma.contacto.findMany.mockResolvedValue([
      {
        id: 'k1',
        estado: 'ACEPTADO',
        solicitanteId: 'u1',
        destinatarioId: 'u2',
        solicitante: user('u1', 'Yo'),
        destinatario: user('u2', 'Ana'),
      },
      {
        id: 'k2',
        estado: 'PENDIENTE',
        solicitanteId: 'u3',
        destinatarioId: 'u1',
        solicitante: user('u3', 'Beto'),
        destinatario: user('u1', 'Yo'),
      },
      {
        id: 'k3',
        estado: 'PENDIENTE',
        solicitanteId: 'u1',
        destinatarioId: 'u4',
        solicitante: user('u1', 'Yo'),
        destinatario: user('u4', 'Dani'),
      },
    ])

    await expect(service.list('u1')).resolves.toEqual({
      contactos: [{ id: 'k1', usuario: user('u2', 'Ana') }],
      recibidas: [{ id: 'k2', usuario: user('u3', 'Beto') }],
      enviadas: [{ id: 'k3', usuario: user('u4', 'Dani') }],
    })
  })

  it('exposes only the id, name and photo of the other players', async () => {
    const { prisma, service } = makeService()

    await service.list('u1')

    const args = prisma.contacto.findMany.mock.calls[0]?.[0] as unknown as {
      include: {
        solicitante: { select: Record<string, boolean> }
        destinatario: { select: Record<string, boolean> }
      }
    }
    const select = { id: true, nombre: true, avatarUrl: true }
    expect(args.include.solicitante.select).toEqual(select)
    expect(args.include.destinatario.select).toEqual(select)
  })
})

describe('ContactosService.accept', () => {
  it('lets the addressee accept a pending request and tells the requester', async () => {
    const { prisma, notifications, service } = makeService()
    prisma.contacto.findUnique.mockResolvedValue({
      id: 'k1',
      estado: 'PENDIENTE',
      solicitanteId: 'u2',
      destinatarioId: 'u1',
    })

    await service.accept('u1', 'k1')

    expect(prisma.contacto.update).toHaveBeenCalledWith({
      where: { id: 'k1' },
      data: { estado: 'ACEPTADO' },
    })
    expect(notifications.notifyContactAccepted).toHaveBeenCalledWith('k1')
  })

  it('does not let the requester accept their own request', async () => {
    const { prisma, service } = makeService()
    prisma.contacto.findUnique.mockResolvedValue({
      id: 'k1',
      estado: 'PENDIENTE',
      solicitanteId: 'u1',
      destinatarioId: 'u2',
    })

    await expect(service.accept('u1', 'k1')).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.contacto.update).not.toHaveBeenCalled()
  })

  it('returns not found for an unknown request', async () => {
    const { service } = makeService()

    await expect(service.accept('u1', 'nope')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('refuses a request that is already accepted', async () => {
    const { prisma, service } = makeService()
    prisma.contacto.findUnique.mockResolvedValue({
      id: 'k1',
      estado: 'ACEPTADO',
      solicitanteId: 'u2',
      destinatarioId: 'u1',
    })

    await expect(service.accept('u1', 'k1')).rejects.toBeInstanceOf(ConflictException)
  })
})

describe('ContactosService.remove', () => {
  it.each([
    ['the requester', 'u1', 'u2'],
    ['the addressee', 'u2', 'u1'],
  ])('lets %s remove the row', async (_who, solicitanteId, destinatarioId) => {
    const { prisma, service } = makeService()
    prisma.contacto.findUnique.mockResolvedValue({
      id: 'k1',
      estado: 'ACEPTADO',
      solicitanteId,
      destinatarioId,
    })

    await service.remove('u1', 'k1')

    expect(prisma.contacto.delete).toHaveBeenCalledWith({ where: { id: 'k1' } })
  })

  it('hides a row from a player who is not part of it', async () => {
    const { prisma, service } = makeService()
    prisma.contacto.findUnique.mockResolvedValue({
      id: 'k1',
      estado: 'ACEPTADO',
      solicitanteId: 'u8',
      destinatarioId: 'u9',
    })

    await expect(service.remove('u1', 'k1')).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.contacto.delete).not.toHaveBeenCalled()
  })

  it('returns not found for an unknown row', async () => {
    const { service } = makeService()

    await expect(service.remove('u1', 'nope')).rejects.toBeInstanceOf(NotFoundException)
  })
})
