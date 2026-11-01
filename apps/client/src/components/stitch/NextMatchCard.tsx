import type { NextMatch } from '../../types/cancha'

interface NextMatchCardProps {
  match: NextMatch
}

const NextMatchCard = ({ match }: NextMatchCardProps) => {
  const extraPlayers = match.confirmed - match.playerInitials.length

  return (
    <div className="relative overflow-hidden rounded-xl bg-primary-container p-6 text-on-primary shadow-xl">
      <div className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-secondary-container/10 blur-2xl" />

      <div className="flex items-center justify-between pb-4">
        <span className="rounded-full bg-secondary-container px-2 py-1 font-display text-eyebrow-badge uppercase text-on-secondary-fixed">
          Turno confirmado • Seña recibida
        </span>
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-[24px] text-secondary-container"
        >
          task_alt
        </span>
      </div>

      <div className="mb-1 flex items-baseline gap-2">
        <span className="font-display text-headline-lg uppercase text-on-primary">
          {match.date}
        </span>
        <span className="font-display text-headline-md uppercase text-secondary-container">
          {match.time}
        </span>
      </div>
      <p className="mb-6 flex items-center gap-1 text-base font-semibold text-on-primary-container">
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-[18px] text-secondary-container"
        >
          pin_drop
        </span>
        {match.venue}
      </p>

      <div className="mb-6 rounded-xl bg-surface-tint/25 p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-label-sm uppercase text-on-primary">
            Tu equipo ({match.confirmed} confirmados)
          </span>
          <span className="text-label-sm font-semibold text-secondary-container">
            100% completo
          </span>
        </div>
        <div className="flex items-center gap-1">
          {match.playerInitials.map((initials, index) => (
            <div
              key={initials}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                index === 0
                  ? 'bg-secondary-container text-on-secondary-fixed'
                  : 'bg-on-secondary text-black'
              }`}
            >
              {initials}
            </div>
          ))}
          {extraPlayers > 0 && (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-bold text-secondary-container">
              +{extraPlayers}
            </div>
          )}
          <span className="ml-1 text-xs text-on-primary-container">Todos pagaron su parte</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="flex h-11 items-center justify-center gap-1 rounded-xl bg-surface-container-lowest/15 text-base font-semibold text-on-primary transition-colors hover:bg-surface-container-lowest/25"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            share
          </span>
          Invitar al grupo
        </button>
        <button
          type="button"
          className="flex h-11 items-center justify-center gap-1 rounded-xl bg-secondary-container font-display text-headline-sm uppercase tracking-wider text-on-secondary-fixed transition-colors hover:bg-secondary-fixed-dim"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            map
          </span>
          Cómo llegar
        </button>
      </div>
    </div>
  )
}

export default NextMatchCard
