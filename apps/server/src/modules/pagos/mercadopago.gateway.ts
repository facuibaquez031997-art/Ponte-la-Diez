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
  private readonly configured: boolean
  private readonly clientUrl: string
  private readonly notificationUrl?: string
  private readonly webhookSecret?: string

  constructor(config: ConfigService) {
    // The platform token no longer charges or reads payments (the owners' tokens do); it is still
    // what the OAuth gateway authenticates with, so it stays the "Mercado Pago is set up" flag.
    this.configured = Boolean(config.get<string>('MP_ACCESS_TOKEN'))
    this.clientUrl = config.get<string>('CLIENT_URL') ?? 'http://localhost:5173'
    this.notificationUrl = config.get<string>('MP_NOTIFICATION_URL')
    this.webhookSecret = config.get<string>('MP_WEBHOOK_SECRET')
  }

  isConfigured(): boolean {
    return this.configured
  }

  getWebhookSecret(): string | undefined {
    return this.webhookSecret
  }

  /**
   * Reads a payment straight from Mercado Pago with the token of the owner it was made to.
   * Returns null when it does not exist on that account.
   */
  async getPayment(id: string, ownerAccessToken: string): Promise<PaymentInfo | null> {
    const ownerClient = new MercadoPagoConfig({
      accessToken: ownerAccessToken,
      options: { timeout: 8000 },
    })

    try {
      const payment = await new Payment(ownerClient).get({ id })
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

  /**
   * Creates the checkout on the owner's account (`ownerAccessToken`), so the money goes to the
   * owner and Mercado Pago keeps `input.marketplaceFee` for the platform.
   */
  async createPreference(
    input: PreferenceInput,
    ownerAccessToken: string
  ): Promise<PreferenceResult> {
    const ownerClient = new MercadoPagoConfig({
      accessToken: ownerAccessToken,
      options: { timeout: 8000 },
    })

    const response = await new Preference(ownerClient).create({
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
