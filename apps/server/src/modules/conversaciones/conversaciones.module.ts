import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module.js'
import { ConversacionesController } from './conversaciones.controller.js'
import { ConversacionesService } from './conversaciones.service.js'

@Module({
  imports: [NotificationsModule],
  controllers: [ConversacionesController],
  providers: [ConversacionesService],
})
export class ConversacionesModule {}
