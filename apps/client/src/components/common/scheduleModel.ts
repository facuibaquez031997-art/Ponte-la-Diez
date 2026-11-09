import type { Franja } from '../../types/canchas'

// Whole hours only: `desde` goes from 0 to 23 and `hasta` from 1 to 24 (24 = midnight).
export interface HourRange {
  desde: number
  hasta: number
}

export type WeekSchedule = Record<number, HourRange[]>

// Monday first, as people read a week; the API numbers Sunday as 0.
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export const DAY_NAMES: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  0: 'Domingo',
}

export const DEFAULT_RANGE: HourRange = { desde: 18, hasta: 22 }

const pad = (hour: number) => String(hour).padStart(2, '0')

export const startLabel = (hour: number) => `${pad(hour)}:00`

export const endLabel = (hour: number) => (hour === 24 ? '00:00 (medianoche)' : `${pad(hour)}:00`)

export const emptySchedule = (): WeekSchedule => ({
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
})

const toHour = (time: string) => Number(time.slice(0, 2))

export const fromFranjas = (franjas: Franja[]): WeekSchedule => {
  const schedule = emptySchedule()
  for (const franja of franjas) {
    schedule[franja.dia].push({ desde: toHour(franja.desde), hasta: toHour(franja.hasta) })
  }
  return schedule
}

export const toFranjas = (schedule: WeekSchedule): Franja[] =>
  DAY_ORDER.flatMap((dia) =>
    schedule[dia].map((range) => ({
      dia,
      desde: startLabel(range.desde),
      hasta: `${pad(range.hasta)}:00`,
    }))
  )

/** Same rules as the API, so the owner sees the problem before saving. */
export const dayError = (ranges: HourRange[]): string | null => {
  if (ranges.some((range) => range.hasta <= range.desde)) {
    return 'Cada franja tiene que terminar después de empezar.'
  }
  const sorted = [...ranges].sort((a, b) => a.desde - b.desde)
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].desde < sorted[i - 1].hasta) return 'Las franjas de un mismo día se superponen.'
  }
  return null
}

export const scheduleError = (schedule: WeekSchedule): boolean =>
  DAY_ORDER.some((dia) => dayError(schedule[dia]) !== null)

export const countHours = (schedule: WeekSchedule): number =>
  DAY_ORDER.reduce<number>(
    (total, dia) =>
      total + schedule[dia].reduce((sum, range) => sum + (range.hasta - range.desde), 0),
    0
  )
