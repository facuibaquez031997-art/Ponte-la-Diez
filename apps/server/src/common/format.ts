// Slots are always written in Argentina time, whatever the time zone of the server is.
const TIME_ZONE = 'America/Argentina/Buenos_Aires'

const dayFormat = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TIME_ZONE,
})

const timeFormat = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TIME_ZONE,
})

const pesosFormat = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** "domingo, 15 de noviembre a las 17:00 hs" for the instant a slot starts. */
export const formatSlotLabel = (start: Date): string =>
  `${dayFormat.format(start)} a las ${timeFormat.format(start)} hs`

/** "$ 20.000" for an amount in pesos. */
export const formatPesos = (amount: number): string => pesosFormat.format(amount)
