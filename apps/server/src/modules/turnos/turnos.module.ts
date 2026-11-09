import { Module } from '@nestjs/common'
import { TurnosController } from './turnos.controller.js'
import { TurnosService } from './turnos.service.js'

@Module({
  controllers: [TurnosController],
  providers: [TurnosService],
  exports: [TurnosService],
})
export class TurnosModule {}
