import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module.js'
import { DevolucionesService } from './devoluciones.service.js'
import { MercadoPagoGateway } from './mercadopago.gateway.js'
import { MpCuentaController } from './mp-cuenta.controller.js'
import { MpCuentaService } from './mp-cuenta.service.js'
import { MpOAuthGateway } from './mp-oauth.gateway.js'
import { PagosController } from './pagos.controller.js'
import { PagosService } from './pagos.service.js'

@Module({
  imports: [NotificationsModule],
  controllers: [PagosController, MpCuentaController],
  providers: [
    PagosService,
    MercadoPagoGateway,
    MpOAuthGateway,
    MpCuentaService,
    DevolucionesService,
  ],
  exports: [PagosService, MpCuentaService, DevolucionesService],
})
export class PagosModule {}
