import { Controller, Get, Query, Redirect } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { Public } from '../auth/decorators/public.decorator.js'
import { Roles } from '../auth/decorators/roles.decorator.js'
import { MpCuentaService } from './mp-cuenta.service.js'

/** Where the owner lands after the consent screen; the page itself is built in the client task. */
const OWNER_ACCOUNT_PATH = '/owner/mercadopago'

@Controller('pagos/mp')
export class MpCuentaController {
  constructor(
    private readonly cuentas: MpCuentaService,
    private readonly config: ConfigService
  ) {}

  /** Returns the Mercado Pago consent URL; the client navigates there. */
  @Get('authorize')
  @Roles('OWNER')
  authorize(@CurrentUser() user: AuthUser): { url: string } {
    return this.cuentas.getAuthorizeUrl(user.id)
  }

  /**
   * Mercado Pago sends the browser back here, so there is no session: it is public and the
   * signed `state` is what identifies the owner. Always redirects, whatever the outcome.
   */
  @Public()
  @Get('callback')
  @Redirect()
  async callback(
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Query('error') error: unknown
  ): Promise<{ url: string }> {
    const result = await this.cuentas.handleCallback({
      code: typeof code === 'string' ? code : undefined,
      state: typeof state === 'string' ? state : undefined,
      error: typeof error === 'string' ? error : undefined,
    })
    const clientUrl = this.config.get<string>('CLIENT_URL') ?? 'http://localhost:5173'
    return { url: `${clientUrl}${OWNER_ACCOUNT_PATH}?mp=${result}` }
  }
}
