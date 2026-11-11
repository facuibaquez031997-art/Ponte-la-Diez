export const AVATAR_FORMATS = ['jpg', 'png', 'webp'] as const
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024

interface AvatarAsset {
  format: string
  bytes: number
}

export const isValidAvatarAsset = ({ format, bytes }: AvatarAsset): boolean =>
  (AVATAR_FORMATS as readonly string[]).includes(format) && bytes > 0 && bytes <= AVATAR_MAX_BYTES

export const avatarPublicId = (userId: string): string => `avatars/${userId}`
