import { Module } from '@nestjs/common'
import { TurnosModule } from '../turnos/turnos.module.js'
import { CanchaFotosService } from './cancha-fotos.service.js'
import { CanchasController } from './canchas.controller.js'
import { CanchasService } from './canchas.service.js'
import { HorariosService } from './horarios.service.js'

@Module({
  imports: [TurnosModule],
  controllers: [CanchasController],
  providers: [CanchasService, HorariosService, CanchaFotosService],
  exports: [CanchasService, HorariosService],
})
export class CanchasModule {}
