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
import { MercadoPagoGateway, type PreferenceResult } from './mercadopago.gateway.js'
import { verifyWebhookSignature } from './webhook-signature.js'

export type NotificationResult = 'confirmed' | 'duplicate' | 'ignored'

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
      include: { pago: true },
    })
    if (!reserva?.pago) {
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
    const confirmed = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.reserva.updateMany({
        where: { id: reserva.id, estado: 'PENDING' },
        data: { estado: 'CONFIRMED' },
      })
      if (claimed.count === 0) return false
      await tx.pago.update({
        where: { id: pagoId },
        data: { estadoPago: 'APPROVED', mpPaymentId: payment.id },
      })
      return true
    })
    if (!confirmed) {
      this.logger.error(
        `Payment ${payment.id} was approved but booking ${reserva.id} is not PENDING anymore: needs a manual review`
      )
      return 'ignored'
    }
    await this.notifyOwner(reserva.id)
    return 'confirmed'
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
