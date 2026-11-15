export type TipoPago = 'SENA' | 'TOTAL'

export type ReservaEstado = 'PENDING' | 'CONFIRMED' | 'CANCELLED'

export interface Reserva {
  id: string
  estado: ReservaEstado
  fechaHoraInicio: string
  fechaHoraFin: string
  cancha: {
    id: string
    nombre: string
    direccion: string
    barrio: string
  }
  /** Full price of the slot. */
  montoTotal: number
  /** What is waiting to be paid online right now, or null when nothing is pending. */
  montoACobrar: number | null
  /** What the player already paid online. */
  montoPagado: number
  /** What is left to pay at the court to the owner. */
  montoRestante: number
}

export interface CreateReservaInput {
  turnoId: string
  tipoPago: TipoPago
}

export interface Preference {
  preferenceId: string
  /** Mercado Pago Checkout Pro URL the player is sent to. */
  initPoint: string
}

/** A booking as the owner of the court sees it. */
export interface OwnerReserva extends Reserva {
  jugador: { nombre: string; avatarUrl: string | null }
  /** When an unpaid booking stops holding the slot, or null once it is not waiting anymore. */
  expiraEl: string | null
}
