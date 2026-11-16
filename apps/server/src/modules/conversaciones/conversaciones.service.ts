import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { ReservaState } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import { releaseExpiredHolds } from '../reservas/holds.js'
import type { CreateConversacionDto } from './dto/create-conversacion.dto.js'
import { PresenceService } from './presence.service.js'
import { MAX_MENSAJE_LENGTH } from './dto/send-mensaje.dto.js'

const MAX_MESSAGES_PER_MINUTE = 20
const MINUTE_MS = 60_000
const THREAD_PAGE_SIZE = 50
const INBOX_PAGE_SIZE = 50
// The "hidden" rule is checked in memory (it compares two columns), so read a bit more than a page.
const INBOX_FETCH_SIZE = 200

type Side = 'jugador' | 'dueno'

const conversacionInclude = {
  cancha: {
    select: {
      id: true,
      nombre: true,
      barrio: true,
      precioHora: true,
      montoSena: true,
      jugadores: true,
      ownerId: true,
      owner: { select: { nombre: true, avatarUrl: true } },
    },
  },
  jugador: { select: { nombre: true, avatarUrl: true } },
  reserva: {
    select: {
      estado: true,
      montoTotal: true,
      pago: { select: { estadoPago: true, monto: true } },
    },
  },
} as const

type StoredConversacion = {
  id: string
  reservaId: string | null
  jugadorId: string
  turnoInicio: Date | null
  jugadorLeyoHasta: Date | null
  duenoLeyoHasta: Date | null
  jugadorEliminoAt: Date | null
  duenoEliminoAt: Date | null
  ultimoMensajeAt: Date | null
  cancha: {
    id: string
    nombre: string
    barrio: string
    precioHora: number
    montoSena: number
    jugadores: number | null
    ownerId: string
    owner: { nombre: string; avatarUrl: string | null }
  }
  jugador: { nombre: string; avatarUrl: string | null }
  reserva: {
    estado: ReservaState
    montoTotal: number
    pago: { estadoPago: string; monto: number } | null
  } | null
}

export interface TurnoBanner {
  fechaHoraInicio: Date
  /** Null when the booking was released: the slot is free again. */
  estado: ReservaState | null
  liberado: boolean
  montoPagado: number
  montoRestante: number
}

interface Participant {
  nombre: string
  avatarUrl: string | null
  /** The app is open for this person right now. */
  conectado: boolean
}

/** What the open thread asks every couple of seconds, much lighter than reading the messages. */
export interface PulsoView {
  conectado: boolean
  escribiendo: boolean
  /** When the last message arrived: a change tells the thread to read the new ones. */
  ultimoMensajeAt: Date | null
}

export interface ConversacionView {
  id: string
  /** The other person of the conversation. */
  otro: Participant
  cancha: { id: string; nombre: string; jugadores: number | null }
  turno: TurnoBanner | null
  ultimoMensaje: { cuerpo: string; createdAt: Date; propio: boolean } | null
  noLeidos: number
  /** The other person is typing in this conversation right now. */
  escribiendo: boolean
}

/** A slot the owner offered in a message, with whether the player can still book it. */
export interface OfertaView {
  turnoId: string
  fechaHoraInicio: Date
  /** Still free and in the future. A booked, expired or deleted slot is not available anymore. */
  disponible: boolean
  cancha: {
    id: string
    nombre: string
    barrio: string
    precioHora: number
    montoSena: number
    jugadores: number | null
  }
}

/** A court at an hour, whichever of its slots (one per court of the entry) is meant. */
const hourKey = (canchaId: string, start: Date): string => `${canchaId}#${start.getTime()}`

const toOfertaCancha = (court: {
  id: string
  nombre: string
  barrio: string
  precioHora: number
  montoSena: number
  jugadores: number | null
}): OfertaView['cancha'] => ({
  id: court.id,
  nombre: court.nombre,
  barrio: court.barrio,
  precioHora: court.precioHora,
  montoSena: court.montoSena,
  jugadores: court.jugadores,
})

