import { useState } from 'react'
import type { Cancha, TurnoLibre } from '../../types/canchas'
import { formatSlotTime } from '../../utils/dates'
import { formatPesos } from '../../utils/money'
import BookingDialog from '../common/BookingDialog'

interface VenueCardProps {
  cancha: Cancha
  // Free slots of the chosen day.
  slots: TurnoLibre[]
  // AAAA-MM-DD day the slots belong to.
  fecha: string
  // Only players book: owners and visitors see the slots read-only.
  canBook: boolean
  // Somebody else took the chosen slot first, so the free slots must be loaded again.
  onSlotTaken: () => void
}

const VenueCard = ({ cancha, slots, fecha, canBook, onSlotTaken }: VenueCardProps) => {
  const [photoIndex, setPhotoIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)
  const { fotos } = cancha
  const current = fotos[photoIndex] ?? fotos[0]
  // A slot that disappeared (other day, already taken) is no longer selected.
  const selected = slots.find((slot) => slot.id === selectedId) ?? null

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-md">
      <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-primary-container via-on-primary-fixed-variant to-secondary">
        {current ? (
          <img
            src={current.url}
            alt={`Foto de ${cancha.nombre}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="material-symbols-outlined absolute -right-6 -top-6 text-[180px] text-white/10"
          >
            sports_soccer
          </span>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary-container/80 via-transparent to-black/20" />

        <span className="absolute left-3 top-3 rounded-full bg-primary-container px-2 py-1 font-display text-eyebrow-badge uppercase text-secondary-container">
          {cancha.tipoSuperficie}
        </span>

        <div className="absolute bottom-3 left-3 right-3 text-on-primary">
          <span className="font-display text-eyebrow-badge uppercase text-secondary-container">
            {cancha.barrio}
          </span>
          <h3 className="font-display text-headline-sm uppercase leading-none text-on-primary">
            {cancha.nombre}
          </h3>
        </div>
      </div>

      {fotos.length > 1 && (
        <ul className="flex gap-2 px-6 pt-4" aria-label={`Fotos de ${cancha.nombre}`}>
          {fotos.map((foto, index) => (
            <li key={foto.id}>
              <button
                type="button"
                onClick={() => setPhotoIndex(index)}
                aria-label={`Ver la foto ${index + 1}`}
                aria-pressed={foto === current}
                className={`h-12 w-16 overflow-hidden rounded-lg ring-2 transition-all ${
                  foto === current ? 'ring-secondary-container' : 'ring-transparent opacity-70'
                }`}
              >
                <img src={foto.url} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-grow flex-col justify-between gap-4 p-6">
        <div className="flex items-start justify-between gap-3 text-xs text-on-surface-variant">
          <div className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[18px] text-secondary"
            >
              near_me
            </span>
            <span>{cancha.direccion}</span>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-title-md font-bold text-on-surface">
              {formatPesos(cancha.precioHora)}{' '}
              <span className="text-xs font-normal text-on-surface-variant">/h</span>
            </span>
            <p className="text-xs text-on-surface-variant">Seña {formatPesos(cancha.montoSena)}</p>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-label-sm uppercase text-on-surface-variant">
              Turnos disponibles
            </span>
            <span className="text-label-sm font-semibold text-secondary">
              {slots.length} {slots.length === 1 ? 'libre' : 'libres'}
            </span>
          </div>
          {slots.length === 0 ? (
            <p className="rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">
              No hay turnos libres para ese día.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-1">
              {slots.map((slot) => {
                const isSelected = slot.id === selected?.id
                const content = (
                  <>
                    <span>{formatSlotTime(slot.fechaHoraInicio)}</span>
                    <span
                      className={`text-[10px] font-normal uppercase leading-none ${
                        isSelected ? 'text-secondary-container' : 'text-secondary'
                      }`}
                    >
                      {isSelected ? 'Seleccionado' : 'Libre'}
                    </span>
                  </>
                )
                return (
                  <li key={slot.id}>
                    {canBook ? (
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedId(slot.id)}
                        className={`flex h-11 w-full flex-col items-center justify-center rounded-lg text-base font-bold transition-all active:scale-[0.97] ${
                          isSelected
                            ? 'bg-primary-container text-on-primary ring-2 ring-secondary-container'
                            : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                        }`}
                      >
                        {content}
                      </button>
                    ) : (
                      <div className="flex h-11 flex-col items-center justify-center rounded-lg bg-surface-container-low text-base font-bold text-on-surface">
                        {content}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {canBook && slots.length > 0 && (
          <button
            type="button"
            disabled={!selected}
            onClick={() => setBooking(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-container font-display text-title-md uppercase tracking-wide text-on-primary transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reservar turno
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
              bolt
            </span>
          </button>
        )}
      </div>

      {booking && selected && (
        <BookingDialog
          cancha={cancha}
          slot={selected}
          fecha={fecha}
          onClose={() => setBooking(false)}
          onSlotTaken={() => {
            setBooking(false)
            setSelectedId(null)
            onSlotTaken()
          }}
        />
      )}
    </article>
  )
}

export default VenueCard
