import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { v2 as cloudinary } from 'cloudinary'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import type { FotoUploadSignatureDto } from './dto/foto-upload-signature.dto.js'
import {
  FOTO_FORMATS,
  MAX_FOTOS,
  isFotoPublicIdOf,
  isValidFotoAsset,
  newFotoPublicId,
} from './foto.rules.js'

interface CloudinaryCredentials {
  cloudName: string
  apiKey: string
  apiSecret: string
}

export interface CanchaFotoView {
  id: string
  url: string
}

const FOTO_WIDTH_PX = 1200
const FOTO_HEIGHT_PX = 750

@Injectable()
export class CanchaFotosService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async createUploadSignature(ownerId: string, canchaId: string): Promise<FotoUploadSignatureDto> {
    await this.assertOwner(ownerId, canchaId)
    const { cloudName, apiKey, apiSecret } = this.credentials()
    if ((await this.prisma.canchaFoto.count({ where: { canchaId } })) >= MAX_FOTOS) {
      throw new ConflictException(`Una cancha puede tener hasta ${MAX_FOTOS} fotos`)
    }

    const publicId = newFotoPublicId(canchaId)
    const timestamp = Math.round(Date.now() / 1000)
    const allowedFormats = FOTO_FORMATS.join(',')
    const signature = cloudinary.utils.api_sign_request(
      { allowed_formats: allowedFormats, public_id: publicId, timestamp },
      apiSecret
    )
    return { cloudName, apiKey, timestamp, signature, publicId, allowedFormats }
  }

  async confirmUpload(
    ownerId: string,
    canchaId: string,
    publicId: string
  ): Promise<CanchaFotoView> {
    await this.assertOwner(ownerId, canchaId)
    if (!isFotoPublicIdOf(canchaId, publicId)) {
      throw new BadRequestException('La foto no corresponde a esta cancha')
    }
    this.configure(this.credentials())

    if (await this.prisma.canchaFoto.findUnique({ where: { publicId } })) {
      throw new ConflictException('Esa foto ya está cargada')
    }

    let asset: { format: string; bytes: number; version: number }
    try {
      asset = await cloudinary.api.resource(publicId, { resource_type: 'image' })
    } catch {
      throw new BadRequestException('No encontramos la foto subida')
    }

    if (!isValidFotoAsset(asset)) {
      await cloudinary.uploader.destroy(publicId, { invalidate: true })
      throw new BadRequestException('La foto debe ser JPG, PNG o WebP de hasta 5 MB')
    }
    if ((await this.prisma.canchaFoto.count({ where: { canchaId } })) >= MAX_FOTOS) {
      await cloudinary.uploader.destroy(publicId, { invalidate: true })
      throw new ConflictException(`Una cancha puede tener hasta ${MAX_FOTOS} fotos`)
    }

    const url = cloudinary.url(publicId, {
      secure: true,
      version: asset.version,
      transformation: [
        {
          width: FOTO_WIDTH_PX,
          height: FOTO_HEIGHT_PX,
          crop: 'fill',
          gravity: 'auto',
          fetch_format: 'auto',
          quality: 'auto',
        },
      ],
    })
    return this.prisma.canchaFoto.create({
      data: { canchaId, publicId, url },
      select: { id: true, url: true },
    })
  }

  async remove(ownerId: string, canchaId: string, fotoId: string): Promise<void> {
    await this.assertOwner(ownerId, canchaId)
    const foto = await this.prisma.canchaFoto.findFirst({ where: { id: fotoId, canchaId } })
    if (!foto) throw new NotFoundException('La foto no existe')

    // A file that cannot be deleted must not leave a photo that nobody can remove.
    await this.destroyAssets([foto.publicId])
    await this.prisma.canchaFoto.delete({ where: { id: foto.id } })
  }

  /** Best effort: used when a photo or a whole court is removed. Never throws. */
  async destroyAssets(publicIds: string[]): Promise<void> {
    if (publicIds.length === 0 || !this.hasCredentials()) return
    this.configure(this.credentials())
    await Promise.allSettled(
      publicIds.map((publicId) => cloudinary.uploader.destroy(publicId, { invalidate: true }))
    )
  }

  private async assertOwner(ownerId: string, canchaId: string): Promise<void> {
    const cancha = await this.prisma.cancha.findUnique({ where: { id: canchaId } })
    if (!cancha) throw new NotFoundException('La cancha no existe')
    if (cancha.ownerId !== ownerId) throw new ForbiddenException('Esta cancha no es tuya')
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
