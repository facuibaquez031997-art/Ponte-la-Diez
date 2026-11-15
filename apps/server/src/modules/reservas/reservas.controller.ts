import { Body, Controller, Get, Post } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { Roles } from '../auth/decorators/roles.decorator.js'
import { CreateReservaDto } from './dto/create-reserva.dto.js'
import { type ReservaView, ReservasService } from './reservas.service.js'

@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}

  @Post()
  @Roles('PLAYER')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReservaDto): Promise<ReservaView> {
    return this.reservas.create(user.id, dto)
  }

  @Get('mine')
  @Roles('PLAYER')
  listMine(@CurrentUser() user: AuthUser): Promise<ReservaView[]> {
    return this.reservas.listMine(user.id)
  }
}