export interface MensajeView {
  id: string
  cuerpo: string
  createdAt: Date
  propio: boolean
  oferta: OfertaView | null
}

interface StoredMensaje {
  id: string
  autorId: string
  cuerpo: string
  createdAt: Date
  ofertaTurnoId: string | null
  ofertaInicio: Date | null
  ofertaCanchaId: string | null
}

export interface ThreadView {
  conversacion: Omit<ConversacionView, 'ultimoMensaje' | 'noLeidos' | 'escribiendo'>
  mensajes: MensajeView[]
  hayMas: boolean
}

@Injectable()
export class ConversacionesService {
  private readonly logger = new Logger(ConversacionesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly presence: PresenceService
  ) {}

  /**
   * Only the player starts a conversation, with or without a booking. Asking again returns the
   * one that already exists instead of creating a second thread.
   */
  async create(userId: string, dto: CreateConversacionDto): Promise<{ id: string }> {
    const cancha = await this.prisma.cancha.findUnique({
      where: { id: dto.canchaId },
      select: { id: true },
    })
    if (!cancha) throw new NotFoundException('Cancha no encontrada')

    if (dto.reservaId) {
      const reserva = await this.prisma.reserva.findUnique({
        where: { id: dto.reservaId },
        select: { userId: true, turno: { select: { canchaId: true, fechaHoraInicio: true } } },
      })
      if (!reserva || reserva.userId !== userId || reserva.turno.canchaId !== dto.canchaId) {
        throw new NotFoundException('Reserva no encontrada')
      }
      const conversacion = await this.prisma.conversacion.upsert({
        where: { reservaId: dto.reservaId },
        update: {},
        create: {
          reservaId: dto.reservaId,
          canchaId: dto.canchaId,
          jugadorId: userId,
          turnoInicio: reserva.turno.fechaHoraInicio,
        },
        select: { id: true },
      })
      return conversacion
    }

    const existing = await this.prisma.conversacion.findFirst({
      where: { jugadorId: userId, canchaId: dto.canchaId, reservaId: null },
      select: { id: true },
    })
    if (existing) return existing

    return this.prisma.conversacion.create({
      data: { canchaId: dto.canchaId, jugadorId: userId },
      select: { id: true },
    })
  }

  async list(userId: string): Promise<ConversacionView[]> {
    const rows = await this.prisma.conversacion.findMany({
      where: {
        ultimoMensajeAt: { not: null },
        OR: [{ jugadorId: userId }, { cancha: { ownerId: userId } }],
      },
      include: conversacionInclude,
      orderBy: { ultimoMensajeAt: 'desc' },
      take: INBOX_FETCH_SIZE,
    })

    // Nobody loses a chat by deleting it: deleting only empties its content for whoever did it.
    const visible = rows.flatMap((row) => {
      const side = this.sideOf(row, userId)
      return side ? [{ row, side }] : []
    })

    return Promise.all(
      visible.slice(0, INBOX_PAGE_SIZE).map(({ row, side }) => this.toView(row, userId, side))
    )
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const conversaciones = await this.list(userId)
    return { count: conversaciones.reduce((total, c) => total + c.noLeidos, 0) }
  }

  async thread(userId: string, id: string, before?: Date): Promise<ThreadView> {
    const { conversacion, side } = await this.findParticipating(userId, id)
    const since = this.eliminoAt(conversacion, side)

    const range = { ...(since && { gt: since }), ...(before && { lt: before }) }
    const rows = await this.prisma.mensaje.findMany({
      where: {
        conversacionId: id,
        ...(Object.keys(range).length > 0 && { createdAt: range }),
      },
      orderBy: { createdAt: 'desc' },
      take: THREAD_PAGE_SIZE + 1,
    })

    const hayMas = rows.length > THREAD_PAGE_SIZE
    const page = rows.slice(0, THREAD_PAGE_SIZE).reverse()
    return {
      conversacion: this.header(conversacion, side),
      mensajes: await this.toMensajeViews(page, userId, conversacion.cancha),
      hayMas,
    }
  }

