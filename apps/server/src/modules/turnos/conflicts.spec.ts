import { vi } from 'vitest'
import { findBlocked } from './conflicts.js'

const H18 = new Date('2026-11-20T21:00:00.000Z') // 18:00 local
const H19 = new Date('2026-11-20T22:00:00.000Z')
const range = {
  gte: new Date('2026-11-20T03:00:00.000Z'),
  lt: new Date('2026-11-21T03:00:00.000Z'),
}

const ONCE = 'e-11' // an entry of courts of 11 (the tests say how many)
const CINCO = 'e-5' // an entry of courts of 5
const CINCO_B = 'e-5b'

interface Link {
  canchaId: string
  numero: number
  otraCanchaId: string
  otraNumero: number
}
interface Confirmed {
  canchaId: string
  numero: number
  fechaHoraInicio: Date
}

/** A link between courts is stored both ways: the same pair seen from each side. */
const link = (a: string, an: number, b: string, bn: number): Link[] => [
  { canchaId: a, numero: an, otraCanchaId: b, otraNumero: bn },
  { canchaId: b, numero: bn, otraCanchaId: a, otraNumero: an },
]

const makeDb = (links: Link[], confirmed: Confirmed[] = []) => ({
  canchaConflicto: {
    findMany: vi.fn(async (args: { where: { canchaId: { in: string[] } } }) =>
      links.filter((item) => args.where.canchaId.in.includes(item.canchaId))
    ),
  },
  turno: {
    findMany: vi.fn(async (args: { where: { canchaId: { in: string[] } } }) =>
      confirmed.filter((slot) => args.where.canchaId.in.includes(slot.canchaId))
    ),
  },
})

const blockedFor = (db: ReturnType<typeof makeDb>, ids: string[]) =>
  findBlocked(db as never, ids, range)

