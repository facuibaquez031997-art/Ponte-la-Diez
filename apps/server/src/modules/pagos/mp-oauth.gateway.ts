import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MercadoPagoConfig, OAuth } from 'mercadopago'

export interface LinkedAccountTokens {
  mpUserId: string
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

interface OAuthResponseBody {
  access_token?: string
  refresh_token?: string
  user_id?: number
  expires_in?: number
}

/** Thin wrapper over the Mercado Pago OAuth endpoints used to link an owner's account. */
@Injectable()
export class MpOAuthGateway {
  private readonly oauth?: OAuth
  private readonly clientId?: string
  private readonly clientSecret?: string
  private readonly redirectUri?: string

  constructor(config: ConfigService) {
    const accessToken = config.get<string>('MP_ACCESS_TOKEN')
    this.clientId = config.get<string>('MP_CLIENT_ID')
    this.clientSecret = config.get<string>('MP_CLIENT_SECRET')
    this.redirectUri = config.get<string>('MP_REDIRECT_URI')
    this.oauth = accessToken
      ? new OAuth(new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } }))
      : undefined
  }

  isConfigured(): boolean {
    return Boolean(this.oauth && this.clientId && this.clientSecret && this.redirectUri)
  }

  /** The consent screen the owner is sent to. `state` comes back untouched on the callback. */
  getAuthorizationUrl(state: string): string {
    if (!this.oauth || !this.clientId || !this.redirectUri) {
      throw new Error('Mercado Pago OAuth is not configured')
    }
    return this.oauth.getAuthorizationURL({
      options: { client_id: this.clientId, redirect_uri: this.redirectUri, state },
    })
  }

  async exchangeCode(code: string, now: Date = new Date()): Promise<LinkedAccountTokens> {
    if (!this.oauth || !this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('Mercado Pago OAuth is not configured')
    }
    const response = await this.oauth.create({
      body: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
      },
    })
    return toTokens(response, now)
  }

  async refresh(refreshToken: string, now: Date = new Date()): Promise<LinkedAccountTokens> {
    if (!this.oauth || !this.clientId || !this.clientSecret) {
      throw new Error('Mercado Pago OAuth is not configured')
    }
    const response = await this.oauth.refresh({
      body: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      },
    })
    return toTokens(response, now)
  }
}

function toTokens(response: OAuthResponseBody, now: Date): LinkedAccountTokens {
  const { access_token, refresh_token, user_id, expires_in } = response
  if (!access_token || !refresh_token || user_id === undefined || !expires_in) {
    throw new Error('Mercado Pago answered the OAuth request without the expected tokens')
  }
  return {
    mpUserId: String(user_id),
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: new Date(now.getTime() + expires_in * 1000),
  }
}
