import { Body, Controller, Post } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { Roles } from '../auth/decorators/roles.decorator.js'
import { CreatePreferenceDto } from './dto/create-preference.dto.js'
import type { PreferenceResult } from './mercadopago.gateway.js'
import { PagosService } from './pagos.service.js'

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagos: PagosService) {}

  @Post('create-preference')
  @Roles('PLAYER')
  createPreference(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePreferenceDto
  ): Promise<PreferenceResult> {
    return this.pagos.createPreference(user.id, dto.reservaId)
  }
}
