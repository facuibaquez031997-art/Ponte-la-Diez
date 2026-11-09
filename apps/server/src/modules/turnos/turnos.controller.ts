import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { ListTurnosQuery } from './dto/list-turnos.query.js'
import { type FreeTurno, TurnosService } from './turnos.service.js'

@Controller('canchas/:canchaId/turnos')
export class TurnosController {
  constructor(private readonly turnos: TurnosService) {}

  @Get()
  listFree(
    @Param('canchaId', ParseUUIDPipe) canchaId: string,
    @Query() query: ListTurnosQuery
  ): Promise<FreeTurno[]> {
    return this.turnos.listFree(canchaId, query.fecha)
  }
}
