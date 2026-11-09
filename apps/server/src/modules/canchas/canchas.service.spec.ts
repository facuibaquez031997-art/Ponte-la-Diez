import 'reflect-metadata'
import { vi } from 'vitest'
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { CanchasService } from './canchas.service.js'

const dto = {
  nombre: 'La Bombonera',
  direccion: 'Calle 1 123',
  barrio: 'Barrio El Mate',
  tipoSuperficie: 'Sintético',
  precioHora: 12000,
  montoSena: 3000,
}

const makePrisma = () => {
  const prisma = {
    cancha: {
      create: vi.fn(async ({ data }: { data: object }) => ({ id: 'c1', ...data })),
      findMany: vi.fn(async (_args?: object) => [] as unknown[]),
      findUnique: vi.fn(async (_args?: object) => null as unknown),
      update: vi.fn(async ({ data }: { data: object }) => ({ id: 'c1', ...data })),
      delete: vi.fn(async (_args?: object) => ({ id: 'c1' })),
    },
    turno: {
      count: vi.fn(async (_args?: object) => 0),
      deleteMany: vi.fn(async (_args?: object) => ({ count: 0 })),
    },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (run: (tx: unknown) => unknown) => run(prisma))
  return prisma
}

const makeService = (prisma = makePrisma()) => ({
  prisma,
  service: new CanchasService(prisma as never),
})

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

  it('lists everything when no filter is given', async () => {
    const { service, prisma } = makeService()
    await service.list({})
    expect(prisma.cancha.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
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

  it('refuses to delete a court that has bookings', async () => {
    const { service, prisma } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' })
    prisma.turno.count.mockResolvedValue(1)
    await expect(service.remove('owner1', 'c1')).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.cancha.delete).not.toHaveBeenCalled()
  })

  it("refuses to delete another owner's court", async () => {
    const { service, prisma } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'other' })
    await expect(service.remove('owner1', 'c1')).rejects.toBeInstanceOf(ForbiddenException)
  })
})
