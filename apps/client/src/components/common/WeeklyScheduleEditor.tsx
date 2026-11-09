import {
  DAY_NAMES,
  DAY_ORDER,
  DEFAULT_RANGE,
  dayError,
  endLabel,
  startLabel,
  type HourRange,
  type WeekSchedule,
} from './scheduleModel'

const SELECT_CLASS =
  'rounded-xl bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary-container'

const START_HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const END_HOURS = Array.from({ length: 24 }, (_, index) => index + 1)

interface WeeklyScheduleEditorProps {
  value: WeekSchedule
  onChange: (next: WeekSchedule) => void
  disabled?: boolean
}

const WeeklyScheduleEditor = ({ value, onChange, disabled = false }: WeeklyScheduleEditorProps) => {
  const setDay = (dia: number, ranges: HourRange[]) => onChange({ ...value, [dia]: ranges })

  const updateRange = (dia: number, index: number, patch: Partial<HourRange>) =>
    setDay(
      dia,
      value[dia].map((range, i) => (i === index ? { ...range, ...patch } : range))
    )

  return (
    <ul className="flex flex-col gap-3">
      {DAY_ORDER.map((dia) => {
        const ranges = value[dia]
        const open = ranges.length > 0
        const error = dayError(ranges)
        const switchLabel = `${DAY_NAMES[dia]}: ${open ? 'abierto' : 'cerrado'}`

        return (
          <li
            key={dia}
            className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="font-display text-headline-sm uppercase text-on-surface">
                  {DAY_NAMES[dia]}
                </span>
                <span className="text-xs text-on-surface-variant">
                  {open ? 'Abierto' : 'Cerrado, no se ofrecen turnos'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={open}
                aria-label={switchLabel}
                disabled={disabled}
                onClick={() => setDay(dia, open ? [] : [{ ...DEFAULT_RANGE }])}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                  open ? 'bg-primary-container' : 'bg-surface-container-high'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-1 h-5 w-5 rounded-full bg-surface-container-lowest transition-all ${
                    open ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {open && (
              <div className="flex flex-col gap-2">
                {ranges.map((range, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                      Desde
                      <select
                        aria-label={`${DAY_NAMES[dia]}, franja ${index + 1}: desde`}
                        disabled={disabled}
                        value={range.desde}
                        onChange={(e) => updateRange(dia, index, { desde: Number(e.target.value) })}
                        className={SELECT_CLASS}
                      >
                        {START_HOURS.map((hour) => (
                          <option key={hour} value={hour}>
                            {startLabel(hour)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                      Hasta
                      <select
                        aria-label={`${DAY_NAMES[dia]}, franja ${index + 1}: hasta`}
                        disabled={disabled}
                        value={range.hasta}
                        onChange={(e) => updateRange(dia, index, { hasta: Number(e.target.value) })}
                        className={SELECT_CLASS}
                      >
                        {END_HOURS.map((hour) => (
                          <option key={hour} value={hour}>
                            {endLabel(hour)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        setDay(
                          dia,
                          ranges.filter((_, i) => i !== index)
                        )
                      }
                      aria-label={`Quitar la franja ${index + 1} del ${DAY_NAMES[dia].toLowerCase()}`}
                      className="flex items-center justify-center rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-60"
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-xl">
                        close
                      </span>
                    </button>
                  </div>
                ))}

                {error && (
                  <p role="alert" className="text-sm text-error">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setDay(dia, [
                      ...ranges,
                      { desde: Math.min(ranges[ranges.length - 1].hasta, 23), hasta: 24 },
                    ])
                  }
                  className="self-start rounded-full bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
                >
                  + Agregar otra franja
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default WeeklyScheduleEditor
