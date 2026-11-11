import { usersService } from './users.service'

export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp'
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024

const ALLOWED_TYPES = AVATAR_ACCEPT.split(',')

export class AvatarUploadError extends Error {}

export const validateAvatarFile = (file: File): string | null => {
  if (!ALLOWED_TYPES.includes(file.type)) return 'La foto debe ser JPG, PNG o WebP.'
  if (file.size > AVATAR_MAX_BYTES) return 'La foto no puede pesar más de 5 MB.'
  return null
}

export const uploadAvatarToCloudinary = async (file: File): Promise<void> => {
  const invalid = validateAvatarFile(file)
  if (invalid) throw new AvatarUploadError(invalid)

  const sig = await usersService.avatarSignature()
  const body = new FormData()
  body.append('file', file)
  body.append('api_key', sig.apiKey)
  body.append('timestamp', String(sig.timestamp))
  body.append('signature', sig.signature)
  body.append('public_id', sig.publicId)
  body.append('allowed_formats', sig.allowedFormats)
  body.append('overwrite', String(sig.overwrite))
  body.append('invalidate', String(sig.invalidate))

  const response = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: 'POST',
    body,
  })
  if (!response.ok) {
    const detail = await response
      .json()
      .then((data: { error?: { message?: string } }) => data.error?.message)
      .catch(() => undefined)
    throw new AvatarUploadError(
      `No se pudo subir la foto (Cloudinary ${response.status}${detail ? `: ${detail}` : ''}).`
    )
  }
}
