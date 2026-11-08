import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module.js'
import { ContactosController } from './contactos.controller.js'
import { ContactosService } from './contactos.service.js'

@Module({
  imports: [NotificationsModule],
  controllers: [ContactosController],
  providers: [ContactosService],
})
export class ContactosModule {}
