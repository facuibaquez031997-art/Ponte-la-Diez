export const SURFACES = ['Sintético', 'Césped natural', 'Cemento', 'Parquet'] as const

export interface Cancha {
  id: string
  ownerId: string
  nombre: string
  direccion: string
  barrio: string
  tipoSuperficie: string
  precioHora: number
  montoSena: number
}

export type CanchaInput = Omit<Cancha, 'id' | 'ownerId'>

// Day of the week as the API sends it: 0 = Sunday ... 6 = Saturday.
export interface Franja {
  dia: number
  desde: string
  hasta: string
}
