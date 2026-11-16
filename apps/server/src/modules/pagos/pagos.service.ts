import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { formatSlotLabel } from '../../common/format.js'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import { HOLD_MS, releaseExpiredHolds } from '../reservas/holds.js'
import { findBlocked } from '../turnos/conflicts.js'
import { MercadoPagoGateway, type PreferenceResult } from './mercadopago.gateway.js'
import { verifyWebhookSignature } from './webhook-signature.js'

export type NotificationResult = 'confirmed' | 'duplicate' | 'ignored' | 'conflict'

export interface WebhookRequest {
  xSignature?: string
  xRequestId?: string
  dataId?: string
  type?: string
}

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MercadoPagoGateway,
    private readonly notifications: NotificationsService
  ) {}

  async createPreference(
    userId: string,
    reservaId: string,
    now: Date = new Date()
  ): Promise<PreferenceResult> {
    if (!this.gateway.isConfigured()) {
      throw new ServiceUnavailableException('Los pagos con Mercado Pago no están configurados')
    }

    const reserva = await this.prisma.reserva.findUnique({
      where: { id: reservaId },
      include: { pago: true, turno: { include: { cancha: true } } },
    })
    // Another player's booking answers 404 so its existence is not revealed.
    if (!reserva || reserva.userId !== userId) throw new NotFoundException('La reserva no existe')
    if (reserva.estado !== 'PENDING' || reserva.pago?.estadoPago !== 'PENDING') {
      throw new ConflictException('La reserva ya no está pendiente de pago')
    }

    const expiresAt = new Date(reserva.createdAt.getTime() + HOLD_MS)
    if (expiresAt <= now) {
      await releaseExpiredHolds(this.prisma, now, { userId })
      throw new ConflictException('La reserva venció, elegí el turno de nuevo')
    }

    // A court that shares the space was confirmed meanwhile: do not let the player pay in vain.
    const { turno } = reserva
    const blocked = await findBlocked(this.prisma, [turno.canchaId], {
      gte: turno.fechaHoraInicio,
      lte: turno.fechaHoraInicio,
    })
    if (blocked.of(turno.canchaId, turno.fechaHoraInicio, turno.numero)) {
      throw new ConflictException(
        'Ese horario ya no está disponible: otra cancha que comparte el espacio ya está confirmada'
      )
    }

    let preference: PreferenceResult
    try {
      preference = await this.gateway.createPreference({
        reservaId: reserva.id,
        title: `Reserva ${reserva.turno.cancha.nombre} - ${formatSlotLabel(reserva.turno.fechaHoraInicio)}`,
        monto: reserva.pago.monto,
        expiresAt,
      })
    } catch (error) {
      this.logger.error(`Mercado Pago preference failed for booking ${reserva.id}`, error)
      throw new BadGatewayException('No pudimos iniciar el pago, intentá de nuevo en un momento')
    }

    await this.prisma.pago.update({
      where: { id: reserva.pago.id },
      data: { mpPreferenceId: preference.preferenceId },
    })
    return preference
  }

  /**
   * Entry point of POST /pagos/webhook. Only a notification signed with the application secret
   * gets through; the body is never trusted, the payment is read again from Mercado Pago.
   */
  async handleWebhook(request: WebhookRequest): Promise<{ result: NotificationResult }> {
    const secret = this.gateway.getWebhookSecret()
    if (!secret) {
      throw new ServiceUnavailableException('El webhook de Mercado Pago no está configurado')
    }
    const signed = verifyWebhookSignature({
      xSignature: request.xSignature,
      xRequestId: request.xRequestId,
      dataId: request.dataId,
      secret,
    })
    if (!signed) throw new UnauthorizedException('Firma de notificación inválida')

    if (request.type !== 'payment' || !request.dataId) return { result: 'ignored' }
    return { result: await this.handlePaymentNotification(request.dataId) }
  }

  /**
   * Confirms the booking of an APPROVED payment. Safe to run any number of times for the same
   * payment. A payment that is rejected, pending or cancelled changes nothing: Checkout Pro lets
   * the player retry, and the booking hold ends on its own.
   */
  async handlePaymentNotification(paymentId: string): Promise<NotificationResult> {
    const payment = await this.gateway.getPayment(paymentId)
    if (!payment || payment.status !== 'approved' || !payment.externalReference) return 'ignored'

    const reserva = await this.prisma.reserva.findUnique({
      where: { id: payment.externalReference },
      include: { pago: true, turno: { include: { cancha: true } } },
    })
    if (!reserva?.pago) {
      // A booking closed because the space was confirmed for another court first is already dealt
      // with (its refund is pending): a retried notification of that payment changes nothing.
      const closed = await this.prisma.historialReserva.findFirst({
        where: { mpPaymentId: payment.id },
        select: { id: true },
      })
      if (closed) return 'duplicate'
      this.logger.error(
        `Payment ${payment.id} was approved but booking ${payment.externalReference} no longer exists: needs a manual refund`
      )
      return 'ignored'
    }
    if (reserva.pago.estadoPago === 'APPROVED') return 'duplicate'

    if (payment.transactionAmount < reserva.pago.monto) {
      this.logger.warn(
        `Payment ${payment.id} paid ${payment.transactionAmount}, less than the ${reserva.pago.monto} charged: not confirmed`
      )
      return 'ignored'
    }

    const pagoId = reserva.pago.id
    const { turno } = reserva
    const outcome = await this.prisma.$transaction(
      async (tx): Promise<'confirmed' | 'conflict' | 'ignored'> => {
        // The same lock the bookings take: the payments of two linked courts for the same hour
        // wait for each other, so the first one to be confirmed wins the shared space.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${turno.cancha.ownerId}), hashtext(${turno.fechaHoraInicio.toISOString()}))`
        const blocked = await findBlocked(tx, [turno.canchaId], {
          gte: turno.fechaHoraInicio,
          lte: turno.fechaHoraInicio,
        })
        const taken = blocked.of(turno.canchaId, turno.fechaHoraInicio, turno.numero) !== undefined

        const claimed = await tx.reserva.updateMany({
          where: { id: reserva.id, estado: 'PENDING' },
          data: { estado: taken ? 'CANCELLED' : 'CONFIRMED' },
        })
        if (claimed.count === 0) return 'ignored'

        if (!taken) {
          await tx.pago.update({
            where: { id: pagoId },
            data: { estadoPago: 'APPROVED', mpPaymentId: payment.id },
          })
          return 'confirmed'
        }

        // A court that shares the space was confirmed first. The payment was approved, so the
        // booking is closed with the refund pending (like when the owner cancels) and its slot is
        // freed, instead of confirming two bookings for the same ground.
        await tx.historialReserva.create({
          data: {
            canchaId: turno.canchaId,
            jugadorId: reserva.userId,
            turnoInicio: turno.fechaHoraInicio,
            turnoFin: turno.fechaHoraFin,
            montoTotal: reserva.montoTotal,
            montoPagado: payment.transactionAmount,
            mpPaymentId: payment.id,
            motivo: 'ESPACIO_OCUPADO',
            devolucion: 'PENDIENTE',
            reservadaAt: reserva.createdAt,
          },
        })
        await tx.pago.deleteMany({ where: { reservaId: reserva.id } })
        await tx.reserva.delete({ where: { id: reserva.id } })
        await tx.turno.update({ where: { id: reserva.turnoId }, data: { estado: 'FREE' } })
        return 'conflict'
      }
    )

    if (outcome === 'ignored') {
      this.logger.error(
        `Payment ${payment.id} was approved but booking ${reserva.id} is not PENDING anymore: needs a manual review`
      )
      return 'ignored'
    }
    if (outcome === 'conflict') {
      this.logger.warn(
        `Payment ${payment.id} was approved but the space of booking ${reserva.id} was confirmed for a court that shares it first: closed, refund pending`
      )
      await this.notifySpaceTaken({
        ownerId: turno.cancha.ownerId,
        jugadorId: reserva.userId,
        canchaNombre: turno.cancha.nombre,
        turnoInicio: turno.fechaHoraInicio,
        montoPagado: payment.transactionAmount,
      })
      return 'conflict'
    }
    await this.notifyOwner(reserva.id)
    return 'confirmed'
  }

  // Same rule as the owner's notice: it already happened, a failed notice must not fail the webhook.
  private async notifySpaceTaken(data: {
    ownerId: string
    jugadorId: string
    canchaNombre: string
    turnoInicio: Date
    montoPagado: number
  }): Promise<void> {
    // The player and the owner are told separately: one notice failing must not hide the other.
    try {
      await this.notifications.notifyBookingSpaceTaken({
        jugadorId: data.jugadorId,
        canchaNombre: data.canchaNombre,
        turnoInicio: data.turnoInicio,
        montoPagado: data.montoPagado,
      })
    } catch (error) {
      this.logger.error(
        `Could not tell the player about the closed booking of ${data.jugadorId}`,
        error
      )
    }
    try {
      await this.notifications.notifyOwnerSpaceTaken(data)
    } catch (error) {
      this.logger.error(
        `Could not tell the owner about the closed booking of ${data.jugadorId}`,
        error
      )
    }
  }

  // A failed notification must never fail the webhook: Mercado Pago would retry a payment that
  // is already confirmed.
  private async notifyOwner(reservaId: string): Promise<void> {
    try {
      await this.notifications.notifyBookingConfirmed(reservaId)
    } catch (error) {
      this.logger.error(`Could not notify the owner of booking ${reservaId}`, error)
    }
  }
}
