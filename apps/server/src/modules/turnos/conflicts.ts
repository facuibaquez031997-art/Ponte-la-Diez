import type { Prisma } from '@prisma/client'

/** A court entry at an hour, whichever of its slots (one per court of the entry) is meant. */
export const hourKey = (canchaId: string, start: Date): string => `${canchaId}#${start.getTime()}`

type Db = Pick<Prisma.TransactionClient, 'canchaConflicto' | 'turno'>

/**
 * The slots that cannot be booked because an entry that shares the physical space with theirs is
 * reserved at the same hour (one court of 11 divided into 3 of 5: booking one blocks the other).
 *
 * Maps `hourKey(blocked entry, start)` to the id of the entry that holds the space. A booking that
 * still waits for its payment already counts (its slot is RESERVED), so two players cannot pay for
 * the same ground. Nothing is stored: it is worked out on every read, so an expired hold or a
 * cancelled booking frees the others by itself. Courts of the same entry never block each other.
 */
export async function findBlocked(
  db: Db,
  canchaIds: string[],
  range: Prisma.DateTimeFilter
): Promise<Map<string, string>> {
  const blocked = new Map<string, string>()
  if (canchaIds.length === 0) return blocked

  const links = await db.canchaConflicto.findMany({
    where: { canchaId: { in: canchaIds } },
    select: { canchaId: true, otraCanchaId: true },
  })
  if (links.length === 0) return blocked

  const reserved = await db.turno.findMany({
    where: {
      canchaId: { in: [...new Set(links.map((link) => link.otraCanchaId))] },
      estado: 'RESERVED',
      fechaHoraInicio: range,
    },
    select: { canchaId: true, fechaHoraInicio: true },
  })

  for (const link of links) {
    for (const slot of reserved) {
      if (slot.canchaId === link.otraCanchaId) {
        blocked.set(hourKey(link.canchaId, slot.fechaHoraInicio), link.otraCanchaId)
      }
    }
  }
  return blocked
}
