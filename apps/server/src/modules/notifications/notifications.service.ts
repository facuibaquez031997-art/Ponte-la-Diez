import { Injectable, NotFoundException } from '@nestjs/common'
import type {
  Alcance,
  Notificacion,
  Posicion,
  PushSubscription,
  RespuestaEstado,
} from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { acceptedContactIds } from '../contactos/contact-ids.js'
import type { SubscribePushDto } from './dto/subscribe-push.dto.js'
import { PushService } from './push.service.js'

const INBOX_PAGE_SIZE = 50
const CONVOCATORIAS_URL = '/convocatorias'
const CONTACTOS_URL = '/contactos'

const POSICION_LABEL: Record<Posicion, string> = {
  ARQUERO: 'arquero',
  DEFENSOR: 'defensor',
  MEDIOCAMPISTA: 'mediocampista',
  DELANTERO: 'delantero',
  TODOS: 'jugador',
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
    if (!convocatoria) return

    const recipients = await this.findAudience(convocatoria)
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

    await this.sendPush(
      recipients.flatMap((user) => user.subscriptions),
      titulo,
      cuerpo
    )
  }

  async notifyResponse(
    convocatoriaId: string,
    responderId: string,
    estado: RespuestaEstado
  ): Promise<void> {
    const [convocatoria, responder] = await Promise.all([
      this.prisma.convocatoria.findUnique({
        where: { id: convocatoriaId },
        include: { creador: { include: { subscriptions: true } } },
      }),
      this.prisma.user.findUnique({ where: { id: responderId } }),
    ])
    if (!convocatoria || !responder) return

    const titulo =
      estado === 'ACEPTADA' ? `${responder.nombre} aceptó` : `${responder.nombre} no aceptó`
    const cuerpo = `Tu aviso: falta un ${POSICION_LABEL[convocatoria.posicion]}`

    await this.prisma.notificacion.createMany({
      data: [{ userId: convocatoria.creadorId, convocatoriaId, titulo, cuerpo }],
    })
    await this.sendPush(convocatoria.creador.subscriptions, titulo, cuerpo)
  }

  async notifyCancelled(convocatoriaId: string): Promise<void> {
    const convocatoria = await this.prisma.convocatoria.findUnique({
      where: { id: convocatoriaId },
      include: {
        creador: true,
        cancha: true,
        respuestas: {
          where: { estado: 'ACEPTADA' },
          include: { user: { include: { subscriptions: true } } },
        },
      },
    })
    if (!convocatoria) return

    // The barrio no longer needs the invitation, and the creator's answers inbox is moot too.
    await this.clearForConvocatoria(convocatoriaId)

    const players = convocatoria.respuestas.map((respuesta) => respuesta.user)
    if (players.length === 0) return

    const titulo = 'Partido cancelado'
    const cuerpo = `${convocatoria.creador.nombre} canceló el partido${this.courtLabel(convocatoria)}`

    await this.prisma.notificacion.createMany({
      data: players.map((user) => ({ userId: user.id, convocatoriaId, titulo, cuerpo })),
    })
    await this.sendPush(
      players.flatMap((user) => user.subscriptions),
      titulo,
      cuerpo
    )
  }

  async notifyContactRequest(contactoId: string): Promise<void> {
    const contacto = await this.findContact(contactoId)
    if (!contacto) return

    const titulo = `${contacto.solicitante.nombre} quiere ser tu contacto`
    const cuerpo = 'Aceptá o rechazá la solicitud desde Contactos.'

    await this.prisma.notificacion.createMany({
      data: [{ userId: contacto.destinatarioId, titulo, cuerpo }],
    })
    await this.sendPush(contacto.destinatario.subscriptions, titulo, cuerpo, CONTACTOS_URL)
  }

  async notifyContactAccepted(contactoId: string): Promise<void> {
    const contacto = await this.findContact(contactoId)
    if (!contacto) return

    const titulo = `${contacto.destinatario.nombre} aceptó tu solicitud`
    const cuerpo = 'Ya son contactos: podés avisarle cuando te falte uno.'

    await this.prisma.notificacion.createMany({
      data: [{ userId: contacto.solicitanteId, titulo, cuerpo }],
    })
    await this.sendPush(contacto.solicitante.subscriptions, titulo, cuerpo, CONTACTOS_URL)
  }

  private async findAudience(convocatoria: {
    alcance: Alcance
    creadorId: string
    creador: { barrioPontevedra: string | null }
  }) {
    if (convocatoria.alcance === 'CONTACTOS') {
      const contactIds = await acceptedContactIds(this.prisma, convocatoria.creadorId)
      if (contactIds.length === 0) return []
      return this.prisma.user.findMany({
        where: { id: { in: contactIds } },
        include: { subscriptions: true },
      })
    }

    const barrio = convocatoria.creador.barrioPontevedra
    if (!barrio) return []
    return this.prisma.user.findMany({
      where: { barrioPontevedra: barrio, id: { not: convocatoria.creadorId } },
      include: { subscriptions: true },
    })
  }

  private findContact(contactoId: string) {
    return this.prisma.contacto.findUnique({
      where: { id: contactoId },
      include: {
        solicitante: { include: { subscriptions: true } },
        destinatario: { include: { subscriptions: true } },
      },
    })
  }

  private async sendPush(
    targets: PushSubscription[],
    titulo: string,
    cuerpo: string,
    url: string = CONVOCATORIAS_URL
  ): Promise<void> {
    const results = await Promise.all(
      targets.map((target) => this.push.send(target, { title: titulo, body: cuerpo, url }))
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

  async clearForConvocatoria(convocatoriaId: string): Promise<void> {
    await this.prisma.notificacion.deleteMany({ where: { convocatoriaId } })
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notificacion.updateMany({
      where: { userId, leida: false },
      data: { leida: true },
    })
  }

  private courtLabel(convocatoria: {
    cancha: { nombre: string } | null
    canchaNombre: string | null
  }): string {
    const nombreCancha = convocatoria.cancha?.nombre ?? convocatoria.canchaNombre
    return nombreCancha ? ` en ${nombreCancha}` : ''
  }

  private buildBody(convocatoria: {
    mensaje: string | null
    creador: { nombre: string }
    cancha: { nombre: string } | null
    canchaNombre: string | null
  }): string {
    const detalle = convocatoria.mensaje ? ` · ${convocatoria.mensaje}` : ''
    return `${convocatoria.creador.nombre} busca jugador${this.courtLabel(convocatoria)}${detalle}`
  }
}
