import { useState, type FormEvent, type ReactNode } from 'react'

const FORMATS = [
  { value: 'f5', label: 'Fútbol 5 (sintético)' },
  { value: 'f7', label: 'Fútbol 7 (césped natural)' },
  { value: 'f9', label: 'Fútbol 9 (mixto)' },
  { value: 'f11', label: 'Fútbol 11 (oficial)' },
]

const ZONES = [
  { value: 'pv-centro', label: 'Pontevedra (centro)' },
  { value: 'pv-oeste', label: 'Pontevedra (Ruta 21)' },
  { value: 'merlo', label: 'Merlo Sur' },
  { value: 'padua', label: 'San Antonio de Padua' },
]

const QUICK_FILTERS = [
  'Techada',
  'Con quincho y parrilla',
  'Estacionamiento propio',
  'Vestuarios con ducha',
]

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

const ExploreSearch = () => {
  const [activeFilters, setActiveFilters] = useState<string[]>([])

  const toggleFilter = (filter: string) =>
    setActiveFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]
    )

  const handleSubmit = (e: FormEvent) => e.preventDefault()

  return (
    <div className="w-full rounded-xl bg-surface-container-lowest p-4 shadow-xl md:p-6">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Field id="format" label="Formato" icon="sports_soccer">
          <div className="relative">
            <select
              id="format"
              defaultValue="f7"
              className={`${controlClass} cursor-pointer appearance-none`}
            >
              {FORMATS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
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

        <Field id="zone" label="Ubicación" icon="location_on">
          <div className="relative">
            <select
              id="zone"
              defaultValue="pv-centro"
              className={`${controlClass} cursor-pointer appearance-none`}
            >
              {ZONES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
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

        <Field id="date" label="Fecha del partido" icon="calendar_today">
          <input
            id="date"
            type="date"
            defaultValue={new Date().toLocaleDateString('en-CA')}
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

      <div className="mt-4 flex flex-wrap items-center gap-2 pt-2">
        <span className="text-label-sm uppercase text-on-surface-variant">Filtros rápidos:</span>
        {QUICK_FILTERS.map((filter) => {
          const active = activeFilters.includes(filter)
          return (
            <button
              key={filter}
              type="button"
              aria-pressed={active}
              onClick={() => toggleFilter(filter)}
              className={`rounded-full px-4 py-1 font-display text-eyebrow-badge uppercase transition-colors ${
                active
                  ? 'bg-primary-container text-secondary-container'
                  : 'bg-surface-container-high text-on-surface hover:bg-surface-dim'
              }`}
            >
              {filter}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ExploreSearch
