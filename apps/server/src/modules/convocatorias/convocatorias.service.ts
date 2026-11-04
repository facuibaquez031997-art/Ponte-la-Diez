import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { Convocatoria } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import type { CreateConvocatoriaDto } from './dto/create-convocatoria.dto.js'

const ESTADO_ABIERTA = 'ABIERTA'
const ESTADO_CERRADA = 'CERRADA'

@Injectable()
export class ConvocatoriasService {
  private readonly logger = new Logger(ConvocatoriasService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  async create(userId: string, dto: CreateConvocatoriaDto): Promise<Convocatoria> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('Usuario no encontrado')
    if (!user.barrioPontevedra) {
      throw new BadRequestException(
        'Completá tu barrio en el perfil para avisar que falta un jugador'
      )
    }
    if (dto.fechaHora.getTime() <= Date.now()) {
      throw new BadRequestException('La fecha del partido debe ser futura')
    }

    const convocatoria = await this.prisma.convocatoria.create({
      data: {
        creadorId: userId,
        canchaId: dto.canchaId,
        fechaHora: dto.fechaHora,
        posicion: dto.posicion,
        jugadoresFaltantes: dto.jugadoresFaltantes,
        mensaje: dto.mensaje,
        alcance: 'BARRIO',
      },
    })

    // Fire and forget: a barrio can be large and a failing push must not undo the call.
    this.notifications.notifyNewConvocatoria(convocatoria.id).catch((error: unknown) => {
      this.logger.error(`Could not notify convocatoria ${convocatoria.id}`, error)
    })
    return convocatoria
  }

  async listForMyBarrio(userId: string): Promise<Convocatoria[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user?.barrioPontevedra) return []

    return this.prisma.convocatoria.findMany({
      where: {
        estado: ESTADO_ABIERTA,
        alcance: 'BARRIO',
        fechaHora: { gte: new Date() },
        creador: { barrioPontevedra: user.barrioPontevedra },
      },
      orderBy: { fechaHora: 'asc' },
    })
  }

  listMine(userId: string): Promise<Convocatoria[]> {
    return this.prisma.convocatoria.findMany({
      where: { creadorId: userId },
      orderBy: { fechaHora: 'desc' },
    })
  }

  async close(userId: string, id: string): Promise<Convocatoria> {
    const convocatoria = await this.prisma.convocatoria.findUnique({ where: { id } })
    if (!convocatoria) throw new NotFoundException('Convocatoria no encontrada')
    if (convocatoria.creadorId !== userId) {
      throw new ForbiddenException('Solo quien creó la convocatoria puede cerrarla')
    }

    return this.prisma.convocatoria.update({
      where: { id },
      data: { estado: ESTADO_CERRADA },
    })
  }
}
