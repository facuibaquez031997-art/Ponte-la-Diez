import type { ConvocatoriaTeam } from '../../types/convocatorias'

interface TeamListProps {
  team: ConvocatoriaTeam
}

const TeamList = ({ team }: TeamListProps) => {
  const freeSlots = Math.max(0, team.jugadoresFaltantes - team.aceptados.length)

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3">
      <span className="text-label-sm uppercase tracking-wider text-on-surface">
        Equipo · {team.aceptados.length}/{team.jugadoresFaltantes}
      </span>
      <ul className="flex flex-col gap-2">
        {team.aceptados.map((player) => (
          <li key={player.userId} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary-container">
              {player.avatarUrl ? (
                <img src={player.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-[18px] text-on-primary"
                >
                  person
                </span>
              )}
            </div>
            <span className="truncate text-sm font-semibold text-on-surface">{player.nombre}</span>
          </li>
        ))}
        {Array.from({ length: freeSlots }, (_, index) => (
          <li key={`free-${index}`} className="flex items-center gap-2 text-on-surface-variant">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-outline-variant">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                add
              </span>
            </div>
            <span className="text-sm">Lugar libre</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TeamList
