import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import FormField from '../../components/common/FormField'
import { contactosService } from '../../services/contactos.service'
import type { ContactEntry, ContactsOverview } from '../../types/contactos'
import { getAuthErrorMessage } from '../Auth/authError'

const REFRESH_INTERVAL_MS = 30_000

const EMPTY_OVERVIEW: ContactsOverview = { contactos: [], recibidas: [], enviadas: [] }

interface PlayerRowProps {
  entry: ContactEntry
  children: ReactNode
}

const PlayerRow = ({ entry, children }: PlayerRowProps) => (
  <li className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-container">
        {entry.usuario.avatarUrl ? (
          <img src={entry.usuario.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true" className="material-symbols-outlined text-xl text-on-primary">
            person
          </span>
        )}
      </div>
      <span className="truncate text-sm font-semibold text-on-surface">{entry.usuario.nombre}</span>
    </div>
    <div className="flex shrink-0 gap-2">{children}</div>
  </li>
)

const SECONDARY_BUTTON =
  'rounded-full bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60'
const PRIMARY_BUTTON =
  'rounded-full bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-secondary disabled:opacity-60'

const ContactosPage = () => {
  const [overview, setOverview] = useState<ContactsOverview>(EMPTY_OVERVIEW)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [requestNotice, setRequestNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<ContactEntry | null>(null)

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

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault()
    setRequestNotice(null)
    let notice: string | null = null
    await runAction(async () => {
      notice = (await contactosService.request(email.trim())).message
      setEmail('')
    })
    setRequestNotice(notice)
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
          Sumá a tus amigos con su email. Cuando aceptan, podés avisarles directamente cuando te
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

      <form
        onSubmit={handleRequest}
        className="flex flex-col gap-3 rounded-3xl bg-surface-container-lowest p-6 shadow-sm md:flex-row md:items-end"
      >
        <div className="flex-1">
          <FormField
            id="contacto-email"
            label="Email del jugador"
            icon="alternate_email"
            type="email"
            required
            maxLength={254}
            placeholder="amigo@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary-container px-8 font-display text-headline-sm uppercase tracking-wide text-on-primary shadow-md transition-all hover:bg-secondary active:scale-95 disabled:opacity-60"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-xl">
            person_add
          </span>
          Enviar solicitud
        </button>
        {requestNotice && (
          <p role="status" className="text-sm text-on-surface-variant md:basis-full">
            {requestNotice}
          </p>
        )}
      </form>

      {overview.recibidas.length > 0 && (
        <section aria-labelledby="received" className="flex flex-col gap-4">
          <h2 id="received" className="font-display text-headline-sm uppercase text-on-surface">
            Solicitudes recibidas
          </h2>
          <ul className="flex flex-col gap-3">
            {overview.recibidas.map((entry) => (
              <PlayerRow key={entry.id} entry={entry}>
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
              <PlayerRow key={entry.id} entry={entry}>
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
              <PlayerRow key={entry.id} entry={entry}>
                <span className="self-center text-xs text-on-surface-variant">Esperando</span>
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
