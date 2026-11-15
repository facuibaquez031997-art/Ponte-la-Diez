export interface ChatParticipant {
  nombre: string
  avatarUrl: string | null
  /** The app is open for this person right now. */
  conectado: boolean
}

/** What an open thread asks every couple of seconds. */
export interface Pulso {
  conectado: boolean
  escribiendo: boolean
  /** When the last message arrived: a change tells the thread to read the new ones. */
  ultimoMensajeAt: string | null
}

export interface TurnoBanner {
  fechaHoraInicio: string
  /** Null when the booking was released: the slot is free again. */
  estado: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | null
  liberado: boolean
  montoPagado: number
  montoRestante: number
}

export interface ConversacionHeader {
  id: string
  /** The other person of the conversation. */
  otro: ChatParticipant
  cancha: { id: string; nombre: string; jugadores: number | null }
  turno: TurnoBanner | null
}

export interface Conversacion extends ConversacionHeader {
  ultimoMensaje: { cuerpo: string; createdAt: string; propio: boolean } | null
  noLeidos: number
  /** The other person is typing in this conversation right now. */
  escribiendo: boolean
}

/** A slot the owner offered in a message, with whether the player can still book it. */
export interface Oferta {
  turnoId: string
  fechaHoraInicio: string
  /** Still free and in the future. A booked, expired or deleted slot is not available anymore. */
  disponible: boolean
  cancha: {
    id: string
    nombre: string
    barrio: string
    precioHora: number
    montoSena: number
    jugadores: number | null
  }
}

export interface Mensaje {
  id: string
  cuerpo: string
  createdAt: string
  propio: boolean
  oferta: Oferta | null
}

export interface Thread {
  conversacion: ConversacionHeader
  mensajes: Mensaje[]
  hayMas: boolean
}

export interface CreateConversacionInput {
  canchaId: string
  reservaId?: string
}

export const MAX_MENSAJE_LENGTH = 1000
