import { randomUUID } from 'node:crypto'
import { AVATAR_FORMATS, isValidAvatarAsset } from '../users/avatar/avatar.rules.js'

// Court photos follow the same limits as the profile photo: JPG, PNG or WebP up to 5 MB.
export const FOTO_FORMATS = AVATAR_FORMATS
export const isValidFotoAsset = (asset: { format: string; bytes: number }): boolean =>
  isValidAvatarAsset(asset)

export const MAX_FOTOS = 5

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const fotoPublicIdPrefix = (canchaId: string): string => `canchas/${canchaId}/`

export const newFotoPublicId = (canchaId: string): string =>
  `${fotoPublicIdPrefix(canchaId)}${randomUUID()}`

/** Only ids this server issued for that court can be attached to it. */
export const isFotoPublicIdOf = (canchaId: string, publicId: string): boolean => {
  const prefix = fotoPublicIdPrefix(canchaId)
  return publicId.startsWith(prefix) && UUID.test(publicId.slice(prefix.length))
}
