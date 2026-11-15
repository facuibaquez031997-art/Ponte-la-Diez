import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { type PreferenceInput, buildPreferenceBody } from './preference-body.js'

export interface PreferenceResult {
  preferenceId: string
  /** Checkout Pro URL the player is sent to. */
  initPoint: string
}

/** Thin wrapper over the Mercado Pago SDK so the business rules never import it. */
@Injectable()
export class MercadoPagoGateway {
  private readonly client?: MercadoPagoConfig
  private readonly clientUrl: string
  private readonly notificationUrl?: string

  constructor(config: ConfigService) {
    const accessToken = config.get<string>('MP_ACCESS_TOKEN')
    this.client = accessToken
      ? new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } })
      : undefined
    this.clientUrl = config.get<string>('CLIENT_URL') ?? 'http://localhost:5173'
    this.notificationUrl = config.get<string>('MP_NOTIFICATION_URL')
  }

  isConfigured(): boolean {
    return this.client !== undefined
  }

  async createPreference(input: PreferenceInput): Promise<PreferenceResult> {
    if (!this.client) throw new Error('Mercado Pago is not configured')

    const response = await new Preference(this.client).create({
      body: buildPreferenceBody(input, {
        clientUrl: this.clientUrl,
        notificationUrl: this.notificationUrl,
      }),
    })
    if (!response.id || !response.init_point) {
      throw new Error('Mercado Pago answered without a preference id or checkout URL')
    }
    return { preferenceId: response.id, initPoint: response.init_point }
  }
}
