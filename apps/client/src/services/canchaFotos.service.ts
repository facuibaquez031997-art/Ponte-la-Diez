import { AVATAR_ACCEPT, AvatarUploadError, validateAvatarFile } from './avatar.service'
import { canchasService } from './canchas.service'

// A court photo has the same limits as a profile photo: JPG, PNG or WebP up to 5 MB.
export const FOTO_ACCEPT = AVATAR_ACCEPT

export const uploadCanchaFoto = async (canchaId: string, file: File): Promise<void> => {
  const invalid = validateAvatarFile(file)
  if (invalid) throw new AvatarUploadError(invalid)

  const sig = await canchasService.fotoSignature(canchaId)
  const body = new FormData()
  body.append('file', file)
  body.append('api_key', sig.apiKey)
  body.append('timestamp', String(sig.timestamp))
  body.append('signature', sig.signature)
  body.append('public_id', sig.publicId)
  body.append('allowed_formats', sig.allowedFormats)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: 'POST',
    body,
  })
  if (!response.ok) {
    throw new AvatarUploadError(`No se pudo subir la foto (Cloudinary ${response.status}).`)
  }
  await canchasService.confirmFoto(canchaId, sig.publicId)
}
