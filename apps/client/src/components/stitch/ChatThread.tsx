import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getAuthErrorMessage } from '../../pages/Auth/authError'
import { useThread } from '../../hooks/useThread'
import { conversacionesService } from '../../services/conversaciones.service'
import type { Role } from '../../types/auth'
import { MAX_MENSAJE_LENGTH, type Oferta, type TurnoBanner } from '../../types/conversaciones'
import { chatSubtitle, chatTitle } from '../../utils/chat'
import { chatDayKey, formatChatDay, formatSlotShortDate, formatSlotTime } from '../../utils/dates'
import { formatJugadores } from '../../utils/canchas'
import { formatPesos } from '../../utils/money'
import ConfirmDialog from '../common/ConfirmDialog'
import BookingDialog from '../common/BookingDialog'
import ChatAgendaPanel from './ChatAgendaPanel'
import ChatAvatar from './ChatAvatar'
import OfertaCard from './OfertaCard'

interface ChatThreadProps {
  id: string
  rol: Role
  /** The inbox should refresh its unread counters. */
  onChanged: () => void
  /** Small screens show one pane at a time: go back to the list. */
  onBack: () => void
}

const TYPING_SIGNAL_EVERY_MS = 2_500

const BOOKING_LINK: Record<Role, string> = { PLAYER: '/reservas', OWNER: '/dueno/reservas' }

// Nobody loses a chat by deleting it: for the player and for the owner alike, clearing only empties
// the content on their side, so an inquiry about a slot is not lost by accident.
const CLEAR_ACTION = 'Vaciar chat'
const CLEAR_CONFIRM = 'Sí, vaciar'
const clearMessage = (rol: Role): string =>
  `Se borran los mensajes de tu pantalla, pero el chat queda en tu bandeja. ${
    rol === 'PLAYER' ? 'El dueño' : 'El jugador'
  } conserva toda la conversación y, si te escribe de nuevo, vas a ver únicamente los mensajes nuevos.`

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

const ChatThread = ({ id, rol, onChanged, onBack }: ChatThreadProps) => {
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
    pulso,
  } = useThread(id, onChanged)
  const [draft, setDraft] = useState('')
  const [agendaOpen, setAgendaOpen] = useState(false)
  // The slot attached to the message being written (one per message), and the text that came with it.
  const [offer, setOffer] = useState<{ turnoId: string; label: string; text: string } | null>(null)
  // The offer the player is booking right now.
  const [booking, setBooking] = useState<Oferta | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastTypingSent = useRef(0)
  const lastId = mensajes.at(-1)?.id

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [lastId])

  const handleDraftChange = (value: string) => {
    setDraft(value)
    // Tell the other side that someone is typing, at most every couple of seconds.
    const now = Date.now()
    if (value.trim() && now - lastTypingSent.current > TYPING_SIGNAL_EVERY_MS) {
      lastTypingSent.current = now
      conversacionesService.typing(id).catch(() => undefined)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    if (await send(text, offer?.turnoId)) {
      setDraft('')
      setOffer(null)
    }
  }

  const handleOffer = (next: { turnoId: string; text: string; label: string }) => {
    // Keep what the owner already wrote; only a draft that is empty or was the previous ready
    // answer gets replaced by the one for this slot.
    setDraft((current) => (current === '' || current === offer?.text ? next.text : current))
    setOffer(next)
  }

  const handleDelete = async () => {
    setConfirmingDelete(false)
    try {
      await conversacionesService.remove(id)
      // The chat stays: it only empties, so stay here and refresh.
      await reload()
      onChanged()
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
  // The pulse is fresher than the header read, which only changes every few seconds.
  const conectado = pulso?.conectado ?? conversacion.otro.conectado
  const escribiendo = pulso?.escribiendo ?? false

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
            conectado={conectado}
          />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-tight text-primary-container">
              {chatTitle(conversacion, rol)}
            </h2>
            <p className="truncate text-xs text-on-surface-variant">
              {chatSubtitle(conversacion, rol)}
              {conversacion.cancha.jugadores
                ? ` · ${formatJugadores(conversacion.cancha.jugadores)}`
                : ''}{' '}
              ·{' '}
              {escribiendo ? (
                <span className="font-semibold italic text-secondary">Escribiendo...</span>
              ) : conectado ? (
                'Conectado'
              ) : (
                'No conectado'
              )}
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
            aria-label={CLEAR_ACTION}
            title={CLEAR_ACTION}
            className="rounded-xl bg-surface-container p-2 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
              delete_sweep
            </span>
          </button>
        </div>
      </div>

      {conversacion.turno && (
        <BookingBanner turno={conversacion.turno} cancha={conversacion.cancha.nombre} />
      )}

      {rol === 'OWNER' && agendaOpen && (
        <ChatAgendaPanel canchaId={conversacion.cancha.id} onOffer={handleOffer} />
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
                  {mensaje.oferta && (
                    <OfertaCard
                      oferta={mensaje.oferta}
                      propio={mensaje.propio}
                      onBook={setBooking}
                    />
                  )}
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
        {escribiendo && (
          <div className="flex flex-col items-start">
            <p
              role="status"
              className="animate-pulse rounded-2xl rounded-tl-md bg-surface-container-lowest px-4 py-2 text-sm italic text-on-surface-variant shadow-sm"
            >
              Escribiendo...
            </p>
          </div>
        )}
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
        {offer && (
          <p className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-secondary-fixed px-3 py-2 text-xs font-semibold text-on-secondary-container">
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                event_available
              </span>
              Se ofrece el turno del {offer.label}: el jugador va a ver un botón para reservarlo.
            </span>
            <button
              type="button"
              onClick={() => setOffer(null)}
              aria-label="Quitar el horario ofrecido"
              className="rounded-full p-1 hover:bg-secondary-container"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                close
              </span>
            </button>
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => handleDraftChange(event.target.value)}
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
        title={CLEAR_ACTION}
        message={clearMessage(rol)}
        confirmLabel={CLEAR_CONFIRM}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />

      {booking && (
        <BookingDialog
          cancha={booking.cancha}
          slot={{ id: booking.turnoId, fechaHoraInicio: booking.fechaHoraInicio }}
          fecha={chatDayKey(booking.fechaHoraInicio)}
          onClose={() => setBooking(null)}
          onSlotTaken={() => {
            // Somebody booked it first: close the dialog and show the offer as not available.
            setBooking(null)
            void reload()
          }}
        />
      )}
    </section>
  )
}

export default ChatThread
