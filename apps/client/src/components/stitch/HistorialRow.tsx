import type { HistorialItem } from '../../types/reservas'
import { formatSlotShortDate, formatSlotTime } from '../../utils/dates'
import { formatPesos } from '../../utils/money'

interface HistorialRowProps {
  item: HistorialItem
  /** Offered while the refund is pending: the owner returned the money outside the app. */
  onMarkRefunded?: (item: HistorialItem) => void
  disabled?: boolean
}

const MOTIVO_CHIP = {
  VENCIDA: { label: 'Vencida', className: 'bg-surface-container-high text-on-surface-variant' },
  CANCELADA_DUENO: { label: 'Cancelada', className: 'bg-error-container text-on-error-container' },
} as const

const HistorialRow = ({ item, onMarkRefunded, disabled = false }: HistorialRowProps) => {
  const chip = MOTIVO_CHIP[item.motivo]
  const refundPending = item.devolucion === 'PENDIENTE'

  return (
    <li className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 sm:flex-row sm:items-center">
      <div className="flex w-24 shrink-0 flex-col items-center rounded-lg bg-surface-container-lowest py-2 opacity-80">
        <span className="font-display text-headline-sm text-on-surface">
          {formatSlotTime(item.turnoInicio)}
        </span>
        <span className="text-[10px] font-semibold uppercase text-on-surface-variant">
          {formatSlotShortDate(item.turnoInicio)}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-base font-bold text-on-surface">{item.cancha.nombre}</span>
        <span className="truncate text-sm text-on-surface-variant">
          {item.motivo === 'VENCIDA'
            ? `${item.jugador.nombre} no pagó a tiempo`
            : `Cancelaste el turno de ${item.jugador.nombre}`}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <div className="text-right">
          <p className="font-bold text-on-surface">{formatPesos(item.montoTotal)} total</p>
          {item.devolucion === 'NO_CORRESPONDE' && (
            <p className="text-xs text-on-surface-variant">No se cobró nada</p>
          )}
          {refundPending && (
            <p className="text-xs font-semibold text-error">
              Devolver {formatPesos(item.montoPagado)} a {item.jugador.nombre}
            </p>
          )}
          {item.devolucion === 'HECHA' && (
            <p className="text-xs text-secondary">
              Devolviste {formatPesos(item.montoPagado)}
              {item.devueltoAt && ` el ${formatSlotShortDate(item.devueltoAt)}`}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 font-display text-eyebrow-badge uppercase ${chip.className}`}
        >
          {chip.label}
        </span>
        {refundPending && onMarkRefunded && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onMarkRefunded(item)}
            className="shrink-0 rounded-xl bg-primary-container px-3 py-2 text-xs font-bold text-on-primary transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ya lo devolví
          </button>
        )}
      </div>
    </li>
  )
}

export default HistorialRow
