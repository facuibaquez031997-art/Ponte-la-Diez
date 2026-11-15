import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { HOLD_MS, releaseExpiredHolds } from '../reservas/holds.js'
import { MercadoPagoGateway, type PreferenceResult } from './mercadopago.gateway.js'

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  dateStyle: 'short',
  timeStyle: 'short',
})

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MercadoPagoGateway
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
        title: `Reserva ${reserva.turno.cancha.nombre} - ${dateFormat.format(reserva.turno.fechaHoraInicio)}`,
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
}
