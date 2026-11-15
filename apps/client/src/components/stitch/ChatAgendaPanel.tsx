import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAgenda } from '../../hooks/useAgenda'
import {
  formatSlotDate,
  formatSlotShortDate,
  formatSlotTime,
  todayInArgentina,
} from '../../utils/dates'
import DayPicker from '../common/DayPicker'
import AgendaDay from './AgendaDay'

interface ChatAgendaPanelProps {
  /** The court the player asked about. */
  canchaId: string
  /** Attaches the slot to the message being written, with a ready answer for it. */
  onOffer: (offer: { turnoId: string; text: string; label: string }) => void
}

/**
 * The agenda of the court inside the owner's chat: the owner checks a day and offers a free slot
 * without leaving the conversation, so the player gets an answer while the slot is still free.
 */
const ChatAgendaPanel = ({ canchaId, onOffer }: ChatAgendaPanelProps) => {
  const [fecha, setFecha] = useState(todayInArgentina)
  const { agenda: loaded, loading, error } = useAgenda(fecha)
  const agenda = loaded?.fecha === fecha ? loaded : null

  return (
    <div className="max-h-72 overflow-y-auto bg-surface-container-lowest p-4 shadow-inner">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <DayPicker fecha={fecha} onChange={setFecha} />
        <Link
          to={`/dueno/agenda?fecha=${fecha}&cancha=${canchaId}`}
          className="text-xs font-semibold text-secondary underline"
        >
          Abrir la agenda completa
        </Link>
      </div>
      {error && (
        <p role="alert" className="mb-2 text-sm text-error">
          {error}
        </p>
      )}
      {loading && !agenda && <p className="text-sm text-on-surface-variant">Cargando...</p>}
      {agenda && (
        <AgendaDay
          agenda={agenda}
          canchaId={canchaId}
          compact
          onPickSlot={(cancha, turno) =>
            onOffer({
              turnoId: turno.id,
              text: `Tengo disponible el ${formatSlotDate(turno.fechaHoraInicio)} a las ${formatSlotTime(turno.fechaHoraInicio)} hs en ${cancha.nombre}.`,
              label: `${formatSlotShortDate(turno.fechaHoraInicio)} ${formatSlotTime(turno.fechaHoraInicio)} hs`,
            })
          }
        />
      )}
    </div>
  )
}

export default ChatAgendaPanel