  /**
   * `ofertaTurnoId` attaches a slot to the message so the player can book it from the chat. Only
   * the owner offers, and only a free, future slot of any of their courts.
   */
  async send(
    userId: string,
    id: string,
    cuerpo: string,
    ofertaTurnoId?: string
  ): Promise<MensajeView> {
    const { conversacion, side } = await this.findParticipating(userId, id)

    const text = cuerpo.trim()
    if (text.length === 0) throw new BadRequestException('El mensaje no puede estar vacío')
    if (text.length > MAX_MENSAJE_LENGTH) {
      throw new BadRequestException(
        `El mensaje no puede superar los ${MAX_MENSAJE_LENGTH} caracteres`
      )
    }

    const oferta = ofertaTurnoId
      ? await this.validateOffer(side, conversacion.cancha.ownerId, ofertaTurnoId)
      : undefined

    const recent = await this.prisma.mensaje.count({
      where: { autorId: userId, createdAt: { gt: new Date(Date.now() - MINUTE_MS) } },
    })
    if (recent >= MAX_MESSAGES_PER_MINUTE) {
      throw new HttpException(
        'Estás enviando mensajes muy rápido. Esperá un momento.',
        HttpStatus.TOO_MANY_REQUESTS
      )
    }

    const mensaje = await this.prisma.mensaje.create({
      data: { conversacionId: id, autorId: userId, cuerpo: text, ...oferta },
    })
    // The author has obviously read everything up to their own message.
    await this.prisma.conversacion.update({
      where: { id },
      data: {
        ultimoMensajeAt: mensaje.createdAt,
        ...(side === 'jugador'
          ? { jugadorLeyoHasta: mensaje.createdAt }
          : { duenoLeyoHasta: mensaje.createdAt }),
      },
    })
    // The message is already saved: a failed notification must not make the send look failed.
    await this.notifications.notifyNewMessage(id, userId, text).catch((error: unknown) => {
      this.logger.warn(`Could not notify the new message of ${id}: ${String(error)}`)
    })
    // Sending ends the "Escribiendo...": the message itself is what the other side sees now.
    this.presence.stopTyping(id, userId)
    const [view] = await this.toMensajeViews([mensaje], userId, conversacion.cancha)
    return view
  }

  /** The app is open for this user. */
  heartbeat(userId: string): void {
    this.presence.beat(userId)
  }

  /** The user is typing in this conversation: the other side shows "Escribiendo...". */
  async typing(userId: string, id: string): Promise<void> {
    await this.findParticipating(userId, id)
    this.presence.typing(id, userId)
  }

  /**
   * A light look at an open conversation: is the other person connected, are they typing, and did
   * a message arrive. Asking also tells the server that this user is here.
   */
  async pulse(userId: string, id: string): Promise<PulsoView> {
    const { conversacion, side } = await this.findParticipating(userId, id)
    this.presence.beat(userId)
    const other = this.otherId(conversacion, side)
    return {
      conectado: this.presence.isOnline(other),
      escribiendo: this.presence.isTyping(id, other),
      ultimoMensajeAt: conversacion.ultimoMensajeAt,
    }
  }

  private async validateOffer(
    side: Side,
    ownerId: string,
    turnoId: string
  ): Promise<{ ofertaTurnoId: string; ofertaInicio: Date; ofertaCanchaId: string }> {
    if (side !== 'dueno') {
      throw new BadRequestException('Solo el dueño puede ofrecer un horario')
    }
    const now = new Date()
    // A booking nobody paid blocks its slot until released: free it before judging the slot.
    await releaseExpiredHolds(this.prisma, now, { ownerId })
    const turno = await this.prisma.turno.findUnique({
      where: { id: turnoId },
      select: {
        canchaId: true,
        estado: true,
        fechaHoraInicio: true,
        cancha: { select: { ownerId: true } },
      },
    })
    // Any court of the owner can be offered (an inquiry about a 5 may be answered with a 7), but
    // never the court of somebody else.
    if (
      !turno ||
      turno.cancha.ownerId !== ownerId ||
      turno.estado !== 'FREE' ||
      turno.fechaHoraInicio <= now
    ) {
      throw new BadRequestException('Ese horario ya no está disponible')
    }
    return {
      ofertaTurnoId: turnoId,
      ofertaInicio: turno.fechaHoraInicio,
      ofertaCanchaId: turno.canchaId,
    }
  }

