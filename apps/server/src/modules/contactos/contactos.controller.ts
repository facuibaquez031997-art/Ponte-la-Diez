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
  Query,
} from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import {
  ContactosService,
  type ContactSearchResult,
  type ContactsOverview,
} from './contactos.service.js'
import { RequestContactDto } from './dto/request-contact.dto.js'
import { SearchContactsDto } from './dto/search-contacts.dto.js'

@Controller('contactos')
export class ContactosController {
  constructor(private readonly contactos: ContactosService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ContactsOverview> {
    return this.contactos.list(user.id)
  }

  @Get('buscar')
  search(
    @CurrentUser() user: AuthUser,
    @Query() query: SearchContactsDto
  ): Promise<ContactSearchResult[]> {
    return this.contactos.search(user.id, query.q)
  }

  @Post('solicitudes')
  @HttpCode(202)
  async request(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestContactDto
  ): Promise<{ message: string }> {
    if (dto.usuarioId) await this.contactos.requestUser(user.id, dto.usuarioId)
    else if (dto.email) await this.contactos.request(user.id, dto.email)
    return { message: 'Si ese email corresponde a un jugador, le enviamos tu solicitud.' }
  }

  @Patch(':id/aceptar')
  @HttpCode(200)
  async accept(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<{ id: string }> {
    await this.contactos.accept(user.id, id)
    return { id }
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.contactos.remove(user.id, id)
  }
}
