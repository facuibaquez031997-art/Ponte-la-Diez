import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import TeamList from '../../components/common/TeamList'
import { useAuth } from '../../hooks/useAuth'
import { convocatoriasService } from '../../services/convocatorias.service'
import {
  POSICION_NOUNS,
  type BarrioConvocatoria,
  type Convocatoria,
  type ConvocatoriaTeam,
  type RespuestaEstado,
} from '../../types/convocatorias'
import { getAuthErrorMessage } from '../Auth/authError'

const ESTADO_ABIERTA = 'ABIERTA'
const REFRESH_INTERVAL_MS = 30_000

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

const missingLabel = (call: Convocatoria) => {
  const { singular, plural } = POSICION_NOUNS[call.posicion]
  return call.jugadoresFaltantes === 1
    ? `Falta 1 ${singular}`
    : `Faltan ${call.jugadoresFaltantes} ${plural}`
}

interface CallDetailsProps {
  call: Convocatoria
}

const CallDetails = ({ call }: CallDetailsProps) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="font-display text-headline-sm uppercase text-on-surface">
      {missingLabel(call)}
    </span>
    {call.alcance === 'CONTACTOS' && (
      <span className="flex w-fit items-center gap-1 rounded-full bg-secondary-container/40 px-2 py-0.5 text-xs font-semibold text-on-surface">
        <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
          group
        </span>
        Solo contactos
      </span>
    )}
    <span className="text-sm capitalize text-on-surface-variant">{formatDate(call.fechaHora)}</span>
    {call.canchaNombre && (
      <span className="flex items-center gap-1 text-sm text-on-surface-variant">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
          stadium
        </span>
        {call.canchaNombre}
      </span>
    )}
    {call.mensaje && <p className="text-sm text-on-surface">{call.mensaje}</p>}
  </div>
)

const fetchTeams = async (ids: string[]) => {
  const results = await Promise.allSettled(ids.map((id) => convocatoriasService.team(id)))
  const teams: Record<string, ConvocatoriaTeam> = {}
  results.forEach((result, index) => {
    const id = ids[index]
    if (id && result.status === 'fulfilled') teams[id] = result.value
  })
  return teams
}

const ConvocatoriasPage = () => {
  const { user } = useAuth()
  const [barrioCalls, setBarrioCalls] = useState<BarrioConvocatoria[]>([])
  const [myCalls, setMyCalls] = useState<Convocatoria[]>([])
  const [teams, setTeams] = useState<Record<string, ConvocatoriaTeam>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [forBarrio, mine] = await Promise.all([
        convocatoriasService.listForMyBarrio(),
        convocatoriasService.listMine(),
      ])
      const openMine = mine.filter((call) => call.estado === ESTADO_ABIERTA)
      const acceptedIds = forBarrio
        .filter((call) => call.respuestas[0]?.estado === 'ACEPTADA')
        .map((call) => call.id)

      setBarrioCalls(forBarrio)
      setMyCalls(openMine)
      setTeams(await fetchTeams([...openMine.map((call) => call.id), ...acceptedIds]))
      setError(null)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const first = window.setTimeout(load, 0)
    const timer = window.setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [load])

  const runAction = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id)
    let failure: string | null = null
    try {
      await action()
    } catch (err) {
      failure = getAuthErrorMessage(err)
    }
    await load()
    setError(failure)
    setBusyId(null)
  }

  const handleRespond = (id: string, estado: RespuestaEstado) =>
    runAction(id, () => convocatoriasService.respond(id, estado))

  const handleConfirmCancel = async () => {
    const id = cancelingId
    setCancelingId(null)
    if (id) await runAction(id, () => convocatoriasService.cancel(id))
  }

  const othersCalls = barrioCalls.filter((call) => call.creadorId !== user?.id)

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-6 md:px-8 lg:px-12 lg:py-10">
      <section className="flex flex-col gap-1">
        <h1 className="font-display text-headline-lg uppercase tracking-tight text-on-surface">
          Falta uno
        </h1>
        <p className="text-sm text-on-surface-variant">
          {user?.barrioPontevedra
            ? `Partidos de ${user.barrioPontevedra} y de tus contactos que buscan jugador.`
            : 'Elegí tu barrio en el perfil para ver los avisos de tu zona. Los avisos de tus contactos se ven igual.'}
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

      <section aria-labelledby="barrio-calls" className="flex flex-col gap-4">
        <h2 id="barrio-calls" className="font-display text-headline-sm uppercase text-on-surface">
          Para vos
        </h2>
        {loading ? (
          <p className="text-sm text-on-surface-variant">Cargando avisos...</p>
        ) : othersCalls.length === 0 ? (
          <p className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Por ahora nadie de tu barrio ni de tus contactos busca jugador.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {othersCalls.map((call) => {
              const answer = call.respuestas[0]?.estado
              const team = teams[call.id]
              const busy = busyId === call.id

              return (
                <li
                  key={call.id}
                  className="flex flex-col gap-4 rounded-2xl bg-surface-container-lowest p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary-container">
                      {call.creador.avatarUrl ? (
                        <img
                          src={call.creador.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="material-symbols-outlined text-xl text-on-primary"
                        >
                          person
                        </span>
                      )}
                    </div>
                    <span className="truncate text-sm font-semibold text-on-surface">
                      {call.creador.nombre}
                    </span>
                  </div>

                  <CallDetails call={call} />

                  {answer === undefined && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRespond(call.id, 'ACEPTADA')}
                        className="flex-1 rounded-full bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-secondary disabled:opacity-60"
                      >
                        Acepto
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRespond(call.id, 'DECLINADA')}
                        className="flex-1 rounded-full bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
                      >
                        No puedo
                      </button>
                    </div>
                  )}
                  {answer === 'ACEPTADA' && (
                    <>
                      <p className="text-sm font-semibold text-secondary">
                        Aceptaste: ya estás en la lista.
                      </p>
                      {team && <TeamList team={team} />}
                    </>
                  )}
                  {answer === 'DECLINADA' && (
                    <p className="text-sm text-on-surface-variant">Avisaste que no podés ir.</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="my-calls" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="my-calls" className="font-display text-headline-sm uppercase text-on-surface">
            Mis avisos abiertos
          </h2>
          <Link
            to="/perfil"
            className="text-sm font-semibold text-secondary underline-offset-2 hover:underline"
          >
            Avisar que falta uno
          </Link>
        </div>
        {!loading && myCalls.length === 0 ? (
          <p className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            No tenés avisos abiertos.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myCalls.map((call) => {
              const team = teams[call.id]
              const busy = busyId === call.id

              return (
                <li
                  key={call.id}
                  className="flex flex-col gap-4 rounded-2xl bg-surface-container-lowest p-5 shadow-sm"
                >
                  <CallDetails call={call} />
                  {team && <TeamList team={team} />}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void runAction(call.id, () => convocatoriasService.close(call.id))
                      }
                      className="rounded-full bg-surface-container px-5 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
                    >
                      Ya completé el equipo
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setCancelingId(call.id)}
                      className="rounded-full bg-error-container px-5 py-2 text-sm font-semibold text-on-error-container transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      Cancelar partido
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={cancelingId !== null}
        title="Cancelar partido"
        message="Les vamos a avisar a los jugadores que aceptaron que el partido se canceló. ¿Seguro?"
        confirmLabel="Sí, cancelar partido"
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelingId(null)}
      />
    </main>
  )
}

export default ConvocatoriasPage
