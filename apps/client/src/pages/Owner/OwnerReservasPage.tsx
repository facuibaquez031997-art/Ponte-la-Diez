import { useState } from 'react'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import HistorialRow from '../../components/stitch/HistorialRow'
import OwnerReservaRow from '../../components/stitch/OwnerReservaRow'
import { useOwnerReservas } from '../../hooks/useOwnerReservas'
import { reservasService } from '../../services/reservas.service'
import type { HistorialItem, OwnerReserva } from '../../types/reservas'
import { formatPesos } from '../../utils/money'
import { summarize } from '../../utils/ownerSummary'
import { getAuthErrorMessage } from '../Auth/authError'

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

const cancelMessage = (reserva: OwnerReserva): string =>
  reserva.montoPagado > 0
    ? `El turno vuelve a quedar libre y le avisamos a ${reserva.jugador.nombre}. Le devolvemos ${formatPesos(reserva.montoPagado)} desde tu cuenta de Mercado Pago.`
    : `El turno vuelve a quedar libre. ${reserva.jugador.nombre} todavía no había pagado, así que no hay nada que devolver.`

const OwnerReservasPage = () => {
  const { reservas, historial, loading, error, reload } = useOwnerReservas()
  const [now] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<OwnerReserva | null>(null)
  const [refunding, setRefunding] = useState<HistorialItem | null>(null)

  const isUpcoming = (fin: string) => new Date(fin).getTime() >= now
  const upcoming = reservas.filter((reserva) => isUpcoming(reserva.fechaHoraFin))
  const past = reservas.filter((reserva) => !isUpcoming(reserva.fechaHoraFin)).reverse()
  const summary = summarize(reservas, historial, now)

  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      setNotice(await action())
    } catch (err) {
      setActionError(getAuthErrorMessage(err))
    }
    await reload()
    setBusy(false)
  }

  const handleCancel = () => {
    const target = cancelling
    setCancelling(null)
    if (!target) return
    void run(async () => {
      const result = await reservasService.cancel(target.id)
      if (result.devolucion === 'PENDIENTE') {
        return `Cancelaste el turno, pero no pudimos devolverle ${formatPesos(result.montoPagado)} a ${target.jugador.nombre} desde tu cuenta de Mercado Pago. Reintentá la devolución en "Vencidas y canceladas".`
      }
      return result.devolucion === 'HECHA'
        ? `Cancelaste el turno y le devolvimos ${formatPesos(result.montoPagado)} a ${target.jugador.nombre}.`
        : 'Cancelaste el turno. Ya está libre para que otro jugador lo reserve.'
    })
  }

  const handleRetryRefund = () => {
    const target = refunding
    setRefunding(null)
    if (!target) return
    void run(async () => {
      await reservasService.refundNow(target.id)
      return `Le devolvimos ${formatPesos(target.montoPagado)} a ${target.jugador.nombre} desde tu cuenta de Mercado Pago.`
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-6 md:px-8 lg:px-12 lg:py-10">
      <section className="flex flex-col gap-1">
        <p className="text-label-sm uppercase tracking-wider text-secondary">Modo dueño</p>
        <h1 className="font-display text-headline-lg uppercase tracking-tight text-on-surface">
          Reservas
        </h1>
        <p className="text-sm text-on-surface-variant">
          Los turnos que reservaron los jugadores en tus canchas, lo que cobraste por Mercado Pago,
          lo que falta cobrar en la cancha y el historial de lo que se venció o se canceló.
        </p>
      </section>

      {(error || actionError) && (
        <p
          role="alert"
          className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {error ?? actionError}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface"
        >
          {notice}
        </p>
      )}

      {loading && <p className="text-sm text-on-surface-variant">Cargando las reservas...</p>}

      {!loading && !error && (
        <>
          <section aria-label="Resumen" className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Cobrado por Mercado Pago"
                value={formatPesos(summary.collected)}
                detail="señas y pagos totales"
              />
              <Stat
                label="A devolver"
                value={formatPesos(summary.refundPending)}
                detail="de turnos que cancelaste"
                danger={summary.refundPending > 0}
              />
              <Stat
                label="Ya devuelto"
                value={formatPesos(summary.refunded)}
                detail="devoluciones hechas"
              />
              <Stat
                label="Ganancia neta"
                value={formatPesos(summary.net)}
                detail="cobrado menos devoluciones"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Turnos confirmados"
                value={String(summary.confirmedUpcoming)}
                detail="próximos, ya pagados"
              />
              <Stat
                label="Por cobrar en la cancha"
                value={formatPesos(summary.toCollect)}
                detail="el resto de las señas"
              />
              <Stat
                label="Pagos pendientes"
                value={String(summary.pendingPayments)}
                detail="esperando el pago del jugador"
                danger={summary.pendingPayments > 0}
              />
              <Stat
                label="Reservas concretadas"
                value={summary.conversion === null ? '—' : `${summary.conversion}%`}
                detail={`${summary.confirmedTotal} confirmadas · ${summary.expired} vencidas · ${summary.cancelled} canceladas`}
              />
            </div>
          </section>

          {reservas.length === 0 && historial.length === 0 && (
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
                  <OwnerReservaRow
                    key={reserva.id}
                    reserva={reserva}
                    onCancel={
                      new Date(reserva.fechaHoraInicio).getTime() > now ? setCancelling : undefined
                    }
                    disabled={busy}
                  />
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

          {historial.length > 0 && (
            <section className="flex flex-col gap-4">
              <div>
                <h2 className="font-display text-headline-md uppercase text-on-surface">
                  Vencidas y canceladas
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Reservas que no se pagaron a tiempo y turnos que cancelaste. Los turnos quedaron
                  libres para que otro jugador los reserve.
                </p>
              </div>
              <ul className="flex flex-col gap-3">
                {historial.map((item) => (
                  <HistorialRow
                    key={item.id}
                    item={item}
                    onRetryRefund={setRefunding}
                    disabled={busy}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancelar turno"
        message={cancelling ? cancelMessage(cancelling) : ''}
        confirmLabel="Sí, cancelar el turno"
        cancelLabel="No, mantenerlo"
        onConfirm={handleCancel}
        onCancel={() => setCancelling(null)}
      />
      <ConfirmDialog
        open={refunding !== null}
        title="Reintentar devolución"
        message={
          refunding
            ? `Vamos a devolverle ${formatPesos(refunding.montoPagado)} a ${refunding.jugador.nombre} desde tu cuenta de Mercado Pago. Esto no se puede deshacer.`
            : ''
        }
        confirmLabel="Sí, devolver"
        cancelLabel="Todavía no"
        onConfirm={handleRetryRefund}
        onCancel={() => setRefunding(null)}
      />
    </main>
  )
}

export default OwnerReservasPage
