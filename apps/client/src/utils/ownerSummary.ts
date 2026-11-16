import type { HistorialItem, OwnerReserva } from '../types/reservas'

export interface OwnerSummary {
  /** Paid online by players, including what was later cancelled. */
  collected: number
  /** Cancelled and paid, waiting for the owner to return it. */
  refundPending: number
  /** Cancelled, paid and already returned by the owner. */
  refunded: number
  /** What stays with the owner: collected minus every refund, made or pending. */
  net: number
  /** Confirmed bookings that have not ended yet. */
  confirmedUpcoming: number
  /** What is left to collect at the court for those bookings. */
  toCollect: number
  /** Unpaid bookings still holding their slot. */
  pendingPayments: number
  confirmedTotal: number
  expired: number
  cancelled: number
  /** Confirmed bookings out of every attempt (confirmed, expired and cancelled), 0 to 100. */
  conversion: number | null
}

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0)

export const summarize = (
  reservas: OwnerReserva[],
  historial: HistorialItem[],
  now: number
): OwnerSummary => {
  const confirmed = reservas.filter((reserva) => reserva.estado === 'CONFIRMED')
  const upcoming = (fin: string) => new Date(fin).getTime() >= now
  const confirmedUpcoming = confirmed.filter((reserva) => upcoming(reserva.fechaHoraFin))

  const collected =
    sum(confirmed.map((r) => r.montoPagado)) + sum(historial.map((h) => h.montoPagado))
  const refundPending = sum(
    historial.filter((h) => h.devolucion === 'PENDIENTE').map((h) => h.montoPagado)
  )
  const refunded = sum(historial.filter((h) => h.devolucion === 'HECHA').map((h) => h.montoPagado))

  const expired = historial.filter((h) => h.motivo === 'VENCIDA').length
  const cancelled = historial.filter((h) => h.motivo === 'CANCELADA_DUENO').length
  // A payment that came in after a court sharing the space was confirmed is a lost booking too.
  const spaceTaken = historial.filter((h) => h.motivo === 'ESPACIO_OCUPADO').length
  const attempts = confirmed.length + expired + cancelled + spaceTaken

  return {
    collected,
    refundPending,
    refunded,
    net: collected - refundPending - refunded,
    confirmedUpcoming: confirmedUpcoming.length,
    toCollect: sum(confirmedUpcoming.map((reserva) => reserva.montoRestante)),
    pendingPayments: reservas.filter(
      (reserva) => reserva.estado === 'PENDING' && upcoming(reserva.fechaHoraFin)
    ).length,
    confirmedTotal: confirmed.length,
    expired,
    cancelled,
    conversion: attempts === 0 ? null : Math.round((confirmed.length / attempts) * 100),
  }
}
