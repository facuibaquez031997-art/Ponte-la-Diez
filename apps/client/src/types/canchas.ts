export const SURFACES = ['Sintético', 'Césped natural', 'Cemento', 'Parquet'] as const

// Players per side: a court of 5, 7, 9 or 11.
export const TAMANOS = [5, 7, 9, 11] as const

export const MAX_FOTOS = 5

export interface CanchaFoto {
  id: string
  url: string
}

export interface FotoUploadSignature {
  cloudName: string
  apiKey: string
  timestamp: number
  signature: string
  publicId: string
  allowedFormats: string
}

export interface Cancha {
  id: string
  ownerId: string
  nombre: string
  direccion: string
  barrio: string
  tipoSuperficie: string
  // Courts created before the size existed have none until the owner sets it.
  jugadores: number | null
  precioHora: number
  montoSena: number
  // Oldest first: the first photo is the cover.
  fotos: CanchaFoto[]
}

export interface TurnoLibre {
  id: string
  fechaHoraInicio: string
  fechaHoraFin: string
}

// What the explore screen sends to the API; empty text means "no filter".
export interface CanchaFilters {
  barrio: string
  tipoSuperficie: string
  // "" = any size, otherwise "5", "7", "9" or "11".
  jugadores: string
  precioMax: string
}

// The size is required to save a court, even when the stored one has none yet.
export type CanchaInput = Omit<Cancha, 'id' | 'ownerId' | 'fotos' | 'jugadores'> & {
  jugadores: number
}

// Day of the week as the API sends it: 0 = Sunday ... 6 = Saturday.
export interface Franja {
  dia: number
  desde: string
  hasta: string
}
