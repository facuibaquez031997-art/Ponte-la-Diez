import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { v2 as cloudinary } from 'cloudinary'
import { PrismaService } from '../../../common/prisma/prisma.service.js'
import type { UserProfileDto } from '../../auth/dto/auth-response.dto.js'
import { toUserProfile } from '../user-profile.mapper.js'
import { AVATAR_FORMATS, avatarPublicId, isValidAvatarAsset } from './avatar.rules.js'
import type { UploadSignatureDto } from './dto/upload-signature.dto.js'

interface CloudinaryCredentials {
  cloudName: string
  apiKey: string
  apiSecret: string
}

const AVATAR_SIZE_PX = 256

@Injectable()
export class AvatarService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  createUploadSignature(userId: string): UploadSignatureDto {
    const { cloudName, apiKey, apiSecret } = this.credentials()
    const publicId = avatarPublicId(userId)
    const timestamp = Math.round(Date.now() / 1000)
    const allowedFormats = AVATAR_FORMATS.join(',')

    const signature = cloudinary.utils.api_sign_request(
      {
        allowed_formats: allowedFormats,
        invalidate: true,
        overwrite: true,
        public_id: publicId,
        timestamp,
      },
      apiSecret
    )

    return {
      cloudName,
      apiKey,
      timestamp,
      signature,
      publicId,
      allowedFormats,
      overwrite: true,
      invalidate: true,
    }
  }

  async confirmUpload(userId: string): Promise<UserProfileDto> {
    this.configure(this.credentials())
    const publicId = avatarPublicId(userId)

    let asset: { format: string; bytes: number; version: number }
    try {
      asset = await cloudinary.api.resource(publicId, { resource_type: 'image' })
    } catch {
      throw new BadRequestException('No encontramos la foto subida')
    }

    if (!isValidAvatarAsset(asset)) {
      await cloudinary.uploader.destroy(publicId, { invalidate: true })
      await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } })
      throw new BadRequestException('La foto debe ser JPG, PNG o WebP de hasta 5 MB')
    }

    const avatarUrl = cloudinary.url(publicId, {
      secure: true,
      version: asset.version,
      transformation: [
        {
          width: AVATAR_SIZE_PX,
          height: AVATAR_SIZE_PX,
          crop: 'fill',
          gravity: 'face',
          fetch_format: 'auto',
          quality: 'auto',
        },
      ],
    })
    const user = await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } })
    return toUserProfile(user)
  }

  async removeAvatar(userId: string): Promise<UserProfileDto> {
    if (this.hasCredentials()) {
      this.configure(this.credentials())
      await cloudinary.uploader.destroy(avatarPublicId(userId), { invalidate: true })
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    })
    return toUserProfile(user)
  }

  private hasCredentials(): boolean {
    return Boolean(
      this.config.get<string>('CLOUDINARY_CLOUD_NAME') &&
      this.config.get<string>('CLOUDINARY_API_KEY') &&
      this.config.get<string>('CLOUDINARY_API_SECRET')
    )
  }

  private credentials(): CloudinaryCredentials {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME')
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY')
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET')
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('La subida de fotos no está configurada')
    }
    return { cloudName, apiKey, apiSecret }
  }

  private configure({ cloudName, apiKey, apiSecret }: CloudinaryCredentials): void {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    })
  }
}
