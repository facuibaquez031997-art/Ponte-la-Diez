// Money is typed as text and kept as digits: a number input reads "20.000" as 20 in Spanish
// locales, because the dot is a decimal separator there.
export const MAX_MONEY = 1_000_000

export const onlyDigits = (text: string): string => text.replace(/\D/g, '').slice(0, 7)

export const formatMoney = (digits: string): string =>
  digits ? Number(digits).toLocaleString('es-AR') : ''
