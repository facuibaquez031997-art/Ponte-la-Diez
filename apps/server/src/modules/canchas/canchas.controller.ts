import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import type { Cancha } from '@prisma/client'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { Roles } from '../auth/decorators/roles.decorator.js'
import { CanchaFotosService, type CanchaFotoView } from './cancha-fotos.service.js'
import { type CanchaWithFotos, CanchasService } from './canchas.service.js'
import { ConfirmFotoDto } from './dto/confirm-foto.dto.js'
import { CreateCanchaDto } from './dto/create-cancha.dto.js'
import type { FotoUploadSignatureDto } from './dto/foto-upload-signature.dto.js'
import { ListCanchasQuery } from './dto/list-canchas.query.js'
import { ReplaceHorariosDto } from './dto/replace-horarios.dto.js'
import { UpdateCanchaDto } from './dto/update-cancha.dto.js'
import type { FranjaInput } from './horarios.js'
import { HorariosService } from './horarios.service.js'

@Controller('canchas')
export class CanchasController {
  constructor(
    private readonly canchas: CanchasService,
    private readonly horarios: HorariosService,
    private readonly fotos: CanchaFotosService
  ) {}

  @Post()
  @Roles('OWNER')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCanchaDto): Promise<Cancha> {
    return this.canchas.create(user.id, dto)
  }

  @Get('mine')
  @Roles('OWNER')
  listMine(@CurrentUser() user: AuthUser): Promise<CanchaWithFotos[]> {
    return this.canchas.listMine(user.id)
  }

  @Get()
  list(@Query() query: ListCanchasQuery): Promise<CanchaWithFotos[]> {
    return this.canchas.list(query)
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CanchaWithFotos> {
    return this.canchas.findOne(id)
  }

  @Post(':id/fotos/signature')
  @Roles('OWNER')
  fotoSignature(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<FotoUploadSignatureDto> {
    return this.fotos.createUploadSignature(user.id, id)
  }

  @Post(':id/fotos')
  @Roles('OWNER')
  confirmFoto(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmFotoDto
  ): Promise<CanchaFotoView> {
    return this.fotos.confirmUpload(user.id, id, dto.publicId)
  }

  @Delete(':id/fotos/:fotoId')
  @Roles('OWNER')
  @HttpCode(204)
  removeFoto(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fotoId', ParseUUIDPipe) fotoId: string
  ): Promise<void> {
    return this.fotos.remove(user.id, id, fotoId)
  }

  @Get(':id/horarios')
  getHorarios(@Param('id', ParseUUIDPipe) id: string): Promise<FranjaInput[]> {
    return this.horarios.get(id)
  }

  @Put(':id/horarios')
  @Roles('OWNER')
  replaceHorarios(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceHorariosDto
  ): Promise<FranjaInput[]> {
    return this.horarios.replace(user.id, id, dto.franjas)
  }

  @Patch(':id')
  @Roles('OWNER')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCanchaDto
  ): Promise<Cancha> {
    return this.canchas.update(user.id, id, dto)
  }

  @Delete(':id')
  @Roles('OWNER')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.canchas.remove(user.id, id)
  }
}
