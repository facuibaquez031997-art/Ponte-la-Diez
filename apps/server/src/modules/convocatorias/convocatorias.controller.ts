import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common'
import type { Convocatoria } from '@prisma/client'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { ConvocatoriasService } from './convocatorias.service.js'
import { CreateConvocatoriaDto } from './dto/create-convocatoria.dto.js'

@Controller('convocatorias')
export class ConvocatoriasController {
  constructor(private readonly convocatorias: ConvocatoriasService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateConvocatoriaDto): Promise<Convocatoria> {
    return this.convocatorias.create(user.id, dto)
  }

  @Get()
  listForMyBarrio(@CurrentUser() user: AuthUser): Promise<Convocatoria[]> {
    return this.convocatorias.listForMyBarrio(user.id)
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthUser): Promise<Convocatoria[]> {
    return this.convocatorias.listMine(user.id)
  }

  @Patch(':id/close')
  @HttpCode(200)
  close(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<Convocatoria> {
    return this.convocatorias.close(user.id, id)
  }
}
