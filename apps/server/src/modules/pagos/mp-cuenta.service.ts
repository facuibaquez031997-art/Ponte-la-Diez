import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { type LinkedAccountTokens, MpOAuthGateway } from './mp-oauth.gateway.js'
import { signOAuthState, verifyOAuthState } from './oauth-state.js'
import { decryptToken, encryptToken } from './token-crypto.js'

export type LinkResult = 'linked' | 'denied' | 'invalid' | 'error'

export interface CallbackParams {
  code?: string
  state?: string
  /** Set by Mercado Pago when the owner declined on the consent screen. */
  error?: string
}

/** A token this close to expiring is renewed before it is used. */
const REFRESH_MARGIN_MS = 5 * 60_000

@Injectable()
export class MpCuentaService {
  private readonly logger = new Logger(MpCuentaService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: MpOAuthGateway,
    private readonly config: ConfigService
  ) {}

  getAuthorizeUrl(ownerId: string, now: Date = new Date()): { url: string } {
    if (!this.oauth.isConfigured() || !this.encryptionKey()) {
      throw new ServiceUnavailableException('El vínculo con Mercado Pago no está configurado')
    }
    return { url: this.oauth.getAuthorizationUrl(signOAuthState(ownerId, this.stateSecret(), now)) }
  }

  /**
   * Finishes the link when Mercado Pago sends the browser back. It never throws: the caller
   * only needs to know where to send the owner. Tokens and codes are never logged.
   */
  async handleCallback(params: CallbackParams, now: Date = new Date()): Promise<LinkResult> {
    const ownerId = params.state ? verifyOAuthState(params.state, this.stateSecret(), now) : null
    if (!ownerId) return 'invalid'
    if (params.error || !params.code) return 'denied'

    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } })
    if (owner?.rol !== 'OWNER') return 'invalid'

    try {
      const tokens = await this.oauth.exchangeCode(params.code, now)
      const data = this.encrypt(tokens)
      await this.prisma.mpCuenta.upsert({
        where: { userId: ownerId },
        create: { userId: ownerId, ...data },
        update: data,
      })
      return 'linked'
    } catch (error) {
      this.logger.error(
        `Could not link the Mercado Pago account of owner ${ownerId}`,
        (error as Error).stack
      )
      return 'error'
    }
  }

  /** The owner's access token, renewed first when it is about to expire. */
  async getAccessToken(ownerId: string, now: Date = new Date()): Promise<string> {
    const account = await this.prisma.mpCuenta.findUnique({ where: { userId: ownerId } })
    if (!account)
      throw new NotFoundException('El dueño todavía no vinculó su cuenta de Mercado Pago')

    if (account.expiresAt.getTime() - now.getTime() > REFRESH_MARGIN_MS) {
      return decryptToken(account.accessTokenEnc, this.encryptionKey())
    }

    const refreshed = await this.oauth.refresh(
      decryptToken(account.refreshTokenEnc, this.encryptionKey()),
      now
    )
    await this.prisma.mpCuenta.update({ where: { userId: ownerId }, data: this.encrypt(refreshed) })
    return refreshed.accessToken
  }

  private encrypt(tokens: LinkedAccountTokens) {
    const key = this.encryptionKey()
    return {
      mpUserId: tokens.mpUserId,
      accessTokenEnc: encryptToken(tokens.accessToken, key),
      refreshTokenEnc: encryptToken(tokens.refreshToken, key),
      expiresAt: tokens.expiresAt,
    }
  }

  private stateSecret(): string {
    return this.config.get<string>('JWT_SECRET') as string
  }

  private encryptionKey(): string {
    return this.config.get<string>('MP_TOKEN_ENCRYPTION_KEY') as string
  }
}
