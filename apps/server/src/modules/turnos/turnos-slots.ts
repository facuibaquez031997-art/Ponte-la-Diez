import { BadRequestException } from '@nestjs/common'
import type { FranjaRow } from '../canchas/horarios.js'

// Argentina has no daylight saving time, so a fixed UTC-3 offset is exact.
const OFFSET_MS = 3 * 3_600_000
const DAY_MS = 86_400_000
const SLOT_MINUTES = 60

export const SLOT_MS = SLOT_MINUTES * 60_000
export const WINDOW_DAYS = 14

const localToday = (now: Date): { year: number; month: number; day: number } => {
  const local = new Date(now.getTime() - OFFSET_MS)
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate() }
}

export const windowEnd = (now: Date, days: number): Date => {
  const { year, month, day } = localToday(now)
  return new Date(Date.UTC(year, month, day + days) + OFFSET_MS)
}

export const buildSlots = (franjas: FranjaRow[], now: Date, days: number = WINDOW_DAYS): Date[] => {
  const { year, month, day } = localToday(now)
  const slots: Date[] = []

  for (let i = 0; i < days; i += 1) {
    const localMidnight = Date.UTC(year, month, day + i)
    const weekday = new Date(localMidnight).getUTCDay()
    const dayStart = localMidnight + OFFSET_MS
    const todays = franjas
      .filter((franja) => franja.diaSemana === weekday)
      .sort((a, b) => a.minutoInicio - b.minutoInicio)

    for (const franja of todays) {
      for (
        let minute = franja.minutoInicio;
        minute + SLOT_MINUTES <= franja.minutoFin;
        minute += SLOT_MINUTES
      ) {
        const start = dayStart + minute * 60_000
        if (start > now.getTime()) slots.push(new Date(start))
      }
    }
  }
  return slots
}

export const localDayBounds = (fecha: string): { start: Date; end: Date } => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  if (match) {
    const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])]
    const date = new Date(Date.UTC(year, month, day))
    if (date.getUTCMonth() === month && date.getUTCDate() === day) {
      const start = new Date(date.getTime() + OFFSET_MS)
      return { start, end: new Date(start.getTime() + DAY_MS) }
    }
  }
  throw new BadRequestException('La fecha no es válida, usá el formato AAAA-MM-DD')
}
