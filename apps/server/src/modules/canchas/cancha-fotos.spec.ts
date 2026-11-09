import 'reflect-metadata'
import { vi } from 'vitest'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'

const cloudinaryMock = vi.hoisted(() => ({
  config: vi.fn(),
  utils: { api_sign_request: vi.fn((_params: object, _secret: string) => 'a'.repeat(40)) },
  api: { resource: vi.fn(async (_id: string, _opts?: object) => ({}) as unknown) },
  uploader: { destroy: vi.fn(async (_id: string, _opts?: object) => ({ result: 'ok' })) },
  url: vi.fn((id: string, _opts?: object) => `https://res.cloudinary.com/demo/${id}.jpg`),
}))
vi.mock('cloudinary', () => ({ v2: cloudinaryMock }))

import { MAX_FOTOS, fotoPublicIdPrefix, isFotoPublicIdOf } from './foto.rules.js'
import { CanchaFotosService } from './cancha-fotos.service.js'

const SECRET = 'test-secret-not-real'
const configured = {
  CLOUDINARY_CLOUD_NAME: 'demo-cloud',
  CLOUDINARY_API_KEY: '123456789',
  CLOUDINARY_API_SECRET: SECRET,
}
const CANCHA = '11111111-1111-4111-8111-111111111111'
const OTHER_CANCHA = '22222222-2222-4222-8222-222222222222'
const OWN_ID = `${fotoPublicIdPrefix(CANCHA)}aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`

const makePrisma = () => ({
  cancha: {
    findUnique: vi.fn(async (_args?: object) => ({ id: CANCHA, ownerId: 'o1' }) as unknown),
  },
  canchaFoto: {
    count: vi.fn(async (_args?: object) => 0),
    findUnique: vi.fn(async (_args?: object) => null as unknown),
    findFirst: vi.fn(async (_args?: object) => null as unknown),
    create: vi.fn(async ({ data }: { data: object }) => ({ id: 'f1', ...data })),
    delete: vi.fn(async (_args?: object) => ({ id: 'f1' })),
  },
})

const makeService = (prisma = makePrisma(), env: Record<string, string> = configured) => ({
  prisma,
  service: new CanchaFotosService({ get: (key: string) => env[key] } as never, prisma as never),
})

beforeEach(() => {
  vi.clearAllMocks()
  cloudinaryMock.api.resource.mockResolvedValue({ format: 'jpg', bytes: 1000, version: 7 })
  cloudinaryMock.uploader.destroy.mockResolvedValue({ result: 'ok' })
})

describe('foto rules', () => {
  it('only accepts ids inside the folder of that court', () => {
    expect(isFotoPublicIdOf(CANCHA, OWN_ID)).toBe(true)
    expect(isFotoPublicIdOf(OTHER_CANCHA, OWN_ID)).toBe(false)
    expect(isFotoPublicIdOf(CANCHA, 'avatars/u-1')).toBe(false)
    expect(isFotoPublicIdOf(CANCHA, `${fotoPublicIdPrefix(CANCHA)}../avatars/u-1`)).toBe(false)
    expect(isFotoPublicIdOf(CANCHA, fotoPublicIdPrefix(CANCHA))).toBe(false)
  })

  it('allows up to 5 photos per court', () => {
    expect(MAX_FOTOS).toBe(5)
  })
})

