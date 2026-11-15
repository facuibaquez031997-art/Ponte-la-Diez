export type TurnoEstado = 'FREE' | 'RESERVED' | 'BLOCKED'

/** The booking that holds a slot, as the owner of the court sees it. */
export interface AgendaReserva {
  id: string
  estado: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  jugador: { nombre: string; avatarUrl: string | null }
  montoTotal: number
  /** What the player already paid online. */
  montoPagado: number
  /** What is left to collect at the court. */
  montoRestante: number
  /** When an unpaid booking stops holding the slot, or null once it is not waiting anymore. */
  expiraEl: string | null
  /** The chat the player opened for this booking, once it has messages. */
  conversacionId: string | null
}

export interface AgendaTurno {
  id: string
  fechaHoraInicio: string
  fechaHoraFin: string
  estado: TurnoEstado
  reserva: AgendaReserva | null
}

export interface AgendaCancha {
  cancha: { id: string; nombre: string; tipoSuperficie: string; jugadores: number | null }
  turnos: AgendaTurno[]
}

export interface Agenda {
  /** AAAA-MM-DD of the day shown. */
  fecha: string
  /** The day is further ahead than the slots are generated: an empty day is not "closed". */
  fueraDeVentana: boolean
  canchas: AgendaCancha[]
}
