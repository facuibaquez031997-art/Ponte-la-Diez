import { Injectable, NotFoundException } from '@nestjs/common'
import type {
  Alcance,
  Notificacion,
  Posicion,
  PushSubscription,
  RespuestaEstado,
} from '@prisma/client'
import { formatPesos, formatSlotLabel } from '../../common/format.js'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { acceptedContactIds } from '../contactos/contact-ids.js'
import type { SubscribePushDto } from './dto/subscribe-push.dto.js'
import { PushService } from './push.service.js'

const INBOX_PAGE_SIZE = 50
const CONVOCATORIAS_URL = '/convocatorias'
const CONTACTOS_URL = '/contactos'
const OWNER_RESERVAS_URL = '/dueno/reservas'
const PLAYER_RESERVAS_URL = '/reservas'
const MENSAJES_URL = '/mensajes'
const MESSAGE_PREVIEW_LENGTH = 80

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

  /** Tells the owner of the court that a booking was paid and is now confirmed. */
  async notifyBookingConfirmed(reservaId: string): Promise<void> {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id: reservaId },
      include: {
        user: true,
        pago: true,
        turno: {
          include: { cancha: { include: { owner: { include: { subscriptions: true } } } } },
        },
      },
    })
    if (!reserva || reserva.pago?.estadoPago !== 'APPROVED') return

    const { cancha } = reserva.turno
    const left = Math.max(reserva.montoTotal - reserva.pago.monto, 0)
    const paid =
      left === 0
        ? 'Pagó el total.'
        : `Pagó la seña de ${formatPesos(reserva.pago.monto)}; quedan ${formatPesos(left)} para cobrar en la cancha.`

    const titulo = 'Reserva confirmada'
    const cuerpo = `${reserva.user.nombre} reservó ${cancha.nombre} el ${formatSlotLabel(reserva.turno.fechaHoraInicio)}. ${paid}`

    await this.prisma.notificacion.createMany({
      data: [
        { userId: cancha.ownerId, reservaId: reserva.id, titulo, cuerpo, url: OWNER_RESERVAS_URL },
      ],
    })
    await this.sendPush(cancha.owner.subscriptions, titulo, cuerpo, OWNER_RESERVAS_URL)
  }

  /**
   * Tells the player that the owner cancelled their turn. The booking is already gone, so the
   * notification is not linked to it: it just opens "Mis reservas".
   */
  async notifyBookingCancelled(data: {
    jugadorId: string
    canchaNombre: string
    turnoInicio: Date
    montoPagado: number
    /** The refund was already made through Mercado Pago. */
    devuelta?: boolean
  }): Promise<void> {
    const jugador = await this.prisma.user.findUnique({
      where: { id: data.jugadorId },
      include: { subscriptions: true },
    })
    if (!jugador) return

    const refund =
      data.montoPagado > 0
        ? data.devuelta
          ? `Te devolvimos ${formatPesos(data.montoPagado)} por Mercado Pago.`
          : `Te corresponde la devolución de ${formatPesos(data.montoPagado)}: el dueño la va a coordinar con vos.`
        : 'No se te cobró nada.'
    const titulo = 'Turno cancelado'
    const cuerpo = `${data.canchaNombre} canceló tu turno del ${formatSlotLabel(data.turnoInicio)}. ${refund}`

    await this.prisma.notificacion.createMany({
      data: [{ userId: jugador.id, titulo, cuerpo, url: PLAYER_RESERVAS_URL }],
    })
    await this.sendPush(jugador.subscriptions, titulo, cuerpo, PLAYER_RESERVAS_URL)
  }

  /**
   * Tells the other participant about a new chat message. There is a single unread notification
   * per conversation: a burst of messages updates it instead of filling the inbox, and the push
   * goes out only when the notification is created.
   */
  async notifyNewMessage(conversacionId: string, autorId: string, texto: string): Promise<void> {
    const conversacion = await this.prisma.conversacion.findUnique({
      where: { id: conversacionId },
      include: {
        jugador: { include: { subscriptions: true } },
        cancha: { include: { owner: { include: { subscriptions: true } } } },
      },
    })
    if (!conversacion) return

    const authorIsPlayer = autorId === conversacion.jugadorId
    const autor = authorIsPlayer ? conversacion.jugador : conversacion.cancha.owner
    const destinatario = authorIsPlayer ? conversacion.cancha.owner : conversacion.jugador

    const titulo = `Mensaje de ${autor.nombre}`
    const cuerpo =
      texto.length > MESSAGE_PREVIEW_LENGTH ? `${texto.slice(0, MESSAGE_PREVIEW_LENGTH)}…` : texto
    const url = `${MENSAJES_URL}/${conversacionId}`

    const unread = await this.prisma.notificacion.findFirst({
      where: { userId: destinatario.id, conversacionId, leida: false },
      select: { id: true },
    })
    if (unread) {
      await this.prisma.notificacion.update({
        where: { id: unread.id },
        data: { titulo, cuerpo, createdAt: new Date() },
      })
      return
    }

    await this.prisma.notificacion.createMany({
      data: [{ userId: destinatario.id, conversacionId, titulo, cuerpo, url }],
    })
    await this.sendPush(destinatario.subscriptions, titulo, cuerpo, url)
  }

  /** The user opened the conversation, so its notification is no longer pending. */
  async markConversationRead(userId: string, conversacionId: string): Promise<void> {
    await this.prisma.notificacion.updateMany({
      where: { userId, conversacionId, leida: false },
      data: { leida: true },
    })
  }

  /**
   * Tells the player that their payment was approved but the space had just been confirmed for a
   * court that shares it, so the turn could not be kept and the refund is pending.
   */
  async notifyBookingSpaceTaken(data: {
    jugadorId: string
    canchaNombre: string
    turnoInicio: Date
    montoPagado: number
    /** The refund was already made through Mercado Pago. */
    devuelta?: boolean
  }): Promise<void> {
    const jugador = await this.prisma.user.findUnique({
      where: { id: data.jugadorId },
      include: { subscriptions: true },
    })
    if (!jugador) return

    const refund = data.devuelta
      ? `Te devolvimos ${formatPesos(data.montoPagado)} por Mercado Pago.`
      : `Te corresponde la devolución de ${formatPesos(data.montoPagado)}: el dueño la va a coordinar con vos.`
    const titulo = 'No pudimos confirmar tu turno'
    const cuerpo = `${data.canchaNombre}: el espacio del turno del ${formatSlotLabel(data.turnoInicio)} se confirmó para otra reserva justo antes que la tuya. ${refund}`

    await this.prisma.notificacion.createMany({
      data: [{ userId: jugador.id, titulo, cuerpo, url: PLAYER_RESERVAS_URL }],
    })
    await this.sendPush(jugador.subscriptions, titulo, cuerpo, PLAYER_RESERVAS_URL)
  }

  /**
   * Tells the owner that a booking was closed because the space had just been confirmed for a
   * court that shares it, and that they have a refund to make (the payment was already approved).
   */
  async notifyOwnerSpaceTaken(data: {
    ownerId: string
    jugadorId: string
    canchaNombre: string
    turnoInicio: Date
    montoPagado: number
    /** The refund was already made from the owner's Mercado Pago account. */
    devuelta?: boolean
  }): Promise<void> {
    const [owner, jugador] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: data.ownerId },
        include: { subscriptions: true },
      }),
      this.prisma.user.findUnique({ where: { id: data.jugadorId } }),
    ])
    if (!owner || !jugador) return

    const titulo = 'Reserva cerrada: espacio ocupado'
    const refund = data.devuelta
      ? 'Ya se lo devolvimos desde tu cuenta de Mercado Pago: quedó anotado en "Vencidas y canceladas".'
      : 'Tenés que devolverle ese monto: quedó anotado en "Vencidas y canceladas".'
    const cuerpo = `${jugador.nombre} pagó ${formatPesos(data.montoPagado)} por ${data.canchaNombre} el ${formatSlotLabel(data.turnoInicio)}, pero otra cancha que comparte el espacio se confirmó antes. ${refund}`

    await this.prisma.notificacion.createMany({
      data: [{ userId: owner.id, titulo, cuerpo, url: OWNER_RESERVAS_URL }],
    })
    await this.sendPush(owner.subscriptions, titulo, cuerpo, OWNER_RESERVAS_URL)
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
