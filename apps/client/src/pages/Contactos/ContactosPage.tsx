import { useCallback, useEffect, useState, type ReactNode } from 'react'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { contactosService } from '../../services/contactos.service'
import type {
  ContactEntry,
  ContactSearchResult,
  ContactsOverview,
  ContactUser,
} from '../../types/contactos'
import { getAuthErrorMessage } from '../Auth/authError'

const REFRESH_INTERVAL_MS = 30_000
const SEARCH_DEBOUNCE_MS = 300
const SEARCH_MIN_LENGTH = 3

const EMPTY_OVERVIEW: ContactsOverview = { contactos: [], recibidas: [], enviadas: [] }

interface PlayerRowProps {
  player: ContactUser
  detail?: string
  children: ReactNode
}

const PlayerRow = ({ player, detail, children }: PlayerRowProps) => (
  <li className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-container">
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true" className="material-symbols-outlined text-2xl text-on-primary">
            person
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-on-surface">{player.nombre}</span>
        {detail && <span className="truncate text-xs text-on-surface-variant">{detail}</span>}
      </div>
    </div>
    <div className="flex shrink-0 gap-2">{children}</div>
  </li>
)

const SECONDARY_BUTTON =
  'rounded-full bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60'
const PRIMARY_BUTTON =
  'rounded-full bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-secondary disabled:opacity-60'

const asPlayer = (entry: ContactEntry) => entry.usuario

const ContactosPage = () => {
  const [overview, setOverview] = useState<ContactsOverview>(EMPTY_OVERVIEW)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ term: string; items: ContactSearchResult[] } | null>(null)
  const [requestNotice, setRequestNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<ContactEntry | null>(null)

  const term = query.trim()
  const canSearch = term.length >= SEARCH_MIN_LENGTH
  // Results of an older term are not shown while the newer search is in flight.
  const results = canSearch && found?.term === term ? found.items : null

  const load = useCallback(async () => {
    try {
      setOverview(await contactosService.list())
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

  useEffect(() => {
    if (!canSearch) return
    let ignore = false
    const timer = window.setTimeout(async () => {
      try {
        const items = await contactosService.search(term)
        if (!ignore) setFound({ term, items })
      } catch (err) {
        if (!ignore) setError(getAuthErrorMessage(err))
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [canSearch, term])

  const runAction = async (action: () => Promise<unknown>) => {
    setBusy(true)
    let failure: string | null = null
    try {
      await action()
    } catch (err) {
      failure = getAuthErrorMessage(err)
    }
    await load()
    setError(failure)
    setBusy(false)
  }

  const handleRequest = async (player: ContactSearchResult) => {
    setRequestNotice(null)
    await runAction(async () => {
      await contactosService.requestUser(player.id)
      setFound((current) =>
        current
          ? { ...current, items: current.items.filter((item) => item.id !== player.id) }
          : current
      )
      setRequestNotice(`Le enviamos la solicitud a ${player.nombre}.`)
    })
  }

  const handleConfirmRemove = async () => {
    const entry = removing
    setRemoving(null)
    if (entry) await runAction(() => contactosService.remove(entry.id))
  }

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-6 md:px-8 lg:px-12 lg:py-10">
      <section className="flex flex-col gap-1">
        <h1 className="font-display text-headline-lg uppercase tracking-tight text-on-surface">
          Contactos
        </h1>
        <p className="text-sm text-on-surface-variant">
          Buscá a tus amigos por nombre. Cuando aceptan, podés avisarles directamente cuando te
          falte uno.
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

      <section aria-labelledby="search" className="flex flex-col gap-4">
        <h2 id="search" className="font-display text-headline-sm uppercase text-on-surface">
          Buscar jugadores
        </h2>
        <div className="relative flex items-center">
          <span
            aria-hidden="true"
            className="material-symbols-outlined pointer-events-none absolute left-3.5 text-xl text-on-surface-variant"
          >
            search
          </span>
          <input
            type="search"
            aria-label="Nombre del jugador"
            maxLength={80}
            placeholder="Escribí al menos 3 letras del nombre"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl bg-surface-container-low py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary-container"
          />
        </div>
        {requestNotice && (
          <p role="status" className="text-sm text-on-surface-variant">
            {requestNotice}
          </p>
        )}
        {canSearch && results === null && (
          <p className="text-sm text-on-surface-variant">Buscando...</p>
        )}
        {results !== null && results.length === 0 && (
          <p className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            No encontramos jugadores con ese nombre.
          </p>
        )}
        {results !== null && results.length > 0 && (
          <ul className="flex flex-col gap-3">
            {results.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                detail={player.barrioPontevedra ?? 'Sin barrio'}
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRequest(player)}
                  className={PRIMARY_BUTTON}
                >
                  Enviar solicitud
                </button>
              </PlayerRow>
            ))}
          </ul>
        )}
      </section>

      {overview.recibidas.length > 0 && (
        <section aria-labelledby="received" className="flex flex-col gap-4">
          <h2 id="received" className="font-display text-headline-sm uppercase text-on-surface">
            Solicitudes recibidas
          </h2>
          <ul className="flex flex-col gap-3">
            {overview.recibidas.map((entry) => (
              <PlayerRow key={entry.id} player={asPlayer(entry)}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction(() => contactosService.accept(entry.id))}
                  className={PRIMARY_BUTTON}
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction(() => contactosService.remove(entry.id))}
                  className={SECONDARY_BUTTON}
                >
                  Rechazar
                </button>
              </PlayerRow>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="contacts" className="flex flex-col gap-4">
        <h2 id="contacts" className="font-display text-headline-sm uppercase text-on-surface">
          Mis contactos
        </h2>
        {!loading && overview.contactos.length === 0 ? (
          <p className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
            Todavía no tenés contactos.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {overview.contactos.map((entry) => (
              <PlayerRow key={entry.id} player={asPlayer(entry)}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRemoving(entry)}
                  className={SECONDARY_BUTTON}
                >
                  Quitar
                </button>
              </PlayerRow>
            ))}
          </ul>
        )}
      </section>

      {overview.enviadas.length > 0 && (
        <section aria-labelledby="sent" className="flex flex-col gap-4">
          <h2 id="sent" className="font-display text-headline-sm uppercase text-on-surface">
            Solicitudes enviadas
          </h2>
          <ul className="flex flex-col gap-3">
            {overview.enviadas.map((entry) => (
              <PlayerRow key={entry.id} player={asPlayer(entry)} detail="Esperando respuesta">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction(() => contactosService.remove(entry.id))}
                  className={SECONDARY_BUTTON}
                >
                  Cancelar
                </button>
              </PlayerRow>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Quitar contacto"
        message={`¿Querés quitar a ${removing?.usuario.nombre ?? 'este jugador'} de tus contactos? Dejarán de verse los avisos entre ustedes.`}
        confirmLabel="Sí, quitar"
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </main>
  )
}

export default ContactosPage
