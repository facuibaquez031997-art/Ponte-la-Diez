import { vi } from 'vitest'
import { findBlocked, hourKey } from './conflicts.js'

const H18 = new Date('2026-11-20T21:00:00.000Z') // 18:00 local
const H19 = new Date('2026-11-20T22:00:00.000Z')
const range = {
  gte: new Date('2026-11-20T03:00:00.000Z'),
  lt: new Date('2026-11-21T03:00:00.000Z'),
}

// One court of 11 divided into 3 of 5: the entries share the space, in both directions.
const ONCE = 'c-11'
const CINCO = 'c-5'
const BOTH_WAYS = [
  { canchaId: ONCE, otraCanchaId: CINCO },
  { canchaId: CINCO, otraCanchaId: ONCE },
]

const makeDb = (
  links = BOTH_WAYS,
  reserved: { canchaId: string; fechaHoraInicio: Date }[] = []
) => ({
  canchaConflicto: {
    findMany: vi.fn(async (args: { where: { canchaId: { in: string[] } } }) =>
      links.filter((link) => args.where.canchaId.in.includes(link.canchaId))
    ),
  },
  turno: {
    findMany: vi.fn(async (args: { where: { canchaId: { in: string[] }; estado: string } }) =>
      reserved.filter(
        (slot) => args.where.canchaId.in.includes(slot.canchaId) && args.where.estado === 'RESERVED'
      )
    ),
  },
})

describe('findBlocked', () => {
  it('blocks the court of 11 at the hour a court of 5 is reserved', async () => {
    const db = makeDb(BOTH_WAYS, [{ canchaId: CINCO, fechaHoraInicio: H18 }])

    const blocked = await findBlocked(db as never, [ONCE, CINCO], range)

    expect([...blocked.entries()]).toEqual([[hourKey(ONCE, H18), CINCO]])
  })

  it('blocks the courts of 5 at the hour the court of 11 is reserved', async () => {
    const db = makeDb(BOTH_WAYS, [{ canchaId: ONCE, fechaHoraInicio: H18 }])

    const blocked = await findBlocked(db as never, [ONCE, CINCO], range)

    expect([...blocked.entries()]).toEqual([[hourKey(CINCO, H18), ONCE]])
  })

  it('only blocks the same hour, not the ones around it', async () => {
    const db = makeDb(BOTH_WAYS, [{ canchaId: CINCO, fechaHoraInicio: H18 }])

    const blocked = await findBlocked(db as never, [ONCE], range)

    expect(blocked.has(hourKey(ONCE, H18))).toBe(true)
    expect(blocked.has(hourKey(ONCE, H19))).toBe(false)
  })

  it('does not block anything when no entry shares the space', async () => {
    const db = makeDb([], [{ canchaId: CINCO, fechaHoraInicio: H18 }])

    const blocked = await findBlocked(db as never, [ONCE, CINCO], range)

    expect(blocked.size).toBe(0)
    // Without links there is nothing to look for: no slots are read.
    expect(db.turno.findMany).not.toHaveBeenCalled()
  })

  it('a court never blocks itself or the other courts of its own entry', async () => {
    // The 5 is reserved, but only the entry of 11 is asked about and linked to it.
    const db = makeDb(BOTH_WAYS, [{ canchaId: CINCO, fechaHoraInicio: H18 }])

    const blocked = await findBlocked(db as never, [CINCO], range)

    expect(blocked.has(hourKey(CINCO, H18))).toBe(false)
  })

  it('does not block anything when the linked entry has no reservation that hour', async () => {
    const db = makeDb(BOTH_WAYS, [])

    expect((await findBlocked(db as never, [ONCE, CINCO], range)).size).toBe(0)
  })

  it('asks only for reserved slots (a booking waiting for its payment already is one) in the range', async () => {
    const db = makeDb(BOTH_WAYS, [])

    await findBlocked(db as never, [ONCE], range)

    expect(db.turno.findMany).toHaveBeenCalledWith({
      where: { canchaId: { in: [CINCO] }, estado: 'RESERVED', fechaHoraInicio: range },
      select: { canchaId: true, fechaHoraInicio: true },
    })
  })

  it('knows several linked entries at once', async () => {
    const links = [
      { canchaId: ONCE, otraCanchaId: CINCO },
      { canchaId: ONCE, otraCanchaId: 'c-7' },
    ]
    const db = makeDb(links, [
      { canchaId: CINCO, fechaHoraInicio: H18 },
      { canchaId: 'c-7', fechaHoraInicio: H19 },
    ])

    const blocked = await findBlocked(db as never, [ONCE], range)

    expect(blocked.get(hourKey(ONCE, H18))).toBe(CINCO)
    expect(blocked.get(hourKey(ONCE, H19))).toBe('c-7')
  })

  it('answers nothing for an empty list of entries, without reading anything', async () => {
    const db = makeDb()

    expect((await findBlocked(db as never, [], range)).size).toBe(0)
    expect(db.canchaConflicto.findMany).not.toHaveBeenCalled()
  })
})
