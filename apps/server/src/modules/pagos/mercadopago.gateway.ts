import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'
import { type PreferenceInput, buildPreferenceBody } from './preference-body.js'

export interface PaymentInfo {
  id: string
  /** `approved`, `rejected`, `pending`, `in_process`, `cancelled`, `refunded`... */
  status: string
  /** The booking id sent as `external_reference` when the preference was created. */
  externalReference?: string
  transactionAmount: number
}

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
  private readonly webhookSecret?: string

  constructor(config: ConfigService) {
    const accessToken = config.get<string>('MP_ACCESS_TOKEN')
    this.client = accessToken
      ? new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } })
      : undefined
    this.clientUrl = config.get<string>('CLIENT_URL') ?? 'http://localhost:5173'
    this.notificationUrl = config.get<string>('MP_NOTIFICATION_URL')
    this.webhookSecret = config.get<string>('MP_WEBHOOK_SECRET')
  }

  isConfigured(): boolean {
    return this.client !== undefined
  }

  getWebhookSecret(): string | undefined {
    return this.webhookSecret
  }

  /** Reads a payment straight from Mercado Pago. Returns null when it does not exist. */
  async getPayment(id: string): Promise<PaymentInfo | null> {
    if (!this.client) throw new Error('Mercado Pago is not configured')

    try {
      const payment = await new Payment(this.client).get({ id })
      return {
        id: String(payment.id),
        status: payment.status ?? 'unknown',
        externalReference: payment.external_reference ?? undefined,
        transactionAmount: payment.transaction_amount ?? 0,
      }
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null
      throw error
    }
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
