import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getAuthErrorMessage } from '../../pages/Auth/authError'
import { useThread } from '../../hooks/useThread'
import { conversacionesService } from '../../services/conversaciones.service'
import type { Role } from '../../types/auth'
import { MAX_MENSAJE_LENGTH, type TurnoBanner } from '../../types/conversaciones'
import { chatSubtitle, chatTitle } from '../../utils/chat'
import { chatDayKey, formatChatDay, formatSlotShortDate, formatSlotTime } from '../../utils/dates'
import { formatPesos } from '../../utils/money'
import ConfirmDialog from '../common/ConfirmDialog'
import ChatAgendaPanel from './ChatAgendaPanel'
import ChatAvatar from './ChatAvatar'

interface ChatThreadProps {
  id: string
  rol: Role
  /** The inbox should refresh its unread counters. */
  onChanged: () => void
  /** The user deleted the chat from their inbox. */
  onDeleted: () => void
  /** Small screens show one pane at a time: go back to the list. */
  onBack: () => void
}

const BOOKING_LINK: Record<Role, string> = { PLAYER: '/reservas', OWNER: '/dueno/reservas' }

// The player hides the chat from their inbox. The owner never loses it: clearing only empties the
// content, so an inquiry about a slot is not lost by accident.
const DELETE_COPY: Record<Role, { action: string; confirm: string; message: string }> = {
  PLAYER: {
    action: 'Eliminar chat',
    confirm: 'Sí, eliminar',
    message:
      'Se oculta solo de tu bandeja. La otra persona conserva la conversación y, si te vuelve a escribir, vas a ver únicamente los mensajes nuevos.',
  },
  OWNER: {
    action: 'Vaciar chat',
    confirm: 'Sí, vaciar',
    message:
      'Se borran los mensajes de tu pantalla, pero el chat queda en tu bandeja para que no pierdas la consulta. El jugador conserva toda la conversación y, si te escribe de nuevo, vas a ver únicamente los mensajes nuevos.',
  },
}

const BookingBanner = ({ turno, cancha }: { turno: TurnoBanner; cancha: string }) => {
  const when = `${formatSlotShortDate(turno.fechaHoraInicio)} ${formatSlotTime(turno.fechaHoraInicio)} hs`

  if (turno.liberado) {
    return (
      <div className="flex items-center gap-2.5 bg-surface-container px-4 py-2.5 text-sm text-on-surface-variant">
        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
          event_busy
        </span>
        <span>
          El turno volvió a quedar libre ({when} · {cancha}).
        </span>
      </div>
    )
  }

  const confirmed = turno.estado === 'CONFIRMED'
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-primary-container px-4 py-2.5 text-on-primary">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="shrink-0 rounded-lg bg-secondary-container/20 p-1.5 text-secondary-container">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
            sports_soccer
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm">
            <span className="font-display text-eyebrow-badge uppercase text-secondary-container">
              Turno activo:{' '}
            </span>
            <span className="font-bold">{when}</span>
            <span className="hidden text-surface-container-high md:inline"> · {cancha}</span>
          </p>
          <p className="truncate text-xs text-surface-container-high">
            {turno.montoPagado > 0 ? (
              <>
                Seña acreditada:{' '}
                <span className="font-semibold text-secondary-container">
                  {formatPesos(turno.montoPagado)}
                </span>{' '}
                vía Mercado Pago
                {turno.montoRestante > 0 &&
                  ` · Resta ${formatPesos(turno.montoRestante)} en la cancha`}
              </>
            ) : (
              'Todavía sin pago acreditado'
            )}
          </p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2.5 py-1 font-display text-eyebrow-badge uppercase text-on-secondary-container">
        <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
          {confirmed ? 'check_circle' : 'hourglass_top'}
        </span>
        {confirmed ? 'Confirmado' : 'Pendiente de pago'}
      </span>
    </div>
  )
}

