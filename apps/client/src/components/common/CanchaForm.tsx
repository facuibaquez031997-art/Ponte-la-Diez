import { useState, type FormEvent } from 'react'
import { getAuthErrorMessage } from '../../pages/Auth/authError'
import {
  MAX_CANTIDAD,
  SURFACES,
  TAMANOS,
  type Cancha,
  type CanchaInput,
  type ComparteCon,
} from '../../types/canchas'
import { formatJugadores } from '../../utils/canchas'
import { MAX_MONEY, formatMoney, onlyDigits } from '../../utils/money'
import BarrioCombobox from './BarrioCombobox'

const FIELD_CLASS =
  'w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary-container'
const LABEL_CLASS = 'text-label-sm uppercase tracking-wider text-on-surface'

interface CanchaFormProps {
  cancha?: Cancha
  /** The other entries of the owner: the ones this court can share its physical space with. */
  otras?: Cancha[]
  onSubmit: (input: CanchaInput) => Promise<void>
  onCancel: () => void
}

const CanchaForm = ({ cancha, otras = [], onSubmit, onCancel }: CanchaFormProps) => {
  const [nombre, setNombre] = useState(cancha?.nombre ?? '')
  const [direccion, setDireccion] = useState(cancha?.direccion ?? '')
  const [barrio, setBarrio] = useState(cancha?.barrio ?? '')
  const [tipoSuperficie, setTipoSuperficie] = useState(cancha?.tipoSuperficie ?? SURFACES[0])
  // "" until the owner chooses: a court cannot be saved without its size, not even an old one.
  const [jugadores, setJugadores] = useState(cancha?.jugadores ? String(cancha.jugadores) : '')
  const [cantidad, setCantidad] = useState(String(cancha?.cantidad ?? 1))
  const [comparteCon, setComparteCon] = useState<ComparteCon[]>(cancha?.comparteCon ?? [])
  const [precioHora, setPrecioHora] = useState(cancha ? String(cancha.precioHora) : '')
  const [montoSena, setMontoSena] = useState(cancha ? String(cancha.montoSena) : '')
  // The other entries are linked one by one; the numbers say which court of each is involved.
  const linkOf = (id: string) => comparteCon.find((link) => link.canchaId === id)
  const toggleLink = (id: string, on: boolean) =>
    setComparteCon((current) =>
      on
        ? [...current, { canchaId: id, numero: 0, otraNumero: 0 }]
        : current.filter((link) => link.canchaId !== id)
    )
  const changeLink = (id: string, change: Partial<ComparteCon>) =>
    setComparteCon((current) => {
      const index = current.findIndex((link) => link.canchaId === id)
      return current.map((link, i) => (i === index ? { ...link, ...change } : link))
    })
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
        jugadores: Number(jugadores),
        cantidad: Number(cantidad),
        comparteCon,
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
    jugadores !== '' &&
    Number(precioHora) > 0 &&
    Number(precioHora) <= MAX_MONEY &&
    montoSena !== '' &&
    Number(montoSena) <= MAX_MONEY

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
          <label htmlFor="cancha-tamano" className={LABEL_CLASS}>
            Tamaño de la cancha
          </label>
          <select
            id="cancha-tamano"
            required
            value={jugadores}
            onChange={(e) => setJugadores(e.target.value)}
            className={`${FIELD_CLASS} cursor-pointer`}
          >
            <option value="" disabled>
              Elegí cuántos jugadores
            </option>
            {TAMANOS.map((size) => (
              <option key={size} value={String(size)}>
                {size} jugadores
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cancha-cantidad" className={LABEL_CLASS}>
            Cuántas canchas de este tamaño tenés
          </label>
          <select
            id="cancha-cantidad"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className={`${FIELD_CLASS} cursor-pointer`}
          >
            {Array.from({ length: MAX_CANTIDAD }, (_, index) => index + 1).map((count) => (
              <option key={count} value={String(count)}>
                {count === 1 ? '1 cancha' : `${count} canchas`}
              </option>
            ))}
          </select>
          <p className="text-xs text-on-surface-variant">
            {Number(cantidad) > 1
              ? `Cada horario va a tener ${cantidad} turnos a la vez: si un jugador reserva una cancha, las otras siguen libres.`
              : 'Si tenés más de una cancha de este tamaño, cargala una sola vez con la cantidad.'}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cancha-precio" className={LABEL_CLASS}>
            Precio por turno de 1 hora (ARS)
          </label>
          <input
            id="cancha-precio"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Por ejemplo: 20.000"
            required
            value={formatMoney(precioHora)}
            onChange={(e) => setPrecioHora(onlyDigits(e.target.value))}
            className={FIELD_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cancha-sena" className={LABEL_CLASS}>
            Seña para reservar (ARS)
          </label>
          <input
            id="cancha-sena"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Por ejemplo: 5.000"
            required
            value={formatMoney(montoSena)}
            onChange={(e) => setMontoSena(onlyDigits(e.target.value))}
            className={FIELD_CLASS}
          />
        </div>
      </div>

      {otras.length > 0 && (
        <fieldset className="flex flex-col gap-3 rounded-2xl bg-surface-container-low p-4">
          <legend className={LABEL_CLASS}>Comparte el espacio con</legend>
          <p className="text-xs text-on-surface-variant">
            Marcá las canchas que usan el mismo lugar físico. Cuando una se reserva y se paga, las
            otras se bloquean en ese horario. Por ejemplo, una cancha de 11 que se divide en 3 de 5:
            en la de 5 marcá la de 11. Si tenés varias canchas de 11 y solo una se divide, elegí
            cuál. Las que no marques no se ven afectadas.
          </p>
          {otras.map((otra) => {
            const link = linkOf(otra.id)
            return (
              <div key={otra.id} className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={link !== undefined}
                    onChange={(e) => toggleLink(otra.id, e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-secondary"
                  />
                  <span className="font-semibold text-on-surface">{otra.nombre}</span>
                  <span className="text-on-surface-variant">
                    {otra.jugadores ? formatJugadores(otra.jugadores) : 'sin tamaño'}
                    {otra.cantidad > 1 ? ` · ${otra.cantidad} canchas` : ''}
                  </span>
                </label>

                {link && (Number(cantidad) > 1 || otra.cantidad > 1) && (
                  <div className="ml-7 grid gap-2 sm:grid-cols-2">
                    {Number(cantidad) > 1 && (
                      <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
                        De esta cancha, la que lo comparte
                        <select
                          value={link.numero}
                          onChange={(e) => changeLink(otra.id, { numero: Number(e.target.value) })}
                          className={`${FIELD_CLASS} cursor-pointer`}
                        >
                          <option value={0}>Todas</option>
                          {Array.from({ length: Number(cantidad) }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              La cancha {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {otra.cantidad > 1 && (
                      <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
                        De {otra.nombre}, la que lo comparte
                        <select
                          value={link.otraNumero}
                          onChange={(e) =>
                            changeLink(otra.id, { otraNumero: Number(e.target.value) })
                          }
                          className={`${FIELD_CLASS} cursor-pointer`}
                        >
                          <option value={0}>Todas</option>
                          {Array.from({ length: otra.cantidad }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              La cancha {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </fieldset>
      )}

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
