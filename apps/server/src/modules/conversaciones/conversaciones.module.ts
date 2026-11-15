import { Module } from '@nestjs/common'
import { ConversacionesController } from './conversaciones.controller.js'
import { ConversacionesService } from './conversaciones.service.js'

@Module({
  controllers: [ConversacionesController],
  providers: [ConversacionesService],
})
export class ConversacionesModule {}
