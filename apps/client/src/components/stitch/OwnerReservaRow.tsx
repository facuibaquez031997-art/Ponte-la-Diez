import { Link } from 'react-router-dom'
import type { OwnerReserva } from '../../types/reservas'
import { formatSlotShortDate, formatSlotTime } from '../../utils/dates'
import { formatPesos } from '../../utils/money'

interface OwnerReservaRowProps {
  reserva: OwnerReserva
  /** Offered while the turn has not started: nobody can play, so the owner frees it. */
  onCancel?: (reserva: OwnerReserva) => void
  disabled?: boolean
}

const initialsOf = (nombre: string): string =>
  nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')

// Same row as "Horarios de hoy" of the Stitch owner panel: time block, court, who booked,
// price with the seña paid through Mercado Pago, and a state chip.
const OwnerReservaRow = ({ reserva, onCancel, disabled = false }: OwnerReservaRowProps) => {
  const pending = reserva.estado === 'PENDING'
  const paidInFull = !pending && reserva.montoRestante === 0

  const chip = pending
    ? { label: 'Pendiente', className: 'bg-error-container text-on-error-container' }
    : paidInFull
      ? { label: 'Pagado', className: 'bg-secondary-container text-on-secondary-fixed' }
      : { label: 'Señado', className: 'bg-secondary-fixed text-on-secondary-container' }

  return (
    <li className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 sm:flex-row sm:items-center">
      <div className="flex w-24 shrink-0 flex-col items-center rounded-lg bg-surface-container-lowest py-2">
        <span className="font-display text-headline-sm text-on-surface">
          {formatSlotTime(reserva.fechaHoraInicio)}
        </span>
        <span className="text-[10px] font-semibold uppercase text-on-surface-variant">
          {formatSlotShortDate(reserva.fechaHoraInicio)}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-base font-bold text-on-surface">
          {reserva.cancha.nombre}
        </span>
        <span className="flex items-center gap-2 text-sm text-on-surface-variant">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-container text-[10px] font-bold text-on-primary"
          >
            {reserva.jugador.avatarUrl ? (
              <img src={reserva.jugador.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initialsOf(reserva.jugador.nombre)
            )}
          </span>
          <span className="truncate">Reservó {reserva.jugador.nombre}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <div className="text-right">
          <p className="font-bold text-on-surface">{formatPesos(reserva.montoTotal)} total</p>
          {pending ? (
            <p className="text-xs text-error">
              Esperando el pago de {formatPesos(reserva.montoACobrar ?? 0)}
              {reserva.expiraEl && ` · vence ${formatSlotTime(reserva.expiraEl)} hs`}
            </p>
          ) : paidInFull ? (
            <p className="text-xs text-secondary">Pagó todo por Mercado Pago</p>
          ) : (
            <p className="text-xs text-secondary">
              Seña {formatPesos(reserva.montoPagado)} MP · cobrás{' '}
              {formatPesos(reserva.montoRestante)} en la cancha
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 font-display text-eyebrow-badge uppercase ${chip.className}`}
        >
          {chip.label}
        </span>
        {reserva.conversacionId && (
          <Link
            to={`/mensajes/${reserva.conversacionId}`}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-secondary-container px-3 py-2 text-xs font-semibold text-on-secondary-fixed transition-all hover:bg-secondary-fixed-dim active:scale-[0.98]"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
              chat
            </span>
            Responder
          </Link>
        )}
        {onCancel && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onCancel(reserva)}
            className="shrink-0 rounded-xl bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface transition-all hover:bg-surface-container-high active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar turno
          </button>
        )}
      </div>
    </li>
  )
}

export default OwnerReservaRow
