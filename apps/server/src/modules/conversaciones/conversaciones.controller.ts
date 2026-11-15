import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { Roles } from '../auth/decorators/roles.decorator.js'
import {
  type ConversacionView,
  ConversacionesService,
  type MensajeView,
  type PulsoView,
  type ThreadView,
} from './conversaciones.service.js'
import { CreateConversacionDto } from './dto/create-conversacion.dto.js'
import { SendMensajeDto } from './dto/send-mensaje.dto.js'

// No @Roles on the shared routes: the player and the owner both use them, and the service decides
// whether the user is a participant of each conversation.
@Controller('conversaciones')
export class ConversacionesController {
  constructor(private readonly conversaciones: ConversacionesService) {}

  @Post()
  @Roles('PLAYER')
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateConversacionDto
  ): Promise<{ id: string }> {
    return this.conversaciones.create(user.id, dto)
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ConversacionView[]> {
    return this.conversaciones.list(user.id)
  }

  @Get('no-leidas')
  unreadCount(@CurrentUser() user: AuthUser): Promise<{ count: number }> {
    return this.conversaciones.unreadCount(user.id)
  }

  @Get(':id/mensajes')
  thread(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('before') before?: string
  ): Promise<ThreadView> {
    return this.conversaciones.thread(user.id, id, parseBefore(before))
  }

  @Post(':id/mensajes')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMensajeDto
  ): Promise<MensajeView> {
    return this.conversaciones.send(user.id, id, dto.cuerpo, dto.ofertaTurnoId)
  }

  @Get(':id/pulso')
  pulse(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PulsoView> {
    return this.conversaciones.pulse(user.id, id)
  }

  @Post(':id/escribiendo')
  @HttpCode(204)
  typing(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.conversaciones.typing(user.id, id)
  }

  @Post(':id/leida')
  @HttpCode(204)
  markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.conversaciones.markRead(user.id, id)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.conversaciones.remove(user.id, id)
  }
}

function parseBefore(raw: string | undefined): Date | undefined {
  if (raw === undefined) return undefined
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) throw new BadRequestException('La fecha "before" no es válida')
  return date
}
