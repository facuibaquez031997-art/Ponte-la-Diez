import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module.js'
import { MercadoPagoGateway } from './mercadopago.gateway.js'
import { PagosController } from './pagos.controller.js'
import { PagosService } from './pagos.service.js'

@Module({
  imports: [NotificationsModule],
  controllers: [PagosController],
  providers: [PagosService, MercadoPagoGateway],
  exports: [PagosService],
})
export class PagosModule {}
