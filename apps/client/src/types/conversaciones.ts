export interface ChatParticipant {
  nombre: string
  avatarUrl: string | null
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
  cancha: { id: string; nombre: string }
  turno: TurnoBanner | null
}

export interface Conversacion extends ConversacionHeader {
  ultimoMensaje: { cuerpo: string; createdAt: string; propio: boolean } | null
  noLeidos: number
}

export interface Mensaje {
  id: string
  cuerpo: string
  createdAt: string
  propio: boolean
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
