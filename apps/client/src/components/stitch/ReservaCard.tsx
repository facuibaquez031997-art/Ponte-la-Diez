import type { Reserva } from '../../types/reservas'
import { formatSlotDate, formatSlotTime } from '../../utils/dates'
import { formatPesos } from '../../utils/money'

interface ReservaCardProps {
  reserva: Reserva
  /** Shown for a booking that still waits for its payment. */
  onPay?: (reserva: Reserva) => void
  paying?: boolean
}

const badgeText = (reserva: Reserva): string => {
  if (reserva.estado === 'CONFIRMED') {
    return reserva.montoRestante === 0
      ? 'Turno confirmado • Pago completo'
      : 'Turno confirmado • Seña recibida'
  }
  return reserva.estado === 'PENDING' ? 'Pendiente de pago' : 'Reserva cancelada'
}

// Same look as the "Próxima fecha confirmada" card of the Stitch design for a confirmed turn.
const ReservaCard = ({ reserva, onPay, paying = false }: ReservaCardProps) => {
  const confirmed = reserva.estado === 'CONFIRMED'
  const canPay = reserva.estado === 'PENDING' && reserva.montoACobrar !== null && onPay

  const title = confirmed ? 'text-on-primary' : 'text-on-surface'
  const accent = confirmed ? 'text-secondary-container' : 'text-secondary'
  const muted = confirmed ? 'text-on-primary-container' : 'text-on-surface-variant'

  return (
    <article
      className={`relative overflow-hidden rounded-xl p-6 shadow-md ${
        confirmed ? 'bg-primary-container text-on-primary' : 'bg-surface-container-lowest'
      }`}
    >
      <div className="flex items-center justify-between gap-3 pb-4">
        <span
          className={`rounded-full px-2 py-1 font-display text-eyebrow-badge uppercase ${
            confirmed
              ? 'bg-secondary-container text-on-secondary-fixed'
              : 'bg-surface-container-high text-secondary'
          }`}
        >
          {badgeText(reserva)}
        </span>
        <span aria-hidden="true" className={`material-symbols-outlined text-[24px] ${accent}`}>
          {confirmed ? 'task_alt' : 'schedule'}
        </span>
      </div>

      <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
        <span className={`font-display text-headline-lg uppercase ${title}`}>
          {formatSlotDate(reserva.fechaHoraInicio)}
        </span>
        <span className={`font-display text-headline-md uppercase ${accent}`}>
          {formatSlotTime(reserva.fechaHoraInicio)} hs
        </span>
      </div>
      <p className={`flex items-center gap-1 text-base font-semibold ${muted}`}>
        <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${accent}`}>
          pin_drop
        </span>
        {reserva.cancha.nombre} • {reserva.cancha.barrio}
      </p>
      <p className={`mb-5 text-xs ${muted}`}>{reserva.cancha.direccion}</p>

      <dl
        className={`rounded-xl p-4 ${confirmed ? 'bg-surface-tint/25' : 'bg-surface-container-low'}`}
      >
        <div className="flex items-center justify-between py-1 text-sm">
          <dt className={muted}>Total del turno</dt>
          <dd className={`font-semibold ${title}`}>{formatPesos(reserva.montoTotal)}</dd>
        </div>
        {reserva.montoPagado > 0 && (
          <div className="flex items-center justify-between py-1 text-sm">
            <dt className={muted}>Pagado online</dt>
            <dd className={`font-semibold ${title}`}>{formatPesos(reserva.montoPagado)}</dd>
          </div>
        )}
        {confirmed && (
          <div className="mt-1 flex items-center justify-between border-t border-current/10 pt-2">
            <dt className={`text-label-sm uppercase ${title}`}>A pagar en la cancha</dt>
            <dd className={`font-display text-headline-sm ${accent}`}>
              {reserva.montoRestante === 0
                ? 'Nada, ya está todo pago'
                : formatPesos(reserva.montoRestante)}
            </dd>
          </div>
        )}
        {reserva.estado === 'PENDING' && reserva.montoACobrar !== null && (
          <div className="mt-1 flex items-center justify-between border-t border-current/10 pt-2">
            <dt className={`text-label-sm uppercase ${title}`}>A pagar ahora</dt>
            <dd className={`font-display text-headline-sm ${accent}`}>
              {formatPesos(reserva.montoACobrar)}
            </dd>
          </div>
        )}
      </dl>

      {canPay && (
        <button
          type="button"
          disabled={paying}
          onClick={() => onPay(reserva)}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-container font-display text-title-md uppercase tracking-wide text-on-primary transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {paying ? 'Redirigiendo...' : `Pagar ${formatPesos(reserva.montoACobrar ?? 0)}`}
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
            bolt
          </span>
        </button>
      )}
    </article>
  )
}

export default ReservaCard
