import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { getAuthErrorMessage } from '../../pages/Auth/authError'
import { pagosService } from '../../services/pagos.service'
import { reservasService } from '../../services/reservas.service'
import type { Cancha, TurnoLibre } from '../../types/canchas'
import type { TipoPago } from '../../types/reservas'
import { formatLongDate, formatSlotTime } from '../../utils/dates'
import { formatPesos } from '../../utils/money'

interface BookingDialogProps {
  cancha: Cancha
  slot: TurnoLibre
  /** AAAA-MM-DD day the slot belongs to. */
  fecha: string
  onClose: () => void
  /** Somebody else took the slot first: the page must reload the free slots. */
  onSlotTaken: () => void
}

const optionClass = (selected: boolean, disabled: boolean) =>
  `flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-2 transition-all ${
    selected
      ? 'bg-secondary-fixed/40 ring-secondary-container'
      : 'bg-surface-container-low ring-transparent'
  } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-surface-container'}`

const BookingDialog = ({ cancha, slot, fecha, onClose, onSlotTaken }: BookingDialogProps) => {
  const [tipoPago, setTipoPago] = useState<TipoPago>('SENA')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Once the booking exists the choice is fixed; a retry only asks for the payment link again.
  const [reservaId, setReservaId] = useState<string | null>(null)

  const hasSena = cancha.montoSena > 0
  const restante = Math.max(cancha.precioHora - cancha.montoSena, 0)

  useEffect(() => {
    if (submitting) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [submitting, onClose])

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      let id = reservaId
      if (!id) {
        const reserva = await reservasService.create({ turnoId: slot.id, tipoPago })
        id = reserva.id
        setReservaId(id)
      }
      const { initPoint } = await pagosService.createPreference(id)
      window.location.assign(initPoint)
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
      if (isAxiosError(err) && err.response?.status === 409 && !reservaId) onSlotTaken()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-primary-container/60 p-4 backdrop-blur-sm"
      onClick={submitting ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-dialog-title"
        className="w-full max-w-md rounded-3xl bg-surface-container-lowest p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="booking-dialog-title"
          className="font-display text-headline-md uppercase tracking-wide text-on-surface"
        >
          Confirmá tu reserva
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          <span className="font-semibold text-on-surface">{cancha.nombre}</span> · {cancha.barrio}
          <br />
          <span className="capitalize">{formatLongDate(fecha)}</span> ·{' '}
          {formatSlotTime(slot.fechaHoraInicio)} hs
        </p>

        <fieldset className="mt-5 flex flex-col gap-3" disabled={submitting || reservaId !== null}>
          <legend className="mb-2 text-label-sm uppercase text-on-surface-variant">
            ¿Cómo querés pagar?
          </legend>

          <label className={optionClass(tipoPago === 'SENA', !hasSena)}>
            <input
              type="radio"
              name="tipoPago"
              value="SENA"
              checked={tipoPago === 'SENA'}
              disabled={!hasSena}
              onChange={() => setTipoPago('SENA')}
              className="mt-1 accent-secondary"
            />
            <span className="flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-bold text-on-surface">Pagar la seña</span>
                <span className="font-bold text-on-surface">{formatPesos(cancha.montoSena)}</span>
              </span>
              <span className="mt-1 block text-xs text-on-surface-variant">
                {hasSena
                  ? `Te reserva la cancha al instante. El resto (${formatPesos(restante)}) lo abonás en la cancha al dueño.`
                  : 'Esta cancha no tiene seña configurada.'}
              </span>
            </span>
          </label>

          <label className={optionClass(tipoPago === 'TOTAL', false)}>
            <input
              type="radio"
              name="tipoPago"
              value="TOTAL"
              checked={tipoPago === 'TOTAL'}
              onChange={() => setTipoPago('TOTAL')}
              className="mt-1 accent-secondary"
            />
            <span className="flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-bold text-on-surface">Pagar el total</span>
                <span className="font-bold text-on-surface">{formatPesos(cancha.precioHora)}</span>
              </span>
              <span className="mt-1 block text-xs text-on-surface-variant">
                Dejás el turno pago por completo.
              </span>
            </span>
          </label>
        </fieldset>

        <p className="mt-4 text-xs text-on-surface-variant">
          Tenés 15 minutos para pagar. Pasado ese tiempo el turno vuelve a quedar libre.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl bg-surface-container py-3 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-high active:scale-[0.98] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            autoFocus
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 rounded-xl bg-primary-container py-3 text-sm font-bold text-on-primary transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? 'Redirigiendo...' : 'Ir a Mercado Pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BookingDialog
