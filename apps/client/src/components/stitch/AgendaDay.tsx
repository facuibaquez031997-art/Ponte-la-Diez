import { Link } from 'react-router-dom'
import type { Agenda, AgendaCancha, AgendaTurno } from '../../types/agenda'
import { formatJugadores } from '../../utils/canchas'
import { formatSlotTime } from '../../utils/dates'
import { formatPesos } from '../../utils/money'

interface AgendaDayProps {
  agenda: Agenda
  /** Show only this court (the chat panel is about one court). */
  canchaId?: string
  /** Offered on free slots: lets the owner answer with that time. */
  onPickSlot?: (cancha: AgendaCancha['cancha'], turno: AgendaTurno) => void
  /** Smaller rows, for the panel inside the chat. */
  compact?: boolean
}

const slotChip = (turno: AgendaTurno): { label: string; className: string } => {
  const { reserva } = turno
  if (turno.estado === 'FREE') {
    return { label: 'Libre', className: 'bg-secondary-fixed text-on-secondary-container' }
  }
  if (turno.estado === 'BLOCKED') {
    return { label: 'Bloqueado', className: 'bg-surface-variant text-on-surface-variant' }
  }
  if (reserva?.estado === 'PENDING') {
    return { label: 'Esperando pago', className: 'bg-error-container text-on-error-container' }
  }
  return reserva && reserva.montoRestante === 0
    ? { label: 'Pagado', className: 'bg-secondary-container text-on-secondary-fixed' }
    : { label: 'Señado', className: 'bg-primary-container text-on-primary' }
}

const SlotDetail = ({ turno }: { turno: AgendaTurno }) => {
  const { reserva } = turno
  if (turno.estado === 'FREE') {
    return <span className="text-sm text-on-surface-variant">Disponible para reservar</span>
  }
  if (!reserva) {
    return <span className="text-sm text-on-surface-variant">No se puede reservar</span>
  }

  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-sm font-semibold text-on-surface">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-container text-[10px] font-bold text-on-primary"
        >
          {reserva.jugador.avatarUrl ? (
            <img src={reserva.jugador.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            reserva.jugador.nombre.slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="truncate">{reserva.jugador.nombre}</span>
      </p>
      <p className={`text-xs ${reserva.estado === 'PENDING' ? 'text-error' : 'text-secondary'}`}>
        {reserva.estado === 'PENDING'
          ? `Espera el pago${reserva.expiraEl ? ` · vence ${formatSlotTime(reserva.expiraEl)} hs` : ''}`
          : reserva.montoRestante === 0
            ? 'Pagó todo por Mercado Pago'
            : `Seña ${formatPesos(reserva.montoPagado)} · cobrás ${formatPesos(reserva.montoRestante)} en la cancha`}
      </p>
    </div>
  )
}

const AgendaDay = ({ agenda, canchaId, onPickSlot, compact = false }: AgendaDayProps) => {
  const canchas = agenda.canchas.filter((item) => !canchaId || item.cancha.id === canchaId)

  if (canchas.length === 0) {
    return (
      <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
        No hay canchas para mostrar. Cargá una desde "Mis canchas".
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {agenda.fueraDeVentana && (
        <p
          role="status"
          className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant"
        >
          Los turnos se generan con 14 días de anticipación: para esta fecha todavía no hay turnos
          armados, no es que la cancha esté cerrada.
        </p>
      )}

      {canchas.map(({ cancha, turnos }) => {
        const free = turnos.filter((turno) => turno.estado === 'FREE').length
        const booked = turnos.filter((turno) => turno.estado === 'RESERVED').length

        return (
          <section key={cancha.id} aria-label={cancha.nombre} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-headline-sm uppercase text-on-surface">
                {cancha.nombre}{' '}
                <span className="text-sm normal-case text-on-surface-variant">
                  · {cancha.tipoSuperficie}
                  {cancha.jugadores ? ` · ${formatJugadores(cancha.jugadores)}` : ''}
                </span>
              </h3>
              <span className="text-xs font-semibold text-secondary">
                {free} {free === 1 ? 'libre' : 'libres'} · {booked}{' '}
                {booked === 1 ? 'reservado' : 'reservados'}
              </span>
            </div>

            {turnos.length === 0 ? (
              <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                {agenda.fueraDeVentana
                  ? 'Sin turnos generados todavía.'
                  : 'No hay turnos ese día: la cancha no atiende ese día de la semana o ya pasó.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {turnos.map((turno) => {
                  const chip = slotChip(turno)
                  return (
                    <li
                      key={turno.id}
                      className={`flex flex-wrap items-center gap-3 rounded-xl bg-surface-container-low ${
                        compact ? 'p-2' : 'p-3'
                      }`}
                    >
                      <span className="w-16 shrink-0 font-display text-headline-sm text-on-surface">
                        {formatSlotTime(turno.fechaHoraInicio)}
                      </span>
                      {cancha.cantidad > 1 && (
                        <span className="shrink-0 rounded-full bg-surface-container px-2 py-1 text-label-sm uppercase text-on-surface-variant">
                          Cancha {turno.numero}
                        </span>
                      )}
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 font-display text-eyebrow-badge uppercase ${chip.className}`}
                      >
                        {chip.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <SlotDetail turno={turno} />
                      </div>
                      {turno.estado === 'FREE' && onPickSlot && (
                        <button
                          type="button"
                          onClick={() => onPickSlot(cancha, turno)}
                          className="shrink-0 rounded-xl bg-secondary-container px-3 py-2 text-xs font-semibold text-on-secondary-fixed transition-all hover:bg-secondary-fixed-dim active:scale-[0.98]"
                        >
                          Ofrecer este horario
                        </button>
                      )}
                      {turno.reserva?.conversacionId && !compact && (
                        <Link
                          to={`/mensajes/${turno.reserva.conversacionId}`}
                          className="flex shrink-0 items-center gap-1 rounded-xl bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface transition-all hover:bg-surface-container-high active:scale-[0.98]"
                        >
                          <span
                            aria-hidden="true"
                            className="material-symbols-outlined text-[16px]"
                          >
                            chat
                          </span>
                          Responder
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

export default AgendaDay