describe('findBlocked', () => {
  describe('a court of 11 divided into 3 of 5 (each entry linked as a whole)', () => {
    const links = link(ONCE, 0, CINCO, 0)

    it('a confirmed 5 blocks the 11 at that hour, and only that hour', async () => {
      const db = makeDb(links, [{ canchaId: CINCO, numero: 2, fechaHoraInicio: H18 }])

      const blocked = await blockedFor(db, [ONCE, CINCO])

      expect(blocked.of(ONCE, H18, 1)).toBe(CINCO)
      expect(blocked.of(ONCE, H19, 1)).toBeUndefined()
    })

    it('the other courts of 5 are not blocked by a 5 (they are the same entry)', async () => {
      const db = makeDb(links, [{ canchaId: CINCO, numero: 2, fechaHoraInicio: H18 }])

      const blocked = await blockedFor(db, [ONCE, CINCO])

      for (const numero of [1, 2, 3]) expect(blocked.of(CINCO, H18, numero)).toBeUndefined()
    })

    it('a confirmed 11 blocks every court of 5 at that hour', async () => {
      const db = makeDb(links, [{ canchaId: ONCE, numero: 1, fechaHoraInicio: H18 }])

      const blocked = await blockedFor(db, [ONCE, CINCO])

      for (const numero of [1, 2, 3]) expect(blocked.of(CINCO, H18, numero)).toBe(ONCE)
      expect(blocked.of(CINCO, H19, 1)).toBeUndefined()
    })
  })

  describe('several courts of 11, only one of them divided', () => {
    // The entry of 11 has two courts. The court 1 is divided into the 3 of 5; the court 2 is pure.
    const links = link(ONCE, 1, CINCO, 0)

    it('a confirmed 5 blocks ONLY the court 1 of the 11: the court 2 stays free', async () => {
      const db = makeDb(links, [{ canchaId: CINCO, numero: 1, fechaHoraInicio: H18 }])

      const blocked = await blockedFor(db, [ONCE])

      expect(blocked.of(ONCE, H18, 1)).toBe(CINCO)
      expect(blocked.of(ONCE, H18, 2)).toBeUndefined()
    })

    it('a confirmed court 1 of the 11 blocks the 5s', async () => {
      const db = makeDb(links, [{ canchaId: ONCE, numero: 1, fechaHoraInicio: H18 }])

      const blocked = await blockedFor(db, [CINCO])

      for (const numero of [1, 2, 3]) expect(blocked.of(CINCO, H18, numero)).toBe(ONCE)
    })

    it('a confirmed court 2 of the 11 (the pure one) blocks nothing', async () => {
      const db = makeDb(links, [{ canchaId: ONCE, numero: 2, fechaHoraInicio: H18 }])

      const blocked = await blockedFor(db, [CINCO])

      expect(blocked.size).toBe(0)
      for (const numero of [1, 2, 3]) expect(blocked.of(CINCO, H18, numero)).toBeUndefined()
    })
  })

  describe('two divisible courts of 11, each with its own entry of 5', () => {
    const links = [...link(ONCE, 1, CINCO, 0), ...link(ONCE, 2, CINCO_B, 0)]

    it('a confirmed court 1 of the 11 blocks the first 5s and not the second ones', async () => {
      const db = makeDb(links, [{ canchaId: ONCE, numero: 1, fechaHoraInicio: H18 }])

      const blocked = await blockedFor(db, [CINCO, CINCO_B])

      expect(blocked.of(CINCO, H18, 1)).toBe(ONCE)
      expect(blocked.of(CINCO_B, H18, 1)).toBeUndefined()
    })

    it('a confirmed 5 of the second entry blocks only the court 2 of the 11', async () => {
      const db = makeDb(links, [{ canchaId: CINCO_B, numero: 3, fechaHoraInicio: H18 }])

      const blocked = await blockedFor(db, [ONCE])

      expect(blocked.of(ONCE, H18, 2)).toBe(CINCO_B)
      expect(blocked.of(ONCE, H18, 1)).toBeUndefined()
    })
  })

  describe('a link to one specific court of the OTHER entry', () => {
    it('only that court blocks, not the others of its entry', async () => {
      // The 5s sit inside the court 2 of the 11 only.
      const links = link(CINCO, 0, ONCE, 2)
      const db = makeDb(links, [
        { canchaId: ONCE, numero: 1, fechaHoraInicio: H18 },
        { canchaId: ONCE, numero: 2, fechaHoraInicio: H19 },
      ])

      const blocked = await blockedFor(db, [CINCO])

      expect(blocked.of(CINCO, H18, 1)).toBeUndefined() // the court 1 of the 11 is somewhere else
      expect(blocked.of(CINCO, H19, 1)).toBe(ONCE)
    })
  })

  describe('what counts', () => {
    it('asks only for CONFIRMED bookings: one that waits for its payment does not block', async () => {
      const db = makeDb(link(ONCE, 0, CINCO, 0))

      await blockedFor(db, [ONCE])

      expect(db.turno.findMany).toHaveBeenCalledWith({
        where: {
          canchaId: { in: [CINCO] },
          estado: 'RESERVED',
          reserva: { is: { estado: 'CONFIRMED' } },
          fechaHoraInicio: range,
        },
        select: { canchaId: true, numero: true, fechaHoraInicio: true },
      })
    })

    it('nothing is blocked when the linked entry has no confirmed booking', async () => {
      const db = makeDb(link(ONCE, 0, CINCO, 0), [])

      expect((await blockedFor(db, [ONCE, CINCO])).size).toBe(0)
    })

    it('nothing is blocked when no entry shares the space, and no slot is read', async () => {
      const db = makeDb([], [{ canchaId: CINCO, numero: 1, fechaHoraInicio: H18 }])

      const blocked = await blockedFor(db, [ONCE, CINCO])

      expect(blocked.size).toBe(0)
      expect(db.turno.findMany).not.toHaveBeenCalled()
    })

    it('answers nothing for an empty list of entries, without reading anything', async () => {
      const db = makeDb(link(ONCE, 0, CINCO, 0))

      expect((await blockedFor(db, [])).size).toBe(0)
      expect(db.canchaConflicto.findMany).not.toHaveBeenCalled()
    })

    it('knows several linked entries at once', async () => {
      const links = [...link(ONCE, 0, CINCO, 0), ...link(ONCE, 0, 'e-7', 0)]
      const db = makeDb(links, [
        { canchaId: CINCO, numero: 1, fechaHoraInicio: H18 },
        { canchaId: 'e-7', numero: 1, fechaHoraInicio: H19 },
      ])

      const blocked = await blockedFor(db, [ONCE])

      expect(blocked.of(ONCE, H18, 1)).toBe(CINCO)
      expect(blocked.of(ONCE, H19, 1)).toBe('e-7')
    })

    it('links that already existed (0 with 0) keep meaning "every court with every court"', async () => {
      const db = makeDb(link(ONCE, 0, CINCO, 0), [
        { canchaId: CINCO, numero: 3, fechaHoraInicio: H18 },
      ])

      const blocked = await blockedFor(db, [ONCE])

      expect(blocked.of(ONCE, H18, 1)).toBe(CINCO)
      expect(blocked.of(ONCE, H18, 5)).toBe(CINCO)
    })
  })
})