describe('CanchaFotosService.createUploadSignature', () => {
  it('pins the upload to a new id inside the court folder and the allowed formats', async () => {
    const { service } = makeService()
    const result = await service.createUploadSignature('o1', CANCHA)
    expect(result.publicId.startsWith(fotoPublicIdPrefix(CANCHA))).toBe(true)
    expect(isFotoPublicIdOf(CANCHA, result.publicId)).toBe(true)
    expect(result.allowedFormats).toBe('jpg,png,webp')
    expect(result.cloudName).toBe('demo-cloud')
    expect(result.apiKey).toBe('123456789')
    expect(result.signature).toMatch(/^[0-9a-f]{40,64}$/)
    const [signed] = cloudinaryMock.utils.api_sign_request.mock.calls[0]
    expect(signed).toEqual({
      allowed_formats: 'jpg,png,webp',
      public_id: result.publicId,
      timestamp: result.timestamp,
    })
  })

  it('never exposes the API secret and gives a different id each time', async () => {
    const { service } = makeService()
    const first = await service.createUploadSignature('o1', CANCHA)
    const second = await service.createUploadSignature('o1', CANCHA)
    expect(JSON.stringify(first)).not.toContain(SECRET)
    expect(first.publicId).not.toBe(second.publicId)
  })

  it('503 when Cloudinary is not configured', async () => {
    const { service } = makeService(makePrisma(), {})
    await expect(service.createUploadSignature('o1', CANCHA)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    )
  })

  it('404 for an unknown court and 403 for a court that is not mine', async () => {
    const missing = makeService()
    missing.prisma.cancha.findUnique.mockResolvedValue(null)
    await expect(missing.service.createUploadSignature('o1', CANCHA)).rejects.toBeInstanceOf(
      NotFoundException
    )
    const other = makeService()
    other.prisma.cancha.findUnique.mockResolvedValue({ id: CANCHA, ownerId: 'someone-else' })
    await expect(other.service.createUploadSignature('o1', CANCHA)).rejects.toBeInstanceOf(
      ForbiddenException
    )
  })

  it('409 when the court already has 5 photos', async () => {
    const { service, prisma } = makeService()
    prisma.canchaFoto.count.mockResolvedValue(5)
    await expect(service.createUploadSignature('o1', CANCHA)).rejects.toBeInstanceOf(
      ConflictException
    )
  })
})

