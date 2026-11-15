import type { Oferta } from '../../types/conversaciones'
import { formatSlotDate, formatSlotTime } from '../../utils/dates'
import { formatPesos } from '../../utils/money'

interface OfertaCardProps {
  oferta: Oferta
  /** Whoever wrote the message (the owner) sees the state; the player gets the button. */
  propio: boolean
  onBook: (oferta: Oferta) => void
}

/** The slot the owner offered in a message, with a button so the player books and pays it. */
const OfertaCard = ({ oferta, propio, onBook }: OfertaCardProps) => (
  <div
    className={`mt-2 rounded-xl p-3 ${propio ? 'bg-surface-tint/25' : 'bg-surface-container-low'}`}
  >
    <p className="flex items-center gap-1 font-display text-eyebrow-badge uppercase text-secondary">
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
        event_available
      </span>
      <span className={propio ? 'text-secondary-container' : ''}>Horario ofrecido</span>
    </p>
    <p className="mt-1 font-bold capitalize">{formatSlotDate(oferta.fechaHoraInicio)}</p>
    <p className="text-sm">
      {formatSlotTime(oferta.fechaHoraInicio)} hs · {oferta.cancha.nombre}
    </p>
    <p className={`text-xs ${propio ? 'text-on-primary-container' : 'text-on-surface-variant'}`}>
      {formatPesos(oferta.cancha.precioHora)} el turno · seña {formatPesos(oferta.cancha.montoSena)}
    </p>

    {propio ? (
      <p
        className={`mt-2 text-xs font-semibold ${
          oferta.disponible ? 'text-secondary-container' : 'text-on-primary-container'
        }`}
      >
        {oferta.disponible ? 'Sigue libre' : 'Ya no está libre: lo reservaron o venció'}
      </p>
    ) : (
      <button
        type="button"
        disabled={!oferta.disponible}
        onClick={() => onBook(oferta)}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-container font-display text-title-md uppercase tracking-wide text-on-primary transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {oferta.disponible ? 'Reservar' : 'Ya no está disponible'}
        {oferta.disponible && (
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
            bolt
          </span>
        )}
      </button>
    )}
  </div>
)

export default OfertaCard
