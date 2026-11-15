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
 * slot must be bookable again; a history record keeps what the owner needs to see.
 * A booking with an APPROVED payment is never removed.
 * Returns how many bookings were released. Safe to run any number of times, even at once:
 * only the run that really deletes a booking records it and frees its slot.
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
    select: {
      id: true,
      turnoId: true,
      userId: true,
      montoTotal: true,
      createdAt: true,
      turno: { select: { canchaId: true, fechaHoraInicio: true, fechaHoraFin: true } },
    },
  })

  let released = 0
  for (const reserva of expired) {
    const done = await prisma.$transaction(async (tx) => {
      await tx.pago.deleteMany({
        where: { reservaId: reserva.id, estadoPago: { not: 'APPROVED' } },
      })
      const deleted = await tx.reserva.deleteMany({
        where: { id: reserva.id, estado: 'PENDING' },
      })
      if (deleted.count === 0) return false

      await tx.historialReserva.create({
        data: {
          canchaId: reserva.turno.canchaId,
          jugadorId: reserva.userId,
          turnoInicio: reserva.turno.fechaHoraInicio,
          turnoFin: reserva.turno.fechaHoraFin,
          montoTotal: reserva.montoTotal,
          montoPagado: 0,
          mpPaymentId: null,
          motivo: 'VENCIDA',
          devolucion: 'NO_CORRESPONDE',
          reservadaAt: reserva.createdAt,
        },
      })
      // A booking confirmed meanwhile (webhook) is still attached to its slot: keep it RESERVED.
      await tx.turno.updateMany({
        where: { id: reserva.turnoId, estado: 'RESERVED', reserva: null },
        data: { estado: 'FREE' },
      })
      return true
    })
    if (done) released += 1
  }
  return released
}
