export interface PreferenceInput {
  reservaId: string
  title: string
  /** Amount to charge now, in pesos. */
  monto: number
  /** The checkout stops accepting payments at this moment (end of the booking hold). */
  expiresAt: Date
  /** The platform's commission in pesos, taken from the amount charged on the owner's account. */
  marketplaceFee?: number
}

export interface PreferenceUrls {
  clientUrl: string
  /** Public https URL of POST /api/pagos/webhook. Mercado Pago cannot reach localhost. */
  notificationUrl?: string
}

export interface PreferenceBody {
  items: { id: string; title: string; quantity: number; unit_price: number; currency_id: string }[]
  external_reference: string
  back_urls: { success: string; pending: string; failure: string }
  expires: boolean
  expiration_date_to: string
  notification_url?: string
  auto_return?: 'approved'
  marketplace_fee?: number
}

export const RESULT_PATH = '/reservas/resultado'

export function buildPreferenceBody(input: PreferenceInput, urls: PreferenceUrls): PreferenceBody {
  const clientUrl = urls.clientUrl.replace(/\/+$/, '')
  const resultUrl = `${clientUrl}${RESULT_PATH}`

  return {
    items: [
      {
        id: input.reservaId,
        title: input.title,
        quantity: 1,
        unit_price: input.monto,
        currency_id: 'ARS',
      },
    ],
    external_reference: input.reservaId,
    back_urls: { success: resultUrl, pending: resultUrl, failure: resultUrl },
    expires: true,
    expiration_date_to: input.expiresAt.toISOString(),
    // Mercado Pago rejects the automatic return when the back URL is not https.
    ...(clientUrl.startsWith('https://') ? { auto_return: 'approved' as const } : {}),
    ...(urls.notificationUrl ? { notification_url: urls.notificationUrl } : {}),
    ...(input.marketplaceFee ? { marketplace_fee: input.marketplaceFee } : {}),
  }
}
