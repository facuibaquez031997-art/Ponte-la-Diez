import { useState, type FormEvent } from 'react'
import { convocatoriasService } from '../../services/convocatorias.service'
import { POSICION_LABELS, type Posicion } from '../../types/convocatorias'
import { getAuthErrorMessage } from '../../pages/Auth/authError'
import FormField from './FormField'

const POSICIONES = Object.entries(POSICION_LABELS) as Array<[Posicion, string]>

const MESSAGE_MAX_LENGTH = 500

const FIELD_CLASS =
  'w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary-container'

interface FaltaUnoFormProps {
  barrio: string | null
}

const FaltaUnoForm = ({ barrio }: FaltaUnoFormProps) => {
  const [canchaNombre, setCanchaNombre] = useState('')
  const [fechaHora, setFechaHora] = useState('')
  const [posicion, setPosicion] = useState<Posicion>('ARQUERO')
  const [jugadoresFaltantes, setJugadoresFaltantes] = useState(1)
  const [mensaje, setMensaje] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSent(false)
    setSending(true)
    try {
      await convocatoriasService.create({
        canchaNombre: canchaNombre.trim() || undefined,
        fechaHora: new Date(fechaHora).toISOString(),
        posicion,
        jugadoresFaltantes,
        mensaje: mensaje.trim() || undefined,
      })
      setCanchaNombre('')
      setFechaHora('')
      setPosicion('ARQUERO')
      setJugadoresFaltantes(1)
      setMensaje('')
      setSent(true)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-3xl bg-surface-container-lowest p-6 shadow-sm md:p-10"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-container font-display text-headline-sm text-on-primary">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
              campaign
            </span>
          </span>
          <h3 className="font-display text-headline-sm uppercase text-on-surface">Falta uno</h3>
        </div>
        <p className="text-sm text-on-surface-variant">
          {barrio
            ? `Avisá a los jugadores de ${barrio} que te falta alguien para el partido.`
            : 'Elegí tu barrio y guardá el perfil para poder avisar que falta un jugador.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          id="falta-uno-cancha"
          label="Cancha (opcional)"
          icon="stadium"
          maxLength={80}
          placeholder="Ej: Cancha de Don Pepe"
          value={canchaNombre}
          onChange={(e) => setCanchaNombre(e.target.value)}
        />
        <FormField
          id="falta-uno-fecha"
          label="Fecha y hora del partido"
          icon="event"
          type="datetime-local"
          required
          value={fechaHora}
          onChange={(e) => setFechaHora(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="falta-uno-posicion"
            className="text-label-sm uppercase tracking-wider text-on-surface"
          >
            Posición que falta
          </label>
          <select
            id="falta-uno-posicion"
            value={posicion}
            onChange={(e) => setPosicion(e.target.value as Posicion)}
            className={FIELD_CLASS}
          >
            {POSICIONES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <FormField
          id="falta-uno-cantidad"
          label="Jugadores que faltan"
          icon="groups"
          type="number"
          required
          min={1}
          max={11}
          value={jugadoresFaltantes}
          onChange={(e) => setJugadoresFaltantes(Number(e.target.value))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="falta-uno-mensaje"
          className="text-label-sm uppercase tracking-wider text-on-surface"
        >
          Mensaje (opcional)
        </label>
        <textarea
          id="falta-uno-mensaje"
          rows={3}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder="Ej: Traé botines, jugamos a las 21."
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          className={FIELD_CLASS}
        />
        <span className="self-end text-xs text-on-surface-variant">
          {mensaje.length}/{MESSAGE_MAX_LENGTH}
        </span>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className="rounded-xl bg-secondary-container/30 px-4 py-3 text-sm">
          ¡Listo! Avisamos a los jugadores de tu barrio.
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={sending || !barrio}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-8 font-display text-headline-sm uppercase tracking-wide text-on-primary shadow-md transition-all hover:bg-secondary active:scale-95 disabled:opacity-60 sm:w-auto"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-xl">
            send
          </span>
          {sending ? 'Enviando...' : 'Avisar que falta uno'}
        </button>
      </div>
    </form>
  )
}

export default FaltaUnoForm
