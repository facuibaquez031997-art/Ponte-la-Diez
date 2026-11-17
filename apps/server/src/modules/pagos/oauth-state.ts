import { createHmac, timingSafeEqual } from 'node:crypto'

/** How long an owner has to finish the Mercado Pago consent screen. */
export const OAUTH_STATE_TTL_MS = 10 * 60_000

const sign = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(`mp-oauth-state:${payload}`).digest('hex')

/**
 * Builds the `state` sent to Mercado Pago: `ownerId.expiresAt.signature`.
 * The callback is public (the browser comes back from Mercado Pago without a session),
 * so this is what proves which owner started the link and that nobody forged it.
 */
export function signOAuthState(ownerId: string, secret: string, now: Date = new Date()): string {
  const payload = `${ownerId}.${now.getTime() + OAUTH_STATE_TTL_MS}`
  return `${payload}.${sign(payload, secret)}`
}

/** Returns the owner id when the state is authentic and not expired, otherwise null. */
export function verifyOAuthState(
  state: string,
  secret: string,
  now: Date = new Date()
): string | null {
  const parts = state.split('.')
  if (parts.length !== 3) return null

  const [ownerId, expiresAt, signature] = parts as [string, string, string]
  const expected = Buffer.from(sign(`${ownerId}.${expiresAt}`, secret))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

  return Number(expiresAt) > now.getTime() ? ownerId : null
}
