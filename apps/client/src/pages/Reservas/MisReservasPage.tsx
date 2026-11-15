import { useState } from 'react'
import { Link } from 'react-router-dom'
import ReservaCard from '../../components/stitch/ReservaCard'
import { useMisReservas } from '../../hooks/useMisReservas'
import { usePayReserva } from '../../hooks/usePayReserva'
import { useStartConversacion } from '../../hooks/useStartConversacion'

const containerClass = 'mx-auto w-full max-w-[1280px] px-4 md:px-8 lg:px-12'

const MisReservasPage = () => {
  const { reservas, loading, error } = useMisReservas()
  const { payingId, payError, pay } = usePayReserva()
  const { startingKey, error: chatError, start } = useStartConversacion()
  const [now] = useState(() => Date.now())

  const upcoming = reservas
    .filter((reserva) => new Date(reserva.fechaHoraFin).getTime() >= now)
    .sort((a, b) => a.fechaHoraInicio.localeCompare(b.fechaHoraInicio))
  const past = reservas.filter((reserva) => new Date(reserva.fechaHoraFin).getTime() < now)

  return (
    <main className="min-h-screen w-full bg-background">
      <section className={`${containerClass} py-10`}>
        <div className="mb-6">
          <div className="flex items-center gap-1 font-display text-eyebrow-badge uppercase text-secondary">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              event_available
            </span>
            Tu agenda deportiva
          </div>
          <h1 className="mt-1 font-display text-headline-lg uppercase tracking-tight text-on-surface">
            Mis reservas
          </h1>
        </div>

        {(error || payError || chatError) && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {error ?? payError ?? chatError}
          </p>
        )}

        {loading && <p className="text-sm text-on-surface-variant">Cargando tus reservas...</p>}

        {!loading && !error && reservas.length === 0 && (
          <p className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Todavía no reservaste ningún turno.{' '}
            <Link to="/canchas" className="font-semibold text-secondary underline">
              Explorá las canchas
            </Link>{' '}
            y elegí el tuyo.
          </p>
        )}

        {upcoming.length > 0 && (
          <>
            <h2 className="mb-4 font-display text-headline-md uppercase text-on-surface">
              Próximos turnos
            </h2>
            <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((reserva) => (
                <ReservaCard
                  key={reserva.id}
                  reserva={reserva}
                  onPay={pay}
                  paying={payingId === reserva.id}
                  onContact={(r) => start({ canchaId: r.cancha.id, reservaId: r.id })}
                  contacting={startingKey === reserva.id}
                />
              ))}
            </div>
          </>
        )}

        {past.length > 0 && (
          <>
            <h2 className="mb-4 font-display text-headline-md uppercase text-on-surface">
              Anteriores
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {past.map((reserva) => (
                <ReservaCard key={reserva.id} reserva={reserva} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default MisReservasPage
