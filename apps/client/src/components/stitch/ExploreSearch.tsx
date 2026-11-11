import { useState, type FormEvent, type ReactNode } from 'react'
import BarrioCombobox from '../common/BarrioCombobox'
import { SURFACES, type CanchaFilters } from '../../types/canchas'
import { formatMoney, onlyDigits } from '../../utils/money'

const controlClass =
  'h-12 w-full rounded-xl bg-surface-container-low px-4 text-base font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary-container'

interface FieldProps {
  id: string
  label: string
  icon: string
  children: ReactNode
}

const Field = ({ id, label, icon, children }: FieldProps) => (
  <div className="flex flex-col gap-1">
    <label
      htmlFor={id}
      className="flex items-center gap-1 text-label-sm uppercase text-on-surface-variant"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-secondary">
        {icon}
      </span>
      {label}
    </label>
    {children}
  </div>
)

interface ExploreSearchProps {
  filters: CanchaFilters
  fecha: string
  // First and last day a slot can exist (the API generates a rolling window).
  minFecha: string
  maxFecha: string
  onApply: (filters: CanchaFilters, fecha: string) => void
}

const ExploreSearch = ({ filters, fecha, minFecha, maxFecha, onApply }: ExploreSearchProps) => {
  const [draft, setDraft] = useState(filters)
  const [draftFecha, setDraftFecha] = useState(fecha)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onApply(draft, draftFecha)
  }

  return (
    <div className="w-full rounded-xl bg-surface-container-lowest p-4 shadow-xl md:p-6">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <BarrioCombobox
          id="filter-barrio"
          label="Ubicación"
          value={draft.barrio}
          onChange={(barrio) => setDraft((current) => ({ ...current, barrio }))}
        />

        <Field id="filter-surface" label="Superficie" icon="sports_soccer">
          <div className="relative">
            <select
              id="filter-surface"
              value={draft.tipoSuperficie}
              onChange={(e) =>
                setDraft((current) => ({ ...current, tipoSuperficie: e.target.value }))
              }
              className={`${controlClass} cursor-pointer appearance-none`}
            >
              <option value="">Todas</option>
              {SURFACES.map((surface) => (
                <option key={surface} value={surface}>
                  {surface}
                </option>
              ))}
            </select>
            <span
              aria-hidden="true"
              className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant"
            >
              expand_more
            </span>
          </div>
        </Field>

        <Field id="filter-price" label="Precio máximo por hora" icon="payments">
          <input
            id="filter-price"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Sin tope"
            value={formatMoney(draft.precioMax)}
            onChange={(e) =>
              setDraft((current) => ({ ...current, precioMax: onlyDigits(e.target.value) }))
            }
            className={controlClass}
          />
        </Field>

        <Field id="filter-date" label="Fecha del partido" icon="calendar_today">
          <input
            id="filter-date"
            type="date"
            min={minFecha}
            max={maxFecha}
            required
            value={draftFecha}
            onChange={(e) => setDraftFecha(e.target.value)}
            className={`${controlClass} cursor-pointer`}
          />
        </Field>

        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary font-display text-headline-sm uppercase tracking-wider text-on-secondary shadow-md transition-colors hover:bg-on-secondary-container"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
            search
          </span>
          Buscar canchas
        </button>
      </form>
    </div>
  )
}

export default ExploreSearch
