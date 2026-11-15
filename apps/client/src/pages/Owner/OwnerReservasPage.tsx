import { useState } from 'react'
import OwnerReservaRow from '../../components/stitch/OwnerReservaRow'
import { useOwnerReservas } from '../../hooks/useOwnerReservas'
import { formatPesos } from '../../utils/money'

interface StatProps {
  label: string
  value: string
  detail: string
  danger?: boolean
}

const Stat = ({ label, value, detail, danger = false }: StatProps) => (
  <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sm">
    <p className="text-label-sm uppercase text-on-surface-variant">{label}</p>
    <p
      className={`mt-2 font-display text-headline-lg ${danger ? 'text-error' : 'text-on-surface'}`}
    >
      {value}
    </p>
    <p className="text-xs text-on-surface-variant">{detail}</p>
  </div>
)

const OwnerReservasPage = () => {
  const { reservas, loading, error } = useOwnerReservas()
  const [now] = useState(() => Date.now())

  const isUpcoming = (fin: string) => new Date(fin).getTime() >= now
  const upcoming = reservas.filter((reserva) => isUpcoming(reserva.fechaHoraFin))
  const past = reservas.filter((reserva) => !isUpcoming(reserva.fechaHoraFin)).reverse()

  const confirmedUpcoming = upcoming.filter((reserva) => reserva.estado === 'CONFIRMED')
  const pending = upcoming.filter((reserva) => reserva.estado === 'PENDING')
  const collected = reservas
    .filter((reserva) => reserva.estado === 'CONFIRMED')
    .reduce((sum, reserva) => sum + reserva.montoPagado, 0)
  const toCollect = confirmedUpcoming.reduce((sum, reserva) => sum + reserva.montoRestante, 0)

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-6 md:px-8 lg:px-12 lg:py-10">
      <section className="flex flex-col gap-1">
        <p className="text-label-sm uppercase tracking-wider text-secondary">Modo dueño</p>
        <h1 className="font-display text-headline-lg uppercase tracking-tight text-on-surface">
          Reservas
        </h1>
        <p className="text-sm text-on-surface-variant">
          Los turnos que reservaron los jugadores en tus canchas, lo que ya cobraste por Mercado
          Pago y lo que falta cobrar en la cancha.
        </p>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-on-surface-variant">Cargando las reservas...</p>}

      {!loading && !error && (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Turnos confirmados"
              value={String(confirmedUpcoming.length)}
              detail="próximos, ya pagados"
            />
            <Stat
              label="Cobrado por Mercado Pago"
              value={formatPesos(collected)}
              detail="señas y pagos totales"
            />
            <Stat
              label="Por cobrar en la cancha"
              value={formatPesos(toCollect)}
              detail="el resto de las señas"
            />
            <Stat
              label="Pagos pendientes"
              value={String(pending.length)}
              detail="esperando el pago del jugador"
              danger={pending.length > 0}
            />
          </section>

          {reservas.length === 0 && (
            <p className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
              Todavía no hay reservas en tus canchas. Cuando un jugador reserve un turno y pague, lo
              vas a ver acá y te llega un aviso.
            </p>
          )}

          {upcoming.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-headline-md uppercase text-on-surface">
                Próximos turnos
              </h2>
              <ul className="flex flex-col gap-3">
                {upcoming.map((reserva) => (
                  <OwnerReservaRow key={reserva.id} reserva={reserva} />
                ))}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="font-display text-headline-md uppercase text-on-surface">
                Anteriores
              </h2>
              <ul className="flex flex-col gap-3">
                {past.map((reserva) => (
                  <OwnerReservaRow key={reserva.id} reserva={reserva} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}

export default OwnerReservasPage
