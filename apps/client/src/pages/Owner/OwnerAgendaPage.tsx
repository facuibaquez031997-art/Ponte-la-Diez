import { useSearchParams } from 'react-router-dom'
import DayPicker from '../../components/common/DayPicker'
import AgendaDay from '../../components/stitch/AgendaDay'
import { useAgenda } from '../../hooks/useAgenda'
import { todayInArgentina } from '../../utils/dates'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const OwnerAgendaPage = () => {
  const [params, setParams] = useSearchParams()
  const requested = params.get('fecha')
  const fecha = requested && DATE_PATTERN.test(requested) ? requested : todayInArgentina()
  const canchaId = params.get('cancha') ?? undefined
  const { agenda: loaded, loading, error } = useAgenda(fecha)
  // Right after changing the day the previous day is still in memory: do not show it as this one.
  const agenda = loaded?.fecha === fecha ? loaded : null

  const changeDay = (next: string) => {
    const copy = new URLSearchParams(params)
    copy.set('fecha', next)
    setParams(copy, { replace: true })
  }
  const changeCancha = (next: string) => {
    const copy = new URLSearchParams(params)
    if (next) copy.set('cancha', next)
    else copy.delete('cancha')
    setParams(copy, { replace: true })
  }

  const visible = agenda?.canchas.filter((item) => !canchaId || item.cancha.id === canchaId) ?? []
  const turnos = visible.flatMap((item) => item.turnos)
  const blocked = turnos.filter((turno) => turno.estado === 'FREE' && turno.bloqueadaPor).length
  const free = turnos.filter((turno) => turno.estado === 'FREE').length - blocked
  const waiting = turnos.filter((turno) => turno.reserva?.estado === 'PENDING').length
  const booked = turnos.filter((turno) => turno.estado === 'RESERVED').length - waiting

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 md:px-8 lg:px-12 lg:py-10">
      <section className="flex flex-col gap-1">
        <p className="text-label-sm uppercase tracking-wider text-secondary">Modo dueño</p>
        <h1 className="font-display text-headline-lg uppercase tracking-tight text-on-surface">
          Agenda
        </h1>
        <p className="text-sm text-on-surface-variant">
          Todos los turnos de tus canchas, día por día: cuáles están libres, cuáles reservó un
          jugador y cuáles esperan el pago. Se actualiza sola.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
        <DayPicker fecha={fecha} onChange={changeDay} />
        {agenda && agenda.canchas.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            Cancha
            <select
              value={canchaId ?? ''}
              onChange={(event) => changeCancha(event.target.value)}
              className="rounded-xl bg-surface-container px-3 py-2 text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary-container"
            >
              <option value="">Todas</option>
              {agenda.canchas.map(({ cancha }) => (
                <option key={cancha.id} value={cancha.id}>
                  {cancha.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        {agenda && (
          <p className="text-sm font-semibold text-on-surface" aria-live="polite">
            {free} {free === 1 ? 'turno libre' : 'turnos libres'} · {booked}{' '}
            {booked === 1 ? 'reservado' : 'reservados'} · {waiting} esperando pago
            {blocked > 0 && ` · ${blocked} ${blocked === 1 ? 'bloqueado' : 'bloqueados'}`}
          </p>
        )}
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {error}
        </p>
      )}
      {loading && !agenda && (
        <p className="text-sm text-on-surface-variant">Cargando la agenda...</p>
      )}
      {agenda && <AgendaDay agenda={agenda} canchaId={canchaId} />}
    </main>
  )
}

export default OwnerAgendaPage
