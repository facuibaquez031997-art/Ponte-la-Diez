import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { MercadoPagoGateway } from './mercadopago.gateway.js'
import { MpCuentaService } from './mp-cuenta.service.js'

/**
 * `refunded` and `already_refunded` mean the player has the money back and the record is `HECHA`.
 * `failed` means nothing was marked: the record stays `PENDIENTE` so the refund can be retried.
 */
export type RefundOutcome =
  'refunded' | 'already_refunded' | 'nothing_to_refund' | 'not_found' | 'failed'

@Injectable()
export class DevolucionesService {
  private readonly logger = new Logger(DevolucionesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MercadoPagoGateway,
    private readonly cuentas: MpCuentaService
  ) {}

  /**
   * Returns the money of a closed booking from the owner's Mercado Pago account. It never throws
   * for a refund that could not be made: the booking is already closed, so the caller only needs
   * to know whether the player was paid back. Safe to repeat for the same record.
   */
  async refund(historialId: string, now: Date = new Date()): Promise<RefundOutcome> {
    const row = await this.prisma.historialReserva.findUnique({
      where: { id: historialId },
      include: { cancha: { select: { ownerId: true } } },
    })
    if (!row) return 'not_found'
    if (row.devolucion === 'HECHA') return 'already_refunded'
    if (row.devolucion === 'NO_CORRESPONDE') return 'nothing_to_refund'

    if (!row.mpPaymentId) {
      this.logger.error(
        `Refund ${row.id} has no Mercado Pago payment to return: needs a manual refund`
      )
      return 'failed'
    }

    try {
      const accessToken = await this.cuentas.getAccessToken(row.cancha.ownerId, now)
      const payment = await this.gateway.getPayment(row.mpPaymentId, accessToken)
      if (!payment) {
        this.logger.error(
          `Refund ${row.id}: payment ${row.mpPaymentId} is not on the owner's account (made before the marketplace?): needs a manual refund`
        )
        return 'failed'
      }

      // Refunded already (for example from the Mercado Pago panel): the player has the money.
      if (payment.status === 'refunded') {
        await this.markDone(row.id, now)
        return 'already_refunded'
      }
      if (payment.status !== 'approved') {
        this.logger.error(
          `Refund ${row.id}: payment ${row.mpPaymentId} is "${payment.status}", it cannot be refunded`
        )
        return 'failed'
      }

      await this.gateway.refundPayment(row.mpPaymentId, accessToken, `refund-${row.id}`)
      await this.markDone(row.id, now)
      return 'refunded'
    } catch (error) {
      this.logger.error(`Could not refund ${row.id} (payment ${row.mpPaymentId})`, error)
      return 'failed'
    }
  }

  private async markDone(historialId: string, now: Date): Promise<void> {
    await this.prisma.historialReserva.updateMany({
      where: { id: historialId, devolucion: 'PENDIENTE' },
      data: { devolucion: 'HECHA', devueltoAt: now },
    })
  }
}