describe('CanchaFotosService.confirmUpload', () => {
  it('saves a valid photo with its delivery url', async () => {
    const { service, prisma } = makeService()
    const foto = await service.confirmUpload('o1', CANCHA, OWN_ID)
    expect(prisma.canchaFoto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ canchaId: CANCHA, publicId: OWN_ID }),
      select: { id: true, url: true },
    })
    expect(foto.url).toContain(OWN_ID)
    expect(cloudinaryMock.url).toHaveBeenCalledWith(
      OWN_ID,
      expect.objectContaining({ secure: true, version: 7 })
    )
  })

  it('refuses an id that belongs to another court or to an avatar, without calling Cloudinary', async () => {
    const { service, prisma } = makeService()
    for (const publicId of [
      `${fotoPublicIdPrefix(OTHER_CANCHA)}aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      'avatars/u-1',
    ]) {
      await expect(service.confirmUpload('o1', CANCHA, publicId)).rejects.toBeInstanceOf(
        BadRequestException
      )
    }
    expect(cloudinaryMock.api.resource).not.toHaveBeenCalled()
    expect(cloudinaryMock.uploader.destroy).not.toHaveBeenCalled()
    expect(prisma.canchaFoto.create).not.toHaveBeenCalled()
  })

  it('refuses a court that is not mine before touching Cloudinary', async () => {
    const { service, prisma } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: CANCHA, ownerId: 'someone-else' })
    await expect(service.confirmUpload('o1', CANCHA, OWN_ID)).rejects.toBeInstanceOf(
      ForbiddenException
    )
    expect(cloudinaryMock.api.resource).not.toHaveBeenCalled()
  })

  it('400 when the uploaded file cannot be found', async () => {
    const { service, prisma } = makeService()
    cloudinaryMock.api.resource.mockRejectedValue(new Error('not found'))
    await expect(service.confirmUpload('o1', CANCHA, OWN_ID)).rejects.toBeInstanceOf(
      BadRequestException
    )
    expect(prisma.canchaFoto.create).not.toHaveBeenCalled()
  })

  it.each([
    ['gif', 1000],
    ['jpg', 5 * 1024 * 1024 + 1],
  ])('deletes the upload and answers 400 for %s with %i bytes', async (format, bytes) => {
    const { service, prisma } = makeService()
    cloudinaryMock.api.resource.mockResolvedValue({ format, bytes, version: 1 })
    await expect(service.confirmUpload('o1', CANCHA, OWN_ID)).rejects.toBeInstanceOf(
      BadRequestException
    )
    expect(cloudinaryMock.uploader.destroy).toHaveBeenCalledWith(OWN_ID, { invalidate: true })
    expect(prisma.canchaFoto.create).not.toHaveBeenCalled()
  })

  it('409 and deletes the upload when the court already has 5 photos', async () => {
    const { service, prisma } = makeService()
    prisma.canchaFoto.count.mockResolvedValue(5)
    await expect(service.confirmUpload('o1', CANCHA, OWN_ID)).rejects.toBeInstanceOf(
      ConflictException
    )
    expect(cloudinaryMock.uploader.destroy).toHaveBeenCalledWith(OWN_ID, { invalidate: true })
    expect(prisma.canchaFoto.create).not.toHaveBeenCalled()
  })

  it('409 when the same upload is confirmed twice, keeping the file', async () => {
    const { service, prisma } = makeService()
    prisma.canchaFoto.findUnique.mockResolvedValue({ id: 'f1' })
    await expect(service.confirmUpload('o1', CANCHA, OWN_ID)).rejects.toBeInstanceOf(
      ConflictException
    )
    expect(cloudinaryMock.uploader.destroy).not.toHaveBeenCalled()
  })
})

describe('CanchaFotosService.remove', () => {
  it('deletes the row and the file of one of my photos', async () => {
    const { service, prisma } = makeService()
    prisma.canchaFoto.findFirst.mockResolvedValue({ id: 'f1', publicId: OWN_ID })
    await service.remove('o1', CANCHA, 'f1')
    expect(prisma.canchaFoto.findFirst).toHaveBeenCalledWith({
      where: { id: 'f1', canchaId: CANCHA },
    })
    expect(cloudinaryMock.uploader.destroy).toHaveBeenCalledWith(OWN_ID, { invalidate: true })
    expect(prisma.canchaFoto.delete).toHaveBeenCalledWith({ where: { id: 'f1' } })
  })

  it('404 for a photo that is not in that court', async () => {
    const { service, prisma } = makeService()
    await expect(service.remove('o1', CANCHA, 'f1')).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.canchaFoto.delete).not.toHaveBeenCalled()
  })

  it('403 for a court that is not mine', async () => {
    const { service, prisma } = makeService()
    prisma.cancha.findUnique.mockResolvedValue({ id: CANCHA, ownerId: 'someone-else' })
    await expect(service.remove('o1', CANCHA, 'f1')).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.canchaFoto.delete).not.toHaveBeenCalled()
  })

  it('still deletes the row when Cloudinary fails', async () => {
    const { service, prisma } = makeService()
    prisma.canchaFoto.findFirst.mockResolvedValue({ id: 'f1', publicId: OWN_ID })
    cloudinaryMock.uploader.destroy.mockRejectedValue(new Error('network'))
    await service.remove('o1', CANCHA, 'f1')
    expect(prisma.canchaFoto.delete).toHaveBeenCalledWith({ where: { id: 'f1' } })
  })
})

describe('CanchaFotosService.destroyAssets', () => {
  it('tries every file and never throws', async () => {
    const { service } = makeService()
    cloudinaryMock.uploader.destroy.mockRejectedValueOnce(new Error('network'))
    await expect(service.destroyAssets(['a', 'b'])).resolves.toBeUndefined()
    expect(cloudinaryMock.uploader.destroy).toHaveBeenCalledTimes(2)
  })

  it('does nothing without credentials or without files', async () => {
    await makeService(makePrisma(), {}).service.destroyAssets(['a'])
    await makeService().service.destroyAssets([])
    expect(cloudinaryMock.uploader.destroy).not.toHaveBeenCalled()
  })
})
