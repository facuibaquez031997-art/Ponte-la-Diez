import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { Roles } from '../auth/decorators/roles.decorator.js'
import { CreateReservaDto } from './dto/create-reserva.dto.js'
import {
  type CancelResult,
  type OwnerReservaView,
  type ReservaView,
  ReservasService,
} from './reservas.service.js'

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

  @Get('owner')
  @Roles('OWNER')
  listForOwner(@CurrentUser() user: AuthUser): Promise<OwnerReservaView[]> {
    return this.reservas.listForOwner(user.id)
  }

  @Post(':id/cancelar')
  @Roles('OWNER')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<CancelResult> {
    return this.reservas.cancelByOwner(user.id, id)
  }
}
