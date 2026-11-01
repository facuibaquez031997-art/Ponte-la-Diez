import { useState } from 'react'
import type { Venue } from '../../types/cancha'

const priceFormat = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

interface VenueCardProps {
  venue: Venue
  onReserve?: (venue: Venue, time: string) => void
}

const VenueCard = ({ venue, onReserve }: VenueCardProps) => {
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [favorite, setFavorite] = useState(false)
  const freeCount = venue.slots.filter((slot) => slot.status === 'FREE').length

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-md">
      <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-primary-container via-on-primary-fixed-variant to-secondary">
        <span
          aria-hidden="true"
          className="material-symbols-outlined absolute -right-6 -top-6 text-[180px] text-white/10 transition-transform duration-500 group-hover:scale-105"
        >
          sports_soccer
        </span>
        <div className="absolute inset-0 bg-gradient-to-t from-primary-container/80 via-transparent to-black/20" />

        <span className="absolute left-3 top-3 rounded-full bg-primary-container px-2 py-1 font-display text-eyebrow-badge uppercase text-secondary-container">
          {venue.format} • {venue.surface}
        </span>
        <button
          type="button"
          onClick={() => setFavorite((value) => !value)}
          aria-pressed={favorite}
          aria-label="Guardar en favoritos"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-lowest/80 text-on-surface backdrop-blur-sm transition-colors hover:text-error"
        >
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-[20px]"
            style={{ fontVariationSettings: `'FILL' ${favorite ? 1 : 0}` }}
          >
            favorite
          </span>
        </button>

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-on-primary">
          <div>
            <span className="font-display text-eyebrow-badge uppercase text-secondary-container">
              {venue.highlight}
            </span>
            <h3 className="font-display text-headline-sm uppercase leading-none text-on-primary">
              {venue.name}
            </h3>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-surface-container-lowest/90 px-2 py-1 text-on-surface">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[16px] text-secondary-container"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              star
            </span>
            <span className="text-xs font-bold">{venue.rating.toFixed(1)}</span>
            <span className="text-xs text-on-surface-variant">({venue.reviews})</span>
          </div>
        </div>
      </div>

      <div className="flex flex-grow flex-col justify-between gap-4 p-6">
        <div className="flex items-center justify-between gap-3 text-xs text-on-surface-variant">
          <div className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-[18px] text-secondary"
            >
              near_me
            </span>
            <span>
              {venue.distance} • {venue.address}
            </span>
          </div>
          <span className="shrink-0 text-title-md font-bold text-on-surface">
            {priceFormat.format(venue.pricePerHour)}{' '}
            <span className="text-xs font-normal text-on-surface-variant">/h</span>
          </span>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-label-sm uppercase text-on-surface-variant">
              Turnos disponibles hoy
            </span>
            <span className="text-label-sm font-semibold text-secondary">{freeCount} libres</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {venue.slots.map(({ time, status }) => {
              const busy = status === 'BUSY'
              const selected = selectedTime === time
              return (
                <button
                  key={time}
                  type="button"
                  disabled={busy}
                  aria-pressed={selected}
                  onClick={() => setSelectedTime(selected ? null : time)}
                  className={`flex h-11 flex-col items-center justify-center rounded-lg text-base font-bold transition-colors ${
                    busy
                      ? 'cursor-not-allowed bg-surface-container text-outline-variant line-through'
                      : selected
                        ? 'bg-primary-container text-secondary-container ring-2 ring-secondary-container'
                        : 'bg-surface-container-low text-on-surface hover:bg-primary-container hover:text-secondary-container'
                  }`}
                >
                  <span>{time}</span>
                  <span
                    className={`text-[10px] uppercase leading-none no-underline ${
                      busy
                        ? 'font-normal text-outline-variant'
                        : selected
                          ? 'font-semibold text-secondary-container'
                          : 'font-normal text-secondary'
                    }`}
                  >
                    {busy ? 'Ocupado' : selected ? 'Seleccionado' : 'Libre'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={!selectedTime}
          onClick={() => selectedTime && onReserve?.(venue, selectedTime)}
          className="flex h-11 w-full items-center justify-center gap-1 rounded-xl bg-primary-container font-display text-headline-sm uppercase tracking-wider text-on-primary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>Reservar turno</span>
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-[18px] text-secondary-container"
          >
            bolt
          </span>
        </button>
      </div>
    </article>
  )
}

export default VenueCard
