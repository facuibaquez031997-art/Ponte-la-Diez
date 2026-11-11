import { BadRequestException } from '@nestjs/common'

export interface FranjaInput {
  dia: number
  desde: string
  hasta: string
}

export interface FranjaRow {
  diaSemana: number
  minutoInicio: number
  minutoFin: number
}

const MINUTES_PER_DAY = 1440

const toMinutes = (time: string, isEnd: boolean): number => {
  const hours = Number(time.slice(0, 2))
  const minutes = hours * 60
  return isEnd && minutes === 0 ? MINUTES_PER_DAY : minutes
}

export const formatMinutes = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`

export const normalizeFranjas = (franjas: FranjaInput[]): FranjaRow[] => {
  const rows = franjas.map((franja) => ({
    diaSemana: franja.dia,
    minutoInicio: toMinutes(franja.desde, false),
    minutoFin: toMinutes(franja.hasta, true),
  }))

  for (const row of rows) {
    if (row.minutoInicio >= row.minutoFin) {
      throw new BadRequestException('Cada franja debe terminar después de empezar')
    }
  }

  const sorted = [...rows].sort(
    (a, b) => a.diaSemana - b.diaSemana || a.minutoInicio - b.minutoInicio
  )
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]
    const current = sorted[i]
    if (prev.diaSemana === current.diaSemana && current.minutoInicio < prev.minutoFin) {
      throw new BadRequestException('Las franjas de un mismo día no pueden superponerse')
    }
  }
  return rows
}
