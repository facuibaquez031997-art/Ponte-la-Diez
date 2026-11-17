import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { formatSlotLabel } from '../../common/format.js'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import { HOLD_MS, releaseExpiredHolds } from '../reservas/holds.js'
import { findBlocked } from '../turnos/conflicts.js'
import { DevolucionesService } from './devoluciones.service.js'
import { DEFAULT_MARKETPLACE_FEE_PERCENT, computeMarketplaceFee } from './marketplace-fee.js'
import { MercadoPagoGateway, type PreferenceResult } from './mercadopago.gateway.js'
import { MpCuentaService } from './mp-cuenta.service.js'
import { verifyWebhookSignature } from './webhook-signature.js'

export type NotificationResult = 'confirmed' | 'duplicate' | 'ignored' | 'conflict'

export interface WebhookRequest {
  xSignature?: string
  xRequestId?: string
  dataId?: string
  type?: string
  /** `user_id` of the notification body: the Mercado Pago account the payment was made to. */
  sellerUserId?: string
  /** `reserva` of the notification URL we set on the preference. */
  reservaId?: string
}

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MercadoPagoGateway,
    private readonly notifications: NotificationsService,
    private readonly cuentas: MpCuentaService,
    private readonly config: ConfigService,
    private readonly devoluciones: DevolucionesService
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
      // The money goes to the owner's account, so the owner must have linked it.
      const ownerAccessToken = await this.cuentas.getAccessToken(turno.cancha.ownerId, now)
      const percent =
        this.config.get<number>('MP_MARKETPLACE_FEE_PERCENT') ?? DEFAULT_MARKETPLACE_FEE_PERCENT
      preference = await this.gateway.createPreference(
        {
          reservaId: reserva.id,
          title: `Reserva ${reserva.turno.cancha.nombre} - ${formatSlotLabel(reserva.turno.fechaHoraInicio)}`,
          monto: reserva.pago.monto,
          expiresAt,
          marketplaceFee: computeMarketplaceFee(reserva.pago.monto, percent),
        },
        ownerAccessToken
      )
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new ConflictException(
          'El dueño de esta cancha todavía no puede recibir pagos con Mercado Pago'
        )
      }
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

    const ownerId = await this.findOwnerId(request)
    if (!ownerId) {
      this.logger.warn(
        `Payment notification ${request.dataId} cannot be tied to any owner: ignored`
      )
      return { result: 'ignored' }
    }
    return { result: await this.handlePaymentNotification(request.dataId, ownerId) }
  }

  /**
   * The payment lives on the owner's account, so the owner is needed to read it. The seller id
   * Mercado Pago sends goes first (it does not depend on the booking still existing); the booking
   * named in our notification URL is the fallback. Neither is trusted: the payment is read with
   * that owner's token and the booking must belong to that same owner.
   */
  private async findOwnerId(request: WebhookRequest): Promise<string | undefined> {
    if (request.sellerUserId) {
      const cuenta = await this.prisma.mpCuenta.findFirst({
        where: { mpUserId: request.sellerUserId },
        select: { userId: true },
      })
      if (cuenta) return cuenta.userId
    }
    if (request.reservaId) {
      const reserva = await this.prisma.reserva.findUnique({
        where: { id: request.reservaId },
        select: { turno: { select: { cancha: { select: { ownerId: true } } } } },
      })
      return reserva?.turno.cancha.ownerId
    }
    return undefined
  }

  /**
   * Confirms the booking of an APPROVED payment made to `ownerId`. Safe to run any number of
   * times for the same payment. A payment that is rejected, pending or cancelled changes nothing:
   * Checkout Pro lets the player retry, and the booking hold ends on its own.
   */
  async handlePaymentNotification(paymentId: string, ownerId: string): Promise<NotificationResult> {
    let ownerAccessToken: string
    try {
      ownerAccessToken = await this.cuentas.getAccessToken(ownerId)
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error
      this.logger.warn(
        `Payment ${paymentId} notified for owner ${ownerId}, who has no linked account`
      )
      return 'ignored'
    }

    const payment = await this.gateway.getPayment(paymentId, ownerAccessToken)
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
    if (reserva.turno.cancha.ownerId !== ownerId) {
      this.logger.warn(
        `Payment ${payment.id} came in for owner ${ownerId} but booking ${reserva.id} belongs to another owner: not confirmed`
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
    let closedHistorialId: string | undefined
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
        const closed = await tx.historialReserva.create({
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
        closedHistorialId = closed.id
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
        `Payment ${payment.id} was approved but the space of booking ${reserva.id} was confirmed for a court that shares it first: closed, refunding`
      )
      // The booking is already closed, so a refund that fails stays pending (and is retried from
      // the owner's screen) instead of failing the webhook.
      const refund = closedHistorialId
        ? await this.devoluciones.refund(closedHistorialId)
        : 'failed'
      await this.notifySpaceTaken({
        ownerId: turno.cancha.ownerId,
        jugadorId: reserva.userId,
        canchaNombre: turno.cancha.nombre,
        turnoInicio: turno.fechaHoraInicio,
        montoPagado: payment.transactionAmount,
        devuelta: refund === 'refunded' || refund === 'already_refunded',
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
    devuelta: boolean
  }): Promise<void> {
    // The player and the owner are told separately: one notice failing must not hide the other.
    try {
      await this.notifications.notifyBookingSpaceTaken({
        jugadorId: data.jugadorId,
        canchaNombre: data.canchaNombre,
        turnoInicio: data.turnoInicio,
        montoPagado: data.montoPagado,
        devuelta: data.devuelta,
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
