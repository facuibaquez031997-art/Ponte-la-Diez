import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module.js'
import { PagosModule } from '../pagos/pagos.module.js'
import { ReservasController } from './reservas.controller.js'
import { ReservasService } from './reservas.service.js'

@Module({
  imports: [NotificationsModule, PagosModule],
  controllers: [ReservasController],
  providers: [ReservasService],
  exports: [ReservasService],
})
export class ReservasModule {}
