import 'reflect-metadata'
import { vi } from 'vitest'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { CanchasService } from './canchas.service.js'

const dto = {
  nombre: 'La Bombonera',
  direccion: 'Calle 1 123',
  barrio: 'Barrio El Mate',
  tipoSuperficie: 'Sintético',
  jugadores: 7,
  precioHora: 12000,
  montoSena: 3000,
}

const makePrisma = () => {
  const prisma = {
    cancha: {
      create: vi.fn(async ({ data }: { data: object }) => ({ id: 'c1', ...data })),
      findMany: vi.fn(async (_args?: object) => [] as unknown[]),
      count: vi.fn(async (_args?: object) => 0),
      findUnique: vi.fn(async (_args?: object) => null as unknown),
      update: vi.fn(async ({ data }: { data: object }) => ({ id: 'c1', ...data })),
      delete: vi.fn(async (_args?: object) => ({ id: 'c1' })),
    },
    turno: {
      count: vi.fn(async (_args?: object) => 0),
      deleteMany: vi.fn(async (_args?: object) => ({ count: 0 })),
    },
    canchaConflicto: {
      deleteMany: vi.fn(async (_args?: object) => ({ count: 0 })),
      createMany: vi.fn(async (_args?: object) => ({ count: 0 })),
    },
    canchaFoto: { findMany: vi.fn(async (_args?: object) => [] as unknown[]) },
    historialReserva: { count: vi.fn(async (_args?: object) => 0) },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (run: (tx: unknown) => unknown) => run(prisma))
  return prisma
}

const makeService = (prisma = makePrisma()) => {
  const fotos = { destroyAssets: vi.fn(async (_publicIds: string[]) => undefined) }
  return { prisma, fotos, service: new CanchasService(prisma as never, fotos as never) }
}

const FOTOS_INCLUDE = { fotos: { orderBy: { createdAt: 'asc' }, select: { id: true, url: true } } }