  /** Messages as the user sees them, with each offer checked against the slot as it is right now. */
  private async toMensajeViews(
    rows: StoredMensaje[],
    userId: string,
    cancha: StoredConversacion['cancha']
  ): Promise<MensajeView[]> {
    const now = new Date()
    const offered = rows.filter(
      (row): row is StoredMensaje & { ofertaTurnoId: string; ofertaInicio: Date } =>
        row.ofertaTurnoId !== null && row.ofertaInicio !== null
    )

    // The courts the offers belong to. Offers made before the owner could offer other courts have
    // no court of their own: they belong to the court of the conversation.
    const courts = new Map<string, OfertaView['cancha']>([[cancha.id, toOfertaCancha(cancha)]])
    const others = [
      ...new Set(offered.map((row) => row.ofertaCanchaId).filter((id) => id && !courts.has(id))),
    ] as string[]
    if (others.length > 0) {
      const found = await this.prisma.cancha.findMany({
        where: { id: { in: others } },
        select: {
          id: true,
          nombre: true,
          barrio: true,
          precioHora: true,
          montoSena: true,
          jugadores: true,
        },
      })
      for (const court of found) courts.set(court.id, toOfertaCancha(court))
    }

    // An offer is about a court and an hour: it stays bookable while any court of that hour is
    // free (an entry with two courts has two slots at the same hour).
    let free = new Set<string>()
    const upcoming = offered.filter((row) => row.ofertaInicio > now)
    if (upcoming.length > 0) {
      await releaseExpiredHolds(this.prisma, now, { ownerId: cancha.ownerId })
      const turnos = await this.prisma.turno.findMany({
        where: {
          estado: 'FREE',
          fechaHoraInicio: { gt: now },
          OR: upcoming.map((row) => ({
            canchaId: row.ofertaCanchaId ?? cancha.id,
            fechaHoraInicio: row.ofertaInicio,
          })),
        },
        select: { canchaId: true, fechaHoraInicio: true },
      })
      free = new Set(turnos.map((turno) => hourKey(turno.canchaId, turno.fechaHoraInicio)))
    }

    return rows.map((row) => {
      const court = courts.get(row.ofertaCanchaId ?? cancha.id)
      return {
        id: row.id,
        cuerpo: row.cuerpo,
        createdAt: row.createdAt,
        propio: row.autorId === userId,
        oferta:
          row.ofertaTurnoId && row.ofertaInicio && court
            ? {
                turnoId: row.ofertaTurnoId,
                fechaHoraInicio: row.ofertaInicio,
                disponible: free.has(hourKey(row.ofertaCanchaId ?? cancha.id, row.ofertaInicio)),
                cancha: court,
              }
            : null,
      }
    })
  }

  async markRead(userId: string, id: string): Promise<void> {
    const { side } = await this.findParticipating(userId, id)
    const now = new Date()
    await this.prisma.conversacion.update({
      where: { id },
      data: side === 'jugador' ? { jugadorLeyoHasta: now } : { duenoLeyoHasta: now },
    })
    await this.notifications.markConversationRead(userId, id)
  }

  /** Deleting is individual: it only empties the chat for whoever deletes it, it never leaves their inbox. */
  async remove(userId: string, id: string): Promise<void> {
    const { side } = await this.findParticipating(userId, id)
    const now = new Date()
    await this.prisma.conversacion.update({
      where: { id },
      data: side === 'jugador' ? { jugadorEliminoAt: now } : { duenoEliminoAt: now },
    })
  }

