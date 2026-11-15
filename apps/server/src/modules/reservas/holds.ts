import type { PrismaService } from '../../common/prisma/prisma.service.js'

/** How long an unpaid booking keeps its slot before the slot goes back to FREE. */
export const HOLD_MS = 15 * 60 * 1000

export interface HoldScope {
  canchaId?: string
  userId?: string
  /** Only the bookings of the courts of this owner. */
  ownerId?: string
}

/**
 * Releases the slots of PENDING bookings that were not paid within the hold time.
 * The booking is deleted (not cancelled) because `Reserva.turnoId` is unique and the
 * slot must be bookable again. A booking with an APPROVED payment is never removed.
 * Returns how many bookings were released. Safe to run any number of times.
 */
export async function releaseExpiredHolds(
  prisma: PrismaService,
  now: Date,
  scope: HoldScope = {}
): Promise<number> {
  const expired = await prisma.reserva.findMany({
    where: {
      estado: 'PENDING',
      createdAt: { lt: new Date(now.getTime() - HOLD_MS) },
      // `Pago` has no cascade: deleting a booking that kept its payment would break the FK.
      OR: [{ pago: null }, { pago: { estadoPago: { not: 'APPROVED' } } }],
      ...(scope.userId ? { userId: scope.userId } : {}),
      ...(scope.canchaId || scope.ownerId
        ? {
            turno: {
              ...(scope.canchaId ? { canchaId: scope.canchaId } : {}),
              ...(scope.ownerId ? { cancha: { ownerId: scope.ownerId } } : {}),
            },
          }
        : {}),
    },
    select: { id: true, turnoId: true },
  })
  if (expired.length === 0) return 0

  const reservaIds = expired.map((reserva) => reserva.id)
  const turnoIds = expired.map((reserva) => reserva.turnoId)
  await prisma.$transaction([
    prisma.pago.deleteMany({
      where: { reservaId: { in: reservaIds }, estadoPago: { not: 'APPROVED' } },
    }),
    prisma.reserva.deleteMany({ where: { id: { in: reservaIds }, estado: 'PENDING' } }),
    prisma.turno.updateMany({
      // A booking confirmed meanwhile (webhook) is still attached to its slot: keep it RESERVED.
      where: { id: { in: turnoIds }, estado: 'RESERVED', reserva: null },
      data: { estado: 'FREE' },
    }),
  ])
  return expired.length
}
