import { Body, Controller, Headers, HttpCode, Post, Query } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { Public } from '../auth/decorators/public.decorator.js'
import { Roles } from '../auth/decorators/roles.decorator.js'
import { CreatePreferenceDto } from './dto/create-preference.dto.js'
import type { PreferenceResult } from './mercadopago.gateway.js'
import { type NotificationResult, PagosService } from './pagos.service.js'

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

  /**
   * Called by Mercado Pago, not by a logged in user: it is public and protected by the signature.
   * It answers 200 for every valid notification (even an ignored one) so Mercado Pago stops
   * retrying, and fails with 5xx only when something broke on our side or theirs.
   */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
    @Query('data.id') dataId: string | undefined,
    @Query('type') queryType: string | undefined,
    @Body() body: { type?: unknown } | undefined
  ): Promise<{ result: NotificationResult }> {
    const bodyType = typeof body?.type === 'string' ? body.type : undefined
    return this.pagos.handleWebhook({
      xSignature,
      xRequestId,
      dataId: typeof dataId === 'string' ? dataId : undefined,
      type: typeof queryType === 'string' ? queryType : bodyType,
    })
  }
}
