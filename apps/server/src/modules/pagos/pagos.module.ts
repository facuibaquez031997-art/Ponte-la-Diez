import { Module } from '@nestjs/common'
import { MercadoPagoGateway } from './mercadopago.gateway.js'
import { PagosController } from './pagos.controller.js'
import { PagosService } from './pagos.service.js'

@Module({
  controllers: [PagosController],
  providers: [PagosService, MercadoPagoGateway],
  exports: [PagosService],
})
export class PagosModule {}
