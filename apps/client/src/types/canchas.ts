export const SURFACES = ['Sintético', 'Césped natural', 'Cemento', 'Parquet'] as const

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
  precioMax: string
}

export type CanchaInput = Omit<Cancha, 'id' | 'ownerId' | 'fotos'>

// Day of the week as the API sends it: 0 = Sunday ... 6 = Saturday.
export interface Franja {
  dia: number
  desde: string
  hasta: string
}
