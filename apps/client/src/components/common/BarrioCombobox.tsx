import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useBarrios } from '../../hooks/useBarrios'

interface BarrioComboboxProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const BarrioCombobox = ({ id, label, value, onChange }: BarrioComboboxProps) => {
  const barrios = useBarrios()
  const listboxId = useId()
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const matches = useMemo(() => {
    const needle = normalize(query)
    return barrios.filter((barrio) => normalize(barrio).includes(needle))
  }, [barrios, query])

  const select = (barrio: string) => {
    setQuery(barrio)
    onChange(barrio)
    setOpen(false)
  }

  const handleInput = (text: string) => {
    setQuery(text)
    setOpen(true)
    setActiveIndex(0)
    const exact = barrios.find((barrio) => normalize(barrio) === normalize(text))
    onChange(exact ?? '')
  }

  const handleBlur = () => {
    setOpen(false)
    setQuery(value)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && matches[activeIndex]) {
      e.preventDefault()
      select(matches[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label-sm uppercase tracking-wider text-on-surface">
        {label}
      </label>
      <div className="relative flex items-center">
        <span
          aria-hidden="true"
          className="material-symbols-outlined pointer-events-none absolute left-3.5 text-xl text-on-surface-variant"
        >
          location_on
        </span>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Escribí tu barrio"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl bg-surface-container-low py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 transition-all focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary-container"
        />
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl bg-surface-container-lowest py-1 shadow-xl"
        >
          {matches.length === 0 ? (
            <li className="px-4 py-2.5 text-sm text-on-surface-variant">
              No encontramos ese barrio
            </li>
          ) : (
            matches.map((barrio, index) => (
              <li
                key={barrio}
                role="option"
                aria-selected={barrio === value}
                onMouseDown={(e) => {
                  e.preventDefault()
                  select(barrio)
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer px-4 py-2.5 text-sm text-on-surface ${
                  index === activeIndex ? 'bg-surface-container' : ''
                }`}
              >
                {barrio}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export default BarrioCombobox