  /** A stranger gets 404, not 403, so the existence of the conversation is not revealed. */
  private async findParticipating(
    userId: string,
    id: string
  ): Promise<{ conversacion: StoredConversacion; side: Side }> {
    const conversacion = await this.prisma.conversacion.findUnique({
      where: { id },
      include: conversacionInclude,
    })
    const side = conversacion ? this.sideOf(conversacion, userId) : null
    if (!conversacion || !side) throw new NotFoundException('Conversación no encontrada')
    return { conversacion, side }
  }

  /** Which participant the user is, or null when they are neither the player nor the owner. */
  private sideOf(conversacion: StoredConversacion, userId: string): Side | null {
    if (conversacion.jugadorId === userId) return 'jugador'
    if (conversacion.cancha.ownerId === userId) return 'dueno'
    return null
  }

  private eliminoAt(conversacion: StoredConversacion, side: Side): Date | null {
    return side === 'jugador' ? conversacion.jugadorEliminoAt : conversacion.duenoEliminoAt
  }

  private leyoHasta(conversacion: StoredConversacion, side: Side): Date | null {
    return side === 'jugador' ? conversacion.jugadorLeyoHasta : conversacion.duenoLeyoHasta
  }

  /** The other person of the conversation: the owner for the player, the player for the owner. */
  private otherId(conversacion: StoredConversacion, side: Side): string {
    return side === 'jugador' ? conversacion.cancha.ownerId : conversacion.jugadorId
  }

  private header(conversacion: StoredConversacion, side: Side): ThreadView['conversacion'] {
    const otro = side === 'jugador' ? conversacion.cancha.owner : conversacion.jugador
    return {
      id: conversacion.id,
      otro: {
        nombre: otro.nombre,
        avatarUrl: otro.avatarUrl,
        conectado: this.presence.isOnline(this.otherId(conversacion, side)),
      },
      cancha: {
        id: conversacion.cancha.id,
        nombre: conversacion.cancha.nombre,
        jugadores: conversacion.cancha.jugadores,
      },
      turno: this.banner(conversacion),
    }
  }

  private banner(conversacion: StoredConversacion): TurnoBanner | null {
    const { reserva, turnoInicio } = conversacion
    if (!turnoInicio) return null
    if (!reserva) {
      return {
        fechaHoraInicio: turnoInicio,
        estado: null,
        liberado: true,
        montoPagado: 0,
        montoRestante: 0,
      }
    }
    const montoPagado = reserva.pago?.estadoPago === 'APPROVED' ? reserva.pago.monto : 0
    return {
      fechaHoraInicio: turnoInicio,
      estado: reserva.estado,
      liberado: false,
      montoPagado,
      montoRestante: Math.max(reserva.montoTotal - montoPagado, 0),
    }
  }

  private async toView(
    conversacion: StoredConversacion,
    userId: string,
    side: Side
  ): Promise<ConversacionView> {
    const eliminoAt = this.eliminoAt(conversacion, side)
    // Only what arrived after the last time I read and after the last time I deleted counts.
    const marks = [this.leyoHasta(conversacion, side), eliminoAt].filter(
      (date): date is Date => date !== null
    )
    const after = marks.length > 0 ? new Date(Math.max(...marks.map((d) => d.getTime()))) : null

    const [ultimo, noLeidos] = await Promise.all([
      this.prisma.mensaje.findFirst({
        where: {
          conversacionId: conversacion.id,
          ...(eliminoAt && { createdAt: { gt: eliminoAt } }),
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mensaje.count({
        where: {
          conversacionId: conversacion.id,
          autorId: { not: userId },
          ...(after && { createdAt: { gt: after } }),
        },
      }),
    ])

    return {
      ...this.header(conversacion, side),
      ultimoMensaje: ultimo
        ? { cuerpo: ultimo.cuerpo, createdAt: ultimo.createdAt, propio: ultimo.autorId === userId }
        : null,
      noLeidos,
      escribiendo: this.presence.isTyping(conversacion.id, this.otherId(conversacion, side)),
    }
  }
}
