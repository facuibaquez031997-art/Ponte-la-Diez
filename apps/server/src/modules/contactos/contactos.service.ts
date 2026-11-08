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
