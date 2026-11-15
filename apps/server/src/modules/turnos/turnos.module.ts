import { Module } from '@nestjs/common'
import { AgendaController } from './agenda.controller.js'
import { TurnosController } from './turnos.controller.js'
import { TurnosService } from './turnos.service.js'

@Module({
  controllers: [TurnosController, AgendaController],
  providers: [TurnosService],
  exports: [TurnosService],
})
export class TurnosModule {}
