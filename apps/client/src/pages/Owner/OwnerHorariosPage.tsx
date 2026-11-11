import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import WeeklyScheduleEditor from '../../components/common/WeeklyScheduleEditor'
import {
  countHours,
  emptySchedule,
  fromFranjas,
  scheduleError,
  toFranjas,
  type WeekSchedule,
} from '../../components/common/scheduleModel'
import { useAuth } from '../../hooks/useAuth'
import { canchasService } from '../../services/canchas.service'
import type { Cancha } from '../../types/canchas'
import { getAuthErrorMessage } from '../Auth/authError'

const serialize = (schedule: WeekSchedule) => JSON.stringify(toFranjas(schedule))

const OwnerHorariosPage = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [cancha, setCancha] = useState<Cancha | null>(null)
  const [schedule, setSchedule] = useState<WeekSchedule>(emptySchedule)
  const [saved, setSaved] = useState(() => serialize(emptySchedule()))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let ignore = false
    const timer = window.setTimeout(async () => {
      try {
        const [found, franjas] = await Promise.all([
          canchasService.get(id),
          canchasService.getHorarios(id),
        ])
        if (ignore) return
        const loaded = fromFranjas(franjas)
        setCancha(found)
        setSchedule(loaded)
        setSaved(serialize(loaded))
      } catch (err) {
        if (!ignore) setError(getAuthErrorMessage(err))
      } finally {
        if (!ignore) setLoading(false)
      }
    }, 0)
    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [id])

  const dirty = serialize(schedule) !== saved
  const invalid = scheduleError(schedule)
  const notMine = cancha !== null && user !== null && cancha.ownerId !== user.id

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      const franjas = await canchasService.saveHorarios(id, toFranjas(schedule))
      const notice =
        franjas.length === 0
          ? 'Cerraste la cancha: no se ofrecen turnos en ningún día.'
          : 'Guardamos tu agenda. Mirá abajo cómo quedaron los horarios de tu cancha.'
      navigate('/dueno', { state: { notice } })
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 py-6 md:px-8 lg:py-10">
      <Link
        to="/dueno"
        className="flex items-center gap-1 self-start text-sm font-semibold text-on-surface-variant hover:text-on-surface"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-xl">
          arrow_back
        </span>
        Mis canchas
      </Link>

      <section className="flex flex-col gap-1">
        <p className="text-label-sm uppercase tracking-wider text-secondary">Configurar turnos</p>
        <h1 className="font-display text-headline-lg uppercase tracking-tight text-on-surface">
          {cancha?.nombre ?? 'Horarios de la cancha'}
        </h1>
        <p className="text-sm text-on-surface-variant">
          Elegí qué días abre la cancha y en qué horarios. Cada día puede ser distinto, y podés
          cambiarlo cuando quieras: los turnos libres se ajustan solos y los ya reservados no se
          tocan.
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

      {loading && <p className="text-sm text-on-surface-variant">Cargando la agenda...</p>}

      {notMine && (
        <p
          role="alert"
          className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          Esta cancha no es tuya, no podés cambiar sus horarios.
        </p>
      )}

      {cancha && !notMine && (
        <>
          <WeeklyScheduleEditor value={schedule} onChange={setSchedule} disabled={saving} />

          <div className="sticky bottom-0 flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-on-surface-variant">
              {invalid
                ? 'Corregí las franjas marcadas para poder guardar.'
                : `${countHours(schedule)} turnos de 1 hora por semana.`}
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || invalid || saving}
              className="rounded-xl bg-primary-container px-6 py-3 text-sm font-bold uppercase tracking-wide text-on-primary transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar agenda'}
            </button>
          </div>
        </>
      )}
    </main>
  )
}

export default OwnerHorariosPage