describe('CanchasService', () => {
  it('creates a court owned by the caller', async () => {
    const { service, prisma } = makeService()
    await service.create('owner1', dto)
    expect(prisma.cancha.create).toHaveBeenCalledWith({ data: { ...dto, ownerId: 'owner1' } })
  })

  it('lists only my courts', async () => {
    const { service, prisma } = makeService()
    await service.listMine('owner1')
    expect(prisma.cancha.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'owner1' } })
    )
  })

  it('filters the public list by barrio, surface and max price', async () => {
    const { service, prisma } = makeService()
    await service.list({ barrio: 'Barrio El Sol', tipoSuperficie: 'Sintético', precioMax: 15000 })
    expect(prisma.cancha.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          barrio: 'Barrio El Sol',
          tipoSuperficie: 'Sintético',
          precioHora: { lte: 15000 },
        },
      })
    )
  })

  it('filters the public list by the size of the court', async () => {
    const { service, prisma } = makeService()
    await service.list({ jugadores: 7 })
    expect(prisma.cancha.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jugadores: 7 } })
    )
  })

  it('combines the size with the other filters', async () => {
    const { service, prisma } = makeService()
    await service.list({ barrio: 'Barrio El Sol', jugadores: 5, precioMax: 15000 })
    expect(prisma.cancha.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { barrio: 'Barrio El Sol', jugadores: 5, precioHora: { lte: 15000 } },
      })
    )
  })

  it('lets the owner set the size of an existing court', async () => {
    const { service, prisma } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })
    await service.update('owner1', 'c1', { jugadores: 9 })
    expect(prisma.cancha.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { jugadores: 9 },
    })
  })

  it('lists everything when no filter is given', async () => {
    const { service, prisma } = makeService()
    await service.list({})
    expect(prisma.cancha.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })

  it('sends the photos with every court, oldest first (the first one is the cover)', async () => {
    const { service, prisma } = makeService()
    await service.listMine('owner1')
    await service.list({})
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })
    await service.findOne('c1')
    for (const call of prisma.cancha.findMany.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({ include: expect.objectContaining(FOTOS_INCLUDE) })
      )
    }
    expect(prisma.cancha.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      include: FOTOS_INCLUDE,
    })
  })

  it('does not bring the links between entries in the public list: only the owner sees them', async () => {
    const { service, prisma } = makeService()
    await service.list({})
    await service.findOne('c1').catch(() => undefined)
    const publicCall = prisma.cancha.findMany.mock.calls[0][0] as { include: object }
    expect(publicCall.include).toEqual(FOTOS_INCLUDE)
  })

  describe('entries that share the physical space', () => {
    const OTHER_A = '8f0c1f7e-3b9e-4c55-9d4b-0d6a5a3a9f11'
    const OTHER_B = '3a1f6d52-7c41-4a7e-8b0e-5d2c1e9f4a22'

    it('shows each of my courts with the ids of the entries it shares the space with', async () => {
      const { service, prisma } = makeService()
      prisma.cancha.findMany.mockResolvedValue([
        { id: 'c1', comparteCon: [{ otraCanchaId: OTHER_A }, { otraCanchaId: OTHER_B }] },
        { id: 'c2', comparteCon: [] },
      ])

      const mine = await service.listMine('owner1')

      expect(mine.map((c) => [c.id, c.comparteCon])).toEqual([
        ['c1', [OTHER_A, OTHER_B]],
        ['c2', []],
      ])
    })

    it('links both ways, so booking either one blocks the other', async () => {
      const { service, prisma } = makeService()
      prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })
      prisma.cancha.count.mockResolvedValue(2)

      await service.update('owner1', 'c1', { comparteCon: [OTHER_A, OTHER_B] })

      expect(prisma.canchaConflicto.deleteMany).toHaveBeenCalledWith({
        where: { OR: [{ canchaId: 'c1' }, { otraCanchaId: 'c1' }] },
      })
      expect(prisma.canchaConflicto.createMany).toHaveBeenCalledWith({
        data: [
          { canchaId: 'c1', otraCanchaId: OTHER_A },
          { canchaId: OTHER_A, otraCanchaId: 'c1' },
          { canchaId: 'c1', otraCanchaId: OTHER_B },
          { canchaId: OTHER_B, otraCanchaId: 'c1' },
        ],
      })
    })

    it('an empty list removes the links in both directions', async () => {
      const { service, prisma } = makeService()
      prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })

      await service.update('owner1', 'c1', { comparteCon: [] })

      expect(prisma.canchaConflicto.deleteMany).toHaveBeenCalled()
      expect(prisma.canchaConflicto.createMany).not.toHaveBeenCalled()
    })

    it('leaves the links alone when the request does not mention them', async () => {
      const { service, prisma } = makeService()
      prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })

      await service.update('owner1', 'c1', { nombre: 'Otro nombre' })

      expect(prisma.canchaConflicto.deleteMany).not.toHaveBeenCalled()
      expect(prisma.canchaConflicto.createMany).not.toHaveBeenCalled()
      expect(prisma.cancha.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { nombre: 'Otro nombre' },
      })
    })

    it('only lets me link courts of mine', async () => {
      const { service, prisma } = makeService()
      prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })
      prisma.cancha.count.mockResolvedValue(1) // one of the two is somebody else's

      await expect(
        service.update('owner1', 'c1', { comparteCon: [OTHER_A, OTHER_B] })
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(prisma.canchaConflicto.createMany).not.toHaveBeenCalled()
    })

    it('does not link a court with itself', async () => {
      const { service, prisma } = makeService()
      prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })

      await expect(service.update('owner1', 'c1', { comparteCon: ['c1'] })).rejects.toBeInstanceOf(
        BadRequestException
      )
    })

    it('links a new court with the ones given when it is created', async () => {
      const { service, prisma } = makeService()
      prisma.cancha.count.mockResolvedValue(1)

      await service.create('owner1', { ...dto, comparteCon: [OTHER_A] })

      expect(prisma.cancha.create).toHaveBeenCalledWith({ data: { ...dto, ownerId: 'owner1' } })
      expect(prisma.canchaConflicto.createMany).toHaveBeenCalledWith({
        data: [
          { canchaId: 'c1', otraCanchaId: OTHER_A },
          { canchaId: OTHER_A, otraCanchaId: 'c1' },
        ],
      })
    })

    it("someone else's court cannot be linked or edited by me", async () => {
      const { service, prisma } = makeService()
      prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'someone-else' })

      await expect(
        service.update('owner1', 'c1', { comparteCon: [OTHER_A] })
      ).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.canchaConflicto.createMany).not.toHaveBeenCalled()
    })
  })

  it('returns 404 for an unknown court', async () => {
    const { service } = makeService()
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('updates my own court', async () => {
    const { service, prisma } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })
    await service.update('owner1', 'c1', { precioHora: 15000 })
    expect(prisma.cancha.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { precioHora: 15000 },
    })
  })

  it("refuses to update another owner's court", async () => {
    const { service, prisma } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'other' })
    await expect(service.update('owner1', 'c1', { precioHora: 1 })).rejects.toBeInstanceOf(
      ForbiddenException
    )
    expect(prisma.cancha.update).not.toHaveBeenCalled()
  })

  it('deletes my court together with its slots', async () => {
    const { service, prisma } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })
    await service.remove('owner1', 'c1')
    expect(prisma.turno.deleteMany).toHaveBeenCalledWith({ where: { canchaId: 'c1' } })
    expect(prisma.cancha.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })

  it('deletes the photo files of a court once the court is gone', async () => {
    const { service, prisma, fotos } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })
    prisma.canchaFoto.findMany.mockResolvedValue([{ publicId: 'p1' }, { publicId: 'p2' }])
    await service.remove('owner1', 'c1')
    expect(fotos.destroyAssets).toHaveBeenCalledWith(['p1', 'p2'])
  })

  it('keeps the photo files when the court cannot be deleted', async () => {
    const { service, prisma, fotos } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })
    prisma.canchaFoto.findMany.mockResolvedValue([{ publicId: 'p1' }])
    prisma.turno.count.mockResolvedValue(1)
    await expect(service.remove('owner1', 'c1')).rejects.toBeInstanceOf(ConflictException)
    expect(fotos.destroyAssets).not.toHaveBeenCalled()
  })

  it('refuses to delete a court that has bookings', async () => {
    const { service, prisma } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })
    prisma.turno.count.mockResolvedValue(1)
    await expect(service.remove('owner1', 'c1')).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.cancha.delete).not.toHaveBeenCalled()
  })

  it('refuses to delete a court whose history has money paid, a refund may still be pending', async () => {
    const { service, prisma, fotos } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })
    prisma.historialReserva.count.mockResolvedValue(1)
    await expect(service.remove('owner1', 'c1')).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.historialReserva.count).toHaveBeenCalledWith({
      where: { canchaId: 'c1', montoPagado: { gt: 0 } },
    })
    expect(prisma.cancha.delete).not.toHaveBeenCalled()
    expect(prisma.turno.deleteMany).not.toHaveBeenCalled()
    expect(fotos.destroyAssets).not.toHaveBeenCalled()
  })

  it('still deletes a court whose history only has bookings nobody paid', async () => {
    const { service, prisma } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })
    prisma.historialReserva.count.mockResolvedValue(0)
    await service.remove('owner1', 'c1')
    expect(prisma.cancha.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })

  it("refuses to delete another owner's court", async () => {
    const { service, prisma } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'other' })
    await expect(service.remove('owner1', 'c1')).rejects.toBeInstanceOf(ForbiddenException)
  })
})
