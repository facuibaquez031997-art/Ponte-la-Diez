import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { convocatoriasService } from '../../services/convocatorias.service'
import {
  POSICION_LABELS,
  type BarrioConvocatoria,
  type Convocatoria,
} from '../../types/convocatorias'
import { getAuthErrorMessage } from '../Auth/authError'

const ESTADO_ABIERTA = 'ABIERTA'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

const missingLabel = (call: Convocatoria) => {
  const position = POSICION_LABELS[call.posicion].toLowerCase()
  return call.jugadoresFaltantes === 1
    ? `Falta 1 ${position}`
    : `Faltan ${call.jugadoresFaltantes} ${position}s`
}

interface CallDetailsProps {
  call: Convocatoria
}

const CallDetails = ({ call }: CallDetailsProps) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="font-display text-headline-sm uppercase text-on-surface">
      {missingLabel(call)}
    </span>
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

const ConvocatoriasPage = () => {
  const { user } = useAuth()
  const [barrioCalls, setBarrioCalls] = useState<BarrioConvocatoria[]>([])
  const [myCalls, setMyCalls] = useState<Convocatoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [forBarrio, mine] = await Promise.all([
        convocatoriasService.listForMyBarrio(),
        convocatoriasService.listMine(),
      ])
      setBarrioCalls(forBarrio)
      setMyCalls(mine.filter((call) => call.estado === ESTADO_ABIERTA))
      setError(null)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const first = window.setTimeout(load, 0)
    return () => window.clearTimeout(first)
  }, [load])

  const handleClose = async (id: string) => {
    setClosingId(id)
    try {
      await convocatoriasService.close(id)
      await load()
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setClosingId(null)
    }
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
            ? `Partidos de ${user.barrioPontevedra} que buscan jugador.`
            : 'Elegí tu barrio en el perfil para ver los avisos de tu zona.'}
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
          En tu barrio
        </h2>
        {loading ? (
          <p className="text-sm text-on-surface-variant">Cargando avisos...</p>
        ) : othersCalls.length === 0 ? (
          <p className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Por ahora nadie de tu barrio busca jugador.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {othersCalls.map((call) => (
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
              </li>
            ))}
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
            {myCalls.map((call) => (
              <li
                key={call.id}
                className="flex flex-col gap-4 rounded-2xl bg-surface-container-lowest p-5 shadow-sm"
              >
                <CallDetails call={call} />
                <button
                  type="button"
                  disabled={closingId === call.id}
                  onClick={() => void handleClose(call.id)}
                  className="self-start rounded-full bg-surface-container px-5 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
                >
                  {closingId === call.id ? 'Cerrando...' : 'Ya completé el equipo'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default ConvocatoriasPage
