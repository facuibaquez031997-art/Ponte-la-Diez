import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import CanchaCard from '../../components/common/CanchaCard'
import CanchaForm from '../../components/common/CanchaForm'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { canchasService } from '../../services/canchas.service'
import type { Cancha, CanchaInput, Franja } from '../../types/canchas'
import { getAuthErrorMessage } from '../Auth/authError'

type FormState = { kind: 'create' } | { kind: 'edit'; cancha: Cancha } | null

const OwnerCanchasPage = () => {
  const [canchas, setCanchas] = useState<Cancha[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // The schedule page sends us back here with a message once it saved.
  const location = useLocation()
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null
  )
  const [horarios, setHorarios] = useState<Record<string, Franja[]>>({})
  const [form, setForm] = useState<FormState>(null)
  const [deleting, setDeleting] = useState<Cancha | null>(null)

  const load = useCallback(async () => {
    try {
      const mine = await canchasService.listMine()
      setCanchas(mine)
      setError(null)
      const schedules = await Promise.all(
        mine.map(
          async (cancha) => [cancha.id, await canchasService.getHorarios(cancha.id)] as const
        )
      )
      setHorarios(Object.fromEntries(schedules))
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

  const handleSubmit = async (input: CanchaInput) => {
    if (form?.kind === 'edit') {
      await canchasService.update(form.cancha.id, input)
      setNotice('Guardamos los cambios de la cancha.')
    } else {
      await canchasService.create(input)
      setNotice('Cancha creada. Ahora configurá sus horarios con "Configurar turnos".')
    }
    setForm(null)
    await load()
  }

  const handleConfirmDelete = async () => {
    const cancha = deleting
    setDeleting(null)
    if (!cancha) return
    try {
      await canchasService.remove(cancha.id)
      setNotice(`Borramos la cancha ${cancha.nombre}.`)
      setError(null)
    } catch (err) {
      setNotice(null)
      setError(getAuthErrorMessage(err))
    }
    await load()
  }

  const startForm = (next: FormState) => {
    setNotice(null)
    setForm(next)
  }

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-6 md:px-8 lg:px-12 lg:py-10">
      <section className="flex flex-col gap-1">
        <p className="text-label-sm uppercase tracking-wider text-secondary">Modo dueño</p>
        <h1 className="font-display text-headline-lg uppercase tracking-tight text-on-surface">
          Mis canchas
        </h1>
        <p className="text-sm text-on-surface-variant">
          Cargá tus canchas y elegí, día por día, en qué horarios se pueden reservar.
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
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface"
        >
          {notice}
        </p>
      )}

      {form && (
        <CanchaForm
          key={form.kind === 'edit' ? form.cancha.id : 'new'}
          cancha={form.kind === 'edit' ? form.cancha : undefined}
          onSubmit={handleSubmit}
          onCancel={() => setForm(null)}
        />
      )}

      {loading ? (
        <p className="text-sm text-on-surface-variant">Cargando tus canchas...</p>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {canchas.map((cancha) => (
            <CanchaCard
              key={cancha.id}
              cancha={cancha}
              horarios={horarios[cancha.id]}
              onEdit={(target) => startForm({ kind: 'edit', cancha: target })}
              onDelete={setDeleting}
              onPhotosChanged={load}
              onError={setError}
            />
          ))}
          {!form && (
            <li className="flex">
              <button
                type="button"
                onClick={() => startForm({ kind: 'create' })}
                className="flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-outline-variant p-8 text-center transition-colors hover:bg-surface-container-low"
              >
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-3xl text-on-surface"
                >
                  add
                </span>
                <span className="font-display text-headline-sm uppercase text-on-surface">
                  Registrar nueva cancha
                </span>
                <span className="text-sm text-on-surface-variant">
                  {canchas.length === 0
                    ? 'Todavía no cargaste ninguna cancha.'
                    : 'Sumá otra cancha a tu predio.'}
                </span>
              </button>
            </li>
          )}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Borrar cancha"
        message={`¿Borrás la cancha ${deleting?.nombre ?? ''}? Se eliminan también sus horarios y turnos libres.`}
        confirmLabel="Sí, borrar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </main>
  )
}

export default OwnerCanchasPage
