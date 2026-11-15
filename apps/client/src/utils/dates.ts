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

/** "dom 15 nov" for the day a slot starts, in Argentina time. */
export const formatSlotShortDate = (iso: string): string =>
  new Date(iso)
    .toLocaleDateString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: TIME_ZONE,
    })
    .replace(/[.,]/g, '')

/** "domingo 15 de noviembre" for the day a slot starts, in Argentina time. */
export const formatSlotDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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

const dayInArgentina = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: TIME_ZONE })

/** "10:42" for a message sent today, "dom 15 nov" for an older one. */
export const formatChatStamp = (iso: string): string =>
  dayInArgentina(iso) === todayInArgentina() ? formatSlotTime(iso) : formatSlotShortDate(iso)

/** The day a message was sent, to group the thread: "Hoy" or "domingo 15 de noviembre". */
export const formatChatDay = (iso: string): string =>
  dayInArgentina(iso) === todayInArgentina() ? 'Hoy' : formatSlotDate(iso)

/** AAAA-MM-DD in Argentina, to tell whether two messages share the same day. */
export const chatDayKey = dayInArgentina
