import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { NotificationsService } from '../notifications/notifications.service.js'

export interface ContactUser {
  id: string
  nombre: string
  avatarUrl: string | null
}

export interface ContactEntry {
  id: string
  usuario: ContactUser
}

export interface ContactsOverview {
  contactos: ContactEntry[]
  recibidas: ContactEntry[]
  enviadas: ContactEntry[]
}

export interface ContactSearchResult extends ContactUser {
  barrioPontevedra: string | null
}

const SEARCH_MIN_LENGTH = 3
const SEARCH_MAX_RESULTS = 10
// Prisma hands `contains` to LIKE as is, so `%` and `_` would act as wildcards and skip the
// minimum length ("%%%" matches everybody).
const escapeLikePattern = (text: string): string => text.replace(/[\\%_]/g, '\\$&')

const PUBLIC_USER = { id: true, nombre: true, avatarUrl: true } as const
const ESTADO_PENDIENTE = 'PENDIENTE'
const ESTADO_ACEPTADO = 'ACEPTADO'
const UNIQUE_VIOLATION = 'P2002'

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION

@Injectable()
export class ContactosService {
  private readonly logger = new Logger(ContactosService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  /**
   * Every outcome resolves the same way, so the answer never tells whether an email belongs to
   * a player (the screen is not a directory of users).
   */
  async request(userId: string, email: string): Promise<void> {
    const target = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    })
    await this.sendRequest(userId, target)
  }

  /** Same neutral outcome as `request`, for a player picked from the name search. */
  async requestUser(userId: string, targetId: string): Promise<void> {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } })
    await this.sendRequest(userId, target)
  }

  /**
   * Players whose name contains the term. Anyone already related (any request, either side) is
   * left out, since they show up in the lists below the search.
   */
  async search(userId: string, term: string): Promise<ContactSearchResult[]> {
    const name = term.trim()
    if (name.length < SEARCH_MIN_LENGTH) return []

    const related = await this.prisma.contacto.findMany({
      where: { OR: [{ solicitanteId: userId }, { destinatarioId: userId }] },
      select: { solicitanteId: true, destinatarioId: true },
    })
    const hidden = new Set([userId])
    for (const row of related) {
      hidden.add(row.solicitanteId)
      hidden.add(row.destinatarioId)
    }

    return this.prisma.user.findMany({
      where: {
        rol: 'PLAYER',
        nombre: { contains: escapeLikePattern(name), mode: 'insensitive' },
        id: { notIn: [...hidden] },
      },
      select: { id: true, nombre: true, avatarUrl: true, barrioPontevedra: true },
      orderBy: { nombre: 'asc' },
      take: SEARCH_MAX_RESULTS,
    })
  }

  private async sendRequest(userId: string, target: { id: string } | null): Promise<void> {
    if (!target || target.id === userId) return

    const [sent, received] = await Promise.all([
      this.prisma.contacto.findUnique({
        where: {
          solicitanteId_destinatarioId: { solicitanteId: userId, destinatarioId: target.id },
        },
      }),
      this.prisma.contacto.findUnique({
        where: {
          solicitanteId_destinatarioId: { solicitanteId: target.id, destinatarioId: userId },
        },
      }),
    ])
    if (sent) return

    if (received) {
      // Both sides asked for each other: no need to wait for a second confirmation.
      if (received.estado === ESTADO_PENDIENTE) await this.markAccepted(received.id)
      return
    }

    try {
      const created = await this.prisma.contacto.create({
        data: { solicitanteId: userId, destinatarioId: target.id },
      })
      this.notifications.notifyContactRequest(created.id).catch((error: unknown) => {
        this.logger.error(`Could not notify contact request ${created.id}`, error)
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
    }
  }

  async list(userId: string): Promise<ContactsOverview> {
    const rows = await this.prisma.contacto.findMany({
      where: { OR: [{ solicitanteId: userId }, { destinatarioId: userId }] },
      include: {
        solicitante: { select: PUBLIC_USER },
        destinatario: { select: PUBLIC_USER },
      },
      orderBy: { createdAt: 'desc' },
    })

    const overview: ContactsOverview = { contactos: [], recibidas: [], enviadas: [] }
    for (const row of rows) {
      const sentByMe = row.solicitanteId === userId
      const entry = { id: row.id, usuario: sentByMe ? row.destinatario : row.solicitante }
      if (row.estado === ESTADO_ACEPTADO) overview.contactos.push(entry)
      else if (sentByMe) overview.enviadas.push(entry)
      else overview.recibidas.push(entry)
    }
    return overview
  }

  async accept(userId: string, id: string): Promise<void> {
    const row = await this.prisma.contacto.findUnique({ where: { id } })
    // A request that is not addressed to the player looks the same as one that does not exist.
    if (!row || row.destinatarioId !== userId)
      throw new NotFoundException('Solicitud no encontrada')
    if (row.estado !== ESTADO_PENDIENTE) throw new ConflictException('La solicitud ya fue aceptada')

    await this.markAccepted(id)
  }

  /** Declines or cancels a pending request, or removes an accepted contact. */
  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.contacto.findUnique({ where: { id } })
    if (!row || (row.solicitanteId !== userId && row.destinatarioId !== userId)) {
      throw new NotFoundException('Contacto no encontrado')
    }

    await this.prisma.contacto.delete({ where: { id } })
  }

  private async markAccepted(id: string): Promise<void> {
    await this.prisma.contacto.update({ where: { id }, data: { estado: ESTADO_ACEPTADO } })

    this.notifications.notifyContactAccepted(id).catch((error: unknown) => {
      this.logger.error(`Could not notify contact acceptance ${id}`, error)
    })
  }
}
