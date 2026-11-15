import type { Role } from '../../types/auth'
import type { Conversacion } from '../../types/conversaciones'
import { chatSubtitle, chatTitle } from '../../utils/chat'
import { formatChatStamp } from '../../utils/dates'
import ChatAvatar from './ChatAvatar'

interface ConversacionItemProps {
  conversacion: Conversacion
  rol: Role
  active: boolean
  onSelect: (id: string) => void
}

const ConversacionItem = ({ conversacion, rol, active, onSelect }: ConversacionItemProps) => {
  const { ultimoMensaje, noLeidos } = conversacion
  const unread = noLeidos > 0

  return (
    <button
      type="button"
      onClick={() => onSelect(conversacion.id)}
      aria-current={active ? 'true' : undefined}
      className={`relative flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all ${
        active ? 'bg-surface-container-lowest shadow-sm' : 'hover:bg-surface-container'
      }`}
    >
      {active && (
        <span className="absolute bottom-3 left-0 top-3 w-1 rounded-r-full bg-secondary" />
      )}
      <ChatAvatar
        nombre={chatTitle(conversacion, rol)}
        avatarUrl={rol === 'PLAYER' ? null : conversacion.otro.avatarUrl}
        className="h-12 w-12"
        conectado={conversacion.otro.conectado}
      />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-1">
          <span className="truncate font-bold text-primary-container">
            {chatTitle(conversacion, rol)}
          </span>
          {ultimoMensaje && (
            <span
              className={`shrink-0 text-xs ${unread ? 'font-semibold text-secondary' : 'text-on-surface-variant'}`}
            >
              {formatChatStamp(ultimoMensaje.createdAt)}
            </span>
          )}
        </div>
        <p className="mb-1 truncate text-xs text-on-surface-variant">
          {chatSubtitle(conversacion, rol)}
        </p>
        {conversacion.escribiendo ? (
          <p className="truncate text-xs font-semibold italic text-secondary">Escribiendo...</p>
        ) : ultimoMensaje ? (
          <p
            className={`truncate text-xs ${unread ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}`}
          >
            {ultimoMensaje.propio && <span className="font-medium text-on-surface">Vos: </span>}
            {ultimoMensaje.cuerpo}
          </p>
        ) : (
          <p className="truncate text-xs italic text-on-surface-variant">Chat vaciado</p>
        )}
      </div>
      {unread && (
        <span
          aria-label={`${noLeidos} sin leer`}
          className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-secondary px-1 text-label-sm text-on-secondary"
        >
          {noLeidos}
        </span>
      )}
    </button>
  )
}

export default ConversacionItem
