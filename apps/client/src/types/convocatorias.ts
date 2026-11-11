export type Posicion = 'ARQUERO' | 'DEFENSOR' | 'MEDIOCAMPISTA' | 'DELANTERO' | 'TODOS'

export const POSICION_LABELS: Record<Posicion, string> = {
  ARQUERO: 'Arquero',
  DEFENSOR: 'Defensor',
  MEDIOCAMPISTA: 'Mediocampista',
  DELANTERO: 'Delantero',
  TODOS: 'Todos',
}

/** Spanish plurals are not "singular + s" (defensor -> defensores), so each one is spelled out. */
export const POSICION_NOUNS: Record<Posicion, { singular: string; plural: string }> = {
  ARQUERO: { singular: 'arquero', plural: 'arqueros' },
  DEFENSOR: { singular: 'defensor', plural: 'defensores' },
  MEDIOCAMPISTA: { singular: 'mediocampista', plural: 'mediocampistas' },
  DELANTERO: { singular: 'delantero', plural: 'delanteros' },
  TODOS: { singular: 'jugador', plural: 'jugadores' },
}

export type Alcance = 'BARRIO' | 'CONTACTOS'

export interface CreateConvocatoriaPayload {
  alcance: Alcance
  canchaNombre?: string
  fechaHora: string
  posicion: Posicion
  jugadoresFaltantes: number
  mensaje?: string
}

export interface Convocatoria {
  id: string
  creadorId: string
  alcance: Alcance
  canchaId: string | null
  canchaNombre: string | null
  fechaHora: string
  jugadoresFaltantes: number
  posicion: Posicion
  mensaje: string | null
  estado: string
}

export type RespuestaEstado = 'ACEPTADA' | 'DECLINADA'

export interface BarrioConvocatoria extends Convocatoria {
  creador: { nombre: string; avatarUrl: string | null }
  respuestas: Array<{ estado: RespuestaEstado }>
}

export interface TeamPlayer {
  userId: string
  nombre: string
  avatarUrl: string | null
}

export interface ConvocatoriaTeam {
  jugadoresFaltantes: number
  aceptados: TeamPlayer[]
}
