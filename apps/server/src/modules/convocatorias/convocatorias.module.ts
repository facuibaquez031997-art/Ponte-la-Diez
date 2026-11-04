import { Module } from '@nestjs/common'
import { ConvocatoriasController } from './convocatorias.controller.js'
import { ConvocatoriasService } from './convocatorias.service.js'

@Module({
  controllers: [ConvocatoriasController],
  providers: [ConvocatoriasService],
})
export class ConvocatoriasModule {}
