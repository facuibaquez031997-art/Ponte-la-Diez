import 'reflect-metadata'
import { vi } from 'vitest'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { ConvocatoriasService } from './convocatorias.service.js'

const future = new Date(Date.now() + 86_400_000)

const makePrisma = () => ({
  user: { findUnique: vi.fn() },
  convocatoria: {
    create: vi.fn(async ({ data }: { data: object }) => ({ id: 'c1', estado: 'ABIERTA', ...data })),
    findMany: vi.fn(async (_args?: object) => []),
    findUnique: vi.fn(),
    update: vi.fn(async ({ data }: { data: object }) => ({ id: 'c1', ...data })),
  },
})

const makeService = (prisma = makePrisma()) => ({
  prisma,
  service: new ConvocatoriasService(prisma as never),
})

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

  it('forbids closing a call owned by someone else', async () => {
    const { prisma, service } = makeService()
    prisma.convocatoria.findUnique.mockResolvedValue({ id: 'c1', creadorId: 'other' })

    await expect(service.close('u1', 'c1')).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.convocatoria.update).not.toHaveBeenCalled()
  })

  it('returns not found for an unknown call', async () => {
    const { prisma, service } = makeService()
    prisma.convocatoria.findUnique.mockResolvedValue(null)

    await expect(service.close('u1', 'nope')).rejects.toBeInstanceOf(NotFoundException)
  })
})
