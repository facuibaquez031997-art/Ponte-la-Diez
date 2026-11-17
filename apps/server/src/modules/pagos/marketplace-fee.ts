/** The platform commission when `MP_MARKETPLACE_FEE_PERCENT` is not set. */
export const DEFAULT_MARKETPLACE_FEE_PERCENT = 10

/** The platform's cut of an amount, in pesos rounded to the cent. Works in cents to avoid float drift. */
export function computeMarketplaceFee(amount: number, percent: number): number {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('The marketplace fee percentage must be between 0 and 100')
  }
  const cents = Math.round(amount * 100)
  return Math.round((cents * percent) / 100) / 100
}
