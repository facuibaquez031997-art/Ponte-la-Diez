import { Controller, Get, Query } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { Roles } from '../auth/decorators/roles.decorator.js'
import { ListTurnosQuery } from './dto/list-turnos.query.js'
import { type AgendaView, TurnosService } from './turnos.service.js'

@Controller('agenda')
export class AgendaController {
  constructor(private readonly turnos: TurnosService) {}

  @Get()
  @Roles('OWNER')
  agenda(@CurrentUser() user: AuthUser, @Query() query: ListTurnosQuery): Promise<AgendaView> {
    return this.turnos.agenda(user.id, query.fecha)
  }
}
