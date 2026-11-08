import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import {
  Prisma,
  type Convocatoria,
  type RespuestaConvocatoria,
  type RespuestaEstado,
} from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import type { CreateConvocatoriaDto } from './dto/create-convocatoria.dto.js'

export type ConvocatoriaWithCreator = Convocatoria & {
  creador: { nombre: string; avatarUrl: string | null }
  respuestas: Array<{ estado: RespuestaEstado }>
}

export interface ConvocatoriaTeam {
  jugadoresFaltantes: number
  aceptados: Array<{ userId: string; nombre: string; avatarUrl: string | null }>
}

const ESTADO_ABIERTA = 'ABIERTA'
const ESTADO_CERRADA = 'CERRADA'
const ESTADO_CANCELADA = 'CANCELADA'

// Prisma codes: unique constraint violated / transaction conflict under Serializable isolation.
const CONFLICT_CODES = ['P2002', 'P2034']

const isConflictError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  typeof error.code === 'string' &&
  CONFLICT_CODES.includes(error.code)

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
        canchaNombre: dto.canchaNombre,
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

  async listForMyBarrio(userId: string): Promise<ConvocatoriaWithCreator[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user?.barrioPontevedra) return []

    return this.prisma.convocatoria.findMany({
      where: {
        estado: ESTADO_ABIERTA,
        alcance: 'BARRIO',
        fechaHora: { gte: new Date() },
        creador: { barrioPontevedra: user.barrioPontevedra },
      },
      include: {
        creador: { select: { nombre: true, avatarUrl: true } },
        respuestas: { where: { userId }, select: { estado: true } },
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

  async respond(
    userId: string,
    convocatoriaId: string,
    estado: RespuestaEstado
  ): Promise<RespuestaConvocatoria> {
    const respuesta = await this.saveResponse(userId, convocatoriaId, estado)

    this.notifications.notifyResponse(convocatoriaId, userId, estado).catch((error: unknown) => {
      this.logger.error(`Could not notify the answer to convocatoria ${convocatoriaId}`, error)
    })
    return respuesta
  }

  async getTeam(userId: string, id: string): Promise<ConvocatoriaTeam> {
    const convocatoria = await this.prisma.convocatoria.findUnique({ where: { id } })
    if (!convocatoria) throw new NotFoundException('Convocatoria no encontrada')

    const aceptadas = await this.prisma.respuestaConvocatoria.findMany({
      where: { convocatoriaId: id, estado: 'ACEPTADA' },
      include: { user: { select: { nombre: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const canSee =
      convocatoria.creadorId === userId ||
      aceptadas.some((respuesta) => respuesta.userId === userId)
    if (!canSee) {
      throw new ForbiddenException('Solo quien creó el aviso o aceptó puede ver el equipo')
    }

    return {
      jugadoresFaltantes: convocatoria.jugadoresFaltantes,
      aceptados: aceptadas.map((respuesta) => ({
        userId: respuesta.userId,
        nombre: respuesta.user.nombre,
        avatarUrl: respuesta.user.avatarUrl,
      })),
    }
  }

  async cancel(userId: string, id: string): Promise<Convocatoria> {
    const convocatoria = await this.prisma.convocatoria.findUnique({ where: { id } })
    if (!convocatoria) throw new NotFoundException('Convocatoria no encontrada')
    if (convocatoria.creadorId !== userId) {
      throw new ForbiddenException('Solo quien creó la convocatoria puede cancelarla')
    }
    if (convocatoria.estado !== ESTADO_ABIERTA) {
      throw new ConflictException('Solo se puede cancelar un partido abierto')
    }

    const cancelled = await this.prisma.convocatoria.update({
      where: { id },
      data: { estado: ESTADO_CANCELADA },
    })

    // The match is already cancelled: a failed notification must not turn that into an error.
    await this.notifications.notifyCancelled(id).catch((error: unknown) => {
      this.logger.error(`Could not notify the cancellation of convocatoria ${id}`, error)
    })
    return cancelled
  }

  private async saveResponse(
    userId: string,
    convocatoriaId: string,
    estado: RespuestaEstado
  ): Promise<RespuestaConvocatoria> {
    try {
      // Serializable: two players accepting the last slot at once must not both get in.
      return await this.prisma.$transaction(
        async (tx) => {
          const convocatoria = await tx.convocatoria.findUnique({
            where: { id: convocatoriaId },
            include: { creador: { select: { barrioPontevedra: true } } },
          })
          if (!convocatoria) throw new NotFoundException('Convocatoria no encontrada')
          if (convocatoria.creadorId === userId) {
            throw new ForbiddenException('No podés responder a tu propio aviso')
          }

          const user = await tx.user.findUnique({ where: { id: userId } })
          if (
            !user?.barrioPontevedra ||
            user.barrioPontevedra !== convocatoria.creador.barrioPontevedra
          ) {
            throw new ForbiddenException('Este aviso es para jugadores de otro barrio')
          }
          if (
            convocatoria.estado !== ESTADO_ABIERTA ||
            convocatoria.fechaHora.getTime() <= Date.now()
          ) {
            throw new ConflictException('Este aviso ya no está abierto')
          }

          const previous = await tx.respuestaConvocatoria.findUnique({
            where: { convocatoriaId_userId: { convocatoriaId, userId } },
          })
          if (previous) throw new ConflictException('Ya respondiste a este aviso')

          if (estado === 'ACEPTADA') {
            const accepted = await tx.respuestaConvocatoria.count({
              where: { convocatoriaId, estado: 'ACEPTADA' },
            })
            if (accepted >= convocatoria.jugadoresFaltantes) {
              throw new ConflictException('El equipo ya está completo')
            }
          }

          return tx.respuestaConvocatoria.create({ data: { convocatoriaId, userId, estado } })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (error) {
      if (isConflictError(error)) {
        throw new ConflictException('No pudimos registrar tu respuesta. Intentá de nuevo.')
      }
      throw error
    }
  }

  async close(userId: string, id: string): Promise<Convocatoria> {
    const convocatoria = await this.prisma.convocatoria.findUnique({ where: { id } })
    if (!convocatoria) throw new NotFoundException('Convocatoria no encontrada')
    if (convocatoria.creadorId !== userId) {
      throw new ForbiddenException('Solo quien creó la convocatoria puede cerrarla')
    }

    const closed = await this.prisma.convocatoria.update({
      where: { id },
      data: { estado: ESTADO_CERRADA },
    })

    // The call is already closed: a failed cleanup must not turn that into an error.
    await this.notifications.clearForConvocatoria(id).catch((error: unknown) => {
      this.logger.error(`Could not clear notifications of convocatoria ${id}`, error)
    })
    return closed
  }
}
