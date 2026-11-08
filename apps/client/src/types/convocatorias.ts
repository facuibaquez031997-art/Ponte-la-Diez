export type Posicion = 'ARQUERO' | 'DEFENSOR' | 'MEDIOCAMPISTA' | 'DELANTERO'

export const POSICION_LABELS: Record<Posicion, string> = {
  ARQUERO: 'Arquero',
  DEFENSOR: 'Defensor',
  MEDIOCAMPISTA: 'Mediocampista',
  DELANTERO: 'Delantero',
}

export interface CreateConvocatoriaPayload {
  canchaNombre?: string
  fechaHora: string
  posicion: Posicion
  jugadoresFaltantes: number
  mensaje?: string
}

export interface Convocatoria {
  id: string
  creadorId: string
  canchaId: string | null
  canchaNombre: string | null
  fechaHora: string
  jugadoresFaltantes: number
  posicion: Posicion
  mensaje: string | null
  estado: string
}

export interface BarrioConvocatoria extends Convocatoria {
  creador: { nombre: string; avatarUrl: string | null }
}
