import { useState, type FormEvent } from 'react'
import { getAuthErrorMessage } from '../../pages/Auth/authError'
import { SURFACES, type Cancha, type CanchaInput } from '../../types/canchas'
import BarrioCombobox from './BarrioCombobox'

const FIELD_CLASS =
  'w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary-container'
const LABEL_CLASS = 'text-label-sm uppercase tracking-wider text-on-surface'

interface CanchaFormProps {
  cancha?: Cancha
  onSubmit: (input: CanchaInput) => Promise<void>
  onCancel: () => void
}

const CanchaForm = ({ cancha, onSubmit, onCancel }: CanchaFormProps) => {
  const [nombre, setNombre] = useState(cancha?.nombre ?? '')
  const [direccion, setDireccion] = useState(cancha?.direccion ?? '')
  const [barrio, setBarrio] = useState(cancha?.barrio ?? '')
  const [tipoSuperficie, setTipoSuperficie] = useState(cancha?.tipoSuperficie ?? SURFACES[0])
  const [precioHora, setPrecioHora] = useState(cancha ? String(cancha.precioHora) : '')
  const [montoSena, setMontoSena] = useState(cancha ? String(cancha.montoSena) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await onSubmit({
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        barrio,
        tipoSuperficie,
        precioHora: Number(precioHora),
        montoSena: Number(montoSena),
      })
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setSaving(false)
    }
  }

  const canSave =
    nombre.trim().length >= 2 &&
    direccion.trim().length >= 3 &&
    barrio !== '' &&
    Number(precioHora) > 0 &&
    montoSena !== '' &&
    Number(montoSena) >= 0

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={cancha ? 'Editar cancha' : 'Registrar nueva cancha'}
      className="flex flex-col gap-4 rounded-3xl bg-surface-container-lowest p-6 shadow-sm"
    >
      <h2 className="font-display text-headline-md uppercase tracking-wide text-on-surface">
        {cancha ? 'Editar cancha' : 'Registrar nueva cancha'}
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cancha-nombre" className={LABEL_CLASS}>
            Nombre de la cancha
          </label>
          <input
            id="cancha-nombre"
            type="text"
            maxLength={80}
            required
            placeholder="Por ejemplo: La Bombonera"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cancha-direccion" className={LABEL_CLASS}>
            Dirección
          </label>
          <input
            id="cancha-direccion"
            type="text"
            maxLength={160}
            required
            placeholder="Calle y altura"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        <BarrioCombobox id="cancha-barrio" label="Barrio" value={barrio} onChange={setBarrio} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cancha-superficie" className={LABEL_CLASS}>
            Tipo de superficie
          </label>
          <select
            id="cancha-superficie"
            value={tipoSuperficie}
            onChange={(e) => setTipoSuperficie(e.target.value)}
            className={`${FIELD_CLASS} cursor-pointer`}
          >
            {SURFACES.map((surface) => (
              <option key={surface} value={surface}>
                {surface}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cancha-precio" className={LABEL_CLASS}>
            Precio por turno de 1 hora (ARS)
          </label>
          <input
            id="cancha-precio"
            type="number"
            inputMode="numeric"
            min={1}
            max={1_000_000}
            required
            value={precioHora}
            onChange={(e) => setPrecioHora(e.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cancha-sena" className={LABEL_CLASS}>
            Seña para reservar (ARS)
          </label>
          <input
            id="cancha-sena"
            type="number"
            inputMode="numeric"
            min={0}
            max={1_000_000}
            required
            value={montoSena}
            onChange={(e) => setMontoSena(e.target.value)}
            className={FIELD_CLASS}
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-xl bg-surface-container py-3 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container-high active:scale-[0.98] disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!canSave || saving}
          className="flex-1 rounded-xl bg-primary-container py-3 text-sm font-bold text-on-primary transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? 'Guardando...' : cancha ? 'Guardar cambios' : 'Crear cancha'}
        </button>
      </div>
    </form>
  )
}

export default CanchaForm
