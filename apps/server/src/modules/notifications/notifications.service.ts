import { Injectable, NotFoundException } from '@nestjs/common'
import type { Notificacion, Posicion } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import type { SubscribePushDto } from './dto/subscribe-push.dto.js'
import { PushService } from './push.service.js'

const INBOX_PAGE_SIZE = 50
const CONVOCATORIAS_URL = '/convocatorias'

const POSICION_LABEL: Record<Posicion, string> = {
  ARQUERO: 'arquero',
  DEFENSOR: 'defensor',
  MEDIOCAMPISTA: 'mediocampista',
  DELANTERO: 'delantero',
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService
  ) {}

  async notifyNewConvocatoria(convocatoriaId: string): Promise<void> {
    const convocatoria = await this.prisma.convocatoria.findUnique({
      where: { id: convocatoriaId },
      include: { creador: true, cancha: true },
    })
    const barrio = convocatoria?.creador.barrioPontevedra
    if (!convocatoria || !barrio) return

    const recipients = await this.prisma.user.findMany({
      where: { barrioPontevedra: barrio, id: { not: convocatoria.creadorId } },
      include: { subscriptions: true },
    })
    if (recipients.length === 0) return

    const titulo = `Falta un ${POSICION_LABEL[convocatoria.posicion]}`
    const cuerpo = this.buildBody(convocatoria)

    await this.prisma.notificacion.createMany({
      data: recipients.map((user) => ({
        userId: user.id,
        convocatoriaId: convocatoria.id,
        titulo,
        cuerpo,
      })),
    })

    const targets = recipients.flatMap((user) => user.subscriptions)
    const results = await Promise.all(
      targets.map((target) =>
        this.push.send(target, { title: titulo, body: cuerpo, url: CONVOCATORIAS_URL })
      )
    )

    const gone = targets.filter((_, index) => results[index] === 'gone').map((t) => t.endpoint)
    if (gone.length > 0) {
      await this.prisma.pushSubscription.deleteMany({ where: { endpoint: { in: gone } } })
    }
  }

  async subscribe(userId: string, dto: SubscribePushDto): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        keysP256: dto.keys.p256dh,
        keysAuth: dto.keys.auth,
      },
      update: { userId, keysP256: dto.keys.p256dh, keysAuth: dto.keys.auth },
    })
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
  }

  list(userId: string): Promise<Notificacion[]> {
    return this.prisma.notificacion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: INBOX_PAGE_SIZE,
    })
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notificacion.count({ where: { userId, leida: false } })
    return { count }
  }

  async markRead(userId: string, id: string): Promise<void> {
    const notificacion = await this.prisma.notificacion.findUnique({ where: { id } })
    if (!notificacion || notificacion.userId !== userId) {
      throw new NotFoundException('Notificación no encontrada')
    }
    await this.prisma.notificacion.update({ where: { id }, data: { leida: true } })
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notificacion.updateMany({
      where: { userId, leida: false },
      data: { leida: true },
    })
  }

  private buildBody(convocatoria: {
    mensaje: string | null
    creador: { nombre: string }
    cancha: { nombre: string } | null
  }): string {
    const lugar = convocatoria.cancha ? ` en ${convocatoria.cancha.nombre}` : ''
    const detalle = convocatoria.mensaje ? ` · ${convocatoria.mensaje}` : ''
    return `${convocatoria.creador.nombre} busca jugador${lugar}${detalle}`
  }
}
