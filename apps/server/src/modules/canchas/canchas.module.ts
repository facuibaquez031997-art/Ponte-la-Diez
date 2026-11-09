import { Module } from '@nestjs/common'
import { CanchasController } from './canchas.controller.js'
import { CanchasService } from './canchas.service.js'
import { HorariosService } from './horarios.service.js'

@Module({
  controllers: [CanchasController],
  providers: [CanchasService, HorariosService],
  exports: [CanchasService, HorariosService],
})
export class CanchasModule {}
