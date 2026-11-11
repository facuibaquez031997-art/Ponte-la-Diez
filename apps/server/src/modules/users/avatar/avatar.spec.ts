import 'reflect-metadata'
import { ServiceUnavailableException } from '@nestjs/common'
import { AVATAR_FORMATS, AVATAR_MAX_BYTES, isValidAvatarAsset } from './avatar.rules.js'
import { AvatarService } from './avatar.service.js'

const SECRET = 'test-secret-not-real'
const configured = {
  CLOUDINARY_CLOUD_NAME: 'demo-cloud',
  CLOUDINARY_API_KEY: '123456789',
  CLOUDINARY_API_SECRET: SECRET,
}

const makeService = (env: Record<string, string> = configured) =>
  new AvatarService({ get: (key: string) => env[key] } as never, {} as never)

describe('isValidAvatarAsset', () => {
  it.each(AVATAR_FORMATS)('accepts %s up to the size limit', (format) => {
    expect(isValidAvatarAsset({ format, bytes: AVATAR_MAX_BYTES })).toBe(true)
  })

  it.each(['gif', 'svg', 'heic', 'pdf'])('rejects %s', (format) => {
    expect(isValidAvatarAsset({ format, bytes: 1000 })).toBe(false)
  })

  it('rejects files over 5 MB', () => {
    expect(isValidAvatarAsset({ format: 'jpg', bytes: AVATAR_MAX_BYTES + 1 })).toBe(false)
  })

  it('rejects empty files', () => {
    expect(isValidAvatarAsset({ format: 'png', bytes: 0 })).toBe(false)
  })
})

describe('AvatarService.createUploadSignature', () => {
  it('pins the upload to the user own public id and the allowed formats', () => {
    const result = makeService().createUploadSignature('u-1')

    expect(result.publicId).toBe('avatars/u-1')
    expect(result.cloudName).toBe('demo-cloud')
    expect(result.apiKey).toBe('123456789')
    expect(result.allowedFormats).toBe('jpg,png,webp')
    expect(result.overwrite).toBe(true)
    expect(result.signature).toMatch(/^[0-9a-f]{40,64}$/)
  })

  it('never exposes the API secret', () => {
    const result = makeService().createUploadSignature('u-1')
    expect(JSON.stringify(result)).not.toContain(SECRET)
  })

  it('gives each user a different public id', () => {
    const service = makeService()
    expect(service.createUploadSignature('u-1').publicId).not.toBe(
      service.createUploadSignature('u-2').publicId
    )
  })

  it('fails with 503 when Cloudinary is not configured', () => {
    expect(() => makeService({}).createUploadSignature('u-1')).toThrow(ServiceUnavailableException)
  })
})
