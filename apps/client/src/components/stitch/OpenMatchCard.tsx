import { useState } from 'react'
import type { OpenMatch } from '../../types/cancha'

const priceFormat = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const AVATAR_TONES = [
  'bg-primary-container text-on-primary',
  'bg-secondary text-on-secondary',
  'bg-surface-tint text-on-primary',
  'bg-black text-on-primary',
]

interface OpenMatchCardProps {
  match: OpenMatch
}

const OpenMatchCard = ({ match }: OpenMatchCardProps) => {
  const [requested, setRequested] = useState(false)
  const missing = match.total - match.joined
  const visibleAvatars = Math.min(match.joined, AVATAR_TONES.length)
  const hiddenPlayers = match.joined - visibleAvatars

  return (
    <article className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container font-display text-headline-sm text-secondary-container">
            {match.initials}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1">
              <h3 className="text-title-md font-bold text-on-surface">{match.teamName}</h3>
              <span className="rounded bg-secondary/15 px-1 py-0.5 text-label-sm uppercase text-secondary">
                Nivel {match.level}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-on-surface-variant">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[16px] text-secondary"
              >
                stadium
              </span>
              <span>{match.venue}</span>
              <span aria-hidden="true">•</span>
              <span className="font-semibold text-on-surface">{match.when}</span>
            </div>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 self-start rounded-full bg-tertiary-fixed px-4 py-1 font-display text-headline-sm uppercase tracking-wide text-on-tertiary-fixed sm:self-center">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            person_alert
          </span>
          ¡Faltan {missing}!
        </div>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-xl bg-surface-container-low p-4 sm:flex-row sm:items-center">
        <div>
          <span className="mb-1 block text-label-sm uppercase text-on-surface-variant">
            Alineación actual ({match.joined}/{match.total} jugadores)
          </span>
          <div className="flex items-center -space-x-2">
            {AVATAR_TONES.slice(0, visibleAvatars).map((tone, index) => (
              <span
                key={tone}
                aria-hidden="true"
                className={`flex h-8 w-8 items-center justify-center rounded-full text-label-sm font-bold ring-2 ring-surface-container-lowest ${tone}`}
              >
                {index + 1}
              </span>
            ))}
            {hiddenPlayers > 0 && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container text-label-sm font-bold text-on-secondary-fixed ring-2 ring-surface-container-lowest">
                +{hiddenPlayers}
              </span>
            )}
            {Array.from({ length: missing }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={`flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-surface-container-lowest text-label-sm font-bold text-secondary ring-2 ring-secondary-container ${
                  index === 0 ? 'ml-3' : ''
                }`}
              >
                ?
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="block text-label-sm uppercase text-on-surface-variant">Tu parte:</span>
            <span className="text-title-md font-bold text-on-surface">
              {priceFormat.format(match.share)}
            </span>
          </div>
          <button
            type="button"
            disabled={requested}
            onClick={() => setRequested(true)}
            className="flex h-11 items-center justify-center gap-1 rounded-xl bg-secondary-container px-5 font-display text-headline-sm uppercase tracking-wider text-on-secondary-fixed transition-all hover:bg-secondary-fixed-dim active:scale-[0.98] disabled:bg-surface-container disabled:text-on-surface-variant"
          >
            {requested ? 'Solicitud enviada' : 'Quiero jugar'}
          </button>
        </div>
      </div>
    </article>
  )
}

export default OpenMatchCard
