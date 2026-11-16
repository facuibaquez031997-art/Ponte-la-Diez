import { formatSlotDate, formatSlotTime } from './dates'

/** "7 jugadores" for a court of 7, or nothing for a court that has no size yet. */
export const formatJugadores = (jugadores: number | null | undefined): string =>
  jugadores ? `${jugadores} jugadores` : ''

interface ConsultaCancha {
  nombre: string
  barrio: string
  jugadores?: number | null
}

/**
 * The ready message a player sends the owner when asking about a court and a slot, so the owner
 * knows what it is about and the player only has to add what they want to know.
 */
export const consultaMessage = (cancha: ConsultaCancha, fechaHoraInicio: string): string => {
  const size = formatJugadores(cancha.jugadores)
  const details = size ? `${size}, ${cancha.barrio}` : cancha.barrio
  return `Hola, quería consultar por la cancha ${cancha.nombre} (${details}) para el ${formatSlotDate(fechaHoraInicio)} a las ${formatSlotTime(fechaHoraInicio)} hs.`
}
