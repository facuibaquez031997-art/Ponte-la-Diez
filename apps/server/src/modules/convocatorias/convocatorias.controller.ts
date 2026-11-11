import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common'
import type { Convocatoria, RespuestaConvocatoria } from '@prisma/client'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import {
  ConvocatoriasService,
  type ConvocatoriaTeam,
  type ConvocatoriaWithCreator,
} from './convocatorias.service.js'
import { CreateConvocatoriaDto } from './dto/create-convocatoria.dto.js'
import { RespondConvocatoriaDto } from './dto/respond-convocatoria.dto.js'

@Controller('convocatorias')
export class ConvocatoriasController {
  constructor(private readonly convocatorias: ConvocatoriasService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateConvocatoriaDto): Promise<Convocatoria> {
    return this.convocatorias.create(user.id, dto)
  }

  @Get()
  listForMe(@CurrentUser() user: AuthUser): Promise<ConvocatoriaWithCreator[]> {
    return this.convocatorias.listForMe(user.id)
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthUser): Promise<Convocatoria[]> {
    return this.convocatorias.listMine(user.id)
  }

  @Post(':id/respuestas')
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondConvocatoriaDto
  ): Promise<RespuestaConvocatoria> {
    return this.convocatorias.respond(user.id, id, dto.estado)
  }

  @Get(':id/equipo')
  team(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ConvocatoriaTeam> {
    return this.convocatorias.getTeam(user.id, id)
  }

  @Patch(':id/close')
  @HttpCode(200)
  close(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<Convocatoria> {
    return this.convocatorias.close(user.id, id)
  }

  @Patch(':id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<Convocatoria> {
    return this.convocatorias.cancel(user.id, id)
  }
}
