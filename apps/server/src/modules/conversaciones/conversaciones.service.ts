import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { ReservaState } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import type { CreateConversacionDto } from './dto/create-conversacion.dto.js'
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
}

export interface ConversacionView {
  id: string
  /** The other person of the conversation. */
  otro: Participant
  cancha: { id: string; nombre: string }
  turno: TurnoBanner | null
  ultimoMensaje: { cuerpo: string; createdAt: Date; propio: boolean } | null
  noLeidos: number
}

export interface MensajeView {
  id: string
  cuerpo: string
  createdAt: Date
  propio: boolean
}

export interface ThreadView {
  conversacion: Omit<ConversacionView, 'ultimoMensaje' | 'noLeidos'>
  mensajes: MensajeView[]
  hayMas: boolean
}

@Injectable()
export class ConversacionesService {
  constructor(private readonly prisma: PrismaService) {}

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

    const visible = rows.flatMap((row) => {
      const side = this.sideOf(row, userId)
      return side && !this.isHidden(row, side) ? [{ row, side }] : []
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
      mensajes: page.map((m) => ({
        id: m.id,
        cuerpo: m.cuerpo,
        createdAt: m.createdAt,
        propio: m.autorId === userId,
      })),
      hayMas,
    }
  }

  async send(userId: string, id: string, cuerpo: string): Promise<MensajeView> {
    const { side } = await this.findParticipating(userId, id)

    const text = cuerpo.trim()
    if (text.length === 0) throw new BadRequestException('El mensaje no puede estar vacío')
    if (text.length > MAX_MENSAJE_LENGTH) {
      throw new BadRequestException(
        `El mensaje no puede superar los ${MAX_MENSAJE_LENGTH} caracteres`
      )
    }

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
      data: { conversacionId: id, autorId: userId, cuerpo: text },
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
    return { id: mensaje.id, cuerpo: mensaje.cuerpo, createdAt: mensaje.createdAt, propio: true }
  }

  async markRead(userId: string, id: string): Promise<void> {
    const { side } = await this.findParticipating(userId, id)
    const now = new Date()
    await this.prisma.conversacion.update({
      where: { id },
      data: side === 'jugador' ? { jugadorLeyoHasta: now } : { duenoLeyoHasta: now },
    })
  }

  /** Deleting is individual: it only hides the chat from the inbox of whoever deletes it. */
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

  /** Hidden while nothing newer than the deletion arrived. */
  private isHidden(conversacion: StoredConversacion, side: Side): boolean {
    const eliminoAt = this.eliminoAt(conversacion, side)
    if (!eliminoAt) return false
    return !conversacion.ultimoMensajeAt || conversacion.ultimoMensajeAt <= eliminoAt
  }

  private header(conversacion: StoredConversacion, side: Side): ThreadView['conversacion'] {
    const otro = side === 'jugador' ? conversacion.cancha.owner : conversacion.jugador
    return {
      id: conversacion.id,
      otro: { nombre: otro.nombre, avatarUrl: otro.avatarUrl },
      cancha: { id: conversacion.cancha.id, nombre: conversacion.cancha.nombre },
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
    // Only what arrived after the last time I read and after the last time I deleted counts.
    const marks = [this.leyoHasta(conversacion, side), this.eliminoAt(conversacion, side)].filter(
      (date): date is Date => date !== null
    )
    const after = marks.length > 0 ? new Date(Math.max(...marks.map((d) => d.getTime()))) : null

    const [ultimo, noLeidos] = await Promise.all([
      this.prisma.mensaje.findFirst({
        where: { conversacionId: conversacion.id },
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
    }
  }
}
