import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAgenda } from '../../hooks/useAgenda'
import { formatJugadores } from '../../utils/canchas'
import {
  formatSlotDate,
  formatSlotShortDate,
  formatSlotTime,
  todayInArgentina,
} from '../../utils/dates'
import DayPicker from '../common/DayPicker'
import AgendaDay from './AgendaDay'

interface ChatAgendaPanelProps {
  /** The court the player asked about: it goes first. */
  canchaId: string
  /** Attaches the slot to the message being written, with a ready answer for it. */
  onOffer: (offer: { turnoId: string; text: string; label: string }) => void
}

/**
 * The agenda of the owner inside the chat: the owner checks a day and offers a free slot of any
 * of their courts (an inquiry about a 5 may be answered with a 7) without leaving the
 * conversation, so the player gets an answer while the slot is still free.
 */
const ChatAgendaPanel = ({ canchaId, onOffer }: ChatAgendaPanelProps) => {
  const [fecha, setFecha] = useState(todayInArgentina)
  // null = every size.
  const [size, setSize] = useState<number | null>(null)
  const { agenda: loaded, loading, error } = useAgenda(fecha)
  const agenda = loaded?.fecha === fecha ? loaded : null

  const sizes = [
    ...new Set(
      (agenda?.canchas ?? []).flatMap(({ cancha }) => (cancha.jugadores ? [cancha.jugadores] : []))
    ),
  ].sort((a, b) => a - b)
  const shown = agenda
    ? {
        ...agenda,
        // The court the player asked about first, then the others.
        canchas: agenda.canchas
          .filter(({ cancha }) => size === null || cancha.jugadores === size)
          .sort((a, b) => Number(b.cancha.id === canchaId) - Number(a.cancha.id === canchaId)),
      }
    : null

  return (
    <div className="max-h-72 overflow-y-auto bg-surface-container-lowest p-4 shadow-inner">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <DayPicker fecha={fecha} onChange={setFecha} />
        <Link
          to={`/dueno/agenda?fecha=${fecha}`}
          className="text-xs font-semibold text-secondary underline"
        >
          Abrir la agenda completa
        </Link>
      </div>

      {sizes.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Tamaño">
          {[null, ...sizes].map((option) => (
            <button
              key={option ?? 'todas'}
              type="button"
              aria-pressed={size === option}
              onClick={() => setSize(option)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                size === option
                  ? 'bg-primary-container text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {option === null ? 'Todas' : formatJugadores(option)}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mb-2 text-sm text-error">
          {error}
        </p>
      )}
      {loading && !shown && <p className="text-sm text-on-surface-variant">Cargando...</p>}
      {shown && (
        <AgendaDay
          agenda={shown}
          compact
          onPickSlot={(cancha, turno) =>
            onOffer({
              turnoId: turno.id,
              text: `Tengo disponible el ${formatSlotDate(turno.fechaHoraInicio)} a las ${formatSlotTime(turno.fechaHoraInicio)} hs en ${cancha.nombre}${cancha.jugadores ? ` (${formatJugadores(cancha.jugadores)})` : ''}.`,
              label: `${formatSlotShortDate(turno.fechaHoraInicio)} ${formatSlotTime(turno.fechaHoraInicio)} hs · ${cancha.nombre}`,
            })
          }
        />
      )}
    </div>
  )
}

export default ChatAgendaPanel
