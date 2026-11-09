import { Link } from 'react-router-dom'
import type { Cancha } from '../../types/canchas'

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

interface CanchaCardProps {
  cancha: Cancha
  onEdit: (cancha: Cancha) => void
  onDelete: (cancha: Cancha) => void
}

const CanchaCard = ({ cancha, onEdit, onDelete }: CanchaCardProps) => (
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
