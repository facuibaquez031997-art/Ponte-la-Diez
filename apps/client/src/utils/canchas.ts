/** "7 jugadores" for a court of 7, or nothing for a court that has no size yet. */
export const formatJugadores = (jugadores: number | null | undefined): string =>
  jugadores ? `${jugadores} jugadores` : ''
