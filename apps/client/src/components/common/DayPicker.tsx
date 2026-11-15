import { addDays, formatLongDate, todayInArgentina } from '../../utils/dates'

interface DayPickerProps {
  /** AAAA-MM-DD */
  fecha: string
  onChange: (fecha: string) => void
}

const buttonClass =
  'flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface transition-all hover:bg-surface-container-high active:scale-95'

/** Previous day, next day, a date field and a shortcut to today. */
const DayPicker = ({ fecha, onChange }: DayPickerProps) => (
  <div className="flex flex-wrap items-center gap-2">
    <button
      type="button"
      onClick={() => onChange(addDays(fecha, -1))}
      aria-label="Día anterior"
      className={buttonClass}
    >
      <span aria-hidden="true" className="material-symbols-outlined">
        chevron_left
      </span>
    </button>
    <input
      type="date"
      value={fecha}
      onChange={(event) => event.target.value && onChange(event.target.value)}
      aria-label="Día de la agenda"
      className="rounded-xl bg-surface-container px-3 py-2 text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary-container"
    />
    <button
      type="button"
      onClick={() => onChange(addDays(fecha, 1))}
      aria-label="Día siguiente"
      className={buttonClass}
    >
      <span aria-hidden="true" className="material-symbols-outlined">
        chevron_right
      </span>
    </button>
    {fecha !== todayInArgentina() && (
      <button
        type="button"
        onClick={() => onChange(todayInArgentina())}
        className="rounded-full bg-secondary-container px-4 py-2 text-xs font-bold text-on-secondary-fixed transition-all hover:bg-secondary-fixed-dim active:scale-[0.98]"
      >
        Hoy
      </button>
    )}
    <span className="text-sm capitalize text-on-surface-variant">{formatLongDate(fecha)}</span>
  </div>
)

export default DayPicker
