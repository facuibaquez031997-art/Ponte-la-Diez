import type { Role } from '../types/auth'
import type { Conversacion } from '../types/conversaciones'

type ChatPeople = Pick<Conversacion, 'otro' | 'cancha'>

/** Who the conversation is with, as the viewer sees it: the court for a player, the player for an owner. */
export const chatTitle = (conversacion: ChatPeople, rol: Role): string =>
  rol === 'PLAYER' ? conversacion.cancha.nombre : conversacion.otro.nombre

export const chatSubtitle = (conversacion: ChatPeople, rol: Role): string =>
  rol === 'PLAYER' ? conversacion.otro.nombre : conversacion.cancha.nombre
