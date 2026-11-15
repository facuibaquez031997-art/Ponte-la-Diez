import { createHmac, timingSafeEqual } from 'node:crypto'

export interface WebhookSignatureInput {
  /** Value of the `x-signature` header: `ts=<millis>,v1=<hex hmac>`. */
  xSignature?: string
  /** Value of the `x-request-id` header. */
  xRequestId?: string
  /** Value of the `data.id` query parameter (the payment id). */
  dataId?: string
  /** Secret of the Mercado Pago application (Webhooks settings). */
  secret?: string
}

const SHA256_HEX = /^[0-9a-f]{64}$/i

function parseSignature(header: string): { ts?: string; v1?: string } {
  const parts: Record<string, string> = {}
  for (const part of header.split(',')) {
    const [key, ...value] = part.split('=')
    if (key && value.length > 0) parts[key.trim()] = value.join('=').trim()
  }
  return { ts: parts.ts, v1: parts.v1 }
}

/**
 * Checks that a notification really comes from Mercado Pago:
 * HMAC-SHA256 of `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` with the application
 * secret, compared in constant time. A value that is not present is left out of the manifest.
 */
export function verifyWebhookSignature(input: WebhookSignatureInput): boolean {
  const { xSignature, xRequestId, dataId, secret } = input
  if (!secret || !xSignature) return false

  const { ts, v1 } = parseSignature(xSignature)
  if (!ts || !v1 || !SHA256_HEX.test(v1)) return false

  const manifest =
    (dataId ? `id:${dataId.toLowerCase()};` : '') +
    (xRequestId ? `request-id:${xRequestId};` : '') +
    `ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest()
  return timingSafeEqual(expected, Buffer.from(v1, 'hex'))
}
