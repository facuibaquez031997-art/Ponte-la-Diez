import ExploreSearch from '../../components/stitch/ExploreSearch'
import NextMatchCard from '../../components/stitch/NextMatchCard'
import OpenMatchCard from '../../components/stitch/OpenMatchCard'
import VenueCard from '../../components/stitch/VenueCard'
import { SAMPLE_NEXT_MATCH, SAMPLE_OPEN_MATCHES, SAMPLE_VENUES } from './exploreSampleData'

const containerClass = 'mx-auto w-full max-w-[1280px] px-4 md:px-8 lg:px-12'

const ExplorarCanchasPage = () => (
  <main className="min-h-screen w-full bg-background">
    <section className="relative w-full overflow-hidden bg-primary-container pb-10">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary-container via-primary-container to-on-primary-fixed-variant/40" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[340px] w-[720px] -translate-x-1/2 rounded-full bg-secondary-container/20 blur-[110px]" />

      <div className={`${containerClass} relative pt-10`}>
        <div className="mb-4 inline-flex items-center gap-1 rounded-full bg-surface-tint/25 px-4 py-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-secondary-container" />
          <span className="font-display text-eyebrow-badge uppercase tracking-widest text-secondary-container">
            Pontevedra capital del fútbol
          </span>
        </div>

        <div className="mb-10 max-w-3xl">
          <h1 className="mb-2 font-display text-5xl uppercase leading-none tracking-wide text-on-primary sm:text-display-hero">
            La cancha te espera. <br />
            <span className="text-secondary-container">Vos ponete la diez.</span>
          </h1>
          <p className="max-w-2xl text-base text-on-primary-container">
            Reservá tu turno en 60 segundos, armá el equipo o sumate como jugador libre a los
            partidos picantes del oeste bonaerense.
          </p>
        </div>

        <ExploreSearch />
      </div>
    </section>

    <section className={`${containerClass} py-10`}>
      <div className="mb-6 flex flex-col justify-between gap-2 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-1 font-display text-eyebrow-badge uppercase text-secondary">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              verified
            </span>
            Instalaciones verificadas en Pontevedra
          </div>
          <h2 className="mt-1 font-display text-headline-lg uppercase tracking-tight text-on-surface">
            Canchas destacadas para hoy
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {SAMPLE_VENUES.map((venue) => (
          <VenueCard key={venue.id} venue={venue} />
        ))}
      </div>
    </section>

    <section className={`${containerClass} pb-10`}>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div>
            <div className="inline-flex items-center gap-1 rounded-full bg-primary-container px-2 py-1 font-display text-eyebrow-badge uppercase text-secondary-container">
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                group_add
              </span>
              Partidos abiertos
            </div>
            <h2 className="mt-1 font-display text-headline-md uppercase tracking-tight text-on-surface">
              Falta uno, ¿te prendés?
            </h2>
          </div>
          <p className="text-sm text-on-surface-variant">
            Sumate a equipos de tu nivel que ya tienen la cancha pagada y necesitan completar el
            cupo para jugar hoy.
          </p>
          {SAMPLE_OPEN_MATCHES.map((match) => (
            <OpenMatchCard key={match.id} match={match} />
          ))}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <div>
            <div className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-1 font-display text-eyebrow-badge uppercase text-secondary">
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                event_available
              </span>
              Tu agenda deportiva
            </div>
            <h2 className="mt-1 font-display text-headline-md uppercase tracking-tight text-on-surface">
              Próxima fecha confirmada
            </h2>
          </div>
          <NextMatchCard match={SAMPLE_NEXT_MATCH} />

          <div className="flex items-start gap-4 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-fixed text-on-secondary-container">
              <span aria-hidden="true" className="material-symbols-outlined text-[22px]">
                shield
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">
                Reserva protegida Ponte la Diez
              </h3>
              <p className="mt-1 text-xs text-on-surface-variant">
                Tu seña queda en custodia hasta que termina el partido. Cancelación gratuita hasta 4
                horas antes sin costo alguno.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
)

export default ExplorarCanchasPage
