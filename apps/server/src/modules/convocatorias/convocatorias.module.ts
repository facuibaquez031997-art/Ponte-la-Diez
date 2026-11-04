import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module.js'
import { ConvocatoriasController } from './convocatorias.controller.js'
import { ConvocatoriasService } from './convocatorias.service.js'

@Module({
  imports: [NotificationsModule],
  controllers: [ConvocatoriasController],
  providers: [ConvocatoriasService],
})
export class ConvocatoriasModule {}
