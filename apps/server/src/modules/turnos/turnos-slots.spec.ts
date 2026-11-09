import { buildSlots, localDayBounds } from './turnos-slots.js'

const mondayNoonLocal = new Date('2026-11-09T15:00:00.000Z') // Mon 12:00 in Argentina (UTC-3)

describe('buildSlots', () => {
  it('turns 15:00-00:00 into one-hour slots in Argentina time', () => {
    const slots = buildSlots(
      [{ diaSemana: 1, minutoInicio: 900, minutoFin: 1440 }],
      mondayNoonLocal,
      1
    )
    expect(slots.map((s) => s.toISOString())).toEqual([
      '2026-11-09T18:00:00.000Z',
      '2026-11-09T19:00:00.000Z',
      '2026-11-09T20:00:00.000Z',
      '2026-11-09T21:00:00.000Z',
      '2026-11-09T22:00:00.000Z',
      '2026-11-09T23:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
      '2026-11-10T01:00:00.000Z',
      '2026-11-10T02:00:00.000Z',
    ])
  })

  it('a 17:00-20:00 court gets 3 slots per open day (el sol)', () => {
    const slots = buildSlots(
      [{ diaSemana: 1, minutoInicio: 1020, minutoFin: 1200 }],
      mondayNoonLocal,
      1
    )
    expect(slots).toHaveLength(3)
  })

  it('covers the rolling window: 14 days include the next monday', () => {
    const slots = buildSlots(
      [{ diaSemana: 1, minutoInicio: 1020, minutoFin: 1200 }],
      mondayNoonLocal,
      14
    )
    expect(slots).toHaveLength(6)
    expect(slots[3].toISOString()).toBe('2026-11-16T20:00:00.000Z')
  })

  it('never offers a slot that already started', () => {
    const now = new Date('2026-11-09T21:30:00.000Z') // Mon 18:30 local
    const slots = buildSlots([{ diaSemana: 1, minutoInicio: 900, minutoFin: 1440 }], now, 1)
    expect(slots[0].toISOString()).toBe('2026-11-09T22:00:00.000Z') // 19:00 local
    expect(slots).toHaveLength(5)
  })

  it('picks the weekday from the local date, not from UTC', () => {
    const now = new Date('2026-11-10T01:00:00.000Z') // Mon 22:00 local, but already Tue in UTC
    const tuesday = [{ diaSemana: 2, minutoInicio: 900, minutoFin: 960 }]
    const slots = buildSlots(tuesday, now, 14)
    expect(slots[0].toISOString()).toBe('2026-11-10T18:00:00.000Z') // Tue 15:00 local
  })

  it('supports several ranges on the same day and no schedule at all', () => {
    const slots = buildSlots(
      [
        { diaSemana: 1, minutoInicio: 600, minutoFin: 720 },
        { diaSemana: 1, minutoInicio: 1020, minutoFin: 1080 },
      ],
      new Date('2026-11-09T05:00:00.000Z'),
      1
    )
    expect(slots).toHaveLength(3)
    expect(buildSlots([], mondayNoonLocal, 14)).toEqual([])
  })
})

describe('localDayBounds', () => {
  it('returns the UTC instants of local midnight to next local midnight', () => {
    const { start, end } = localDayBounds('2026-11-09')
    expect(start.toISOString()).toBe('2026-11-09T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-10T03:00:00.000Z')
  })

  it('rejects impossible dates', () => {
    expect(() => localDayBounds('2026-13-45')).toThrow()
    expect(() => localDayBounds('2026-02-30')).toThrow()
  })
})