const ChatThread = ({ id, rol, onChanged, onDeleted, onBack }: ChatThreadProps) => {
  const {
    conversacion,
    mensajes,
    hayMas,
    loading,
    notFound,
    error,
    sending,
    sendError,
    send,
    loadOlder,
    reload,
  } = useThread(id, onChanged)
  const [draft, setDraft] = useState('')
  const [agendaOpen, setAgendaOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastId = mensajes.at(-1)?.id

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [lastId])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    if (await send(text)) setDraft('')
  }

  const handleDelete = async () => {
    setConfirmingDelete(false)
    try {
      await conversacionesService.remove(id)
      if (rol === 'OWNER') {
        // The owner keeps the chat: it only empties, so stay here and refresh.
        await reload()
        onChanged()
      } else {
        onDeleted()
      }
    } catch (err) {
      setDeleteError(getAuthErrorMessage(err))
    }
  }

  if (notFound) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 bg-surface-bright p-8 text-center">
        <p className="text-sm text-on-surface-variant">No encontramos esta conversación.</p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl bg-primary-container px-4 py-2 text-sm font-bold text-on-primary"
        >
          Volver a mis mensajes
        </button>
      </section>
    )
  }

  if (!conversacion) {
    return (
      <section className="flex flex-1 items-center justify-center bg-surface-bright p-8 text-sm text-on-surface-variant">
        {loading ? 'Cargando la conversación...' : (error ?? '')}
      </section>
    )
  }

  const overLimit = draft.length > MAX_MENSAJE_LENGTH

  return (
    <section className="flex min-h-[740px] flex-1 flex-col bg-surface-bright">
      <div className="flex items-center justify-between gap-3 bg-surface-container-lowest px-4 py-3.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver a mis mensajes"
            className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container lg:hidden"
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              arrow_back
            </span>
          </button>
          <ChatAvatar
            nombre={chatTitle(conversacion, rol)}
            avatarUrl={rol === 'PLAYER' ? null : conversacion.otro.avatarUrl}
            className="h-11 w-11"
          />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-tight text-primary-container">
              {chatTitle(conversacion, rol)}
            </h2>
            <p className="truncate text-xs text-on-surface-variant">
              {chatSubtitle(conversacion, rol)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {rol === 'OWNER' && (
            <button
              type="button"
              onClick={() => setAgendaOpen((open) => !open)}
              aria-expanded={agendaOpen}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                agendaOpen
                  ? 'bg-primary-container text-on-primary'
                  : 'bg-secondary-container text-on-secondary-fixed hover:bg-secondary-fixed-dim'
              }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                calendar_month
              </span>
              <span className="hidden sm:inline">Ver agenda</span>
            </button>
          )}
          {conversacion.turno && !conversacion.turno.liberado && (
            <Link
              to={BOOKING_LINK[rol]}
              className="inline-flex items-center gap-1.5 rounded-xl bg-surface-container px-3 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[18px] text-secondary"
              >
                receipt_long
              </span>
              <span className="hidden sm:inline">Ver reserva</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={DELETE_COPY[rol].action}
            title={DELETE_COPY[rol].action}
            className="rounded-xl bg-surface-container p-2 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
              {rol === 'OWNER' ? 'delete_sweep' : 'delete'}
            </span>
          </button>
        </div>
      </div>

      {conversacion.turno && (
        <BookingBanner turno={conversacion.turno} cancha={conversacion.cancha.nombre} />
      )}

      {rol === 'OWNER' && agendaOpen && (
        <ChatAgendaPanel
          canchaId={conversacion.cancha.id}
          onOffer={(text) => setDraft((current) => (current ? `${current} ${text}` : text))}
        />
      )}

      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {hayMas && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={loadOlder}
              className="rounded-full bg-surface-container px-4 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high"
            >
              Ver mensajes anteriores
            </button>
          </div>
        )}

        {mensajes.length === 0 && (
          <p className="py-10 text-center text-sm text-on-surface-variant">
            Todavía no hay mensajes. Escribí el primero.
          </p>
        )}

        {mensajes.map((mensaje, index) => {
          const previous = mensajes[index - 1]
          const newDay =
            !previous || chatDayKey(previous.createdAt) !== chatDayKey(mensaje.createdAt)
          return (
            <div key={mensaje.id}>
              {newDay && (
                <div className="my-2 flex justify-center">
                  <span className="rounded-full bg-surface-container px-3 py-1 text-label-sm uppercase tracking-wider text-on-surface-variant">
                    {formatChatDay(mensaje.createdAt)}
                  </span>
                </div>
              )}
              <div className={`flex flex-col ${mensaje.propio ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words p-3.5 text-sm leading-relaxed md:max-w-[70%] ${
                    mensaje.propio
                      ? 'rounded-2xl rounded-tr-md bg-primary-container text-on-primary shadow-md'
                      : 'rounded-2xl rounded-tl-md bg-surface-container-lowest text-on-surface shadow-sm'
                  }`}
                >
                  {mensaje.cuerpo}
                  <p
                    className={`mt-1 text-right text-label-sm ${
                      mensaje.propio ? 'text-on-primary-container' : 'text-on-surface-variant'
                    }`}
                  >
                    {formatSlotTime(mensaje.createdAt)} hs
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-surface-container-lowest p-4 shadow-[0_-4px_16px_rgba(7,28,46,0.04)]"
      >
        {(sendError || deleteError || error) && (
          <p
            role="alert"
            className="mb-2 rounded-xl bg-error-container px-4 py-2 text-sm text-on-error-container"
          >
            {sendError ?? deleteError ?? error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escribí un mensaje..."
            aria-label="Mensaje"
            autoComplete="off"
            className="w-full rounded-full bg-surface-container px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary-container"
          />
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0 || overLimit}
            aria-label="Enviar mensaje"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary shadow-md transition-all hover:bg-secondary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
              send
            </span>
          </button>
        </div>
        <p
          className={`mt-2 px-2 text-[11px] ${overLimit ? 'font-semibold text-error' : 'text-on-surface-variant'}`}
        >
          {overLimit
            ? `El mensaje supera los ${MAX_MENSAJE_LENGTH} caracteres (${draft.length}).`
            : 'Enter para enviar'}
        </p>
      </form>

      <ConfirmDialog
        open={confirmingDelete}
        title={DELETE_COPY[rol].action}
        message={DELETE_COPY[rol].message}
        confirmLabel={DELETE_COPY[rol].confirm}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </section>
  )
}

export default ChatThread
