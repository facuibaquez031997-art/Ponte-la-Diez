import type { Prisma } from '@prisma/client'

/** A court entry at an hour, whichever of its courts (slots) is meant. */
export const hourKey = (canchaId: string, start: Date): string => `${canchaId}#${start.getTime()}`

type Db = Pick<Prisma.TransactionClient, 'canchaConflicto' | 'turno'>

/** The courts that cannot be booked at some hours because of what a linked court has confirmed. */
export interface Blocked {
  /** How many (court, hour) pairs are blocked; 0 means nothing is. */
  readonly size: number
  /**
   * The entry that holds the space when that court of that entry is blocked at that hour, or
   * undefined when it is free to book (`numero` is the number of the court within its entry).
   */
  of(canchaId: string, start: Date, numero: number): string | undefined
}

const NOTHING_BLOCKED: Blocked = { size: 0, of: () => undefined }

const slotKey = (canchaId: string, start: Date, numero: number | '*'): string =>
  `${canchaId}#${start.getTime()}#${numero}`

/**
 * Which courts cannot be booked because a court that shares their physical space has a CONFIRMED
 * booking at the same hour (a court of 11 divided into 3 of 5: a paid booking of one blocks the
 * other). A link names the court of each entry that is involved (0 = every court of the entry),
 * so an entry with two courts of 11, only one of them divided, blocks only that one.
 *
 * Only a confirmed booking blocks: one that still waits for its payment holds its own slot but
 * does not block the linked courts. Nothing is stored: it is worked out on every read, so a
 * cancelled booking frees the others by itself. Courts of the same entry never block each other.
 */
export async function findBlocked(
  db: Db,
  canchaIds: string[],
  range: Prisma.DateTimeFilter
): Promise<Blocked> {
  if (canchaIds.length === 0) return NOTHING_BLOCKED

  const links = await db.canchaConflicto.findMany({
    where: { canchaId: { in: canchaIds } },
    select: { canchaId: true, numero: true, otraCanchaId: true, otraNumero: true },
  })
  if (links.length === 0) return NOTHING_BLOCKED

  const confirmed = await db.turno.findMany({
    where: {
      canchaId: { in: [...new Set(links.map((link) => link.otraCanchaId))] },
      estado: 'RESERVED',
      reserva: { is: { estado: 'CONFIRMED' } },
      fechaHoraInicio: range,
    },
    select: { canchaId: true, numero: true, fechaHoraInicio: true },
  })

  const holder = new Map<string, string>()
  for (const link of links) {
    for (const slot of confirmed) {
      const involved =
        slot.canchaId === link.otraCanchaId &&
        (link.otraNumero === 0 || link.otraNumero === slot.numero)
      if (!involved) continue
      holder.set(
        slotKey(link.canchaId, slot.fechaHoraInicio, link.numero === 0 ? '*' : link.numero),
        link.otraCanchaId
      )
    }
  }

  return {
    size: holder.size,
    of: (canchaId, start, numero) =>
      holder.get(slotKey(canchaId, start, numero)) ?? holder.get(slotKey(canchaId, start, '*')),
  }
}
