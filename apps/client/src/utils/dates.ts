// Courts and slots are always read in Argentina time, whatever the browser time zone is.
const TIME_ZONE = 'America/Argentina/Buenos_Aires'

/** Today as AAAA-MM-DD in Argentina. */
export const todayInArgentina = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE })

export const addDays = (date: string, days: number): string => {
  const moved = new Date(`${date}T12:00:00Z`)
  moved.setUTCDate(moved.getUTCDate() + days)
  return moved.toISOString().slice(0, 10)
}

/** "19:00" for a slot that starts at the given instant. */
export const formatSlotTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIME_ZONE,
  })

/** "lunes 9 de noviembre" for a AAAA-MM-DD date. */
export const formatLongDate = (date: string): string =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
