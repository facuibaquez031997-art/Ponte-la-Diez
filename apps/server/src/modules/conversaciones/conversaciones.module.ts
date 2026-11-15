import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module.js'
import { ConversacionesController } from './conversaciones.controller.js'
import { ConversacionesService } from './conversaciones.service.js'
import { PresenceService } from './presence.service.js'
import { PresenciaController } from './presencia.controller.js'

@Module({
  imports: [NotificationsModule],
  controllers: [ConversacionesController, PresenciaController],
  providers: [ConversacionesService, PresenceService],
})
export class ConversacionesModule {}
