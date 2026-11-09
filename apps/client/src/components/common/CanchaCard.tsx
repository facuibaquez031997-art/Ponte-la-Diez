import { Link } from 'react-router-dom'
import type { Cancha, Franja } from '../../types/canchas'
import { summarizeWeek } from './scheduleModel'

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

interface CanchaCardProps {
  cancha: Cancha
  // undefined while the schedule is still loading
  horarios?: Franja[]
  onEdit: (cancha: Cancha) => void
  onDelete: (cancha: Cancha) => void
}

const CanchaCard = ({ cancha, horarios, onEdit, onDelete }: CanchaCardProps) => (
  <li className="flex flex-col gap-4 rounded-3xl bg-surface-container-lowest p-6 shadow-sm">
    <div className="flex flex-col gap-1">
      <h3 className="font-display text-headline-md uppercase tracking-wide text-on-surface">
        {cancha.nombre}
      </h3>
      <p className="text-sm text-on-surface-variant">
        {cancha.tipoSuperficie} · {cancha.barrio}
      </p>
      <p className="text-sm text-on-surface-variant">{cancha.direccion}</p>
    </div>

    <dl className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-surface-container-low p-3">
        <dt className="text-label-sm uppercase tracking-wider text-on-surface-variant">
          Turno de 1 hora
        </dt>
        <dd className="font-display text-headline-sm text-on-surface">
          {money.format(cancha.precioHora)}
        </dd>
      </div>
      <div className="rounded-2xl bg-surface-container-low p-3">
        <dt className="text-label-sm uppercase tracking-wider text-on-surface-variant">Seña</dt>
        <dd className="font-display text-headline-sm text-on-surface">
          {money.format(cancha.montoSena)}
        </dd>
      </div>
    </dl>

    <section aria-label={`Horarios de ${cancha.nombre}`} className="flex flex-col gap-2">
      <h4 className="text-label-sm uppercase tracking-wider text-on-surface-variant">Horarios</h4>
      {horarios === undefined ? (
        <p className="text-sm text-on-surface-variant">Cargando horarios...</p>
      ) : horarios.length === 0 ? (
        <p className="rounded-2xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
          Sin horarios: todavía no se ofrecen turnos.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {summarizeWeek(horarios).map(({ dia, name, text }) => (
            <li key={dia} className="flex justify-between gap-3">
              <span className="text-on-surface-variant">{name}</span>
              <span
                className={
                  text === 'Cerrado' ? 'text-on-surface-variant' : 'font-semibold text-on-surface'
                }
              >
                {text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>

    <Link
      to={`/dueno/canchas/${cancha.id}/horarios`}
      className="flex items-center justify-between rounded-xl bg-primary-container px-4 py-3 text-sm font-bold uppercase tracking-wide text-on-primary transition-all hover:opacity-90"
    >
      Configurar turnos
      <span aria-hidden="true" className="material-symbols-outlined text-xl">
        arrow_forward
      </span>
    </Link>

    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onEdit(cancha)}
        className="flex-1 rounded-xl bg-surface-container py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
      >
        Editar
      </button>
      <button
        type="button"
        onClick={() => onDelete(cancha)}
        className="flex-1 rounded-xl bg-error-container py-2.5 text-sm font-semibold text-on-error-container transition-opacity hover:opacity-90"
      >
        Borrar
      </button>
    </div>
  </li>
)

export default CanchaCard
